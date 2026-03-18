import { QRCodeSVG } from "qrcode.react";

export default function CredentialCard({ credential, revealedQR, onToggleQR, wallet, isDemoMode }) {
  const { tokenId, revoked, issuer, metadata } = credential;

  const subject = metadata?.credentialSubject || {};
  const studentName = subject.studentName || "Unknown Student";
  const degree = subject.degree || "Unknown Degree";
  const institution = subject.institution || "Unknown Institution";
  const graduationYear = subject.graduationYear || "N/A";
  const cgpa = subject.cgpa != null ? subject.cgpa : null;
  const issuanceDate = metadata?.issuanceDate
    ? new Date(metadata.issuanceDate).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      })
    : null;

  const qrData = JSON.stringify({ walletAddress: wallet, tokenId });
  const isShowingQR = revealedQR === tokenId;

  // Derive institution initials for the avatar
  const initials = institution
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="credential-card bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden animate-slide-up">
      {/* Card header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-5 border-b border-gray-800 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              {institution}
            </p>
            <h3 className="text-base font-bold text-gray-100 leading-tight mt-0.5 flex items-center">
              {degree}
              {(isDemoMode || credential?.ipnsPointer?.startsWith("demo://")) && (
                <span className="ml-2 bg-orange-600/30 text-orange-400 border border-orange-500/50 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                  Demo
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Status badge */}
        {revoked ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 bg-red-950/50 text-red-400 border border-red-800/60 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            REVOKED
          </span>
        ) : (
          <span className="badge-valid shrink-0 inline-flex items-center gap-1.5 bg-green-950/50 text-green-400 border border-green-800/60 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            VALID
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-5 space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Student</span>
            <span className="text-gray-200 font-medium">{studentName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Graduation Year</span>
            <span className="text-gray-200 font-medium">{graduationYear}</span>
          </div>
          {cgpa !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">CGPA</span>
              <span className="text-gray-200 font-medium">{cgpa} / 10</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Token ID</span>
            <span className="text-gray-400 font-mono text-xs"># {tokenId}</span>
          </div>
          {issuanceDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Issued</span>
              <span className="text-gray-400 text-xs">{issuanceDate}</span>
            </div>
          )}
        </div>

        {/* QR Code section */}
        {isShowingQR && (
          <div className="mt-4 bg-white rounded-xl p-4 flex flex-col items-center gap-2 animate-fade-in">
            <QRCodeSVG
              value={qrData}
              size={160}
              bgColor="#ffffff"
              fgColor="#111827"
              level="M"
              includeMargin={false}
            />
            <p className="text-gray-600 text-xs mt-1 text-center">
              Scan to verify this credential
            </p>
          </div>
        )}

        <button
          onClick={() => onToggleQR(tokenId)}
          className="w-full mt-2 flex items-center justify-center gap-2 text-sm font-medium border border-gray-700 hover:border-blue-600 text-gray-400 hover:text-blue-400 rounded-xl py-2.5 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          {isShowingQR ? "Hide QR Code" : "Show QR Code"}
        </button>
      </div>

      {/* Card footer: issuer */}
      <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/50">
        <p className="text-xs text-gray-600">
          Issuer:{" "}
          <span className="font-mono text-gray-500">
            {issuer.slice(0, 6)}…{issuer.slice(-4)}
          </span>
        </p>
      </div>
    </div>
  );
}
