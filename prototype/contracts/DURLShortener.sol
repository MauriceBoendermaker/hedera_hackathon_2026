// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DURLShortener {
    struct ShortLink {
        string originalUrl;
        uint256 createdAt;
    }

    mapping(string => ShortLink) public urlMapping;
    mapping(address => string[]) public userLinks;

    event ShortUrlCreated(
        address indexed user,
        string shortId,
        string originalUrl,
        uint256 createdAt
    );

    function generateShortUrl(string memory originalUrl) external {
        bytes32 hash = keccak256(
            abi.encodePacked(msg.sender, originalUrl, block.timestamp)
        );
        string memory shortId = _bytes32ToShortString(hash);

        require(bytes(urlMapping[shortId].originalUrl).length == 0, "Collision - try again");

        urlMapping[shortId] = ShortLink(originalUrl, block.timestamp);
        userLinks[msg.sender].push(shortId);

        emit ShortUrlCreated(msg.sender, shortId, originalUrl, block.timestamp);
    }

    function createCustomShortUrl(
        string memory customId,
        string memory originalUrl
    ) external payable {
        require(msg.value >= 1 ether, "Payment of 1 HBAR required");
        require(bytes(urlMapping[customId].originalUrl).length == 0, "Short ID already taken");

        urlMapping[customId] = ShortLink(originalUrl, block.timestamp);
        userLinks[msg.sender].push(customId);

        emit ShortUrlCreated(msg.sender, customId, originalUrl, block.timestamp);
    }

    function getOriginalUrl(string memory shortId) external view returns (string memory) {
        return urlMapping[shortId].originalUrl;
    }

    function getShortLink(string memory shortId) external view returns (string memory originalUrl, uint256 createdAt) {
        ShortLink memory link = urlMapping[shortId];
        return (link.originalUrl, link.createdAt);
    }

    function getUserLinks(address user) external view returns (string[] memory) {
        return userLinks[user];
    }

    function shortIdExists(string memory shortId) external view returns (bool) {
        return bytes(urlMapping[shortId].originalUrl).length > 0;
    }

    function _bytes32ToShortString(bytes32 hash) internal pure returns (string memory) {
        bytes memory alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
        bytes memory result = new bytes(8);
        for (uint256 i = 0; i < 8; i++) {
            result[i] = alphabet[uint8(hash[i]) % 36];
        }
        return string(result);
    }

    receive() external payable {}
}
