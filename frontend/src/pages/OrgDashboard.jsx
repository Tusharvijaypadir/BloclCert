import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { ethers } from "ethers";
import { getProvider, getContract } from "../utils/contract.js";

// ─── Utility ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Anti-screenshot Secure Viewer ───────────────────────────────────────────
function SecureViewer({ cid, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    // Block key combos: PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5
    const block = (e) => {
      if (e.key === 'PrintScreen' || (e.shiftKey && e.key === 'S' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        alert('Screenshots are disabled on this secure view.');
      }
    };
    document.addEventListener('keydown', block);

    // Blur/hide on focus loss (tab switch)
    const onBlur = () => { if (ref.current) ref.current.style.filter = 'blur(20px)'; };
    const onFocus = () => { if (ref.current) ref.current.style.filter = 'none'; };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('keydown', block);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Secure Viewing Mode</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm border border-gray-700 px-3 py-1 rounded-lg">Close</button>
        </div>

        {/* The protected content area */}
        <div
          ref={ref}
          className="relative"
          onContextMenu={e => e.preventDefault()}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          <div
            className="absolute inset-0 z-10 select-none pointer-events-none"
            style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 80px)' }}
          />
          <iframe
            src={`${ipfsUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-[70vh] bg-white"
            title="Secure Certificate Viewer"
            sandbox="allow-scripts allow-same-origin"
            style={{ pointerEvents: 'none' }}
          />
        </div>
        <div className="p-3 text-center text-xs text-gray-600 bg-gray-950">
          🔒 Screenshot, download, and copy are disabled. This view is logged.
        </div>
      </div>
    </div>
  );
}

// ─── QR Scanner ──────────────────────────────────────────────────────────────
function QrScanner({ onResult }) {
  const scannerRef = useRef(null);
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-scan-region', { fps: 10, qrbox: 250 }, false);
    scanner.render(
      (decoded) => { scanner.clear(); onResult(decoded); },
      (err) => {}
    );
    scannerRef.current = scanner;
    return () => scanner.clear().catch(() => {});
  }, []);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      <h3 className="text-lg font-bold text-white mb-4">📷 Scan Student QR Code</h3>
      <p className="text-sm text-gray-400 mb-4">Point your camera at the student's profile QR code. You'll be taken to their public certificate count page.</p>
      <div id="qr-scan-region" className="rounded-xl overflow-hidden" />
    </div>
  );
}

// ─── Candidate Profile (after QR scan) ───────────────────────────────────────
function CandidateView({ wallet, orgToken, onBack }) {
  const [certCount, setCertCount] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function fetchCount() {
      try {
        const provider = getProvider();
        const contract = getContract(provider);
        const count = await contract.studentCertCount(wallet);
        setCertCount(Number(count));
      } catch { setCertCount('?'); }
    }
    fetchCount();
  }, [wallet]);

  const sendRequest = async () => {
    setRequesting(true);
    try {
      const res = await fetch('http://localhost:3001/api/submission/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${orgToken}` },
        body: JSON.stringify({ studentWallet: wallet, requestedCerts: ['all'], mode: 'FULL' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } finally { setRequesting(false); }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center max-w-md mx-auto">
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-white mb-6 block text-left">← Back</button>
      <div className="text-5xl mb-4">👤</div>
      <h2 className="text-xl font-bold text-white mb-1">Candidate Profile</h2>
      <p className="text-xs font-mono text-gray-500 break-all mb-6">{wallet}</p>

      <div className="bg-gray-950 rounded-xl border border-gray-800 p-6 mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Blockchain-Verified Certificates</p>
        <p className="text-5xl font-bold text-blue-400">{certCount === null ? '…' : certCount}</p>
      </div>

      {done ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl">
          ✅ Request sent! Expires in 7 days. The student will see this in their inbox.
        </div>
      ) : (
        <button onClick={sendRequest} disabled={requesting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all">
          {requesting ? 'Sending…' : 'Request Full Certificate Access'}
        </button>
      )}
    </div>
  );
}

// ─── Vault (received fulfillments) ───────────────────────────────────────────
function VaultBlock({ orgToken }) {
  const [vault, setVault] = useState([]);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { fetchVault(); }, []);

  async function fetchVault() {
    try {
      const r = await fetch('http://localhost:3001/api/submission/vault', {
        headers: { Authorization: `Bearer ${orgToken}` }
      });
      const d = await r.json();
      setVault(d.vault || []);
    } catch (e) { console.error(e); }
  }

  async function openItem(item) {
    // Log read receipt
    await fetch('http://localhost:3001/api/submission/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${orgToken}` },
      body: JSON.stringify({ fulfillId: item.id })
    });
    setViewing(item);
    fetchVault();
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      {viewing && (
        <SecureViewer cid={viewing.ipfsCids?.[0] || ''} onClose={() => { setViewing(null); fetchVault(); }} />
      )}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">📦 Received Vault</h3>
        <button onClick={fetchVault} className="text-xs text-gray-500 hover:text-white border border-gray-700 px-3 py-1 rounded-lg">Refresh</button>
      </div>
      {vault.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-8">No fulfilled requests yet. Scan a student QR to send a request.</p>
      ) : (
        <div className="space-y-3">
          {vault.map(item => (
            <div key={item.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-gray-200 font-mono">{item.studentWallet?.slice(0, 10)}…</p>
                <p className="text-xs text-gray-500">{timeAgo(item.fulfilledAt)} · {item.tokenIds?.length || 0} token(s)</p>
                {item.viewed && <p className="text-xs text-emerald-500 mt-1">✅ Viewed {timeAgo(item.viewedAt)}</p>}
              </div>
              <button onClick={() => openItem(item)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold shrink-0">
                {item.viewed ? 'View Again' : 'Open Securely'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HR History ───────────────────────────────────────────────────────────────
function HrHistoryBlock({ orgToken }) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    fetch('http://localhost:3001/api/submission/hr-history', {
      headers: { Authorization: `Bearer ${orgToken}` }
    }).then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {});
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4">📋 My Request History</h3>
      {history.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">No requests sent yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map(r => (
            <div key={r.id} className="flex justify-between items-center bg-gray-950 rounded-xl border border-gray-800 p-3">
              <div>
                <p className="text-sm text-gray-200 font-mono">{r.studentWallet?.slice(0, 14)}…</p>
                <p className="text-xs text-gray-500">{timeAgo(r.createdAt)}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.expired ? 'bg-gray-700 text-gray-400' : r.status === 'FULFILLED' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'DENIED' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {r.expired && r.status === 'PENDING' ? 'EXPIRED' : r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function OrgDashboard() {
  const orgToken = localStorage.getItem('bc_org_token');
  const [tab, setTab] = useState('vault'); // 'vault' | 'scan'
  const [scannedWallet, setScannedWallet] = useState(null);

  function handleScan(url) {
    // URL format: http://.../#/org/candidate/0xABC...
    const match = url.match(/candidate\/(0x[a-fA-F0-9]{40})/);
    if (match) setScannedWallet(match[1]);
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex justify-between items-end border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white font-['Space_Grotesk']">HR Dashboard</h1>
          <p className="text-emerald-500 text-sm mt-1">tusharvijaypadir@gmail.com</p>
        </div>
        <div className="flex gap-2">
          {['vault', 'scan'].map(t => (
            <button key={t} onClick={() => { setTab(t); setScannedWallet(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'}`}>
              {t === 'vault' ? '📦 Received Vault' : '📷 Scan QR'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'vault' && (
        <>
          <VaultBlock orgToken={orgToken} />
          <HrHistoryBlock orgToken={orgToken} />
        </>
      )}

      {tab === 'scan' && (
        scannedWallet
          ? <CandidateView wallet={scannedWallet} orgToken={orgToken} onBack={() => setScannedWallet(null)} />
          : <QrScanner onResult={handleScan} />
      )}
    </div>
  );
}
