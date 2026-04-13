import { useState } from "react";
import { useWallet } from "../App.jsx";

export default function LoginPage({ onRoleSelect }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { connect } = useWallet();

  const handleStudentSelect = async () => {
    await connect();
    onRoleSelect("student", null);
  };

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/api/auth/org-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRoleSelect("org", data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-gray-950 to-gray-950 pointer-events-none"></div>

      <div className="flex flex-col items-center gap-3 mb-12 relative z-10">
        <div className="flex items-center gap-3">
            <span className="text-blue-500 text-4xl font-bold font-mono">⬡</span>
            <h1 className="text-5xl font-bold text-white font-['Space_Grotesk'] tracking-tight">BlockCert</h1>
        </div>
        <p className="text-gray-400 font-medium">Soulbound Academic Credential Protocol</p>
      </div>
      
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 relative z-10">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-blue-500 transition-all duration-300 shadow-2xl flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-blue-500/20">Student Portal</span>
          </div>
          <div className="text-6xl mb-6">🎓</div>
          <h2 className="text-3xl font-bold text-white mb-3 font-['Space_Grotesk']">I am a Student</h2>
          <p className="text-gray-400 mb-8 flex-grow leading-relaxed">Securely upload documents, bypass manual data entry, sign selective privacy disclosure claims, and send to HR.</p>
          <button onClick={handleStudentSelect} className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold py-4 rounded-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]">
            Connect MetaMask to Enter
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-emerald-500/50 transition-all duration-300 shadow-2xl flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/20">HR / Institution Role</span>
          </div>
          <div className="text-6xl mb-6">🏢</div>
          <h2 className="text-3xl font-bold text-white mb-3 font-['Space_Grotesk']">I am an Organisation</h2>
          <p className="text-gray-400 mb-8 font-sm leading-relaxed">Log in to review candidate pipelines, verify zero-knowledge claims algorithmically, and manage the OCR anomaly queue.</p>
          
          <form onSubmit={handleOrgSubmit} className="flex flex-col gap-4">
            <input type="email" placeholder="Admin Email" required value={email} onChange={e=>setEmail(e.target.value)} className="bg-gray-950 border border-gray-800 text-gray-200 px-4 py-3 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner" />
            <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} className="bg-gray-950 border border-gray-800 text-gray-200 px-4 py-3 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner" />
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded font-medium mt-1">{error}</div>}
            <button disabled={loading} type="submit" className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold py-4 rounded-lg transition-all shadow-[0_0_20px_rgba(5,150,105,0.2)]">
              {loading ? "Authenticating Platform..." : "Sign In via Admin Portal"}
            </button>
          </form>
        </div>
      </div>
      
      <div className="mt-16 text-center text-gray-600 text-xs tracking-widest uppercase">
        Bennett University &middot; April 2026<br/>
        <span className="mt-2 block opacity-50">Prototype Administrator: tusharvijaypadir@gmail.com</span>
      </div>
    </div>
  );
}
