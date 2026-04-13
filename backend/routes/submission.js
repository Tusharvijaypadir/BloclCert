const express = require('express');
const router = express.Router();
const orgAuth = require('../middleware/orgAuth');

// NOTE: In-memory maps. Resets on server restart. Production requires a database.
const dataRequests = new Map();   // HR → Student requests
const fulfillments = new Map();   // Student → HR fulfillments
const viewReceipts = new Map();   // When HR opens a fulfillment

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function isExpired(createdAt) {
  return Date.now() - new Date(createdAt).getTime() > ONE_WEEK_MS;
}

// ─── HR sends a request to a student ─────────────────────────────────────────
// POST /api/submission/request
// Body: { studentWallet, hrEmail, requestedCerts: ['all' | tokenId[]], mode: 'FULL' | 'ZKP' }
router.post('/request', orgAuth, (req, res) => {
  const { studentWallet, hrEmail, requestedCerts, mode } = req.body;
  if (!studentWallet) return res.status(400).json({ error: 'studentWallet required' });

  const id = makeId();
  const record = {
    id,
    studentWallet,
    hrEmail: hrEmail || req.user.email,
    requestedCerts: requestedCerts || ['all'],
    mode: mode || 'FULL',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ONE_WEEK_MS).toISOString(),
  };
  dataRequests.set(id, record);
  return res.json({ requestId: id, expiresAt: record.expiresAt });
});

// ─── Student fetches their pending inbox ──────────────────────────────────────
// GET /api/submission/inbox/:wallet
router.get('/inbox/:wallet', (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const inbox = Array.from(dataRequests.values())
    .filter(r => r.studentWallet.toLowerCase() === wallet)
    .map(r => ({ ...r, expired: isExpired(r.createdAt) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ inbox });
});

// ─── Student fulfills/denies a request ───────────────────────────────────────
// POST /api/submission/fulfill
// Body: { requestId, action: 'approve' | 'deny', tokenIds: [], ipfsCids: [] }
router.post('/fulfill', (req, res) => {
  const { requestId, action, tokenIds, ipfsCids } = req.body;
  const request = dataRequests.get(requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (isExpired(request.createdAt)) {
    request.status = 'EXPIRED';
    dataRequests.set(requestId, request);
    return res.status(410).json({ error: 'This HR request has expired (7-day window closed)' });
  }

  if (action === 'deny') {
    request.status = 'DENIED';
    dataRequests.set(requestId, request);
    return res.json({ message: 'Request denied' });
  }

  const fulfillId = makeId();
  fulfillments.set(fulfillId, {
    id: fulfillId,
    requestId,
    studentWallet: request.studentWallet,
    hrEmail: request.hrEmail,
    tokenIds: tokenIds || [],
    ipfsCids: ipfsCids || [],
    mode: request.mode,
    fulfilledAt: new Date().toISOString(),
    viewed: false,
  });

  request.status = 'FULFILLED';
  request.fulfillId = fulfillId;
  dataRequests.set(requestId, request);

  return res.json({ fulfillId, message: 'Credentials sent to HR' });
});

// ─── HR fetches their received vault ─────────────────────────────────────────
// GET /api/submission/vault
router.get('/vault', orgAuth, (req, res) => {
  const hrEmail = req.user.email;
  const vault = Array.from(fulfillments.values())
    .filter(f => f.hrEmail === hrEmail)
    .sort((a, b) => new Date(b.fulfilledAt) - new Date(a.fulfilledAt));
  return res.json({ vault });
});

// ─── HR marks a fulfillment as viewed (read receipt) ─────────────────────────
// POST /api/submission/view
// Body: { fulfillId }
router.post('/view', orgAuth, (req, res) => {
  const f = fulfillments.get(req.body.fulfillId);
  if (!f) return res.status(404).json({ error: 'Not found' });

  if (!f.viewed) {
    f.viewed = true;
    f.viewedAt = new Date().toISOString();
    fulfillments.set(f.id, f);

    // Write receipt back so student can see it
    const receipts = viewReceipts.get(f.studentWallet) || [];
    receipts.push({ hrEmail: f.hrEmail, fulfillId: f.id, viewedAt: f.viewedAt });
    viewReceipts.set(f.studentWallet, receipts);
  }
  return res.json({ message: 'Marked as viewed', viewedAt: f.viewedAt });
});

// ─── Student fetches their HR view history ────────────────────────────────────
// GET /api/submission/history/:wallet
router.get('/history/:wallet', (req, res) => {
  const receipts = viewReceipts.get(req.params.wallet) || [];
  return res.json({ history: receipts.reverse() });
});

// ─── HR fetches their sent-requests history ───────────────────────────────────
// GET /api/submission/hr-history (protected)
router.get('/hr-history', orgAuth, (req, res) => {
  const hrEmail = req.user.email;
  const history = Array.from(dataRequests.values())
    .filter(r => r.hrEmail === hrEmail)
    .map(r => ({ ...r, expired: isExpired(r.createdAt) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ history });
});

// ─── Candidate public profile (for HR after scanning QR) ─────────────────────
// GET /api/submission/candidate/:wallet  (no auth — public facing)
router.get('/candidate/:wallet', (req, res) => {
  // Returns only safe public info — cert count comes from the chain, not here
  const wallet = req.params.wallet;
  return res.json({ wallet, message: 'Fetch cert count from smart contract directly' });
});

module.exports = router; module.exports.dataRequests = dataRequests; module.exports.fulfillments = fulfillments;
