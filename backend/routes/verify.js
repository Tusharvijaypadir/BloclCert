require("dotenv").config({ path: "../../.env" });
const express = require("express");
const { ethers } = require("ethers");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// ─── In-Memory Nonce Store ─────────────────────────────────────────────────────
// Maps nonce string → { nonce, walletAddress, tokenId, expiresAt }
const nonceStore = new Map();
const NONCE_TTL_MS = 60_000; // 60 seconds

/** Removes all expired nonces from the store */
function cleanExpiredNonces() {
  const now = Date.now();
  for (const [key, value] of nonceStore.entries()) {
    if (value.expiresAt < now) {
      nonceStore.delete(key);
    }
  }
}

/** Loads the contract ABI and address from the compiled config */
function getContractConfig() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "deployed_contract_address_goes_here") {
    throw new Error("CONTRACT_ADDRESS not configured in .env");
  }
  // Minimal ABI — only what we need for verification
  const abi = [
    "function isValid(uint256 tokenId) external view returns (bool)",
    "function getCredential(uint256 tokenId) external view returns (string memory ipnsPointer, bool revoked, address issuer, address student)",
  ];
  return { contractAddress, abi };
}

/** Fetches credential metadata JSON from Pinata gateway using the IPNS pointer */
async function fetchCredentialFromIPFS(ipnsPointer) {
  const gateway = process.env.PINATA_GATEWAY;
  if (!gateway) {
    throw new Error("PINATA_GATEWAY not configured in .env");
  }

  // ipnsPointer is "ipfs://CID" — convert to gateway URL
  const cid = ipnsPointer.replace("ipfs://", "");
  const url = `${gateway.replace(/\/$/, "")}/ipfs/${cid}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

// ─── POST /api/challenge ───────────────────────────────────────────────────────
/**
 * Issues a one-time challenge nonce for a wallet + tokenId pair.
 * The student must sign this nonce to prove ownership for verification.
 */
router.post("/challenge", (req, res) => {
  try {
    const { walletAddress, tokenId } = req.body;

    if (!walletAddress || tokenId === undefined || tokenId === null || tokenId === "") {
      return res.status(400).json({
        error: "Missing required fields: walletAddress, tokenId",
      });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: "walletAddress must be a valid Ethereum address",
      });
    }

    const tokenIdStr = String(tokenId);
    if (isNaN(parseInt(tokenIdStr, 10)) || parseInt(tokenIdStr, 10) < 0) {
      return res.status(400).json({ error: "tokenId must be a non-negative integer" });
    }

    // Clean expired nonces on each request
    cleanExpiredNonces();

    const nonce = uuidv4();
    const expiresAt = Date.now() + NONCE_TTL_MS;

    nonceStore.set(nonce, {
      nonce,
      walletAddress: walletAddress.toLowerCase(),
      tokenId: tokenIdStr,
      expiresAt,
    });

    console.log(
      `[challenge] Issued nonce for wallet=${walletAddress} tokenId=${tokenIdStr}`
    );

    res.status(200).json({ nonce, expiresAt });
  } catch (error) {
    console.error("[challenge] Error:", error.message || error);
    res.status(500).json({ error: "Failed to generate challenge nonce" });
  }
});

// ─── POST /api/verify ─────────────────────────────────────────────────────────
/**
 * Verifies a student credential by:
 * 1. Validating the challenge nonce exists and is not expired
 * 2. Recovering the signer from the signature and confirming it matches walletAddress
 * 3. Calling isValid() on the deployed BlockCertSBT contract
 * 4. Fetching the metadata from IPFS and returning the full credential
 */
router.post("/verify", async (req, res) => {
  try {
    const { signature, nonce, walletAddress, tokenId } = req.body;

    if (!signature || !nonce || !walletAddress || tokenId === undefined || tokenId === null || tokenId === "") {
      return res.status(400).json({
        valid: false,
        reason: "Missing required fields: signature, nonce, walletAddress, tokenId",
      });
    }

    // Clean expired nonces
    cleanExpiredNonces();

    // Validate nonce exists
    const storedNonce = nonceStore.get(nonce);
    if (!storedNonce) {
      return res.status(401).json({
        valid: false,
        reason: "Nonce not found or already used. Request a new challenge.",
      });
    }

    // Validate nonce is not expired
    if (storedNonce.expiresAt < Date.now()) {
      nonceStore.delete(nonce);
      return res.status(401).json({
        valid: false,
        reason: "Challenge nonce has expired. Request a new challenge.",
      });
    }

    // Validate walletAddress matches stored nonce
    if (storedNonce.walletAddress !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        valid: false,
        reason: "Wallet address does not match the challenge nonce.",
      });
    }

    // Validate tokenId matches stored nonce
    if (storedNonce.tokenId !== String(tokenId)) {
      return res.status(401).json({
        valid: false,
        reason: "Token ID does not match the challenge nonce.",
      });
    }

    // Recover signer from signature
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(nonce, signature);
    } catch (sigError) {
      return res.status(401).json({
        valid: false,
        reason: "Invalid signature format.",
      });
    }

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        valid: false,
        reason: "Signature does not match the provided wallet address.",
      });
    }

    // Remove used nonce (one-time use)
    nonceStore.delete(nonce);

    // Connect to blockchain and verify credential
    const { contractAddress, abi } = getContractConfig();
    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    if (!rpcUrl || rpcUrl === "your_alchemy_polygon_amoy_rpc_url") {
      return res.status(500).json({
        valid: false,
        reason: "Blockchain RPC URL not configured on server.",
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const tokenIdBN = BigInt(tokenId);

    // Check validity on-chain
    const valid = await contract.isValid(tokenIdBN);
    if (!valid) {
      // Determine reason using getCredential if possible
      try {
        const [, revoked] = await contract.getCredential(tokenIdBN);
        return res.status(200).json({
          valid: false,
          reason: revoked
            ? "This credential has been revoked by the issuing institution."
            : "Credential is not valid (may not exist or has no metadata).",
        });
      } catch {
        return res.status(200).json({
          valid: false,
          reason: "Credential does not exist on-chain or is invalid.",
        });
      }
    }

    // Fetch full credential details from blockchain
    const [ipnsPointer, revoked, issuer, student] =
      await contract.getCredential(tokenIdBN);

    // Fetch metadata from IPFS
    let credentialMetadata = null;
    try {
      credentialMetadata = await fetchCredentialFromIPFS(ipnsPointer);
    } catch (ipfsError) {
      console.warn("[verify] Could not fetch IPFS metadata:", ipfsError.message);
      // Return on-chain data at minimum if IPFS is unavailable
      return res.status(200).json({
        valid: true,
        credential: {
          tokenId: String(tokenId),
          ipnsPointer,
          issuer,
          student,
          revoked,
          metadata: null,
          warning: "Credential verified on-chain but IPFS metadata unavailable.",
        },
      });
    }

    console.log(`[verify] ✅ Credential ${tokenId} verified for wallet ${walletAddress}`);

    res.status(200).json({
      valid: true,
      credential: {
        tokenId: String(tokenId),
        ipnsPointer,
        issuer,
        student,
        revoked,
        metadata: credentialMetadata,
      },
    });
  } catch (error) {
    console.error("[verify] Unexpected error:", error.message || error);
    res.status(500).json({
      valid: false,
      reason: "Server error during verification. Please try again.",
      details: error.message || "Unknown error",
    });
  }
});

// ─── GET /api/credential/:tokenId ─────────────────────────────────────────────
/**
 * Returns combined on-chain + IPFS metadata for a credential.
 * This is a public route that does not require signature verification.
 */
router.get("/credential/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const tokenIdNum = parseInt(tokenId, 10);

    if (isNaN(tokenIdNum) || tokenIdNum <= 0) {
      return res.status(400).json({ error: "tokenId must be a positive integer" });
    }

    const { contractAddress, abi } = getContractConfig();
    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    if (!rpcUrl || rpcUrl === "your_alchemy_polygon_amoy_rpc_url") {
      return res.status(500).json({ error: "Blockchain RPC URL not configured" });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const [ipnsPointer, revoked, issuer, student] = await contract.getCredential(
      BigInt(tokenIdNum)
    );

    // Try to fetch IPFS metadata
    let metadata = null;
    try {
      metadata = await fetchCredentialFromIPFS(ipnsPointer);
    } catch (ipfsError) {
      console.warn(
        `[credential] IPFS fetch failed for token ${tokenId}:`,
        ipfsError.message
      );
    }

    res.status(200).json({
      tokenId: String(tokenId),
      ipnsPointer,
      issuer,
      student,
      revoked,
      valid: !revoked,
      metadata,
    });
  } catch (error) {
    if (error.message && error.message.includes("token does not exist")) {
      return res.status(404).json({ error: "Token does not exist" });
    }
    console.error("[credential] Error:", error.message || error);
    res.status(500).json({
      error: "Failed to fetch credential",
      details: error.message || "Unknown error",
    });
  }
});

module.exports = router;
