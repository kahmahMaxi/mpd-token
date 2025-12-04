# MPD Token Suite

> **📁 This repo contains all token-related smart contracts for MPD DEX**

## Overview

This repository houses the token ecosystem that powers MPD DEX — our fork of GMX's perpetual trading protocol. The tokens in this suite serve critical functions including governance, fee distribution, liquidity provision, and long-term incentive alignment.

---

## Token Architecture

### 1. MPD Token (Governance Token)

**Status**: 📋 Planned

| Property | Value |
|----------|-------|
| Name | MPD Token (placeholder) |
| Symbol | MPD (placeholder) |
| Standard | ERC-20 |
| Decimals | 18 |

#### Role in the Protocol

The MPD token serves two primary functions:

1. **Governance**
   - Token holders can participate in protocol governance
   - Vote on proposals affecting protocol parameters
   - Influence fee structures, supported markets, and protocol upgrades

2. **Fee Distribution**
   - Staked MPD tokens earn a share of protocol-generated fees
   - Fees are distributed in the native currency of the deployed chain (e.g., ETH on Arbitrum)
   - Revenue share model similar to GMX (30% to stakers, 70% to LPs)

#### Token Utility

- Stake to earn protocol fees
- Stake to earn escrowed MPD (esMPD) rewards
- Stake to earn Multiplier Points (bonus rewards)
- Governance voting rights

---

### 2. esMPD Token (Escrowed MPD)

**Status**: 📋 Planned

| Property | Value |
|----------|-------|
| Name | Escrowed MPD |
| Symbol | esMPD |
| Standard | ERC-20 (non-transferable) |
| Decimals | 18 |

#### Purpose

esMPD is a non-transferable token that represents locked/vesting MPD rewards:

- **Earned through staking**: Users who stake MPD or provide liquidity earn esMPD as additional rewards
- **Non-transferable**: Cannot be sold or transferred (prevents immediate sell pressure)
- **Vestable**: Can be converted to regular MPD through a vesting process
- **Stakeable**: Can be staked to earn the same rewards as regular MPD

#### Vesting Mechanism

esMPD can be vested into MPD over a period of time:
- Vesting requires locking a proportional amount of MPD or LP tokens
- Vesting period: TBD (typically 12 months in GMX model)
- Early exit forfeits unvested tokens

---

### 3. Vesting Contract

**Status**: 📋 Planned (to be implemented later)

The vesting contract will manage the conversion of esMPD to MPD:

- Track vesting positions per user
- Enforce vesting schedules
- Handle early withdrawal penalties
- Manage locked collateral requirements

---

## Planned File Structure

```
tokens/
├── README.md                 # This file
├── contracts/
│   ├── MPD.sol              # Main governance token
│   ├── EsMPD.sol            # Escrowed token
│   ├── Vester.sol           # Vesting contract
│   └── interfaces/
│       ├── IMPD.sol
│       ├── IEsMPD.sol
│       └── IVester.sol
├── scripts/
│   └── deploy.js            # Deployment scripts
└── test/
    ├── MPD.test.js
    ├── EsMPD.test.js
    └── Vester.test.js
```

---

## Development Milestones

| Milestone | Status | Description |
|-----------|--------|-------------|
| Documentation Setup | ✅ Complete | This README and repo structure |
| MPD Token Contract | ⏳ Pending | ERC-20 governance token implementation |
| esMPD Token Contract | ⏳ Pending | Non-transferable escrowed token |
| Vester Contract | ⏳ Pending | Vesting mechanism for esMPD → MPD |
| Integration | ⏳ Pending | Connect tokens to staking/reward system |
| Testing | ⏳ Pending | Comprehensive test coverage |
| Audit Prep | ⏳ Pending | Security review preparation |

---

## Integration Points

These tokens will integrate with:

| System | Integration |
|--------|-------------|
| **Staking (V1)** | RewardRouter, RewardTracker contracts |
| **Staking (V2)** | Synthetics staking system |
| **Fee Distribution** | Protocol fee collector and distributor |
| **Governance** | On-chain or off-chain voting system |
| **Frontend** | gmx-interface token displays and interactions |

---

## Naming Convention

> ⚠️ **Note**: "MPD" is a placeholder name.

All token names and symbols are placeholders and will be finalized before deployment:

| Placeholder | Description |
|-------------|-------------|
| MPD | Main governance token |
| esMPD | Escrowed/vesting token |
| MPD-LP | Liquidity provider tokens (in other repos) |

---

## Current Milestone

**🎯 This milestone focuses ONLY on documentation and setup.**

- ✅ Created `/tokens` repo
- ✅ Documented token architecture
- ✅ Defined token roles and purposes
- ✅ Outlined planned file structure
- ⏳ **No contract code yet** — awaiting next milestone

---

## Next Steps

1. Implement MPD token contract (ERC-20)
2. Implement esMPD token contract (non-transferable ERC-20)
3. Implement Vester contract
4. Write comprehensive tests
5. Integrate with staking system from gmx-contracts

---

## References

- [GMX Token Model](https://gmxio.gitbook.io/gmx/tokenomics)
- [OpenZeppelin ERC-20](https://docs.openzeppelin.com/contracts/4.x/erc20)
- [GMX Contracts (Original)](https://github.com/gmx-io/gmx-contracts)

