require("dotenv").config({ path: "../../.env" });
const express = require("express");
const PinataSDK = require("@pinata/sdk");

const router = express.Router();

// Initialize Pinata client using JWT
const pinata = new PinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

// web3.storage client cache
let w3upClientCache = null;

async function initWeb3Storage() {
  if (w3upClientCache) return w3upClientCache;
  try {
    const { create } = await import("@web3-storage/w3up-client");
    const client = await create();
    if (!process.env.WEB3_STORAGE_EMAIL) {
      throw new Error("WEB3_STORAGE_EMAIL is missing in .env");
    }
    // Note: client.login() checks session. A first-time setup might require email verification link click.
    await client.login(process.env.WEB3_STORAGE_EMAIL);
    w3upClientCache = client;
    return client;
  } catch (err) {
    console.error("Failed to initialize web3.storage client:", err);
    throw err;
  }
}

async function dualUpload(credentialJSON) {
  const jsonString = JSON.stringify(credentialJSON);
  const blob = new Blob([jsonString], { type: "application/json" });
  const filename = `credential-${Date.now()}.json`;

  const [pinataResult, web3Result] = await Promise.allSettled([
    // Pinata upload
    pinata.pinJSONToIPFS(credentialJSON, {
      pinataMetadata: { 
        name: filename,
        keyvalues: { 
          type: "blockcert-credential",
          timestamp: Date.now().toString()
        }
      }
    }),
    
    // web3.storage upload
    (async () => {
      const client = await initWeb3Storage();
      const file = new File([blob], filename, { type: "application/json" });
      const cid = await client.uploadFile(file);
      return { IpfsHash: cid.toString() };
    })()
  ]);

  // Case 1: Both succeeded
  if (pinataResult.status === "fulfilled" && web3Result.status === "fulfilled") {
    return {
      success: true,
      primaryCID: pinataResult.value.IpfsHash,
      backupCID: web3Result.value.IpfsHash,
      redundancy: "FULL",
      gateway: `${process.env.PINATA_GATEWAY}/ipfs/${pinataResult.value.IpfsHash}`,
      warning: null
    };
  }
  
  // Case 2: Pinata succeeded, web3.storage failed
  if (pinataResult.status === "fulfilled" && web3Result.status === "rejected") {
    console.warn("web3.storage upload failed:", web3Result.reason);
    return {
      success: true,
      primaryCID: pinataResult.value.IpfsHash,
      backupCID: null,
      redundancy: "PARTIAL",
      warning: "Backup storage failed. Credential stored on primary only.",
      gateway: `${process.env.PINATA_GATEWAY}/ipfs/${pinataResult.value.IpfsHash}`
    };
  }
  
  // Case 3: Pinata failed, web3.storage succeeded
  if (pinataResult.status === "rejected" && web3Result.status === "fulfilled") {
    console.error("Pinata upload failed:", pinataResult.reason);
    return {
      success: true,
      primaryCID: web3Result.value.IpfsHash,
      backupCID: null,
      redundancy: "DEGRADED",
      warning: "Primary storage failed. Credential stored on backup only.",
      gateway: `https://w3s.link/ipfs/${web3Result.value.IpfsHash}`
    };
  }
  
  // Case 4: Both failed
  throw new Error(
    `Both storage services failed. ` +
    `Pinata: ${pinataResult.reason?.message}. ` +
    `web3.storage: ${web3Result.reason?.message}. ` +
    `Credential not minted.`
  );
}

/**
 * POST /api/upload-credential
 *
 * Accepts credential details, constructs a W3C-compatible Verifiable Credential
 * JSON object, and pins it to IPFS via Pinata. Returns the CID and IPNS-style pointer.
 */
router.post("/upload-credential", async (req, res) => {
  try {
    const { studentName, degree, institution, year, cgpa, studentWallet } = req.body;

    // Validate all required fields
    const missing = [];
    if (!studentName) missing.push("studentName");
    if (!degree) missing.push("degree");
    if (!institution) missing.push("institution");
    if (!year) missing.push("year");
    if (!cgpa && cgpa !== 0) missing.push("cgpa");
    if (!studentWallet) missing.push("studentWallet");

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Validate wallet address format (basic check)
    if (!/^0x[0-9a-fA-F]{40}$/.test(studentWallet)) {
      return res.status(400).json({
        success: false,
        error: "studentWallet must be a valid Ethereum address (0x...)",
      });
    }

    // Validate CGPA range
    const cgpaNum = parseFloat(cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      return res.status(400).json({
        success: false,
        error: "cgpa must be a number between 0 and 10",
      });
    }

    // Validate graduation year
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: "year must be a valid graduation year between 1900 and 2100",
      });
    }

    // Construct W3C Verifiable Credential JSON
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

    // Pin to IPFS via Pinata and web3.storage
    const uploadResult = await dualUpload(credentialPayload);

    console.log(`[upload-credential] Uploaded with redundancy: ${uploadResult.redundancy}`);

    res.status(200).json({
      success: true,
      primaryCID: uploadResult.primaryCID,
      backupCID: uploadResult.backupCID,
      redundancy: uploadResult.redundancy,
      gateway: uploadResult.gateway,
      warning: uploadResult.warning,
      ipnsPointer: `ipfs://${uploadResult.primaryCID}`, // keep this for backward compatibility with contract
      metadata: {
        studentName: studentName.trim(),
        institution: institution.trim(),
        degree: degree.trim(),
        year: yearNum,
      },
    });
  } catch (error) {
    console.error("[upload-credential] Error:", error.message || error);
    res.status(500).json({
      success: false,
      error: "Failed to upload credential to IPFS",
      details: error.message || "Unknown error",
    });
  }
});

module.exports = router;
