import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "../App.jsx";
import { getProvider, getContract, formatAddress } from "../utils/contract.js";
import CredentialCard from "./CredentialCard.jsx";

const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "";

async function fetchMetadata(ipnsPointer) {
  if (ipnsPointer.startsWith("demo://")) {
    const timestamp = ipnsPointer.replace("demo://local-", "");
    const key = `blockcert_credential_${timestamp}`;
    const data = localStorage.getItem(key);
    if (!data) throw new Error("Demo credential not found in local storage");
    return JSON.parse(data);
  }

  const cid = ipnsPointer.replace("ipfs://", "");
  const url = `${PINATA_GATEWAY.replace(/\/$/, "")}/ipfs/${cid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return res.json();
}

export default function StudentDashboard({ isDemoMode }) {
  const { wallet, connect } = useWallet();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revealedQR, setRevealedQR] = useState(null);

  useEffect(() => {
    if (wallet) loadCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  async function loadCredentials() {
    setLoading(true);
    setError("");
    setCredentials([]);
    try {
      const provider = getProvider();
      const contract = getContract(provider);

      // Get all CredentialMinted events where student === wallet
      const filter = contract.filters.CredentialMinted(null, wallet);
      const events = await contract.queryFilter(filter, 0, "latest");

      const credList = await Promise.all(
        events.map(async (event) => {
          const tokenId = event.args.tokenId;
          try {
            const [ipnsPointer, revoked, issuer, student] =
              await contract.getCredential(tokenId);

            let metadata = null;
            if (ipnsPointer) {
              if (ipnsPointer.startsWith("demo://") || PINATA_GATEWAY) {
                try {
                  metadata = await fetchMetadata(ipnsPointer);
                } catch {
                  // metadata fetch failure is non-fatal
                }
              }
            }

            return { tokenId: tokenId.toString(), ipnsPointer, revoked, issuer, student, metadata };
          } catch {
            return null;
          }
        })
      );

      setCredentials(credList.filter(Boolean));
    } catch (err) {
      if (
        err.message &&
        (err.message.includes("Contract address not configured") ||
          err.message.includes("Contract not deployed"))
      ) {
        // Not an error — just not deployed yet, show empty state below
        setCredentials([]);
      } else {
        setError(err.message || "Failed to load credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-6 text-3xl">
          🎓
        </div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Student Dashboard</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          Connect your MetaMask wallet to view your academic credentials issued as Soulbound Tokens.
        </p>
        <button
          onClick={connect}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/30"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">My Credentials</h1>
          <p className="text-gray-400 text-sm mt-1">
            Wallet: <span className="font-mono text-gray-300">{formatAddress(wallet)}</span>
          </p>
        </div>
        <button
          onClick={loadCredentials}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-all border border-gray-700"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400 text-sm">Fetching credentials from blockchain…</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-6 text-center animate-fade-in">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      )}

      {!loading && !error && credentials.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 text-3xl">
            📭
          </div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Credentials Found</h3>
          <p className="text-gray-500 text-sm max-w-sm">
            No academic credentials have been issued to this wallet address yet.
            Ask your institution to mint a credential for you.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {credentials.map((cred) => (
          <CredentialCard
            key={cred.tokenId}
            credential={cred}
            revealedQR={revealedQR}
            onToggleQR={(id) => setRevealedQR(revealedQR === id ? null : id)}
            wallet={wallet}
            isDemoMode={isDemoMode}
          />
        ))}
      </div>
    </div>
  );
}
