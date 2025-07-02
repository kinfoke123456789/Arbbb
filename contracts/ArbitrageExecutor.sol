// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

interface ILendingPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface I1InchRouter {
    function swap(
        address caller,
        bytes calldata desc,
        bytes calldata data
    ) external returns (uint256 returnAmount, uint256 gasLeft);
}

contract ArbitrageExecutor is IFlashLoanReceiver, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    ILendingPool public constant AAVE_LENDING_POOL = ILendingPool(0xA238Dd80C259a72e81d7e4664a9801593F98d1c5); // Base Aave
    IUniswapV3Router public constant UNISWAP_ROUTER = IUniswapV3Router(0x2626664c2603336E57B271c5C0b26F421741e481); // Base Uniswap V3
    I1InchRouter public constant ONEINCH_ROUTER = I1InchRouter(0x1111111254EEB25477B68fb85Ed929f73A960582); // 1inch Router

    struct ArbitrageParams {
        address tokenA;
        address tokenB;
        uint256 amountIn;
        uint24 uniswapFee;
        bytes oneInchCallData;
        uint256 minProfit;
        address recipient;
    }

    event ArbitrageExecuted(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        address indexed recipient
    );

    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium
    );

    function executeArbitrage(ArbitrageParams calldata params) external nonReentrant {
        require(params.amountIn > 0, "Invalid amount");
        require(params.tokenA != params.tokenB, "Same tokens");
        
        address[] memory assets = new address[](1);
        assets[0] = params.tokenA;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = params.amountIn;
        
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // No debt mode
        
        bytes memory encodedParams = abi.encode(params);
        
        AAVE_LENDING_POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            encodedParams,
            0
        );
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(AAVE_LENDING_POOL), "Invalid caller");
        require(initiator == address(this), "Invalid initiator");

        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));
        
        address asset = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];
        
        // Execute arbitrage logic
        uint256 profit = _performArbitrage(arbParams, amount);
        
        // Ensure we have enough to repay the flash loan
        uint256 amountOwed = amount + premium;
        require(IERC20(asset).balanceOf(address(this)) >= amountOwed, "Insufficient funds to repay");
        
        // Approve repayment
        IERC20(asset).safeApprove(address(AAVE_LENDING_POOL), amountOwed);
        
        // Transfer profit to recipient
        if (profit > 0) {
            IERC20(asset).safeTransfer(arbParams.recipient, profit);
        }
        
        emit FlashLoanExecuted(asset, amount, premium);
        emit ArbitrageExecuted(arbParams.tokenA, arbParams.tokenB, amount, profit, arbParams.recipient);
        
        return true;
    }

    function _performArbitrage(ArbitrageParams memory params, uint256 flashLoanAmount) internal returns (uint256 profit) {
        IERC20 tokenA = IERC20(params.tokenA);
        IERC20 tokenB = IERC20(params.tokenB);
        
        uint256 initialBalance = tokenA.balanceOf(address(this));
        
        // Step 1: Swap tokenA to tokenB on Uniswap
        tokenA.safeApprove(address(UNISWAP_ROUTER), flashLoanAmount);
        
        IUniswapV3Router.ExactInputSingleParams memory uniswapParams = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: params.tokenA,
            tokenOut: params.tokenB,
            fee: params.uniswapFee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: flashLoanAmount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        uint256 tokenBAmount = UNISWAP_ROUTER.exactInputSingle(uniswapParams);
        
        // Step 2: Swap tokenB back to tokenA on 1inch
        tokenB.safeApprove(address(ONEINCH_ROUTER), tokenBAmount);
        
        (uint256 returnAmount,) = ONEINCH_ROUTER.swap(
            address(this),
            params.oneInchCallData,
            ""
        );
        
        uint256 finalBalance = tokenA.balanceOf(address(this));
        
        // Calculate profit (should be positive for profitable arbitrage)
        if (finalBalance > initialBalance) {
            profit = finalBalance - initialBalance;
            require(profit >= params.minProfit, "Insufficient profit");
        } else {
            revert("Arbitrage not profitable");
        }
        
        return profit;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    receive() external payable {}
}
