export interface ProfitCalculation {
  grossProfit: bigint
  netProfit: bigint
  profitPercentage: number
  gasEstimate: bigint
  gasCost: bigint
  flashLoanFee: bigint
  isProfitable: boolean
  minAmountOut: bigint
}

export class ProfitCalculator {
  private gasPrice: bigint
  private flashLoanFeeRate: number // e.g., 0.0009 for 0.09%

  constructor(gasPrice: bigint, flashLoanFeeRate = 0.0009) {
    this.gasPrice = gasPrice
    this.flashLoanFeeRate = flashLoanFeeRate
  }

  calculateArbitrageProfit(
    amountIn: bigint,
    amountOutDex1: bigint,
    amountOutDex2: bigint,
    gasEstimate = 500000n,
    tokenDecimals = 18,
  ): ProfitCalculation {
    // Calculate flash loan fee
    const flashLoanFee = (amountIn * BigInt(Math.floor(this.flashLoanFeeRate * 10000))) / 10000n

    // Calculate gas cost
    const gasCost = gasEstimate * this.gasPrice

    // Determine arbitrage direction and calculate gross profit
    let grossProfit = 0n
    let minAmountOut = 0n

    if (amountOutDex1 > amountOutDex2) {
      // Buy on DEX2, sell on DEX1
      grossProfit = amountOutDex1 - amountIn
      minAmountOut = amountOutDex2
    } else if (amountOutDex2 > amountOutDex1) {
      // Buy on DEX1, sell on DEX2
      grossProfit = amountOutDex2 - amountIn
      minAmountOut = amountOutDex1
    }

    // Calculate net profit (subtract fees and gas)
    const netProfit = grossProfit - flashLoanFee - gasCost

    // Calculate profit percentage
    const profitPercentage = Number((netProfit * 10000n) / amountIn) / 100

    return {
      grossProfit,
      netProfit,
      profitPercentage,
      gasEstimate,
      gasCost,
      flashLoanFee,
      isProfitable: netProfit > 0n,
      minAmountOut,
    }
  }

  calculateOptimalAmount(
    price1: bigint,
    price2: bigint,
    liquidity1: bigint,
    liquidity2: bigint,
    tokenDecimals = 18,
  ): bigint {
    // Simplified optimal amount calculation
    // In production, this would use more sophisticated algorithms
    // considering liquidity depth and price impact

    const priceDiff = price1 > price2 ? price1 - price2 : price2 - price1
    const avgPrice = (price1 + price2) / 2n

    if (avgPrice === 0n) return 0n

    const priceImpactThreshold = avgPrice / 100n // 1% price impact threshold
    const maxAmount = (liquidity1 < liquidity2 ? liquidity1 : liquidity2) / 10n // 10% of smaller liquidity

    // Use smaller of price impact limited amount or liquidity limited amount
    const optimalAmount = priceDiff > priceImpactThreshold ? maxAmount : maxAmount / 2n

    return optimalAmount
  }

  updateGasPrice(newGasPrice: bigint) {
    this.gasPrice = newGasPrice
  }

  updateFlashLoanFeeRate(newRate: number) {
    this.flashLoanFeeRate = newRate
  }

  // Calculate slippage protection parameters
  calculateSlippageParams(
    expectedAmountOut: bigint,
    slippageTolerancePercent: number,
  ): { minAmountOut: bigint; maxSlippage: bigint } {
    const slippageBps = BigInt(Math.floor(slippageTolerancePercent * 100)) // Convert to basis points
    const maxSlippage = (expectedAmountOut * slippageBps) / 10000n
    const minAmountOut = expectedAmountOut - maxSlippage

    return { minAmountOut, maxSlippage }
  }

  // Estimate MEV protection requirements
  estimateMEVProtection(
    profitAmount: bigint,
    blockTime = 2000, // 2 seconds average block time on Base
  ): { priorityFee: bigint; maxFeePerGas: bigint } {
    // Calculate competitive fees to avoid MEV
    const basePriorityFee = this.gasPrice / 10n // 10% of gas price as base priority
    const mevProtectionFee = profitAmount / 100n // 1% of profit for MEV protection

    const priorityFee = basePriorityFee + mevProtectionFee
    const maxFeePerGas = this.gasPrice + priorityFee

    return { priorityFee, maxFeePerGas }
  }
}
