# BlockCert

BlockCert is a blockchain-based academic credential verification system that issues degrees and certificates as **Soulbound Tokens (SBTs)** on the Polygon Amoy testnet. Credentials are permanently locked to a student's wallet — they cannot be transferred, sold, or forged. Recruiters can verify credentials by scanning a QR code in a matter of seconds.

---

##  Original Plan vs Current Implementation

###  Our Original Plan
Our initial goal was to build a comprehensive, decentralized alternative to services like *Accredible*. We wanted to guarantee that digital certificates never vanish if a university forgets to pay their subscription fee. By utilizing decentralized technologies, we aimed to prove institutional authorship while storing the visual and metadata context completely off-grid, putting total ownership back into the hands of the students.

###  What We Are Doing Right Now
Currently, we have successfully developed the core prototype.
- **Dual IPFS Storage:** We pin every credential to both **Pinata** and **web3.storage** concurrently to ensure maximum uptime and absolute redundancy.
- **Demo & Presentation Features:** Biconomy integration is currently bypassed in favor of a full "Demo Mode Toggle". This toggle switches the application to use a local Hardhat node and local browser storage — meaning we can demonstrate the exact user flows to stakeholders completely free of transaction gas.
- **Verifiable Proofs:** Recruiters can scan QR codes to trigger on-chain `isValid()` challenges securing the authenticity of the Soulbound credential in real-time.

---

##  Project Structure

```
blockcert/
├── contracts/          # Solidity smart contracts
├── scripts/            # Hardhat deployment scripts
├── test/               # Contract unit tests
├── hardhat.config.js
├── .env                # Environment variables (see setup)
├── backend/            # Express.js API server
│   └── routes/
└── frontend/           # React + Vite + Tailwind UI
    └── src/
        ├── components/
        └── utils/
```

---

## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd blockcert
```

### 2. Install Dependencies

**Root (Hardhat):**
```bash
npm install
```

**Backend:**
```bash
cd backend && npm install && cd ..
```

**Frontend:**
```bash
cd frontend && npm install && cd ..
```

### 3. Configure Environment Variables

Copy and fill in the `.env` file in the project root:

```bash
# Polygon Amoy RPC endpoint from Alchemy
ALCHEMY_RPC_URL=your_alchemy_polygon_amoy_rpc_url

# MetaMask private key WITHOUT the 0x prefix
PRIVATE_KEY=your_metamask_private_key_without_0x_prefix

# Pinata credentials (https://app.pinata.cloud)
PINATA_JWT=your_pinata_jwt_token
PINATA_GATEWAY=your_pinata_gateway_url

# Filled automatically after deployment
CONTRACT_ADDRESS=deployed_contract_address_goes_here
```

Also create `frontend/.env` (for the Vite dev server):
```bash
VITE_PINATA_GATEWAY=your_pinata_gateway_url
```

> Get free Polygon Amoy testnet MATIC from: https://faucet.polygon.technology/

### 4. Compile Contracts

```bash
npx hardhat compile
```

### 5. Run Tests

```bash
npx hardhat test
```

### 6. Deploy to Polygon Amoy

```bash
npx hardhat run scripts/deploy.js --network amoy
```

This will:
- Deploy `BlockCertSBT.sol`
- Grant `INSTITUTION_ROLE` to the deployer
- Auto-save the contract address + ABI to `frontend/src/utils/contractConfig.json`
- Print the contract address — **copy it to `.env`** as `CONTRACT_ADDRESS`

### 7. Start the Backend

```bash
cd backend
node server.js
```

The API server starts on `http://localhost:3001`.

### 8. Start the Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

---

##  How to Use the Prototype

### As an Institution (Minting)

1. Open http://localhost:5173 and click **Connect Wallet**
2. MetaMask will prompt you to switch to Polygon Amoy — approve it
3. Navigate to **Issue Credential**
4. Fill in student details: wallet address, name, degree, institution, year, CGPA
5. Click **Issue Soulbound Credential**
6. The app uploads metadata to IPFS, then mints the SBT on-chain
7. After confirmation, you'll see the Transaction Hash and Token ID

> **Note:** The connected wallet must have `INSTITUTION_ROLE` (granted by the deployer via `grantInstitutionRole()`).

### As a Student (Viewing Credentials)

1. Connect the student's MetaMask wallet
2. The **Dashboard** automatically loads all credentials issued to that wallet
3. Each credential shows: degree, institution, year, CGPA, and validity status
4. Click **Show QR Code** to display a scannable QR for recruiter verification

### As a Recruiter (Verifying)

1. Navigate to **Verify**
2. Either scan the student's QR code with the camera, or enter the wallet address + Token ID manually
3. Click **Request Challenge** — a one-time nonce (expires in 60s) is generated
4. In test mode, click **Sign as Student** to sign the nonce with MetaMask
5. The app verifies the signature, calls `isValid()` on-chain, and fetches metadata from IPFS
6. The **Verification Result** screen shows whether the credential is VALID, REVOKED, or INVALID

---

## 📋 Deployed Contract

| Field | Value |
|-------|-------|
| Contract Address | `CONTRACT_ADDRESS_PLACEHOLDER` |
| Network | Polygon Amoy Testnet |
| Chain ID | 80002 |
| Block Explorer | [amoy.polygonscan.com](https://amoy.polygonscan.com) |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Solidity 0.8.20 + OpenZeppelin 5 |
| Blockchain Framework | Hardhat + ethers.js v6 |
| Testnet | Polygon Amoy (chainId 80002) |
| IPFS Storage | Pinata SDK (pinJSONToIPFS) |
| NFT Standard | ERC-721 + EIP-5192 (Soulbound) |
| Backend | Node.js + Express.js |
| Frontend | React 18 + Vite + Tailwind CSS |
| Wallet Integration | MetaMask + ethers.js BrowserProvider |
| QR Code | qrcode.react (generate) + jsQR (scan) |

---

## 🧪 Demo Mode vs Live Mode

To demonstrate the application without requiring gas or affecting the Polygon Amoy testnet, the application includes a **Demo Mode Toggle**.

| Feature | Live Mode | Demo Mode |
|---------|-----------|-----------|
| **Network** | Polygon Amoy (80002) | Hardhat Local (31337) |
| **Storage** | Pinata IPFS + web3.storage (Dual) | Local Storage (`demo://...`) |
| **Validation** | Backend `/api/challenge` signature | Direct on-chain `isValid()` |
| **Wallet** | User's MetaMask (needs Test MATIC) | MetaMask + Hardhat account |

### Setting up Demo Mode

1. Start the local Hardhat blockchain node in a terminal:
   ```bash
   npx hardhat node
   ```
2. Open a second terminal and deploy the contracts locally:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```
3. Toggle "DEMO MODE" in the top-left of the application.
4. If MetaMask prompts to add/switch to **Hardhat Localhost**, click Approve.

> **Warning:** Credentials minted in Demo Mode are tied exclusively to the local network instance. They cannot be verified on the Amoy Testnet, and resetting the Hardhat node will wipe them.

---

##  License

MIT
