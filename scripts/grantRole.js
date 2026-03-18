const hre = require("hardhat");
const { address: contractAddress } = require("../frontend/src/utils/contractConfig.json");

async function main() {
  // Get the address from command line argument
  const targetAddress = process.env.TARGET_ADDRESS;

  if (!targetAddress) {
    console.error("❌ Please provide a TARGET_ADDRESS.");
    console.error('Usage: TARGET_ADDRESS="0xYourAddress..." npx hardhat run scripts/grantRole.js --network amoy');
    process.exit(1);
  }

  if (!contractAddress) {
    console.error("❌ Contract address not found in frontend/src/utils/contractConfig.json");
    process.exit(1);
  }

  console.log(`Granting INSTITUTION_ROLE to: ${targetAddress}`);
  console.log(`Using contract at: ${contractAddress}`);

  // Get the default signer (the admin/deployer of the contract)
  const [admin] = await hre.ethers.getSigners();
  console.log("Executing as Admin:", admin.address);

  // Attach to the deployed contract
  const BlockCertSBT = await hre.ethers.getContractFactory("BlockCertSBT");
  const contract = BlockCertSBT.attach(contractAddress);

  try {
    // Call grantInstitutionRole function
    const tx = await contract.grantInstitutionRole(targetAddress);
    console.log("Transaction submitted:", tx.hash);
    console.log("Waiting for confirmation...");
    
    await tx.wait();
    console.log("✅ Successfully granted INSTITUTION_ROLE!");
  } catch (error) {
    console.error("❌ Failed to grant role:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
