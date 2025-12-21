// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CopyrightRegistry
 * @dev Event-based contract for copyright history
 * @notice Blockchain chỉ lưu event (rẻ gas, dễ audit)
 */
contract CopyrightRegistry {

    /* ========= EVENTS ========= */

    /// @notice Đăng ký bản quyền tác phẩm
    event WorkRegistered(
        address indexed user,
        string workId,
        bytes32 workHash,
        uint256 fee,
        uint256 time
    );

    /// @notice Giao dịch / mua bán bản quyền
    event WorkTraded(
        address indexed buyer,
        string workId,
        uint256 price,
        uint256 time
    );

    /* ========= FUNCTIONS ========= */

    function registerWork(
        string calldata workId,
        bytes32 workHash
    ) external payable {
        require(msg.value > 0, "Fee required");

        emit WorkRegistered(
            msg.sender,
            workId,
            workHash,
            msg.value,
            block.timestamp
        );
    }

    function tradeWork(
        string calldata workId
    ) external payable {
        require(msg.value > 0, "Price required");

        emit WorkTraded(
            msg.sender,
            workId,
            msg.value,
            block.timestamp
        );
    }
}
