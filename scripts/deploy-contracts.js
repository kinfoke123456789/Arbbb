const { ethers } = require("hardhat")

async function main() {
  console.log("Deploying ArbAgent contracts to Base Mainnet...")

  const [deployer] = await ethers.getSigners()
  console.log("Deploying contracts with account:", deployer.address)

  const balance = await deployer.getBalance()
  console.log("Account balance:", ethers.formatEther(balance), "ETH")

  // Deploy Smart Account Implementation
  console.log("\n1. Deploying Smart Account Implementation...")
  const SmartAccount = await ethers.getContractFactory("SmartAccount")
  const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" // Base Mainnet EntryPoint
  const smartAccountImpl = await SmartAccount.deploy(entryPointAddress)
  await smartAccountImpl.waitForDeployment()
  console.log("Smart Account Implementation deployed to:", await smartAccountImpl.getAddress())

  // Deploy Arbitrage Paymaster
  console.log("\n2. Deploying Arbitrage Paymaster...")
  const ArbitragePaymaster = await ethers.getContractFactory("ArbitragePaymaster")
  const paymaster = await ArbitragePaymaster.deploy(entryPointAddress)
  await paymaster.waitForDeployment()
  console.log("Arbitrage Paymaster deployed to:", await paymaster.getAddress())

  // Deploy Arbitrage Executor
  console.log("\n3. Deploying Arbitrage Executor...")
  const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor")
  const arbitrageExecutor = await ArbitrageExecutor.deploy()
  await arbitrageExecutor.waitForDeployment()
  console.log("Arbitrage Executor deployed to:", await arbitrageExecutor.getAddress())

  // Fund the paymaster
  console.log("\n4. Funding Paymaster...")
  const fundAmount = ethers.parseEther("0.1") // Fund with 0.1 ETH
  const fundTx = await paymaster.deposit({ value: fundAmount })
  await fundTx.wait()
  console.log("Paymaster funded with", ethers.formatEther(fundAmount), "ETH")

  // Verify contracts on Basescan
  console.log("\n5. Contract Verification Commands:")
  console.log(`npx hardhat verify --network base ${await smartAccountImpl.getAddress()} ${entryPointAddress}`)
  console.log(`npx hardhat verify --network base ${await paymaster.getAddress()} ${entryPointAddress}`)
  console.log(`npx hardhat verify --network base ${await arbitrageExecutor.getAddress()}`)

  // Save deployment info
  const deploymentInfo = {
    network: "base-mainnet",
    entryPoint: entryPointAddress,
    smartAccountImpl: await smartAccountImpl.getAddress(),
    paymaster: await paymaster.getAddress(),
    arbitrageExecutor: await arbitrageExecutor.getAddress(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  }

  console.log("\n6. Deployment Summary:")
  console.log(JSON.stringify(deploymentInfo, null, 2))

  // Save to file
  const fs = require("fs")
  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2))
  console.log("\nDeployment info saved to deployment.json")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
