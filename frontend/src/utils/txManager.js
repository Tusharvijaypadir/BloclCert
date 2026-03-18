export async function sendTransaction(
  functionName, 
  args, 
  { signer, isDemoMode }
) {
  const { getContract } = await import("./contract");
  const contract = getContract(signer);
  
  if (isDemoMode) {
    const tx = await contract[functionName](...args);
    const receipt = await tx.wait();
    return { 
      transactionHash: receipt.hash,
      mode: "DEMO"
    };
  } else {
    // The user requested removing Biconomy for now, so live mode also uses standard signing.
    const tx = await contract[functionName](...args);
    const receipt = await tx.wait();
    return { 
      transactionHash: receipt.hash,
      mode: "LIVE"
    };
  }
}

export async function uploadCredential(
  credentialData, 
  { isDemoMode }
) {
  if (isDemoMode) {
    // localStorage path
    const timestamp = Date.now();
    const key = `blockcert_credential_${timestamp}`;
    const cid = `demo://local-${timestamp}`;
    
    // Format must match IPFS schema so the same display components work
    const credentialPayload = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "AcademicCredential"],
      issuer: credentialData.institution,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: credentialData.studentWallet,
        studentName: credentialData.studentName.trim(),
        degree: credentialData.degree.trim(),
        institution: credentialData.institution.trim(),
        graduationYear: parseInt(credentialData.year, 10),
        cgpa: parseFloat(credentialData.cgpa),
      },
    };
    
    localStorage.setItem(key, JSON.stringify(credentialPayload));
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    
    return {
      success: true,
      primaryCID: cid,
      backupCID: null,
      redundancy: "DEMO",
      gateway: "localStorage",
      ipnsPointer: cid,
      metadata: {
        studentName: credentialData.studentName.trim(),
        institution: credentialData.institution.trim(),
        degree: credentialData.degree.trim(),
        year: parseInt(credentialData.year, 10),
      }
    };
  } else {
    // Real dual IPFS upload path
    const response = await fetch("/api/upload-credential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentialData)
    });
    return response.json();
  }
}
