# ArbAgent - ERC-4337 Gasless Arbitrage Platform

A production-ready, fully functional crypto arbitrage application using ERC-4337 Account Abstraction on Base Mainnet. Execute profitable arbitrage trades between Uniswap V3 and 1inch with gasless transactions.

## Features

- **Gasless Transactions**: Execute arbitrage using ERC-4337 with sponsored gas via custom Paymaster
- **Real-time Monitoring**: Continuous scanning for profitable arbitrage opportunities
- **Flash Loan Integration**: Automated flash loans from Aave for capital-efficient arbitrage
- **Multi-DEX Support**: Arbitrage between Uniswap V3 and 1inch aggregator
- **Smart Account Management**: ERC-4337 compatible smart accounts with social recovery
- **Profit Optimization**: Real-time profit calculation with slippage protection
- **Security Features**: Reentrancy protection, rate limiting, and emergency controls

## Architecture

\`\`\`
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Smart Account  │    │   Paymaster     │
│   (Next.js)     │◄──►│   (ERC-4337)     │◄──►│   (Gas Sponsor) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Arbitrage     │    │   Flash Loan     │    │   DEX           │
│   Monitor       │◄──►│   Provider       │◄──►│   Aggregators   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
\`\`\`

## Quick Start

### Prerequisites

- Node.js 18+
- Hardhat
- Base Mainnet RPC access
- 1inch API key
- Bundler service access

### Installation

1. **Clone and Install**
\`\`\`bash
git clone <repository-url>
cd arb-agent
npm install
\`\`\`

2. **Environment Setup**
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

3. **Compile Contracts**
\`\`\`bash
npm run compile
\`\`\`

4. **Deploy to Base Mainnet**
\`\`\`bash
npm run deploy
\`\`\`

5. **Start Frontend**
\`\`\`bash
npm run dev
\`\`\`

### Configuration

#### Required Environment Variables

\`\`\`env
# Essential Configuration
PRIVATE_KEY=0x...                                    # Deployer private key
BASE_RPC_URL=https://mainnet.base.org               # Base RPC endpoint
NEXT_PUBLIC_1INCH_API_KEY=...                       # 1inch API key
NEXT_PUBLIC_BUNDLER_URL=https://api.stackup.sh/...  # ERC-4337 bundler
\`\`\`

#### Contract Deployment

After running `npm run deploy`, update your `.env` with the deployed addresses:

\`\`\`env
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x...
NEXT_PUBLIC_ARBITRAGE_EXECUTOR_ADDRESS=0x...
\`\`\`

## Usage Guide

### 1. Connect Wallet & Setup Smart Account

1. Open the application at `http://localhost:3000`
2. Connect your MetaMask wallet
3. Navigate to "Smart Account" tab
4. Deploy or import your ERC-4337 smart account

### 2. Configure Settings

1. Go to "Settings" tab
2. Enter your contract addresses
3. Set minimum profit threshold (recommended: 0.5%)
4. Configure gas limits and slippage tolerance

### 3. Start Arbitrage Monitoring

1. Navigate to "Opportunities" tab
2. Click "Start Monitoring"
3. The system will scan for profitable opportunities every 15 seconds
4. Execute trades with one click - completely gasless!

### 4. Monitor Performance

- View real-time opportunities with profit estimates
- Track execution history in "Trade History"
- Monitor gas savings from sponsored transactions

## Smart Contract Architecture

### Core Contracts

#### SmartAccount.sol
- ERC-4337 compatible account implementation
- Signature validation and execution logic
- Upgradeable via UUPS proxy pattern

#### ArbitragePaymaster.sol
- Sponsors gas for arbitrage transactions
- Rate limiting: 1 transaction per 30 seconds per account
- Validates arbitrage-specific transactions only

#### ArbitrageExecutor.sol
- Flash loan receiver implementation
- Executes arbitrage between Uniswap V3 and 1inch
- Profit calculation and slippage protection

### Security Features

- **Reentrancy Protection**: All external calls protected
- **Flash Loan Safety**: Automatic repayment validation
- **Rate Limiting**: Prevents paymaster abuse
- **Access Control**: Owner-only emergency functions
- **Slippage Protection**: Minimum profit thresholds

## API Integration

### 1inch Integration
\`\`\`typescript
// Real-time price fetching
const response = await fetch(
  `https://api.1inch.dev/swap/v5.2/8453/swap?src=${tokenA}&dst=${tokenB}&amount=${amount}`,
  {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  }
);
\`\`\`

### Uniswap V3 Integration
\`\`\`typescript
// Direct quoter contract calls
const quoter = new ethers.Contract(quoterAddress, quoterABI, provider);
const amountOut = await quoter.quoteExactInputSingle(
  tokenIn, tokenOut, fee, amountIn, 0
);
\`\`\`

## Deployment Guide

### Mainnet Deployment

1. **Fund Deployer Account**
\`\`\`bash
# Ensure deployer has sufficient ETH for gas
\`\`\`

2. **Deploy Contracts**
\`\`\`bash
npm run deploy
\`\`\`

3. **Verify Contracts**
\`\`\`bash
npx hardhat verify --network base <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
\`\`\`

4. **Fund Paymaster**
\`\`\`bash
# Send ETH to paymaster for gas sponsorship
\`\`\`

### Production Checklist

- [ ] All contracts deployed and verified
- [ ] Paymaster funded with sufficient ETH
- [ ] API keys configured and tested
- [ ] Bundler service operational
- [ ] Frontend deployed to Vercel
- [ ] Monitoring alerts configured

## Monitoring & Maintenance

### Key Metrics to Monitor

- **Paymaster Balance**: Ensure sufficient funds for gas sponsorship
- **Arbitrage Success Rate**: Track profitable vs failed executions
- **Gas Costs**: Monitor sponsored gas consumption
- **API Rate Limits**: 1inch and bundler usage

### Maintenance Tasks

- **Weekly**: Check paymaster balance and refund if needed
- **Daily**: Monitor arbitrage opportunities and execution success
- **Real-time**: Alert on failed transactions or API errors

## Security Considerations

### Smart Contract Security

- All contracts audited for common vulnerabilities
- Flash loan repayment guaranteed before profit distribution
- Emergency pause functionality for critical issues
- Multi-signature wallet recommended for contract ownership

### Operational Security

- Private keys stored securely (hardware wallet recommended)
- API keys rotated regularly
- Monitoring for unusual transaction patterns
- Rate limiting prevents abuse of gas sponsorship

## Troubleshooting

### Common Issues

**"Insufficient funds to repay" Error**
- Arbitrage not profitable after gas costs
- Increase minimum profit threshold
- Check slippage settings

**"Rate limit exceeded" Error**
- Paymaster enforces 30-second cooldown
- Wait before retrying transaction

**"Not an arbitrage transaction" Error**
- Paymaster only sponsors arbitrage calls
- Ensure correct function selector

### Debug Mode

Enable detailed logging:
\`\`\`bash
DEBUG=arb-agent:* npm run dev
\`\`\`

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided for educational and research purposes. Users are responsible for:
- Compliance with local regulations
- Understanding smart contract risks
- Managing private keys securely
- Monitoring for MEV and front-running

**Use at your own risk. The authors are not responsible for any financial losses.**

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Comprehensive guides and API reference
- Community: Join our Discord for real-time support

---

**ArbAgent** - Democratizing DeFi arbitrage through Account Abstraction
