import { useState, useRef, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../App.jsx";
import { getSigner, getContract } from "../utils/contract.js";
import jsQR from "jsqr";

export default function RecruiterPortal({ isDemoMode }) {
  const { wallet, connect } = useWallet();
  const navigate = useNavigate();
  const [manualInput, setManualInput] = useState({ walletAddress: "", tokenId: "" });
  const [scanning, setScanning] = useState(false);
  const [nonce, setNonce] = useState(null);
  const [nonceExpiry, setNonceExpiry] = useState(null);
  const [phase, setPhase] = useState("input");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [target, setTarget] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          try {
            const parsed = JSON.parse(code.data);
            if (parsed.walletAddress && parsed.tokenId !== undefined) {
              stopCamera();
              setManualInput({
                walletAddress: parsed.walletAddress,
                tokenId: String(parsed.tokenId),
              });
            }
          } catch {
          }
        }
      }, 250);
    } catch (err) {
      setError("Camera access denied or not available: " + (err.message || ""));
    }
  }

  async function requestChallenge(addr, id) {
    setLoading(true);
    setError("");
    try {
      if (isDemoMode) {
        const signer = await getSigner();
        const contract = getContract(signer);
        const valid = await contract.isValid(id);
        const [ipnsPointer, revoked, issuer, student] = await contract.getCredential(id);
        
        let metadata = { credentialSubject: {} };
        if (ipnsPointer && ipnsPointer.startsWith("demo://")) {
            const ts = ipnsPointer.replace("demo://local-", "");
            const payload = localStorage.getItem(`blockcert_credential_${ts}`);
            if (payload) {
                metadata = JSON.parse(payload);
            }
        }
        
        const demoResult = {
            valid,
            reason: valid ? null : (revoked ? "Revoked" : "Invalid credential"),
            isDemoModeVerification: true,
            credential: {
                tokenId: id.toString(),
                ipnsPointer,
                issuer,
                student,
                revoked,
                metadata
            }
        };
        
        setLoading(false);
        navigate(`/verify/${id}`, {
          state: { result: demoResult, tokenId: id, walletAddress: addr },
        });
        return;
      }

      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, tokenId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get challenge");
      setNonce(data.nonce);
      setNonceExpiry(data.expiresAt);
      setTarget({ walletAddress: addr, tokenId: id });
      setPhase("challenge");
    } catch (err) {
      setError(err.message || "Failed to request challenge");
    } finally {
      if (!isDemoMode) setLoading(false);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    const { walletAddress, tokenId } = manualInput;
    if (!walletAddress || !tokenId) {
      setError("Both wallet address and token ID are required.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      setError("Wallet address must be a valid Ethereum address.");
      return;
    }
    if (isNaN(parseInt(tokenId, 10)) || parseInt(tokenId, 10) <= 0) {
      setError("Token ID must be a positive integer.");
      return;
    }
    requestChallenge(walletAddress, tokenId);
  }

  async function signAsStudent() {
    if (!nonce) return;
    setLoading(true);
    setError("");
    setPhase("signing");
    try {
      const signer = await getSigner();
      const signature = await signer.signMessage(nonce);

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          nonce,
          walletAddress: target.walletAddress,
          tokenId: target.tokenId,
        }),
      });
      const data = await res.json();

      navigate(`/verify/${target.tokenId}`, {
        state: { result: data, tokenId: target.tokenId, walletAddress: target.walletAddress },
      });
    } catch (err) {
      setPhase("challenge");
      if (err.code === "ACTION_REJECTED") {
        setError("Signature request was rejected by the user.");
      } else {
        setError(err.message || "Failed to sign or verify");
      }
    } finally {
      setLoading(false);
    }
  }

  const resetAll = useCallback(() => {
    setPhase("input");
    setNonce(null);
    setNonceExpiry(null);
    setTarget(null);
    setError("");
    setManualInput({ walletAddress: "", tokenId: "" });
    stopCamera();
  }, []);

  const clearError = () => { if (error) setError(""); };

  if (phase === "input") {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text">Verify Credential</h1>
          <p className="text-gray-400 text-sm mt-1">
            Enter a student's wallet address and token ID, or scan their QR code.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            QR Code Scanner
          </h2>
          {scanning ? (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-square max-h-52">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-2 border-blue-500/50 rounded-lg pointer-events-none" />
              <button onClick={stopCamera} className="absolute top-2 right-2 bg-gray-900/80 text-xs text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">
                Stop
              </button>
            </div>
          ) : (
            <button
              onClick={startCamera}
              className="w-full bg-gray-800/50 border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-lg py-8 text-gray-500 hover:text-blue-400 text-sm font-medium transition-colors flex flex-col items-center gap-3"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Click to open camera &amp; scan QR
            </button>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual Entry
          </h2>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Student Wallet Address</label>
              <input
                type="text"
                value={manualInput.walletAddress}
                onChange={(e) => { clearError(); setManualInput((p) => ({ ...p, walletAddress: e.target.value })); }}
                placeholder="0x..."
                className="bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 w-full outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Token ID</label>
              <input
                type="number"
                value={manualInput.tokenId}
                onChange={(e) => { clearError(); setManualInput((p) => ({ ...p, tokenId: e.target.value })); }}
                placeholder="1"
                min="1"
                className="bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 w-full outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white"></div>
                  Processing...
                </>
              ) : "Request Challenge →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (phase === "challenge" || phase === "signing") {
    const expiresInSec = nonceExpiry
      ? Math.max(0, Math.round((nonceExpiry - Date.now()) / 1000))
      : 60;

    return (
      <div className="animate-fade-in">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg text-center">
          <div className="w-14 h-14 rounded-full bg-blue-900/40 border border-blue-700 flex items-center justify-center mx-auto mb-5 text-2xl">
            🔐
          </div>
          <h2 className="text-xl font-bold text-gray-100 mb-1">Waiting for Signature</h2>
          <p className="text-gray-400 text-sm mb-6">
            Ask the student to sign the challenge nonce to prove ownership of their credential.
          </p>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 text-left">
            <p className="text-xs text-gray-500 mb-2">Challenge Nonce (expires in ~{expiresInSec}s)</p>
            <p className="font-mono text-blue-300 text-sm break-all">{nonce}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6 text-left space-y-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-gray-500">Wallet</span>
              <span className="font-mono text-gray-300 text-xs sm:text-sm break-all">{target?.walletAddress}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
              <span className="text-gray-500">Token ID</span>
              <span className="text-gray-300">#{target?.tokenId}</span>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-5">
            <p className="text-xs text-yellow-500 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
              🧪 <strong>Test Mode:</strong> Use the button below to sign as the student with your connected wallet.
            </p>
            
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={signAsStudent}
              disabled={loading || phase === "signing" || !wallet}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              {loading || phase === "signing" ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white"></div>
                  Processing...
                </>
              ) : "Sign as Student (Test Mode)"}
            </button>

            {!wallet && (
              <p className="text-xs text-gray-500 mt-3">Connect your wallet first to sign.</p>
            )}
            <button onClick={resetAll} className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ← Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
