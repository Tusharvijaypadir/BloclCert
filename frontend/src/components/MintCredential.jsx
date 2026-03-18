import { useState } from "react";
import { ethers } from "ethers";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "../App.jsx";
import { getSigner } from "../utils/contract.js";
import { uploadCredential, sendTransaction } from "../utils/txManager.js";

const STEPS = ["Idle", "Uploading Data", "Minting SBT", "Confirmed"];

export default function MintCredential({ isDemoMode }) {
  const { wallet, connect } = useWallet();
  const [searchParams] = useSearchParams();
  const demoForm = searchParams.get("demo") === "form";
  const [form, setForm] = useState({
    studentWallet: "",
    studentName: "",
    degree: "",
    institution: "",
    year: "",
    cgpa: "",
  });
  const [step, setStep] = useState(0); // 0=idle, 1=uploading, 2=minting, 3=done
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { txHash, tokenId }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const reset = () => {
    setStep(0);
    setError("");
    setResult(null);
    setForm({ studentWallet: "", studentName: "", degree: "", institution: "", year: "", cgpa: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    // Client-side validation
    const { studentWallet, studentName, degree, institution, year, cgpa } = form;
    if (!studentWallet || !studentName || !degree || !institution || !year || !cgpa) {
      setError("All fields are required.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(studentWallet)) {
      setError("Student wallet must be a valid Ethereum address.");
      return;
    }
    const cgpaNum = parseFloat(cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      setError("CGPA must be between 0 and 10.");
      return;
    }

    try {
      // Step 1: Upload (Dual IPFS or Local Storage)
      setStep(1);
      
      const payload = { studentName, degree, institution, year, cgpa, studentWallet };
      const uploadData = await uploadCredential(payload, { isDemoMode });
      
      if (!uploadData.success) {
        throw new Error(uploadData.error || "Upload failed");
      }
      
      const { ipnsPointer, redundancy, primaryCID, backupCID, warning } = uploadData;

      // Step 2: Mint on-chain
      setStep(2);
      const signer = await getSigner();
      
      const txResult = await sendTransaction(
        "mintSBT",
        [studentWallet, ipnsPointer],
        { signer, isDemoMode }
      );

      // Extract tokenId from CredentialMinted event requires parsing the receipt,
      // but since txManager handles wait(), we can just use the provider to get the receipt
      // Or we can query the contract for the latest token by this user.
      // Ethers v6: we can ask the contract for the counter or just filter logs.
      // To keep it clean, let's just query the contract logs
      const { getContract } = await import("../utils/contract.js");
      const contract = getContract(signer);
      const filter = contract.filters.CredentialMinted(null, studentWallet, wallet);
      const currentBlock = await contract.runner.provider.getBlockNumber();
      const events = await contract.queryFilter(filter, Math.max(0, currentBlock - 100));
      let tokenId = "unknown";
      if (events.length > 0) {
        tokenId = events[events.length - 1].args.tokenId.toString();
      }

      setStep(3);
      setResult({ 
        txHash: txResult.transactionHash, 
        tokenId,
        redundancy,
        primaryCID,
        warning
      });
    } catch (err) {
      setStep(0);
      if (err.code === "ACTION_REJECTED") {
        setError("Transaction was rejected by the user.");
      } else if (err.message && err.message.includes("INSTITUTION_ROLE")) {
        setError("Your wallet does not have INSTITUTION_ROLE. Ask the contract admin to grant the role.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    }
  };

  if (!wallet && !demoForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-6 text-3xl">
          🏛️
        </div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Issue a Credential</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          Connect your institution wallet (must have INSTITUTION_ROLE) to mint a Soulbound credential.
        </p>
        <button onClick={connect} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/30">
          Connect Wallet
        </button>
      </div>
    );
  }

  // Success state
  if (step === 3 && result) {
    return (
      <div className="max-w-lg mx-auto py-12 animate-slide-up">
        <div className="bg-gray-900 rounded-2xl border border-green-800/40 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-5 text-3xl">
            ✅
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDemoMode ? 'text-orange-400' : 'text-green-400'}`}>
            Credential Minted!
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            The Soulbound Token has been permanently issued to the student's wallet.
          </p>
          
          {/* Redundancy Display */}
          {result.redundancy === "FULL" && (
            <div className="mb-6 bg-green-950/40 border-l-4 border-green-500 p-3 text-left rounded-r flex items-start gap-3">
              <span className="text-xl">🛡️</span>
              <div>
                <p className="text-sm font-bold text-green-400">Stored on 2 Networks</p>
                <p className="text-xs text-gray-400">Pinned to both Pinata and web3.storage</p>
              </div>
            </div>
          )}
          {result.redundancy === "PARTIAL" && (
            <div className="mb-6 bg-yellow-950/40 border-l-4 border-yellow-500 p-3 text-left rounded-r flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-bold text-yellow-400">Stored on 1 Network</p>
                <p className="text-xs text-gray-400">{result.warning || "Backup failed"}</p>
              </div>
            </div>
          )}
          {result.redundancy === "DEGRADED" && (
            <div className="mb-6 bg-orange-950/40 border-l-4 border-orange-500 p-3 text-left rounded-r flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-bold text-orange-400">Primary Failed</p>
                <p className="text-xs text-gray-400">{result.warning || "Stored on backup only"}</p>
              </div>
            </div>
          )}
          {result.redundancy === "DEMO" && (
            <div className="mb-6 bg-gray-800 border-l-4 border-orange-500 p-3 text-left rounded-r flex items-start gap-3">
              <span className="text-xl">🧪</span>
              <div>
                <p className="text-sm font-bold text-orange-400">Demo Storage</p>
                <p className="text-xs text-gray-400">Data stored in local browser memory</p>
              </div>
            </div>
          )}

          <div className="space-y-3 text-left">
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Token ID</p>
              <p className="font-mono text-gray-200 font-bold text-lg">#{result.tokenId}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Transaction Hash &nbsp; {isDemoMode && <span className="bg-orange-600/30 text-orange-400 px-1.5 rounded text-[10px]">DEMO</span>}</p>
              <a
                href={isDemoMode ? "#" : `https://amoy.polygonscan.com/tx/${result.txHash}`}
                target={isDemoMode ? "_self" : "_blank"}
                rel="noreferrer"
                className="font-mono text-blue-400 hover:text-blue-300 text-xs break-all"
              >
                {result.txHash}
              </a>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-6 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-all border border-gray-700"
          >
            Issue Another Credential
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text">Issue Credential</h1>
        <p className="text-gray-400 text-sm mt-1">
          Mint a Soulbound Token to permanently record an academic credential on-chain.
        </p>
      </div>

      {/* Progress stepper */}
      {step > 0 && (
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2">
            {["Uploading Data", "Minting SBT", "Confirmed"].map((label, i) => {
              const stepNum = i + 1;
              const done = step > stepNum;
              const active = step === stepNum;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
                    ${done ? "bg-green-900 border-green-600 text-green-400" :
                      active ? "bg-blue-900 border-blue-500 text-blue-300 animate-pulse" :
                      "bg-gray-800 border-gray-700 text-gray-600"}`}>
                    {done ? "✓" : stepNum}
                  </div>
                  <span className={`text-xs ${active ? "text-gray-200" : done ? "text-green-400" : "text-gray-600"}`}>
                    {label}
                  </span>
                  {i < 2 && <div className={`flex-1 h-px ${done || (step > stepNum) ? "bg-green-700" : "bg-gray-800"}`} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-400 animate-fade-in">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5">
        {[
          { name: "studentWallet", label: "Student Wallet Address", placeholder: "0x...", type: "text" },
          { name: "studentName", label: "Student Full Name", placeholder: "e.g. Alice Johnson", type: "text" },
          { name: "degree", label: "Degree Name", placeholder: "e.g. B.Tech Computer Science", type: "text" },
          { name: "institution", label: "Institution Name", placeholder: "e.g. MIT", type: "text" },
        ].map(({ name, label, placeholder, type }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
            <input
              name={name}
              type={type}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              disabled={step > 0}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 text-sm transition-all disabled:opacity-50"
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Graduation Year</label>
            <input
              name="year"
              type="number"
              value={form.year}
              onChange={handleChange}
              placeholder="2024"
              min="1900"
              max="2100"
              disabled={step > 0}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 text-sm transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">CGPA (0 – 10)</label>
            <input
              name="cgpa"
              type="number"
              value={form.cgpa}
              onChange={handleChange}
              placeholder="8.5"
              min="0"
              max="10"
              step="0.01"
              disabled={step > 0}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 text-sm transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={step > 0}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
        >
          {step > 0 ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {STEPS[step]}…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Issue Soulbound Credential
            </>
          )}
        </button>
      </form>
    </div>
  );
}
