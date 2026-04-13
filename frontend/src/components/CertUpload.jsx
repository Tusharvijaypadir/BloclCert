import { useState } from "react";
import TamperReport from "./TamperReport.jsx";

export default function CertUpload({ isDemoMode }) {
  const [file, setFile] = useState(null);
  const [studentWallet, setStudentWallet] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file || !studentWallet) return setError("File and Student Wallet are absolutely required.");
    if (file.size > 10 * 1024 * 1024) return setError("File limit is 10MB");

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("certificate", file);
    formData.append("isDemoMode", isDemoMode);

    try {
      const res = await fetch("http://localhost:3001/api/analyse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server analysis failed structurally");
      setAnalysis(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (analysis) {
    return <TamperReport 
      analysis={analysis} 
      studentWallet={studentWallet} 
      isDemoMode={isDemoMode} 
      onReset={() => { setAnalysis(null); setFile(null); }} 
    />;
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-2">Upload Certificate</h1>
      <p className="text-gray-400 mb-8">Run an algorithmic heuristic scan via Tesseract OCR to eliminate manual data entry.</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl">
        <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">Target Student Wallet</label>
        <input 
          type="text" 
          placeholder="0x..." 
          value={studentWallet}
          onChange={e => setStudentWallet(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 text-gray-200 px-4 py-3 rounded-lg outline-none focus:border-blue-500 font-mono mb-8"
        />

        <div className={`border-2 border-dashed ${file ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 bg-gray-950'} rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all mb-8`}>
          <div className="text-4xl mb-4">📄</div>
          {file ? (
            <div className="mb-4">
              <p className="text-blue-400 font-semibold mb-1">{file.name}</p>
              <p className="text-gray-500 text-xs font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="text-gray-400 mb-4">
              Drag and drop certificate document here, or<br/>
              <label className="text-blue-500 hover:text-blue-400 cursor-pointer font-medium mt-2 inline-block">
                Browse Files
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>
          )}
          <div className="text-xs text-gray-600 font-mono">PDF, PNG, JPG only (Max 10MB)</div>
        </div>

        {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6 text-sm">{error}</div>}

        <button 
          onClick={handleUpload}
          disabled={loading || !file || !studentWallet}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
        >
          {loading ? "Running Tesseract Scan Engine..." : "Upload and Analyze Document"}
        </button>
      </div>
    </div>
  );
}
