import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRef } from "react";

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

  if (!effectiveState || !effectiveState.result) {
    return (
      <div className="py-8 animate-fade-in">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg text-center">
          <p className="text-gray-400 mb-6">No verification data found.</p>
          <button
            onClick={() => navigate("/verify")}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
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
    <div className="animate-slide-up">
      {isValid ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6 mb-6 text-center relative shadow-lg">
          {result.isDemoModeVerification && (
            <div className="absolute top-4 right-4 bg-orange-500/20 text-orange-400 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-500/30 uppercase">
              Offline Demo
            </div>
          )}
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-2xl font-bold text-green-400">CREDENTIAL VERIFIED</h1>
          <p className="text-green-500/80 text-sm mt-2">
            This academic credential is authentic and valid {result.isDemoModeVerification ? "on the local node" : "on-chain"}.
          </p>
        </div>
      ) : isRevoked ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 mb-6 text-center shadow-lg">
          <div className="text-4xl mb-3">🚫</div>
          <h1 className="text-2xl font-bold text-red-500">CREDENTIAL REVOKED</h1>
          <p className="text-red-400 text-sm mt-2">
            This credential has been revoked by the issuing institution.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-6 mb-6 text-center shadow-lg">
          <div className="text-4xl mb-3">❌</div>
          <h1 className="text-2xl font-bold text-orange-500">VERIFICATION FAILED</h1>
          <p className="text-orange-400 text-sm mt-2">
            {result.reason || "Unable to verify this credential."}
          </p>
        </div>
      )}

      {isValid && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6 shadow-lg">
          <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Credential Details</h2>
          </div>
          <div className="p-6 space-y-4">
            <DetailRow label="Student Name" value={studentName} highlight />
            <DetailRow label="Degree" value={degree} />
            <DetailRow label="Institution" value={institution} />
            <DetailRow label="Graduation Year" value={String(graduationYear)} />
            {cgpa !== null && <DetailRow label="CGPA" value={`${cgpa} / 10`} />}
            {issuanceDate && <DetailRow label="Issued On" value={issuanceDate} />}

            <hr className="border-gray-800 my-4" />

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

      <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 mb-6 flex items-center justify-between text-sm shadow-lg">
        <span className="text-gray-500">Verification time</span>
        <span className="text-gray-300 font-medium">{elapsed}s</span>
      </div>

      <button
        onClick={() => navigate("/verify")}
        className="w-full flex items-center justify-center gap-2 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-6 py-3 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        ${mono ? "font-mono text-xs bg-gray-800 px-2 py-1 rounded" : ""}
      `}
      >
        {value}
      </span>
    </div>
  );
}
