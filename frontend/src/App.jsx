import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useParams } from "react-router-dom";
import { ethers } from "ethers";

import StudentDashboard from "./components/StudentDashboard.jsx";
import CertUpload from "./components/CertUpload.jsx";
import RecruiterPortal from "./components/RecruiterPortal.jsx";
import VerificationResult from "./components/VerificationResult.jsx";
import DemoModeToggle from "./components/DemoModeToggle.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import StudentSubmitPage from "./pages/StudentSubmitPage.jsx";
import OrgDashboard from "./pages/OrgDashboard.jsx";

import { formatAddress, switchToAmoy, switchToHardhat } from "./utils/contract.js";

export const WalletContext = createContext(null);
export function useWallet() {
  return useContext(WalletContext);
}

function Navbar({ wallet, onConnect, onDisconnect, connecting, hasMetaMask, role, onLogout, adminEmail }) {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path
      ? "text-blue-400 border-b-2 border-blue-500"
      : "text-gray-400 hover:text-gray-100";

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-blue-500 text-xl font-bold">⬡</span>
            <span className="font-bold text-xl text-white font-['Space_Grotesk']">BlockCert</span>
          </Link>

          {/* DYNAMIC MIDDLE LINKS */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium h-full">
            {role === "student" ? (
              <>
                <Link to="/" className={`${isActive("/")} h-full flex items-center transition-colors`}>Dashboard</Link>
                <Link to="/submit" className={`${isActive("/submit")} h-full flex items-center transition-colors text-emerald-400`}>Submit to HR</Link>
                <Link to="/verify" className={`${isActive("/verify")} h-full flex items-center transition-colors`}>Verify Tool</Link>
              </>
            ) : role === "org" ? (
              <>
                 <Link to="/org" className={`${isActive("/org")} h-full flex items-center transition-colors text-emerald-500`}>HR Panel</Link>
                 <Link to="/mint" className={`${isActive("/mint")} h-full flex items-center transition-colors`}>Issue SBT</Link>
                 <span className="text-gray-600 ml-4 font-mono text-xs">{adminEmail}</span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="hidden md:block text-gray-500 hover:text-red-400 text-sm font-medium mr-4 transition-colors"
            >
              Logout Endpoint
            </button>
            {wallet ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 text-sm font-mono text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  {formatAddress(wallet)}
                </div>
                <button onClick={onDisconnect} className="bg-transparent border border-gray-700 text-gray-300 text-sm px-4 py-1.5 rounded-lg">Disconnect</button>
              </div>
            ) : !hasMetaMask ? (
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm">
                Install MetaMask
              </a>
            ) : (
              <button onClick={onConnect} disabled={connecting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm">
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [hasMetaMask, setHasMetaMask] = useState(!!window.ethereum);
  const [isDemoMode, setIsDemoMode] = useState(localStorage.getItem("blockcert_demo_mode") === "true");
  
  // ROLE STATE
  const [role, setRole] = useState(localStorage.getItem("bc_role") || null);
  const [orgToken, setOrgToken] = useState(localStorage.getItem("bc_org_token") || null);

  useEffect(() => {
    if (!window.ethereum) return setHasMetaMask(false);
    setHasMetaMask(true);
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) setWallet(null);
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, []);

  const connect = async () => {
    if (!window.ethereum) return;
    setConnecting(true);
    setConnectError("");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      if (isDemoMode) {
        await switchToHardhat();
      } else {
        await switchToAmoy();
      }
      const signer = await provider.getSigner();
      setWallet(await signer.getAddress());
    } catch (err) {
      if (err.code === 4001) setConnectError("Connection rejected. Please approve MetaMask.");
      else setConnectError(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => setWallet(null);

  const handleRoleSelect = (selectedRole, token) => {
    setRole(selectedRole);
    localStorage.setItem("bc_role", selectedRole);
    if (token) {
      setOrgToken(token);
      localStorage.setItem("bc_org_token", token);
    }
  };

  const handleLogout = () => {
    setRole(null);
    setOrgToken(null);
    localStorage.removeItem("bc_role");
    localStorage.removeItem("bc_org_token");
    setWallet(null);
  };

  // If no role, strictly enforce logical boundary
  if (!role) {
    return (
      <WalletContext.Provider value={{ wallet, connect, disconnect, hasMetaMask }}>
         <LoginPage onRoleSelect={handleRoleSelect} />
      </WalletContext.Provider>
    );
  }

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, hasMetaMask }}>
      <DemoModeToggle isDemoMode={isDemoMode} setIsDemoMode={setIsDemoMode} />
      <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        <Navbar
          wallet={wallet}
          onConnect={connect}
          onDisconnect={disconnect}
          connecting={connecting}
          hasMetaMask={hasMetaMask}
          role={role}
          onLogout={handleLogout}
          adminEmail="tusharvijaypadir@gmail.com"
        />

        {!hasMetaMask && role === 'student' && (
           <div className="bg-orange-500/10 text-orange-400 text-center py-2 mt-16 font-medium text-sm">⚠️ MetaMask required.</div>
        )}

        <div className="mt-[64px] bg-gray-900 border-b border-gray-800 text-gray-500 text-xs font-medium text-center py-2">
          {isDemoMode ? <span className="text-amber-400">DEMO MODE — Local Testing Active</span> : "LIVE — Polygon Amoy Testnet"}
        </div>
        
        {connectError && <div className="max-w-4xl mx-auto px-6 pt-6 text-red-400 bg-red-500/10 p-4 rounded-lg my-4">{connectError}</div>}

        <main className="pt-6 px-6 py-8 max-w-5xl mx-auto">
          {role === "student" ? (
            <Routes>
              <Route path="/" element={<StudentDashboard isDemoMode={isDemoMode} />} />
              <Route path="/submit" element={<StudentSubmitPage isDemoMode={isDemoMode} />} />
              <Route path="/verify" element={<RecruiterPortal isDemoMode={isDemoMode} />} />
              <Route path="/verify/:tokenId" element={<VerificationResult isDemoMode={isDemoMode} />} />
              <Route path="/org/candidate/:wallet" element={<StudentDashboard isDemoMode={isDemoMode} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/org" element={<OrgDashboard />} />
              <Route path="/mint" element={<CertUpload isDemoMode={isDemoMode} />} />
              <Route path="/org/candidate/:wallet" element={<OrgDashboard />} />
              <Route path="*" element={<Navigate to="/org" />} />
            </Routes>
          )}
        </main>
      </div>
    </WalletContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
