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
  const [step, setStep] = useState(0); 
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); 

  const handleChange = (e) => {
    if (error) setError("");
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
      setStep(1);
      
      const payload = { studentName, degree, institution, year, cgpa, studentWallet };
      const uploadData = await uploadCredential(payload, { isDemoMode });
      
      if (!uploadData.success && !isDemoMode) {
        throw new Error(uploadData.error || "Upload failed");
      }
      
      const activeCID = uploadData.primaryCID || uploadData.backupCID;
      if (!activeCID && !isDemoMode) {
        throw new Error("Upload failed: No CID returned from storage services");
      }

      const ipnsPointer = isDemoMode ? uploadData.ipnsPointer : `ipfs://${activeCID}`;

      setStep(2);
      const signer = await getSigner();
      
      const txResult = await sendTransaction(
        "mintSBT",
        [studentWallet, ipnsPointer],
        { signer, isDemoMode }
      );

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
        redundancy: uploadData.redundancy,
        primaryCID: activeCID,
        warning: uploadData.warning
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
        <div className="w-16 h-16 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-6 text-3xl shadow-lg">
          🏛️
        </div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Issue a Credential</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          Connect your institution wallet (must have INSTITUTION_ROLE) to mint a Soulbound credential.
        </p>
        <button onClick={connect} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (step === 3 && result) {
    return (
      <div className="animate-slide-up">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-5 text-3xl">
            ✅
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDemoMode ? 'text-orange-400' : 'text-green-400'}`}>
            Credential Minted!
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            The Soulbound Token has been permanently issued to the student's wallet.
          </p>
          
          {result.redundancy === "FULL" && (
            <div className="mb-6 bg-green-500/20 text-green-400 border border-green-500/30 p-3 text-center rounded-xl">
              <p className="text-sm font-bold">Stored on 2 networks</p>
              {result.warning && <p className="text-xs text-gray-500 mt-1">{result.warning}</p>}
            </div>
          )}
          {result.redundancy === "PARTIAL" && (
            <div className="mb-6 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 p-3 text-center rounded-xl">
              <p className="text-sm font-bold">Stored on 1 network — backup failed</p>
              {result.warning && <p className="text-xs text-gray-500 mt-1">{result.warning}</p>}
            </div>
          )}
          {result.redundancy === "DEGRADED" && (
            <div className="mb-6 bg-orange-500/20 text-orange-400 border border-orange-500/30 p-3 text-center rounded-xl">
              <p className="text-sm font-bold">Primary failed — backup only</p>
              {result.warning && <p className="text-xs text-gray-500 mt-1">{result.warning}</p>}
            </div>
          )}
          {result.redundancy === "DEMO" && (
            <div className="mb-6 bg-gray-500/20 text-gray-400 border border-gray-500/30 p-3 text-center rounded-xl">
              <p className="text-sm font-bold">Demo mode — local storage only</p>
              {result.warning && <p className="text-xs text-gray-500 mt-1">{result.warning}</p>}
            </div>
          )}

          <div className="space-y-3 text-left">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Token ID</p>
              <p className="font-mono text-gray-200 font-bold text-lg">#{result.tokenId}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
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
            className="mt-6 w-full bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Issue Another Credential
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text">Issue Credential</h1>
        <p className="text-gray-400 text-sm mt-1">
          Mint a Soulbound Token to permanently record an academic credential on-chain.
        </p>
      </div>

      {step > 0 && (
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {["Uploading Data", "Minting SBT", "Confirmed"].map((label, i) => {
              const stepNum = i + 1;
              const done = step > stepNum;
              const active = step === stepNum;
              return (
                <div key={label} className="flex items-center gap-3 flex-1 w-full">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border
                    ${done ? "bg-green-500/10 border-green-500/20 text-green-400" :
                      active ? "bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse" :
                      "bg-gray-800 border-gray-700 text-gray-600"}`}>
                    {done ? "✓" : stepNum}
                  </div>
                  <span className={`text-sm tracking-wide ${active ? "text-gray-200 font-medium" : done ? "text-green-400 font-medium" : "text-gray-600"}`}>
                    {label}
                  </span>
                  {i < 2 && <div className={`hidden sm:block flex-1 h-px ${done || (step > stepNum) ? "bg-green-700/50" : "bg-gray-800"}`} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm animate-fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg space-y-5">
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
              className="bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 w-full outline-none transition-colors disabled:opacity-50"
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
              className="bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 w-full outline-none transition-colors disabled:opacity-50"
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
              className="bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 w-full outline-none transition-colors disabled:opacity-50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={step > 0}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-colors"
        >
          {step > 0 ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white"></div>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
