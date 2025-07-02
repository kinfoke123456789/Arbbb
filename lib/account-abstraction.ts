import { ethers } from "ethers"
import { CONTRACTS, SMART_ACCOUNT_ABI } from "./contracts"

export interface UserOperation {
  sender: string
  nonce: string
  initCode: string
  callData: string
  callGasLimit: string
  verificationGasLimit: string
  preVerificationGas: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  paymasterAndData: string
  signature: string
}

export class SmartAccountManager {
  private provider: ethers.Provider
  private signer: ethers.Signer
  private entryPointAddress: string
  private paymasterAddress: string
  private bundlerUrl: string

  constructor(
    provider: ethers.Provider,
    signer: ethers.Signer,
    paymasterAddress: string,
    bundlerUrl = "https://api.stackup.sh/v1/node/base-mainnet",
  ) {
    this.provider = provider
    this.signer = signer
    this.entryPointAddress = CONTRACTS.BASE_MAINNET.ENTRY_POINT
    this.paymasterAddress = paymasterAddress
    this.bundlerUrl = bundlerUrl
  }

  async createSmartAccount(ownerAddress: string): Promise<string> {
    // This would typically involve deploying a new smart account
    // For production, you'd use a factory contract
    throw new Error("Smart account creation not implemented - use factory contract")
  }

  async buildUserOperation(
    smartAccountAddress: string,
    target: string,
    value: string,
    data: string,
  ): Promise<UserOperation> {
    const smartAccount = new ethers.Contract(smartAccountAddress, SMART_ACCOUNT_ABI, this.provider)

    // Get nonce
    const nonce = await this.provider.getTransactionCount(smartAccountAddress)

    // Build call data for execute function
    const callData = smartAccount.interface.encodeFunctionData("execute", [target, value, data])

    // Estimate gas
    const gasEstimate = await this.provider.estimateGas({
      to: smartAccountAddress,
      data: callData,
    })

    // Get gas prices
    const feeData = await this.provider.getFeeData()

    const userOp: UserOperation = {
      sender: smartAccountAddress,
      nonce: ethers.toBeHex(nonce),
      initCode: "0x",
      callData,
      callGasLimit: ethers.toBeHex(gasEstimate),
      verificationGasLimit: ethers.toBeHex(150000),
      preVerificationGas: ethers.toBeHex(21000),
      maxFeePerGas: ethers.toBeHex(feeData.maxFeePerGas || 0),
      maxPriorityFeePerGas: ethers.toBeHex(feeData.maxPriorityFeePerGas || 0),
      paymasterAndData: this.paymasterAddress + "0".repeat(40), // Paymaster address + empty data
      signature: "0x",
    }

    return userOp
  }

  async signUserOperation(userOp: UserOperation): Promise<UserOperation> {
    // Get user operation hash from entry point
    const entryPoint = new ethers.Contract(
      this.entryPointAddress,
      [
        "function getUserOpHash(tuple(address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)) external view returns (bytes32)",
      ],
      this.provider,
    )

    const userOpHash = await entryPoint.getUserOpHash([
      userOp.sender,
      userOp.nonce,
      userOp.initCode,
      userOp.callData,
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      userOp.paymasterAndData,
      userOp.signature,
    ])

    // Sign the hash
    const signature = await this.signer.signMessage(ethers.getBytes(userOpHash))

    return {
      ...userOp,
      signature,
    }
  }

  async submitUserOperation(userOp: UserOperation): Promise<string> {
    const response = await fetch(this.bundlerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [userOp, this.entryPointAddress],
      }),
    })

    const result = await response.json()

    if (result.error) {
      throw new Error(`Bundler error: ${result.error.message}`)
    }

    return result.result // Returns user operation hash
  }

  async waitForUserOperation(userOpHash: string): Promise<any> {
    let attempts = 0
    const maxAttempts = 60 // 5 minutes with 5-second intervals

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(this.bundlerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getUserOperationReceipt",
            params: [userOpHash],
          }),
        })

        const result = await response.json()

        if (result.result) {
          return result.result
        }
      } catch (error) {
        console.error("Error checking user operation status:", error)
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error("User operation timeout")
  }
}
