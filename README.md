# MPD Token Suite

> **📁 This repo contains all token-related smart contracts for MPD DEX**

## Overview

This is a **Hardhat workspace** housing the token ecosystem that powers MPD DEX — our fork of GMX's perpetual trading protocol. The tokens in this suite serve critical functions including governance, fee distribution, liquidity provision, and long-term incentive alignment.

---

## Project Structure

```
mpd-token/
├── contracts/
│   ├── MPDToken.sol          # Main governance token (ERC20)
│   └── EsMPD.sol             # Escrowed MPD (non-transferable)
├── scripts/
│   └── deploy.js             # Deployment script
├── test/
│   └── token.test.js         # Test suite
├── hardhat.config.js         # Hardhat configuration
├── package.json              # Dependencies
├── .env.example              # Environment template
└── README.md                 # This file
```

---

## Contracts

### 1. MPDToken.sol (Governance Token)

| Property | Value |
|----------|-------|
| Name | MPD Token |
| Symbol | MPD |
| Standard | ERC-20 |
| Decimals | 18 |

**Features:**
- ✅ Standard ERC20 functionality
- ✅ Owner-controlled minting
- ✅ Full transferability
- ⏳ Burning (future)
- ⏳ Governance integration (future)

### 2. EsMPD.sol (Escrowed Token)

| Property | Value |
|----------|-------|
| Name | Escrowed MPD |
| Symbol | esMPD |
| Standard | ERC-20 (non-transferable) |
| Decimals | 18 |

**Features:**
- ✅ Non-transferable (transfers blocked)
- ✅ Minter authorization system
- ✅ Mint/burn by authorized contracts only
- ⏳ Vesting integration (future)

---

## Quick Start

### Prerequisites

- Node.js v18+
- npm or yarn

### Installation

```bash
cd mpd-token
npm install
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test
```

### Run Local Node

```bash
npm run node
```

### Deploy (Local)

```bash
# In a separate terminal, start local node first
npm run node

# Then deploy
npm run deploy:local
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile all contracts |
| `npm run test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run node` | Start local Hardhat node |
| `npm run deploy:local` | Deploy to local network |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npm run clean` | Clear cache and artifacts |

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer wallet private key |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `ETHERSCAN_API_KEY` | For contract verification |
| `REPORT_GAS` | Enable gas reporting |

---

## Development Milestones

| Milestone | Status | Description |
|-----------|--------|-------------|
| Documentation Setup | ✅ Complete | README and repo structure |
| Hardhat Setup | ✅ Complete | Full Hardhat workspace |
| MPDToken Contract | ✅ Complete | ERC-20 governance token |
| EsMPD Contract | ✅ Complete | Non-transferable escrowed token |
| Test Suite | ✅ Complete | Comprehensive tests |
| Vester Contract | ⏳ Pending | esMPD → MPD vesting |
| Staking Integration | ⏳ Pending | Connect to reward system |
| Audit Prep | ⏳ Pending | Security review |

---

## Future Contracts

The following contracts will be added to this repo:

| Contract | Purpose |
|----------|---------|
| `Vester.sol` | Vest esMPD into MPD over time |
| `RewardTracker.sol` | Track staking rewards |
| `RewardRouter.sol` | Unified staking interface |

---

## Integration Points

These tokens will integrate with:

| System | Integration |
|--------|-------------|
| **gmx-contracts (V1)** | Staking and rewards |
| **gmx-synthetics (V2)** | Synthetics staking |
| **gmx-interface** | Frontend token displays |

---

## License

MIT

## Attribution

Token architecture inspired by [GMX Protocol](https://gmx.io). All credit for the original design goes to the GMX team.
