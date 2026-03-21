# Fusebox × ERC-8004: Engineering Agents with Verifiable Reputation

> **Synthesis Hackathon — Protocol Labs Track: Agents With Receipts (ERC-8004)**

## The Idea

Fusebox agents autonomously discover tasks in codebases and execute them. Every verified completion is recorded as an immutable onchain reputation event — building a verifiable track record no one can fake and no one can erase.

**The agent builds a career. Onchain.**

## Why This Matters

Today, AI coding agents are black boxes. You don't know if the agent that fixed your bug last Tuesday is the same one running on your production codebase today. You can't verify its history. You can't prove it did the work.

ERC-8004 fixes this. Every Fusebox agent has:
- **A permanent onchain identity** (ERC-721 NFT, transferable, censorship-resistant)
- **A verifiable reputation** (task completions, quality scores, evidence hashes)
- **A pluggable trust model** (social reputation → crypto-economic staking → ZKP/TEE for critical systems)

## Architecture

### Three ERC-8004 Compliant Contracts

**1. FuseboxAgentRegistry (Identity)**
- ERC-721 NFT per agent
- `agentURI` points to `agent-card.json` (A2A + MCP compatible)
- Transferable ownership, operator delegation

**2. FuseboxReputationRegistry**
- Records every verified task completion onchain
- Evidence hash = keccak256(PR URL + commit + test output)
- Auto-calculates reputation tier: Unranked → Junior → Senior → Lead → Principal
- Fully queryable: tasks, average score, completion history

**3. FuseboxValidationRegistry**
- Pluggable trust hooks (ERC-8004 Validation Registry spec)
- Tier 1: Social reputation (low-stakes tasks)
- Tier 2: Crypto-economic staking (verifier stakes ETH, re-executes task)
- Tier 3: ZKP/TEE proof hooks (critical production systems)

### Reputation Tiers

| Tier | Tasks | Avg Score | Access |
|------|-------|-----------|--------|
| Unranked | 0-2 | any | Public repos, low-stakes |
| Junior | 3+ | 60+ | Standard codebases |
| Senior | 10+ | 70+ | Production systems |
| Lead | 20+ | 80+ | Critical infrastructure |
| Principal | 50+ | 90+ | Classified / high-stakes |

### The Ukraine Parallel

The battlefield marketplace model — units earn points for verified actions, reputation gates access to advanced resources — is the same architecture applied to software engineering. Fusebox agents earn reputation for verified completions. Reputation determines what codebases they can touch.

## The Demo Flow

```
1. Agent registers ERC-8004 identity (ERC-721 minted)
2. Agent discovers task: "Race condition in async queue" 
3. Agent executes: scans codebase → generates fix → runs tests → opens PR
4. Verifier records completion onchain (evidenceHash = keccak256(PR+commit+tests))
5. Reputation registry updates tier automatically
6. Anyone can verify: agent's full history, immutable, trustless
```

## Contracts (Base Sepolia)

Deploy with:
```bash
npm install
node scripts/deploy.js
```

Run demo:
```bash
RPC_URL=https://sepolia.base.org \
PRIVATE_KEY=your_key \
IDENTITY_REGISTRY=0x... \
REPUTATION_REGISTRY=0x... \
node scripts/demo.js
```

## ERC-8004 Compliance

- ✅ Identity Registry — ERC-721 with URIStorage, CAIP-10 format
- ✅ Agent registration file (agent-card.json) at `/.well-known/agent-card.json`
- ✅ Reputation Registry — feedback signals, onchain scoring
- ✅ Validation Registry — pluggable trust model hooks
- ✅ A2A protocol endpoint advertised in agent card
- ✅ `supportedTrust` array in registration file

## Built By

ShortCircuit Ventures — hey@shortcircuit.ventures
