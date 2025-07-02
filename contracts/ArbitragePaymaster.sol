// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IEntryPoint {
    function balanceOf(address account) external view returns (uint256);
    function depositTo(address account) external payable;
}

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

contract ArbitragePaymaster is Ownable, ReentrancyGuard {
    IEntryPoint public immutable entryPoint;
    
    mapping(address => uint256) public lastTransactionTime;
    uint256 public constant RATE_LIMIT_DURATION = 30; // 30 seconds between transactions
    uint256 public constant MAX_GAS_SPONSORSHIP = 500000; // Max gas units to sponsor
    
    event GasSponsored(address indexed account, uint256 gasUsed, uint256 actualGasCost);
    event PaymasterDeposit(uint256 amount);
    event PaymasterWithdraw(uint256 amount);

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
        external returns (bytes memory context, uint256 validationData) {
        
        // Rate limiting check
        require(
            block.timestamp >= lastTransactionTime[userOp.sender] + RATE_LIMIT_DURATION,
            "Rate limit exceeded"
        );
        
        // Gas limit check
        require(
            userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas <= MAX_GAS_SPONSORSHIP,
            "Gas limit too high"
        );
        
        // Check if this is an arbitrage transaction
        require(_isArbitrageTransaction(userOp.callData), "Not an arbitrage transaction");
        
        // Update rate limiting
        lastTransactionTime[userOp.sender] = block.timestamp;
        
        // Return context for postOp
        context = abi.encode(userOp.sender, maxCost);
        validationData = 0;
    }

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external {
        (address sender, uint256 maxCost) = abi.decode(context, (address, uint256));
        
        if (mode == PostOpMode.opSucceeded) {
            emit GasSponsored(sender, actualGasCost / tx.gasprice, actualGasCost);
        }
    }

    function _isArbitrageTransaction(bytes calldata callData) internal pure returns (bool) {
        // Check if the call data contains arbitrage function selector
        if (callData.length < 4) return false;
        
        bytes4 selector = bytes4(callData[:4]);
        // executeArbitrage function selector
        return selector == 0x8a8c523c;
    }

    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit PaymasterDeposit(msg.value);
    }

    function withdrawTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        (bool success,) = withdrawAddress.call{value: amount}("");
        require(success, "Withdraw failed");
        emit PaymasterWithdraw(amount);
    }

    function getBalance() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    receive() external payable {
        deposit();
    }

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }
}
