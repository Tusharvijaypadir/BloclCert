const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying BlockCertSBT to Polygon Amoy...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} MATIC\n`);

  // Deploy the contract
  const BlockCertSBT = await ethers.getContractFactory("BlockCertSBT");
  const contract = await BlockCertSBT.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`✅ BlockCertSBT deployed to: ${contractAddress}`);

  // Grant INSTITUTION_ROLE to deployer for testing
  const INSTITUTION_ROLE = await contract.INSTITUTION_ROLE();
  const tx = await contract.grantInstitutionRole(deployer.address);
  await tx.wait();
  console.log(`✅ INSTITUTION_ROLE granted to deployer: ${deployer.address}`);

  // Save contract address and ABI to frontned/src/utils/contractConfig.json
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/BlockCertSBT.sol/BlockCertSBT.json"
  );

  let abi = [];
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abi = artifact.abi;
  } else {
    console.warn(
      "⚠️  Artifact not found at expected path. ABI may be empty. Run `npx hardhat compile` first."
    );
  }

  const configDir = path.join(
    __dirname,
    "../frontend/src/utils"
  );
  const configPath = path.join(configDir, "contractConfig.json");

  // Ensure the directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const contractConfig = {
    address: contractAddress,
    abi: abi,
    network: "Polygon Amoy",
    chainId: 80002,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(configPath, JSON.stringify(contractConfig, null, 2));
  console.log(`\n📄 Contract config saved to: ${configPath}`);
  console.log(`\n📋 Summary:`);
  console.log(`   Contract Address : ${contractAddress}`);
  console.log(`   Network          : Polygon Amoy (chainId: 80002)`);
  console.log(`   Deployer         : ${deployer.address}`);
  console.log(
    `\n💡 Add this to your .env file:\nCONTRACT_ADDRESS=${contractAddress}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
