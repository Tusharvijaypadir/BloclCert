import { useState } from "react";
import { getProvider, getContract } from "../utils/contract.js";

export default function TamperReport({ analysis, studentWallet, isDemoMode, onReset }) {
  const [fields, setFields] = useState(analysis.extractedFields);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState("");

  const handleMint = async () => {
    setMinting(true);
    setStatus("");
    try {
      const payload = {
         metadata: {
           studentName: fields.studentName.value,
           degree: fields.degree.value,
           institution: fields.institution.value,
           graduationYear: fields.graduationYear.value,
           cgpa: fields.cgpa.value,
           certificateId: fields.certificateId.value,
           tamperStatus: analysis.tamperAnalysis.overallStatus,
           verificationMethod: "Tesseract OCR + Metadata Analysis",
           reviewedBy: "Institution Admin"
         },
         isDemoMode
      };

      const res = await fetch("http://localhost:3001/api/upload-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Now map to Smart Contract natively
      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      const tx = await contract.mintSBT(studentWallet, data.primaryCID || data.backupCID);
      await tx.wait();

      setStatus("SUCCESS");
    } catch (e) {
      setStatus(`Failed: ${e.message}`);
      setMinting(false);
    }
  };

  if (status === "SUCCESS") {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 animate-fade-in">
        <div className="text-6xl mb-6">✅</div>
        <h2 className="text-2xl font-bold text-white mb-2">Credential Successfully Sealed</h2>
        <p className="text-gray-400 mb-8">Tamper status applied natively: {analysis.tamperAnalysis.overallStatus}</p>
        <button onClick={onReset} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg">Upload Another</button>
      </div>
    );
  }

  const { overallStatus, advisoryNote, checks } = analysis.tamperAnalysis;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* BANNER */}
      <div className={`p-4 rounded-xl border mb-8 flex gap-3 ${overallStatus === 'CLEAN' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : overallStatus === 'SUSPICIOUS' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'}`}>
        <div className="text-xl">⚠️</div>
        <div>
          <h3 className="font-bold">Status: {overallStatus}</h3>
          <p className="text-sm opacity-90">{advisoryNote}</p>
          {analysis.requiresManualReview && <p className="text-sm font-semibold mt-1">Manual review inherently required due to low Tesseract OCR confidence bounds.</p>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
        <h3 className="text-xl font-bold text-white mb-6">Review Extracted Fields</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {Object.entries(fields).map(([key, data]) => (
            <div key={key} className="flex flex-col">
              <label className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 flex justify-between">
                <span>{key}</span>
                <span className={`${data.confidence >= 0.85 ? 'text-emerald-500' : 'text-yellow-500'} font-mono`}>Conf: {(data.confidence*100).toFixed(0)}%</span>
              </label>
              <input 
                type="text" 
                value={data.value} 
                onChange={(e) => setFields({...fields, [key]: { ...data, value: e.target.value }})}
                className={`bg-gray-950 border ${data.confidence < 0.85 ? 'border-yellow-500/50 focus:border-yellow-500' : 'border-gray-800 focus:border-blue-500'} text-white px-4 py-3 rounded-lg outline-none`}
              />
            </div>
          ))}
        </div>
      </div>

      {status && <div className="p-4 bg-red-500/10 text-red-500 rounded-lg mb-6">{status}</div>}

      <div className="flex gap-4">
        <button onClick={onReset} className="flex-1 py-3 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg font-semibold">Reject & Restart</button>
        <button onClick={handleMint} disabled={minting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-lg">
          {minting ? "Minting to Polygon Amoy..." : "Approve & Mint SBT"}
        </button>
      </div>

      <p className="text-xs text-center text-gray-600 mt-6 max-w-2xl mx-auto leading-relaxed">
        Note: This system detects digital manipulation of existing documents using OCR heuristics. It cannot identify professionally fabricated documents created from scratch. Final responsibility for credential authenticity rests with the issuing institution.
      </p>
    </div>
  );
}
