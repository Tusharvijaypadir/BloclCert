import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { useWallet } from "../App.jsx";
import { getProvider, getContract } from "../utils/contract.js";
import { ethers } from "ethers";

// ─── Utility ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function daysLeft(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProfileBlock({ wallet, certCount }) {
  const qrValue = `${window.location.origin}/org/candidate/${wallet}`;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-8">
      <div className="bg-white p-4 rounded-xl shadow-lg flex-shrink-0">
        <QRCode value={qrValue} size={140} />
      </div>
      <div className="flex-grow">
        <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mb-1">My Profile</h2>
        <p className="text-xs font-mono text-gray-500 mb-4 break-all">{wallet}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Blockchain Certs</p>
            <p className="text-3xl font-bold text-blue-400">{certCount}</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cert Limit</p>
            <p className="text-3xl font-bold text-gray-400">10</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-4">HR can scan this QR code to view your verified certificate count and send you a data request.</p>
      </div>
    </div>
  );
}

function InboxBlock({ wallet, credentials }) {
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchInbox(); }, [wallet]);

  async function fetchInbox() {
    try {
      const r = await fetch(`http://localhost:3001/api/submission/inbox/${wallet}`);
      const d = await r.json();
      setInbox(d.inbox || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleAction(requestId, action, tokenIds) {
    const body = { requestId, action, tokenIds, ipfsCids: [] };
    await fetch('http://localhost:3001/api/submission/fulfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    fetchInbox();
  }

  if (loading) return <div className="text-gray-600 text-sm py-4 text-center">Loading inbox…</div>;

  const active = inbox.filter(r => r.status === 'PENDING' && !r.expired);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        📥 Incoming HR Requests
        {active.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{active.length}</span>}
      </h3>
      {inbox.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">No requests yet.</p>
      ) : (
        <div className="space-y-3">
          {inbox.map(req => (
            <div key={req.id} className={`bg-gray-950 rounded-xl p-4 border ${req.expired ? 'border-gray-800 opacity-50' : req.status === 'PENDING' ? 'border-amber-500/40' : req.status === 'FULFILLED' ? 'border-emerald-500/40' : 'border-red-500/30'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-200">{req.hrEmail}</p>
                  <p className="text-xs text-gray-500">{timeAgo(req.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${req.expired ? 'bg-gray-700 text-gray-400' : req.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : req.status === 'FULFILLED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {req.expired ? 'EXPIRED' : req.status}
                  </span>
                  {!req.expired && req.status === 'PENDING' && (
                    <span className="text-xs text-gray-500">{daysLeft(req.expiresAt)}d left</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">Requesting: {Array.isArray(req.requestedCerts) ? req.requestedCerts.join(', ') : req.requestedCerts} · Mode: <span className="text-blue-400">{req.mode}</span></p>
              {req.status === 'PENDING' && !req.expired && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req.id, 'deny')} className="flex-1 py-2 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg">Deny</button>
                  <button onClick={() => handleAction(req.id, 'approve', credentials.map(c => c.tokenId))} className="flex-1 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold">Approve & Send</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryBlock({ wallet }) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    fetch(`http://localhost:3001/api/submission/history/${wallet}`)
      .then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {});
  }, [wallet]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4">👁️ Viewed History</h3>
      {history.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">No one has viewed your certificates yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-gray-800">
              <div>
                <p className="text-sm text-gray-200">{h.hrEmail}</p>
                <p className="text-xs text-gray-500">opened your documents</p>
              </div>
              <span className="text-xs text-gray-500 font-mono">{timeAgo(h.viewedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CertsBlock({ credentials, onRefresh }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">📜 My Certificates</h3>
        <button onClick={onRefresh} className="text-xs text-gray-500 hover:text-white border border-gray-700 px-3 py-1 rounded-lg">Refresh</button>
      </div>
      {credentials.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">No blockchain certificates yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {credentials.map(c => (
            <div key={c.tokenId} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">🎓</div>
              <p className="font-medium text-gray-200 text-sm">{c.title || 'Credential'}</p>
              <p className="text-xs font-mono text-gray-500 mt-1">Token #{c.tokenId}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function StudentDashboard({ isDemoMode }) {
  const { wallet } = useWallet();
  const [certCount, setCertCount] = useState(0);
  const [credentials, setCredentials] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { if (wallet) loadCredentials(); }, [wallet]);

  async function loadCredentials() {
    try {
      const provider = getProvider();
      const contract = getContract(provider);
      const count = await contract.studentCertCount(wallet);
      setCertCount(Number(count));

      const filter = contract.filters.CredentialMinted(null, wallet);
      const currentBlock = await provider.getBlockNumber();
      let events = [];
      try {
        events = await contract.queryFilter(filter, Math.max(0, currentBlock - 1000), 'latest');
      } catch {
        events = await contract.queryFilter(filter, Math.max(0, currentBlock - 50), 'latest');
      }
      const list = await Promise.all(events.map(async ev => {
        const tokenId = ev.args.tokenId.toString();
        try {
          const [ipnsPointer] = await contract.getCredential(tokenId);
          let title = 'Academic Credential';
          if (ipnsPointer?.startsWith('demo://')) {
            const stored = localStorage.getItem(`blockcert_credential_${ipnsPointer.replace('demo://local-', '')}`);
            if (stored) title = JSON.parse(stored).degree || title;
          }
          return { tokenId, title };
        } catch { return null; }
      }));
      setCredentials(list.filter(Boolean));
    } catch (err) {
      setLoadError(err.message);
    }
  }

  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h2>
        <p className="text-gray-500 text-sm">Connect your MetaMask wallet to see your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {loadError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl">{loadError}</div>
      )}
      <ProfileBlock wallet={wallet} certCount={certCount} />
      <div className="grid md:grid-cols-2 gap-6">
        <InboxBlock wallet={wallet} credentials={credentials} />
        <HistoryBlock wallet={wallet} />
      </div>
      <CertsBlock credentials={credentials} onRefresh={loadCredentials} />
    </div>
  );
}
