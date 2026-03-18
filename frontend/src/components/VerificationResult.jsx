import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRef } from "react";

// Demo data shown when ?demo=verified is in the URL
const DEMO_RESULT = {
  valid: true,
  credential: {
    tokenId: "1",
    ipnsPointer: "ipfs://QmDemoCredentialCIDBlockCert123",
    issuer: "0xAbCd1234EfGh5678IjKl9012MnOp3456QrSt7890",
    student: "0x742d35Cc6634C0532925a3b8D4C9Db96590B0001",
    revoked: false,
    metadata: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "AcademicCredential"],
      issuer: "Indian Institute of Technology, Bombay",
      issuanceDate: "2024-06-15T10:30:00.000Z",
      credentialSubject: {
        id: "0x742d35Cc6634C0532925a3b8D4C9Db96590B0001",
        studentName: "Arjun Sharma",
        degree: "B.Tech Computer Science & Engineering",
        institution: "Indian Institute of Technology, Bombay",
        graduationYear: 2024,
        cgpa: 9.2,
      },
    },
  },
};

export default function VerificationResult({ isDemoMode }) {
  const { tokenId } = useParams();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const startTimeRef = useRef(Date.now());

  // Demo mode — show sample verified result when ?demo=verified is in the URL
  const demoMode = searchParams.get("demo");
  const effectiveState =
    state ||
    (demoMode === "verified"
      ? {
          result: DEMO_RESULT,
          tokenId: "1",
          walletAddress: DEMO_RESULT.credential.student,
        }
      : null);

  // If navigated here without state (e.g. direct URL), show instructions
  if (!effectiveState || !effectiveState.result) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center animate-fade-in">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <p className="text-gray-400 mb-4">No verification data found.</p>
          <button
            onClick={() => navigate("/verify")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-all"
          >
            Start Verification
          </button>
        </div>
      </div>
    );
  }

  const { result, walletAddress } = effectiveState;
  const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);

  const credential = result.credential || {};
  const metadata = credential.metadata || {};
  const subject = metadata.credentialSubject || {};
  const isValid = result.valid;
  const isRevoked = credential.revoked;

  const studentName = subject.studentName || "Unknown";
  const degree = subject.degree || "Unknown";
  const institution = subject.institution || credential.issuer || "Unknown";
  const graduationYear = subject.graduationYear || "N/A";
  const cgpa = subject.cgpa != null ? subject.cgpa : null;
  const issuer = credential.issuer || "Unknown";
  const issuanceDate = metadata.issuanceDate
    ? new Date(metadata.issuanceDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const displayTokenId = tokenId || effectiveState.tokenId || credential.tokenId;

  return (
    <div className="max-w-lg mx-auto py-8 animate-slide-up">
      {/* Banner */}
      {isValid ? (
        <div className="rounded-2xl bg-gradient-to-r from-green-900 to-emerald-900 border border-green-700 p-6 mb-6 text-center relative">
          {result.isDemoModeVerification && (
            <div className="absolute top-4 right-4 bg-orange-600/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-orange-500 uppercase">
              Offline Demo Validation
            </div>
          )}
          <div className="text-4xl mb-2">✅</div>
          <h1 className="text-2xl font-bold text-green-300">CREDENTIAL VERIFIED</h1>
          <p className="text-green-400/80 text-sm mt-1">
            This academic credential is authentic and valid {result.isDemoModeVerification ? "on the local node" : "on-chain"}.
          </p>
        </div>
      ) : isRevoked ? (
        <div className="rounded-2xl bg-gradient-to-r from-red-950 to-red-900 border border-red-700 p-6 mb-6 text-center">
          <div className="text-4xl mb-2">🚫</div>
          <h1 className="text-2xl font-bold text-red-300">CREDENTIAL REVOKED</h1>
          <p className="text-red-400/80 text-sm mt-1">
            This credential has been revoked by the issuing institution.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-gradient-to-r from-red-950 to-orange-950 border border-red-700 p-6 mb-6 text-center">
          <div className="text-4xl mb-2">❌</div>
          <h1 className="text-2xl font-bold text-red-300">VERIFICATION FAILED</h1>
          <p className="text-red-400/80 text-sm mt-1">
            {result.reason || "Unable to verify this credential."}
          </p>
        </div>
      )}

      {/* Credential details — only show on valid */}
      {isValid && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Credential Details</h2>
          </div>
          <div className="p-6 space-y-4">
            <DetailRow label="Student Name" value={studentName} highlight />
            <DetailRow label="Degree" value={degree} />
            <DetailRow label="Institution" value={institution} />
            <DetailRow label="Graduation Year" value={String(graduationYear)} />
            {cgpa !== null && <DetailRow label="CGPA" value={`${cgpa} / 10`} />}
            {issuanceDate && <DetailRow label="Issued On" value={issuanceDate} />}

            <hr className="border-gray-800" />

            <DetailRow label="Token ID" value={`#${displayTokenId}`} mono />
            <DetailRow
              label="Student Wallet"
              value={`${walletAddress?.slice(0, 6)}…${walletAddress?.slice(-4)}`}
              mono
            />
            <DetailRow
              label="Issuer Wallet"
              value={`${issuer?.slice(0, 6)}…${issuer?.slice(-4)}`}
              mono
            />
          </div>
        </div>
      )}

      {/* Verification meta */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 mb-6 flex items-center justify-between text-sm">
        <span className="text-gray-500">Verification time</span>
        <span className="text-gray-300 font-medium">{elapsed}s</span>
      </div>

      {/* Actions */}
      <button
        onClick={() => navigate("/verify")}
        className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3.5 rounded-xl transition-all border border-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Verify Another Credential
      </button>
    </div>
  );
}

function DetailRow({ label, value, highlight = false, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-right
        ${highlight ? "text-gray-100 font-semibold" : "text-gray-300"}
        ${mono ? "font-mono text-xs" : ""}
      `}
      >
        {value}
      </span>
    </div>
  );
}
