const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlockCertSBT", function () {
  let contract;
  let owner;
  let institution;
  let student;
  let stranger;

  const SAMPLE_IPNS = "ipfs://QmSampleCIDforTestingPurposesOnly123456789";

  beforeEach(async function () {
    [owner, institution, student, stranger] = await ethers.getSigners();
    const BlockCertSBT = await ethers.getContractFactory("BlockCertSBT");
    contract = await BlockCertSBT.deploy();
    await contract.waitForDeployment();
  });

  // ─── Deployment ───────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await contract.name()).to.equal("BlockCert Credential");
      expect(await contract.symbol()).to.equal("BCERT");
    });

    it("Should set the deployer as DEFAULT_ADMIN_ROLE holder", async function () {
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should not grant INSTITUTION_ROLE to owner by default", async function () {
      const INSTITUTION_ROLE = await contract.INSTITUTION_ROLE();
      expect(await contract.hasRole(INSTITUTION_ROLE, owner.address)).to.be.false;
    });

    it("Should support ERC721 interface", async function () {
      // ERC721 interfaceId
      expect(await contract.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("Should support EIP-5192 interface", async function () {
      // IERC5192 interfaceId: keccak256("locked(uint256)") => 0xb45a3c0e
      expect(await contract.supportsInterface("0xb45a3c0e")).to.be.true;
    });
  });

  // ─── Role Management ──────────────────────────────────────────────────

  describe("Role Management", function () {
    it("Should allow admin to grant INSTITUTION_ROLE", async function () {
      await contract.connect(owner).grantInstitutionRole(institution.address);
      const INSTITUTION_ROLE = await contract.INSTITUTION_ROLE();
      expect(await contract.hasRole(INSTITUTION_ROLE, institution.address)).to.be.true;
    });

    it("Should revert when non-admin tries to grant INSTITUTION_ROLE", async function () {
      await expect(
        contract.connect(stranger).grantInstitutionRole(institution.address)
      ).to.be.reverted;
    });

    it("Should revert grantInstitutionRole with zero address", async function () {
      await expect(
        contract.connect(owner).grantInstitutionRole(ethers.ZeroAddress)
      ).to.be.revertedWith("SBT: institution address cannot be zero");
    });
  });

  // ─── mintSBT ──────────────────────────────────────────────────────────

  describe("mintSBT", function () {
    beforeEach(async function () {
      await contract.connect(owner).grantInstitutionRole(institution.address);
    });

    it("Should allow institution to mint an SBT", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      expect(await contract.ownerOf(1)).to.equal(student.address);
    });

    it("Should store the IPNS pointer correctly", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      expect(await contract.tokenIPNS(1)).to.equal(SAMPLE_IPNS);
    });

    it("Should record the institution as the issuer", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      expect(await contract.tokenIssuer(1)).to.equal(institution.address);
    });

    it("Should return the new tokenId", async function () {
      const tx = await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "CredentialMinted"
      );
      expect(event).to.not.be.undefined;
      expect(event.args.tokenId).to.equal(1n);
    });

    it("Should auto-increment token IDs starting from 1", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      await contract.connect(institution).mintSBT(stranger.address, SAMPLE_IPNS);
      expect(await contract.ownerOf(1)).to.equal(student.address);
      expect(await contract.ownerOf(2)).to.equal(stranger.address);
    });

    it("Should revert when non-institution address tries to mint", async function () {
      await expect(
        contract.connect(stranger).mintSBT(student.address, SAMPLE_IPNS)
      ).to.be.reverted;
    });

    it("Should revert when minting to zero address", async function () {
      await expect(
        contract.connect(institution).mintSBT(ethers.ZeroAddress, SAMPLE_IPNS)
      ).to.be.revertedWith("SBT: student address cannot be zero");
    });

    it("Should revert when IPNS pointer is empty", async function () {
      await expect(
        contract.connect(institution).mintSBT(student.address, "")
      ).to.be.revertedWith("SBT: IPNS pointer cannot be empty");
    });

    it("Should emit CredentialMinted event with correct args", async function () {
      await expect(
        contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS)
      )
        .to.emit(contract, "CredentialMinted")
        .withArgs(1n, student.address, institution.address, SAMPLE_IPNS);
    });

    it("Should make the token non-transferable (locked returns true)", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      expect(await contract.locked(1)).to.be.true;
    });

    it("Should revert on transfer attempt (soulbound enforcement)", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      await expect(
        contract
          .connect(student)
          .transferFrom(student.address, stranger.address, 1)
      ).to.be.revertedWith("SBT: token is non-transferable");
    });

    it("Should revert on safeTransferFrom attempt", async function () {
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
      await expect(
        contract
          .connect(student)
          ["safeTransferFrom(address,address,uint256)"](
            student.address,
            stranger.address,
            1
          )
      ).to.be.revertedWith("SBT: token is non-transferable");
    });
  });

  // ─── revokeSBT ────────────────────────────────────────────────────────

  describe("revokeSBT", function () {
    beforeEach(async function () {
      await contract.connect(owner).grantInstitutionRole(institution.address);
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
    });

    it("Should allow the issuer to revoke a credential", async function () {
      await contract.connect(institution).revokeSBT(1);
      expect(await contract.isRevoked(1)).to.be.true;
    });

    it("Should emit CredentialRevoked event", async function () {
      await expect(contract.connect(institution).revokeSBT(1))
        .to.emit(contract, "CredentialRevoked")
        .withArgs(1n, institution.address);
    });

    it("Should revert when a non-issuer tries to revoke", async function () {
      await expect(
        contract.connect(stranger).revokeSBT(1)
      ).to.be.revertedWith("SBT: only the original issuer can revoke");
    });

    it("Should revert when trying to revoke an already-revoked credential", async function () {
      await contract.connect(institution).revokeSBT(1);
      await expect(
        contract.connect(institution).revokeSBT(1)
      ).to.be.revertedWith("SBT: credential already revoked");
    });

    it("Should revert when token does not exist", async function () {
      await expect(
        contract.connect(institution).revokeSBT(999)
      ).to.be.revertedWith("SBT: token does not exist");
    });
  });

  // ─── isValid ──────────────────────────────────────────────────────────

  describe("isValid", function () {
    beforeEach(async function () {
      await contract.connect(owner).grantInstitutionRole(institution.address);
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
    });

    it("Should return true for a valid, unrevoked credential", async function () {
      expect(await contract.isValid(1)).to.be.true;
    });

    it("Should return false for a revoked credential", async function () {
      await contract.connect(institution).revokeSBT(1);
      expect(await contract.isValid(1)).to.be.false;
    });

    it("Should return false for a non-existent token", async function () {
      expect(await contract.isValid(999)).to.be.false;
    });
  });

  // ─── setConsentFlag ───────────────────────────────────────────────────

  describe("setConsentFlag", function () {
    beforeEach(async function () {
      await contract.connect(owner).grantInstitutionRole(institution.address);
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
    });

    it("Should default to false (not discoverable)", async function () {
      expect(await contract.isPubliclyDiscoverable(1)).to.be.false;
    });

    it("Should allow token owner to set consent flag to true", async function () {
      await contract.connect(student).setConsentFlag(1, true);
      expect(await contract.isPubliclyDiscoverable(1)).to.be.true;
    });

    it("Should allow token owner to revoke consent flag", async function () {
      await contract.connect(student).setConsentFlag(1, true);
      await contract.connect(student).setConsentFlag(1, false);
      expect(await contract.isPubliclyDiscoverable(1)).to.be.false;
    });

    it("Should emit ConsentFlagUpdated event", async function () {
      await expect(contract.connect(student).setConsentFlag(1, true))
        .to.emit(contract, "ConsentFlagUpdated")
        .withArgs(1n, true);
    });

    it("Should revert when non-owner tries to set consent flag", async function () {
      await expect(
        contract.connect(stranger).setConsentFlag(1, true)
      ).to.be.revertedWith("SBT: only token owner can set consent");
    });
  });

  // ─── getCredential ────────────────────────────────────────────────────

  describe("getCredential", function () {
    beforeEach(async function () {
      await contract.connect(owner).grantInstitutionRole(institution.address);
      await contract.connect(institution).mintSBT(student.address, SAMPLE_IPNS);
    });

    it("Should return all credential fields correctly", async function () {
      const [ipnsPointer, revoked, issuer, studentAddr] =
        await contract.getCredential(1);
      expect(ipnsPointer).to.equal(SAMPLE_IPNS);
      expect(revoked).to.be.false;
      expect(issuer).to.equal(institution.address);
      expect(studentAddr).to.equal(student.address);
    });

    it("Should reflect revocation status after revoking", async function () {
      await contract.connect(institution).revokeSBT(1);
      const [, revoked] = await contract.getCredential(1);
      expect(revoked).to.be.true;
    });

    it("Should revert for non-existent token", async function () {
      await expect(contract.getCredential(999)).to.be.revertedWith(
        "SBT: token does not exist"
      );
    });
  });
});
