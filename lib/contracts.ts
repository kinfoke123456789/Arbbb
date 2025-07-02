export const CONTRACTS = {
  BASE_MAINNET: {
    ENTRY_POINT: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    AAVE_LENDING_POOL: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    UNISWAP_V3_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481",
    ONEINCH_ROUTER: "0x1111111254EEB25477B68fb85Ed929f73A960582",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  },
}

export const SMART_ACCOUNT_ABI = [
  "function initialize(address anOwner) external",
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external",
  "function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData)",
  "function entryPoint() external view returns (address)",
  "function owner() external view returns (address)",
]

export const PAYMASTER_ABI = [
  "function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes memory context, uint256 validationData)",
  "function postOp(uint8 mode, bytes calldata context, uint256 actualGasCost) external",
  "function deposit() external payable",
  "function withdrawTo(address payable withdrawAddress, uint256 amount) external",
  "function getBalance() external view returns (uint256)",
]

export const ARBITRAGE_EXECUTOR_ABI = [
  "function executeArbitrage(tuple(address tokenA, address tokenB, uint256 amountIn, uint24 uniswapFee, bytes oneInchCallData, uint256 minProfit, address recipient) params) external",
  "function emergencyWithdraw(address token, uint256 amount) external",
  "event ArbitrageExecuted(address indexed tokenA, address indexed tokenB, uint256 amountIn, uint256 profit, address indexed recipient)",
  "event FlashLoanExecuted(address indexed asset, uint256 amount, uint256 premium)",
]

export const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
]
