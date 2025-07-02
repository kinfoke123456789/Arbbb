"use client"

import { useState, useEffect } from "react"
import { ethers } from "ethers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowRightLeft, TrendingUp, Wallet, Settings, Activity } from "lucide-react"
import { ArbitrageMonitor, type ArbitrageOpportunity } from "@/lib/arbitrage-monitor"
import { SmartAccountManager } from "@/lib/account-abstraction"
import { ARBITRAGE_EXECUTOR_ABI } from "@/lib/contracts"

export default function ArbAgentApp() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [account, setAccount] = useState<string>("")
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("")
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [executingTx, setExecutingTx] = useState<string>("")
  const [tradeHistory, setTradeHistory] = useState<any[]>([])
  const [settings, setSettings] = useState({
    minProfitThreshold: 0.5,
    maxGasPrice: 50,
    slippageTolerance: 1.0,
    paymasterAddress: "",
    arbitrageExecutorAddress: "",
    oneInchApiKey: "",
  })

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum)
      setProvider(provider)

      try {
        const accounts = await provider.send("eth_requestAccounts", [])
        if (accounts.length > 0) {
          const signer = await provider.getSigner()
          setSigner(signer)
          setAccount(accounts[0])
        }
      } catch (error) {
        console.error("Failed to connect wallet:", error)
      }
    }
  }

  const connectWallet = async () => {
    if (!provider) return

    try {
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setSigner(signer)
      setAccount(address)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    }
  }

  const startMonitoring = async () => {
    if (!provider || !settings.oneInchApiKey) {
      alert("Please configure your settings first")
      return
    }

    const monitor = new ArbitrageMonitor(provider, settings.oneInchApiKey)
    monitor.setMinProfitThreshold(settings.minProfitThreshold)

    setIsMonitoring(true)

    const intervalId = await monitor.startMonitoring((opps) => {
      setOpportunities(opps)
    }, 15000) // Check every 15 seconds

    // Store interval ID for cleanup
    ;(window as any).monitoringInterval = intervalId
  }

  const stopMonitoring = () => {
    if ((window as any).monitoringInterval) {
      clearInterval((window as any).monitoringInterval)
      ;(window as any).monitoringInterval = null
    }
    setIsMonitoring(false)
    setOpportunities([])
  }

  const executeArbitrage = async (opportunity: ArbitrageOpportunity) => {
    if (!signer || !settings.paymasterAddress || !settings.arbitrageExecutorAddress) {
      alert("Please configure your smart account and paymaster addresses")
      return
    }

    try {
      setExecutingTx(opportunity.tokenA + opportunity.tokenB)

      const smartAccountManager = new SmartAccountManager(provider!, signer, settings.paymasterAddress)

      // Build arbitrage parameters
      const arbitrageParams = {
        tokenA: opportunity.tokenA,
        tokenB: opportunity.tokenB,
        amountIn: opportunity.amountIn,
        uniswapFee: 3000, // 0.3%
        oneInchCallData: "0x", // This would come from 1inch API
        minProfit: ethers.parseUnits(opportunity.expectedProfit, 18),
        recipient: account,
      }

      // Encode the arbitrage execution call
      const arbitrageExecutor = new ethers.Contract(settings.arbitrageExecutorAddress, ARBITRAGE_EXECUTOR_ABI, provider)

      const callData = arbitrageExecutor.interface.encodeFunctionData("executeArbitrage", [arbitrageParams])

      // Build user operation
      const userOp = await smartAccountManager.buildUserOperation(
        smartAccountAddress,
        settings.arbitrageExecutorAddress,
        "0",
        callData,
      )

      // Sign and submit
      const signedUserOp = await smartAccountManager.signUserOperation(userOp)
      const userOpHash = await smartAccountManager.submitUserOperation(signedUserOp)

      // Wait for execution
      const receipt = await smartAccountManager.waitForUserOperation(userOpHash)

      // Add to trade history
      const trade = {
        id: userOpHash,
        timestamp: Date.now(),
        tokenA: opportunity.tokenASymbol,
        tokenB: opportunity.tokenBSymbol,
        profit: opportunity.expectedProfit,
        profitPercentage: opportunity.profitPercentage,
        txHash: receipt.transactionHash,
        status: "success",
      }

      setTradeHistory((prev) => [trade, ...prev])
    } catch (error) {
      console.error("Arbitrage execution failed:", error)
      alert(`Execution failed: ${error}`)
    } finally {
      setExecutingTx("")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-lg">
                <ArrowRightLeft className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ArbAgent</h1>
                <p className="text-gray-600">ERC-4337 Gasless Arbitrage Platform</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {account ? (
                <Badge variant="outline" className="px-3 py-1">
                  <Wallet className="h-4 w-4 mr-2" />
                  {account.slice(0, 6)}...{account.slice(-4)}
                </Badge>
              ) : (
                <Button onClick={connectWallet}>Connect Wallet</Button>
              )}
            </div>
          </div>
        </header>

        <Tabs defaultValue="opportunities" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="history">Trade History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="account">Smart Account</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5" />
                      <span>Arbitrage Opportunities</span>
                    </CardTitle>
                    <CardDescription>Real-time arbitrage opportunities on Base Mainnet</CardDescription>
                  </div>

                  <div className="flex space-x-2">
                    {!isMonitoring ? (
                      <Button onClick={startMonitoring}>
                        <Activity className="h-4 w-4 mr-2" />
                        Start Monitoring
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={stopMonitoring}>
                        Stop Monitoring
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isMonitoring && (
                  <Alert className="mb-4">
                    <Activity className="h-4 w-4" />
                    <AlertDescription>Monitoring active - Checking for opportunities every 15 seconds</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {opportunities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {isMonitoring
                        ? "Scanning for opportunities..."
                        : "Start monitoring to find arbitrage opportunities"}
                    </div>
                  ) : (
                    opportunities.map((opp, index) => (
                      <Card key={index} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary">{opp.tokenASymbol}</Badge>
                                <ArrowRightLeft className="h-4 w-4" />
                                <Badge variant="secondary">{opp.tokenBSymbol}</Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Expected Profit:</span>
                                  <div className="font-semibold text-green-600">{opp.profitPercentage.toFixed(2)}%</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Amount:</span>
                                  <div className="font-semibold">
                                    {ethers.formatEther(opp.amountIn)} {opp.tokenASymbol}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Button
                              onClick={() => executeArbitrage(opp)}
                              disabled={executingTx === opp.tokenA + opp.tokenB}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {executingTx === opp.tokenA + opp.tokenB ? "Executing..." : "Execute"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trade History</CardTitle>
                <CardDescription>Your past arbitrage executions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tradeHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No trades executed yet</div>
                  ) : (
                    tradeHistory.map((trade) => (
                      <Card key={trade.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary">{trade.tokenA}</Badge>
                                <ArrowRightLeft className="h-4 w-4" />
                                <Badge variant="secondary">{trade.tokenB}</Badge>
                                <Badge variant={trade.status === "success" ? "default" : "destructive"}>
                                  {trade.status}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Profit:</span>
                                  <div className="font-semibold text-green-600">
                                    {trade.profitPercentage.toFixed(2)}%
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Time:</span>
                                  <div className="font-semibold">{new Date(trade.timestamp).toLocaleTimeString()}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">TX:</span>
                                  <div className="font-semibold text-blue-600">{trade.txHash?.slice(0, 10)}...</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Configuration</span>
                </CardTitle>
                <CardDescription>Configure your arbitrage parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minProfit">Min Profit Threshold (%)</Label>
                    <Input
                      id="minProfit"
                      type="number"
                      step="0.1"
                      value={settings.minProfitThreshold}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          minProfitThreshold: Number.parseFloat(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxGas">Max Gas Price (gwei)</Label>
                    <Input
                      id="maxGas"
                      type="number"
                      value={settings.maxGasPrice}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxGasPrice: Number.parseInt(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymaster">Paymaster Address</Label>
                  <Input
                    id="paymaster"
                    placeholder="0x..."
                    value={settings.paymasterAddress}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        paymasterAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="executor">Arbitrage Executor Address</Label>
                  <Input
                    id="executor"
                    placeholder="0x..."
                    value={settings.arbitrageExecutorAddress}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        arbitrageExecutorAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">1inch API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Your 1inch API key"
                    value={settings.oneInchApiKey}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        oneInchApiKey: e.target.value,
                      }))
                    }
                  />
                </div>

                <Button className="w-full">Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Smart Account Management</CardTitle>
                <CardDescription>Manage your ERC-4337 smart account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="smartAccount">Smart Account Address</Label>
                  <Input
                    id="smartAccount"
                    placeholder="0x..."
                    value={smartAccountAddress}
                    onChange={(e) => setSmartAccountAddress(e.target.value)}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline">Deploy New Account</Button>
                  <Button variant="outline">Import Existing</Button>
                </div>

                {smartAccountAddress && (
                  <Alert>
                    <AlertDescription>
                      Smart account configured. You can now execute gasless arbitrage transactions.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
