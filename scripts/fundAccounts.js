const hre = require("hardhat");

async function main() {
  // Add the student or institution wallet addresses you want to fund here.
  const targetAccounts = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat Demo Student
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Hardhat Demo Institution
  ];

  // 0.5 MATIC/ETH securely covers ~25+ certificate issues (avg 250k gas each)
  const amountToFund = hre.ethers.parseEther("0.5");

  console.log("🚀 Starting smooth sailing account funding process...");
  const [deployer] = await hre.ethers.getSigners();
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`\nFunder Admin Wallet: ${deployer.address}`);
  console.log(`Current Admin Balance: ${hre.ethers.formatEther(balance)} tokens`);

  if (targetAccounts.length === 0) {
    console.error("❌ No target accounts provided. Add Ethereum addresses to the targetAccounts array in scripts/fundAccounts.js.");
    return;
  }

  for (const acc of targetAccounts) {
    console.log(`\n💸 Transferring 0.5 tokens to ${acc}...`);
    try {
      const tx = await deployer.sendTransaction({
        to: acc,
        value: amountToFund,
      });
      console.log(`Tx broadcasted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Successfully funded ${acc}`);
    } catch (err) {
      console.error(`❌ Failed to fund ${acc}: ${err.message}`);
    }
  }

  console.log("\n✅ All specified accounts have been funded for smooth execution!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
