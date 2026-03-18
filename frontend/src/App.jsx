import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { ethers } from "ethers";
import StudentDashboard from "./components/StudentDashboard.jsx";
import MintCredential from "./components/MintCredential.jsx";
import RecruiterPortal from "./components/RecruiterPortal.jsx";
import VerificationResult from "./components/VerificationResult.jsx";
import DemoModeToggle from "./components/DemoModeToggle.jsx";
import { formatAddress, switchToAmoy, switchToHardhat } from "./utils/contract.js";

// ─── Wallet Context ─────────────────────────────────────────────────────────
export const WalletContext = createContext(null);
export function useWallet() {
  return useContext(WalletContext);
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function Navbar({ wallet, onConnect, onDisconnect, connecting, hasMetaMask }) {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path
      ? "text-blue-400 border-b-2 border-blue-500"
      : "text-gray-400 hover:text-gray-100";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="hex-logo text-xl font-bold">⬡</span>
            <span className="font-bold text-xl gradient-text">BlockCert</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className={`${isActive("/")} pb-1 transition-colors`}>
              Dashboard
            </Link>
            <Link to="/mint" className={`${isActive("/mint")} pb-1 transition-colors`}>
              Issue Credential
            </Link>
            <Link to="/verify" className={`${isActive("/verify")} pb-1 transition-colors`}>
              Verify
            </Link>
          </div>

          {/* Wallet button */}
          <div className="flex items-center gap-3">
            {wallet ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  <span className="text-sm text-gray-300 font-mono">
                    {formatAddress(wallet)}
                  </span>
                </div>
                <button
                  onClick={onDisconnect}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-950"
                >
                  Disconnect
                </button>
              </div>
            ) : !hasMetaMask ? (
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-orange-900/30"
              >
                <img src="https://metamask.io/images/metamask-fox.svg" className="w-4 h-4" alt="" />
                Install MetaMask
              </a>
            ) : (
              <button
                onClick={onConnect}
                disabled={connecting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-900/30"
              >
                {connecting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Connect Wallet
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex border-t border-gray-800">
        {[
          { to: "/", label: "Dashboard" },
          { to: "/mint", label: "Issue" },
          { to: "/verify", label: "Verify" },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex-1 text-center py-2 text-xs font-medium ${isActive(to)} transition-colors`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────
function AppContent() {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [hasMetaMask, setHasMetaMask] = useState(!!window.ethereum);
  const [isDemoMode, setIsDemoMode] = useState(
    localStorage.getItem("blockcert_demo_mode") === "true"
  );

  // Check for MetaMask but don't auto-connect
  useEffect(() => {
    if (!window.ethereum) {
      setHasMetaMask(false);
      return;
    }
    setHasMetaMask(true);

    const handleAccountsChanged = (accounts) => {
      // Only keep them logged in if they were already logged in intentionally
      // or log them out if they disconnect from MetaMask side
      if (accounts.length === 0) {
        setWallet(null);
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, []);

  const connect = async () => {
    if (!window.ethereum) return;
    setConnecting(true);
    setConnectError("");
    console.log("Connecting...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      console.log("Provider created:", provider);
      await provider.send("eth_requestAccounts", []);
      console.log("Accounts requested.");
      if (isDemoMode) {
        await switchToHardhat();
        console.log("Switched to Hardhat.");
      } else {
        await switchToAmoy();
        console.log("Switched to Amoy.");
      }
      const signer = await provider.getSigner();
      console.log("Got signer.");
      setWallet(await signer.getAddress());
      console.log("Connected to wallet.");
    } catch (err) {
      console.error("Connection error:", err);
      if (err.code === 4001) {
        setConnectError("Connection rejected. Please approve MetaMask to continue.");
      } else {
        setConnectError(err.message || "Failed to connect wallet");
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => setWallet(null);

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, hasMetaMask }}>
      <DemoModeToggle isDemoMode={isDemoMode} setIsDemoMode={setIsDemoMode} />
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar
          wallet={wallet}
          onConnect={connect}
          onDisconnect={disconnect}
          connecting={connecting}
          hasMetaMask={hasMetaMask}
        />

        {!hasMetaMask && (
          <div className="fixed top-16 left-0 right-0 z-40 bg-orange-950/90 border-b border-orange-800 text-orange-200 text-sm px-4 py-2.5 flex items-center justify-center gap-3">
            <span>⚠️ MetaMask is not installed.</span>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline hover:text-orange-100"
            >
              Install MetaMask →
            </a>
            <span className="text-orange-400/70 text-xs">then refresh this page</span>
          </div>
        )}

        {connectError && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-700 text-red-200 text-sm px-4 py-2 rounded-lg shadow-lg">
            ⚠️ {connectError}
          </div>
        )}

        {isDemoMode && (
          <div className="fixed top-16 left-0 right-0 z-30 bg-orange-950/90 border-b border-orange-800 text-orange-200 text-xs sm:text-sm px-4 py-2 flex items-center justify-center text-center animate-slide-up">
            <span className="font-bold mr-2 text-white">DEMO MODE ACTIVE</span> — Data stored locally, transactions on Hardhat. Switch to Live Mode for Polygon Amoy.
          </div>
        )}

        <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isDemoMode ? 'pt-24 md:pt-20' : 'pt-20 md:pt-16'}`}>
          <Routes>
            <Route path="/" element={<StudentDashboard isDemoMode={isDemoMode} />} />
            <Route path="/mint" element={<MintCredential isDemoMode={isDemoMode} />} />
            <Route path="/verify" element={<RecruiterPortal isDemoMode={isDemoMode} />} />
            <Route path="/verify/:tokenId" element={<VerificationResult isDemoMode={isDemoMode} />} />
          </Routes>
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
