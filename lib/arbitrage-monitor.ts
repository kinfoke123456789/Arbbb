import { ethers } from "ethers"
import { CONTRACTS } from "./contracts"

export interface ArbitrageOpportunity {
  tokenA: string
  tokenB: string
  tokenASymbol: string
  tokenBSymbol: string
  amountIn: string
  expectedProfit: string
  profitPercentage: number
  uniswapPrice: string
  oneInchPrice: string
  gasEstimate: string
  timestamp: number
}

export interface TokenPair {
  tokenA: string
  tokenB: string
  symbolA: string
  symbolB: string
  decimalsA: number
  decimalsB: number
}

export class ArbitrageMonitor {
  private provider: ethers.Provider
  private oneInchApiKey: string
  private monitoringPairs: TokenPair[] = []
  private minProfitThreshold = 0.5 // 0.5% minimum profit

  constructor(provider: ethers.Provider, oneInchApiKey: string) {
    this.provider = provider
    this.oneInchApiKey = oneInchApiKey
    this.initializeDefaultPairs()
  }

  private initializeDefaultPairs() {
    this.monitoringPairs = [
      {
        tokenA: CONTRACTS.BASE_MAINNET.WETH,
        tokenB: CONTRACTS.BASE_MAINNET.USDC,
        symbolA: "WETH",
        symbolB: "USDC",
        decimalsA: 18,
        decimalsB: 6,
      },
      {
        tokenA: CONTRACTS.BASE_MAINNET.USDC,
        tokenB: CONTRACTS.BASE_MAINNET.DAI,
        symbolA: "USDC",
        symbolB: "DAI",
        decimalsA: 6,
        decimalsB: 18,
      },
    ]
  }

  async getUniswapPrice(tokenA: string, tokenB: string, amountIn: string): Promise<string> {
    // This is a simplified version - in production, you'd use Uniswap SDK
    // or direct contract calls to get accurate pricing
    try {
      const quoterAddress = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" // Uniswap V3 Quoter on Base
      const quoter = new ethers.Contract(
        quoterAddress,
        [
          "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
        ],
        this.provider,
      )

      const amountOut = await quoter.quoteExactInputSingle(
        tokenA,
        tokenB,
        3000, // 0.3% fee tier
        amountIn,
        0,
      )

      return amountOut.toString()
    } catch (error) {
      console.error("Error getting Uniswap price:", error)
      return "0"
    }
  }

  async get1InchPrice(tokenA: string, tokenB: string, amountIn: string): Promise<{ price: string; callData: string }> {
    try {
      const response = await fetch(
        `https://api.1inch.dev/swap/v5.2/8453/swap?src=${tokenA}&dst=${tokenB}&amount=${amountIn}&from=0x0000000000000000000000000000000000000000&slippage=1&disableEstimate=true`,
        {
          headers: {
            Authorization: `Bearer ${this.oneInchApiKey}`,
            accept: "application/json",
          },
        },
      )

      if (!response.ok) {
        throw new Error(`1inch API error: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        price: data.toAmount,
        callData: data.tx.data,
      }
    } catch (error) {
      console.error("Error getting 1inch price:", error)
      return { price: "0", callData: "0x" }
    }
  }

  async findArbitrageOpportunities(
    amountIn: string = ethers.parseEther("1").toString(),
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = []

    for (const pair of this.monitoringPairs) {
      try {
        // Get prices from both DEXs
        const [uniswapPrice, oneInchData] = await Promise.all([
          this.getUniswapPrice(pair.tokenA, pair.tokenB, amountIn),
          this.get1InchPrice(pair.tokenA, pair.tokenB, amountIn),
        ])

        if (uniswapPrice === "0" || oneInchData.price === "0") {
          continue
        }

        // Calculate profit potential
        const uniswapOut = BigInt(uniswapPrice)
        const oneInchOut = BigInt(oneInchData.price)

        let profit = 0n
        let direction = ""

        if (uniswapOut > oneInchOut) {
          // Buy on 1inch, sell on Uniswap
          profit = uniswapOut - oneInchOut
          direction = "1inch -> Uniswap"
        } else if (oneInchOut > uniswapOut) {
          // Buy on Uniswap, sell on 1inch
          profit = oneInchOut - uniswapOut
          direction = "Uniswap -> 1inch"
        }

        if (profit > 0n) {
          const profitPercentage = Number((profit * 10000n) / BigInt(amountIn)) / 100

          if (profitPercentage >= this.minProfitThreshold) {
            opportunities.push({
              tokenA: pair.tokenA,
              tokenB: pair.tokenB,
              tokenASymbol: pair.symbolA,
              tokenBSymbol: pair.symbolB,
              amountIn,
              expectedProfit: profit.toString(),
              profitPercentage,
              uniswapPrice,
              oneInchPrice: oneInchData.price,
              gasEstimate: "500000", // Estimated gas for arbitrage
              timestamp: Date.now(),
            })
          }
        }
      } catch (error) {
        console.error(`Error checking pair ${pair.symbolA}/${pair.symbolB}:`, error)
      }
    }

    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage)
  }

  async startMonitoring(callback: (opportunities: ArbitrageOpportunity[]) => void, intervalMs = 10000) {
    console.log("Starting arbitrage monitoring...")

    const monitor = async () => {
      try {
        const opportunities = await this.findArbitrageOpportunities()
        if (opportunities.length > 0) {
          callback(opportunities)
        }
      } catch (error) {
        console.error("Monitoring error:", error)
      }
    }

    // Initial check
    await monitor()

    // Set up interval
    return setInterval(monitor, intervalMs)
  }

  setMinProfitThreshold(threshold: number) {
    this.minProfitThreshold = threshold
  }

  addMonitoringPair(pair: TokenPair) {
    this.monitoringPairs.push(pair)
  }

  removeMonitoringPair(tokenA: string, tokenB: string) {
    this.monitoringPairs = this.monitoringPairs.filter((pair) => !(pair.tokenA === tokenA && pair.tokenB === tokenB))
  }
}
