require("dotenv").config({ path: "../../.env" });
const express = require("express");
const PinataSDK = require("@pinata/sdk");

const router = express.Router();
const pinata = new PinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

let web3Client = null;

// Initialize web3.storage client once at module load
(async () => {
  try {
    const { create } = await import("@web3-storage/w3up-client");
    web3Client = await create();
    // First run requires email verification link to be clicked by the admin
    await web3Client.login(process.env.WEB3_STORAGE_EMAIL);
  } catch (err) {
    console.warn("Failed to initialize web3.storage client: " + err.message);
  }
})();

async function dualUpload(credentialJSON) {
  const jsonString = JSON.stringify(credentialJSON);
  const blob = new Blob([jsonString], { type: "application/json" });
  const filename = `credential-${Date.now()}.json`;

  const [pinataResult, web3Result] = await Promise.allSettled([
    pinata.pinJSONToIPFS(credentialJSON, {
      pinataMetadata: { 
        name: filename,
        keyvalues: { type: "blockcert-credential", timestamp: Date.now().toString() }
      }
    }),
    (async () => {
      if (!web3Client) throw new Error("web3.storage client not initialized");
      const file = new File([blob], filename, { type: "application/json" });
      const cid = await web3Client.uploadFile(file);
      return { IpfsHash: cid.toString() };
    })()
  ]);

  // CASE 1 — Both succeed
  if (pinataResult.status === "fulfilled" && web3Result.status === "fulfilled") {
    return {
      success: true,
      primaryCID: pinataResult.value.IpfsHash,
      backupCID: web3Result.value.IpfsHash,
      redundancy: "FULL",
      gateway: process.env.PINATA_GATEWAY + "/ipfs/" + pinataResult.value.IpfsHash,
      warning: null
    };
  }
  
  // CASE 2 — Pinata succeeds, web3.storage fails
  if (pinataResult.status === "fulfilled" && web3Result.status === "rejected") {
    console.warn("web3.storage upload failed:", web3Result.reason);
    return {
      success: true,
      primaryCID: pinataResult.value.IpfsHash,
      backupCID: null,
      redundancy: "PARTIAL",
      gateway: process.env.PINATA_GATEWAY + "/ipfs/" + pinataResult.value.IpfsHash,
      warning: "Backup storage unavailable. Credential stored on primary only."
    };
  }
  
  // CASE 3 — Pinata fails, web3.storage succeeds
  if (pinataResult.status === "rejected" && web3Result.status === "fulfilled") {
    console.error("Pinata upload failed:", pinataResult.reason);
    return {
      success: true,
      primaryCID: web3Result.value.IpfsHash,
      backupCID: null,
      redundancy: "DEGRADED",
      gateway: "https://w3s.link/ipfs/" + web3Result.value.IpfsHash,
      warning: "Primary storage failed. Credential stored on backup only."
    };
  }
  
  // CASE 4 — Both fail
  throw new Error(`Both storage services failed. Pinata: ${pinataResult.reason?.message}. web3.storage: ${web3Result.reason?.message}. Credential not minted.`);
}

router.post("/upload-credential", async (req, res) => {
  try {
    const { studentName, degree, institution, year, cgpa, studentWallet } = req.body;

    const missing = [];
    if (!studentName) missing.push("studentName");
    if (!degree) missing.push("degree");
    if (!institution) missing.push("institution");
    if (!year) missing.push("year");
    if (!cgpa && cgpa !== 0) missing.push("cgpa");
    if (!studentWallet) missing.push("studentWallet");

    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(", ")}` });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(studentWallet)) {
      return res.status(400).json({ success: false, error: "studentWallet must be a valid Ethereum address (0x...)" });
    }

    const cgpaNum = parseFloat(cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      return res.status(400).json({ success: false, error: "cgpa must be a number between 0 and 10" });
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return res.status(400).json({ success: false, error: "year must be a valid graduation year between 1900 and 2100" });
    }

    const credentialPayload = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "AcademicCredential"],
      issuer: institution,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: studentWallet,
        studentName: studentName.trim(),
        degree: degree.trim(),
        institution: institution.trim(),
        graduationYear: yearNum,
        cgpa: cgpaNum,
      },
    };

    const uploadResult = await dualUpload(credentialPayload);

    console.log(`[upload-credential] Uploaded with redundancy: ${uploadResult.redundancy}`);

    res.status(200).json({
      success: true,
      primaryCID: uploadResult.primaryCID,
      backupCID: uploadResult.backupCID,
      redundancy: uploadResult.redundancy,
      gateway: uploadResult.gateway,
      warning: uploadResult.warning,
      ipnsPointer: `ipfs://${uploadResult.primaryCID}`,
      metadata: {
        studentName: studentName.trim(),
        institution: institution.trim(),
        degree: degree.trim(),
        year: yearNum,
      },
    });
  } catch (error) {
    console.error("[upload-credential] Error:", error.message || error);
    res.status(503).json({
      success: false,
      error: "Failed to upload credential to IPFS",
      details: error.message || "Unknown error",
    });
  }
});

module.exports = router;
