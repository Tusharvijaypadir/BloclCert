import { useState, useEffect } from "react";
import { useWallet } from "../App.jsx";
import { getProvider, getContract } from "../utils/contract.js";
import { ethers } from "ethers";

export default function StudentSubmitPage({ isDemoMode }) {
  const { wallet } = useWallet();
  const [credentials, setCredentials] = useState([]);
  const [selectedCred, setSelectedCred] = useState(null);
  const [disclosureMode, setDisclosureMode] = useState(null); // 'FULL' or 'ZKP'
  const [claims, setClaims] = useState({ degree: true, institution: true, year: true, cgpa: false });
  const [cgpaThreshold, setCgpaThreshold] = useState(7.0);
  const [hrEmail, setHrEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wallet) loadCredentials();
  }, [wallet]);

  async function loadCredentials() {
    try {
      const provider = getProvider();
      const contract = getContract(provider);
      const filter = contract.filters.CredentialMinted(null, wallet);
      const currentBlock = await provider.getBlockNumber();
      
      let events = [];
      try {
        events = await contract.queryFilter(filter, Math.max(0, currentBlock - 500), "latest");
      } catch (e) {
        events = await contract.queryFilter(filter, Math.max(0, currentBlock - 50), "latest");
      }

      const credList = await Promise.all(
        events.map(async (event) => {
          const tokenId = event.args.tokenId;
          const [ipnsPointer] = await contract.getCredential(tokenId);
          if (!ipnsPointer) return null;
          
          let title = "Academic Credential";
          if (ipnsPointer.startsWith("demo://")) {
            const data = localStorage.getItem(`blockcert_credential_${ipnsPointer.replace("demo://local-", "")}`);
            if (data) title = JSON.parse(data).degree;
          }
          return { tokenId: tokenId.toString(), ipnsPointer, title };
        })
      );
      setCredentials(credList.filter(Boolean));
    } catch (err) {
      console.error(err);
    }
  }

  const handleSubmit = async () => {
    if (!hrEmail) return setStatus("Error: HR Email is required");
    setLoading(true);
    setStatus("");

    try {
      const payload = {
        tokenId: selectedCred.tokenId,
        walletAddress: wallet,
        disclosureMode,
        hrEmail,
        ipnsPointer: selectedCred.ipnsPointer,
        selectedClaims: disclosureMode === 'ZKP' ? Object.keys(claims).filter(k => claims[k]) : [],
        cgpaThreshold: disclosureMode === 'ZKP' && claims.cgpa ? cgpaThreshold : null
      };

      const res = await fetch("http://localhost:3001/api/submission/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus(`Success! Submission ID: ${data.submissionId}`);
      setSelectedCred(null);
      setDisclosureMode(null);
    } catch (e) {
      setStatus(`Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold gradient-text mb-2">Submit to HR</h1>
      <p className="text-gray-400 mb-8">Securely share your verified credentials with employers.</p>

      {status && (
        <div className={`mb-6 p-4 rounded-lg font-medium border ${status.includes("Error") || status.includes("Failed") ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          {status}
        </div>
      )}

      {/* STEP 1 */}
      <h2 className="text-xl font-semibold text-white mb-4">1. Select Credential</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {credentials.length === 0 ? <p className="text-gray-500 text-sm">No credentials found in your wallet.</p> : null}
        {credentials.map(c => (
          <div 
            key={c.tokenId} 
            onClick={() => setSelectedCred(c)}
            className={`cursor-pointer p-5 rounded-xl border transition-all ${selectedCred?.tokenId === c.tokenId ? 'bg-blue-600/10 border-blue-500' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
          >
            <div className="text-2xl mb-2">📜</div>
            <h3 className="font-medium text-gray-200">{c.title}</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">Token ID: {c.tokenId}</p>
          </div>
        ))}
      </div>

      {selectedCred && (
        <div className="animate-fade-in">
          {/* STEP 2 */}
          <h2 className="text-xl font-semibold text-white mb-4">2. Choose Disclosure Mode</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div 
              onClick={() => setDisclosureMode("FULL")}
              className={`cursor-pointer p-5 rounded-xl border transition-all ${disclosureMode === 'FULL' ? 'bg-blue-600/10 border-blue-500' : 'bg-gray-900 border-gray-800'}`}
            >
              <div className="text-2xl mb-2">📄</div>
              <h3 className="font-medium text-gray-200">Share Full Document</h3>
              <p className="text-xs text-gray-500 mt-1">HR will see your complete credential.</p>
            </div>
            
            <div 
              onClick={() => setDisclosureMode("ZKP")}
              className={`cursor-pointer p-5 rounded-xl border transition-all ${disclosureMode === 'ZKP' ? 'bg-emerald-600/10 border-emerald-500' : 'bg-gray-900 border-gray-800'}`}
            >
              <div className="text-2xl mb-2">🛡️</div>
              <h3 className="font-medium text-gray-200">Share Verified Claims Only</h3>
              <p className="text-xs text-gray-500 mt-1">ZKP Mode: HR sees only what you explicitly disclose.</p>
            </div>
          </div>

          {/* STEP 3 */}
          {disclosureMode === 'ZKP' && (
            <div className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl animate-fade-in">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Select Claims to Verify</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 text-gray-300">
                  <input type="checkbox" checked={claims.degree} onChange={e => setClaims({...claims, degree: e.target.checked})} className="accent-emerald-500 w-4 h-4"/> Degree Name
                </label>
                <label className="flex items-center gap-3 text-gray-300">
                  <input type="checkbox" checked={claims.institution} onChange={e => setClaims({...claims, institution: e.target.checked})} className="accent-emerald-500 w-4 h-4"/> Institution Name
                </label>
                <label className="flex items-center gap-3 text-gray-300">
                  <input type="checkbox" checked={claims.year} onChange={e => setClaims({...claims, year: e.target.checked})} className="accent-emerald-500 w-4 h-4"/> Graduation Year
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 text-gray-300">
                    <input type="checkbox" checked={claims.cgpa} onChange={e => setClaims({...claims, cgpa: e.target.checked})} className="accent-emerald-500 w-4 h-4"/> CGPA meets threshold:
                  </label>
                  {claims.cgpa && (
                    <input type="number" step="0.1" value={cgpaThreshold} onChange={e => setCgpaThreshold(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-20 text-sm outline-none text-white focus:border-emerald-500"/>
                  )}
                </div>
              </div>
              <p className="text-xs text-emerald-500 mt-4 font-mono bg-emerald-500/10 p-2 rounded">
                * ZKP-style claim (prototype — Polygon ID circuit integration planned for Phase 2b)
              </p>
            </div>
          )}

          {/* STEP 4 & 5 */}
          {disclosureMode && (
            <div className="mb-8 animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4">3. Finalize & Submit</h2>
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                <input 
                  type="email" 
                  placeholder="HR Reviewer Email" 
                  value={hrEmail}
                  onChange={e => setHrEmail(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-colors mb-6"
                />
                
                <button 
                  onClick={handleSubmit} 
                  disabled={loading || !hrEmail}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                  {loading ? "Transmitting..." : "Send Securely to HR"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
