// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title IERC5192 - Soulbound Token Interface (EIP-5192)
interface IERC5192 {
    /// @notice Emitted when the locking status is changed to locked.
    event Locked(uint256 tokenId);
    /// @notice Emitted when the locking status is changed to unlocked.
    event Unlocked(uint256 tokenId);
    /// @notice Returns the locking status of a Soulbound Token
    function locked(uint256 tokenId) external view returns (bool);
}

/// @title BlockCertSBT - Soulbound Token for Academic Credentials
/// @notice Issues non-transferable NFTs representing academic degrees on Polygon Amoy
/// @dev Implements EIP-5192 for soulbound semantics using OpenZeppelin v4
contract BlockCertSBT is ERC721, Ownable, AccessControl, IERC5192 {
    using Counters for Counters.Counter;

    // ─── State Variables ─────────────────────────────────────────────────

    /// @dev Auto-incrementing token ID counter, starts at 1
    Counters.Counter private _tokenIdCounter;

    /// @dev Maps tokenId to its IPFS/IPNS content pointer
    mapping(uint256 => string) public tokenIPNS;

    /// @dev Maps tokenId to revocation status
    mapping(uint256 => bool) public isRevoked;

    /// @dev Maps tokenId to the institution that issued it
    mapping(uint256 => address) public tokenIssuer;

    /// @dev Maps tokenId to student's public discoverability consent
    mapping(uint256 => bool) public isPubliclyDiscoverable;

    /// @dev Role identifier for institutions allowed to mint credentials
    bytes32 public constant INSTITUTION_ROLE = keccak256("INSTITUTION_ROLE");

    // ─── Events ───────────────────────────────────────────────────────────

    /// @notice Emitted when a new credential SBT is minted
    event CredentialMinted(
        uint256 indexed tokenId,
        address indexed student,
        address indexed institution,
        string ipnsPointer
    );

    /// @notice Emitted when a credential is revoked by its issuing institution
    event CredentialRevoked(uint256 indexed tokenId, address revokedBy);

    /// @notice Emitted when a student updates their discoverability consent
    event ConsentFlagUpdated(uint256 indexed tokenId, bool isPublic);

    // ─── Constructor ──────────────────────────────────────────────────────

    constructor() ERC721("BlockCert Credential", "BCERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Counter starts at 0; we increment before use so first tokenId == 1
    }

    // ─── EIP-5192 Implementation ──────────────────────────────────────────

    /// @notice Returns true for all tokens — they are permanently locked (soulbound)
    /// @param tokenId The token to query (must exist)
    function locked(uint256 tokenId) external view override returns (bool) {
        require(_exists(tokenId), "SBT: token does not exist");
        return true;
    }

    // ─── Transfer Hook (Soulbound Enforcement) ────────────────────────────

    /// @dev Override _beforeTokenTransfer to block all transfers except minting
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        // Allow minting (from == address(0)) but block all other transfers
        if (from != address(0)) {
            revert("SBT: token is non-transferable");
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ─── Core Functions ───────────────────────────────────────────────────

    /// @notice Mints a credential SBT to a student wallet
    /// @param student The wallet address of the student to receive the credential
    /// @param ipnsPointer The IPFS CID or IPNS address of the credential metadata
    /// @return newTokenId The ID of the newly minted token
    function mintSBT(
        address student,
        string memory ipnsPointer
    ) external onlyRole(INSTITUTION_ROLE) returns (uint256) {
        require(student != address(0), "SBT: student address cannot be zero");
        require(bytes(ipnsPointer).length > 0, "SBT: IPNS pointer cannot be empty");

        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();

        tokenIPNS[newTokenId] = ipnsPointer;
        tokenIssuer[newTokenId] = msg.sender;

        _safeMint(student, newTokenId);

        emit CredentialMinted(newTokenId, student, msg.sender, ipnsPointer);
        return newTokenId;
    }

    /// @notice Revokes a previously issued credential
    /// @dev Only the original issuing institution can revoke
    /// @param tokenId The token to revoke
    function revokeSBT(uint256 tokenId) external {
        require(_exists(tokenId), "SBT: token does not exist");
        require(
            tokenIssuer[tokenId] == msg.sender,
            "SBT: only the original issuer can revoke"
        );
        require(!isRevoked[tokenId], "SBT: credential already revoked");

        isRevoked[tokenId] = true;
        emit CredentialRevoked(tokenId, msg.sender);
    }

    /// @notice Checks whether a credential is currently valid
    /// @param tokenId The token to check
    /// @return True only if the token exists, has an IPNS pointer, and is not revoked
    function isValid(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) return false;
        if (isRevoked[tokenId]) return false;
        if (bytes(tokenIPNS[tokenId]).length == 0) return false;
        return true;
    }

    /// @notice Allows a student to control whether their credential is publicly discoverable
    /// @param tokenId The token to update consent for
    /// @param isPublic True to make the credential publicly discoverable
    function setConsentFlag(uint256 tokenId, bool isPublic) external {
        require(
            ownerOf(tokenId) == msg.sender,
            "SBT: only token owner can set consent"
        );
        isPubliclyDiscoverable[tokenId] = isPublic;
        emit ConsentFlagUpdated(tokenId, isPublic);
    }

    /// @notice Returns all key credential information in a single call
    /// @param tokenId The token to query
    /// @return ipnsPointer The IPFS/IPNS pointer to metadata
    /// @return revoked Whether the credential has been revoked
    /// @return issuer The institution that issued the credential
    /// @return student The student who holds the credential
    function getCredential(
        uint256 tokenId
    )
        external
        view
        returns (
            string memory ipnsPointer,
            bool revoked,
            address issuer,
            address student
        )
    {
        require(_exists(tokenId), "SBT: token does not exist");
        return (
            tokenIPNS[tokenId],
            isRevoked[tokenId],
            tokenIssuer[tokenId],
            ownerOf(tokenId)
        );
    }

    // ─── Role Management ──────────────────────────────────────────────────

    /// @notice Grants INSTITUTION_ROLE to an institution address
    /// @dev Only the DEFAULT_ADMIN_ROLE (deployer/owner) can call this
    /// @param institution The address to grant minting rights to
    function grantInstitutionRole(
        address institution
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            institution != address(0),
            "SBT: institution address cannot be zero"
        );
        _grantRole(INSTITUTION_ROLE, institution);
    }

    // ─── Interface Support ────────────────────────────────────────────────

    /// @notice Returns true if this contract implements the given interface
    /// @dev Supports ERC721, AccessControl, and EIP-5192
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
