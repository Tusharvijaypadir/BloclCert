# BlockCert Project Overview & Status Report

## 1. Project Overview
**BlockCert** is a Web3 credentialing system designed to securely issue, manage, and verify blockchain-based academic or professional credentials. The project is structured with:
- **Smart Contracts (Solidity/Hardhat):** For minting Soulbound Tokens (SBTs) or non-transferable NFTs to represent verified credentials.
- **Backend (Node.js/Express):** Handles off-chain metadata processing, interfacing with IPFS for decentralized storage, and credential validation logic.
- **Frontend (React/Tailwind CSS):** Provides dedicated User Interfaces for Students (Dashboards), Institutions (Minting/Issuing), and Recruiters (Verification via QR/Manual Entry). 

## 2. What Has Been Done (Completed Works)
Based on previous sessions, a significant portion of the application has been built and refined:

### Foundation & Smart Contracts
- Complete scaffolding of the Hardhat project infrastructure.
- Authoring, deploying, and testing the `BlockCertSBT.sol` smart contract on a testnet.

### Backend Infrastructure
- Implementation of the `server.js` and Express router.
- Developed the `/upload` API (using IPFS/Pinata originally) to securely host credential metadata.
- Developed the `/verify` route to cross-check credentials.

### Frontend Application
- Engineered the React app UI using modern Tailwind styling (Dark glassmorphism design system).
- Built core views: **Student Dashboard**, **Issue Credential** (Institution Admin), **Recruiter Portal**, and **Verification Result**.
- Integrated ethers.js configuration (`utils/contract.js`) to allow seamless connection between the frontend and smart contracts.

### Enhancements & Environment Features (Demo Mode)
- **Demo Mode Implementation:** Added a fully functional "Demo Mode" using `localStorage` persistence and an active toggle component. This allowed recruiters or reviewers to test out the platform without needing live Web3 wallets or API keys by querying local data and utilizing a Hardhat localhost network.
- Updated core components (`MintCredential.jsx`, `RecruiterPortal.jsx`, `StudentDashboard.jsx`) to handle both *LIVE* and *DEMO* routing simultaneously.
- Generated UI application screenshots and UI/UX explanations for milestone submissions.
- Pushed the finalized working codebase to GitHub (`Tusharvijaypadir/BloclCert.git`).

## 3. What You Were Planning To Do (Incomplete Tasks)
While the **Demo Mode** feature was fully finished, the integration of **Dual IPFS Storage** remained partially incomplete. 

You had installed `w3up-client` and set the `.env` variables, but the following tasks are still on your uncompleted roadmap:
1. **Refactor Backend Upload Flow:** Update `backend/routes/upload.js` to utilize `Promise.allSettled` to simultaneously dispatch uploads to both **Pinata** AND **web3.storage**.
2. **Update API Response Schemas:** The upload route needs to return a more robust data structure, including fields like `redundancy`, `primaryCID`, and `backupCID`.
3. **Frontend Redundancy Badges:** Update `MintCredential.jsx` to dynamically parse the new IPFS response and display color-coded visual badges verifying if the file successfully replicated across both networks (e.g., Full Redundancy, Partial, Degraded).
