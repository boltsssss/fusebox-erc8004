/**
 * Fusebox ERC-8004 Demo Script
 * 
 * Simulates a full Fusebox agent lifecycle:
 * 1. Agent registers its ERC-8004 identity onchain
 * 2. Agent discovers a task in a codebase
 * 3. Agent executes the task (simulated)
 * 4. Verifier records completion → reputation event minted onchain
 * 5. Read back agent reputation — tier, score, task history
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─── Configuration ────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract addresses (set after deploy)
const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY || "";
const REPUTATION_REGISTRY = process.env.REPUTATION_REGISTRY || "";

// Task types
const TASK_TYPES = { BUG_FIX: 0, FEATURE: 1, REFACTOR: 2, TEST: 3, REVIEW: 4 };

async function main() {
  console.log("\n⚡ FUSEBOX ERC-8004 DEMO\n");

  // ── Connect ─────────────────────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = PRIVATE_KEY
    ? new ethers.Wallet(PRIVATE_KEY, provider)
    : ethers.Wallet.createRandom().connect(provider);

  console.log(`📍 Wallet: ${wallet.address}`);
  console.log(`🔗 Network: Base Sepolia\n`);

  // ── Step 1: Register Agent Identity ─────────────────────────────────────────
  console.log("STEP 1 — Register Fusebox Agent Identity (ERC-8004)");
  
  const agentCardURI = "https://fusebox.shortcircuit.ventures/.well-known/agent-card.json";
  
  if (IDENTITY_REGISTRY) {
    const identityABI = [
      "function registerAgent(string calldata agentURI) external returns (uint256)",
      "function totalAgents() external view returns (uint256)",
      "event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)"
    ];
    const registry = new ethers.Contract(IDENTITY_REGISTRY, identityABI, wallet);
    const tx = await registry.registerAgent(agentCardURI);
    const receipt = await tx.wait();
    console.log(`✅ Agent registered — tx: ${tx.hash}`);
    console.log(`   agentURI: ${agentCardURI}\n`);
  } else {
    console.log(`   [DEMO MODE] Would register agent with URI: ${agentCardURI}\n`);
  }

  // ── Step 2: Discover Task ────────────────────────────────────────────────────
  console.log("STEP 2 — Agent Discovers Task in Codebase");
  
  const discoveredTask = {
    id: "TASK-4471",
    type: "BUG_FIX",
    description: "Fix race condition in async job queue — tasks occasionally lost when worker restarts",
    file: "src/workers/queue.ts",
    severity: "HIGH",
    discoveredAt: new Date().toISOString()
  };
  
  console.log(`   Task: ${discoveredTask.id} — ${discoveredTask.description}`);
  console.log(`   Type: ${discoveredTask.type} | File: ${discoveredTask.file}`);
  console.log(`   Severity: ${discoveredTask.severity}\n`);

  // ── Step 3: Execute Task ─────────────────────────────────────────────────────
  console.log("STEP 3 — Agent Executes Task");
  console.log("   [Scanning codebase...]");
  console.log("   [Identifying root cause: missing mutex lock on dequeue operation]");
  console.log("   [Generating fix: added atomic compareAndSwap with retry logic]");
  console.log("   [Running tests: 47/47 passing]");
  console.log("   [Opening PR: github.com/shortcircuit/fusebox/pull/892]");
  
  const prUrl = "https://github.com/shortcircuit/fusebox/pull/892";
  const commitHash = "a4f8d2c";
  const testOutput = "47 tests passing, 0 failing, coverage 94.2%";
  
  // Build evidence hash — keccak256 of PR + commit + test output
  const evidence = `${prUrl}|${commitHash}|${testOutput}`;
  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes(evidence));
  console.log(`\n   Evidence hash: ${evidenceHash}\n`);

  // ── Step 4: Record Reputation Event ─────────────────────────────────────────
  console.log("STEP 4 — Record Verified Task Completion Onchain");
  
  const agentId = 0; // First registered agent
  const score = 92;  // Quality score from verifier
  
  if (REPUTATION_REGISTRY) {
    const reputationABI = [
      "function recordCompletion(uint256 agentId, uint8 taskType, uint8 score, bytes32 evidenceHash, string calldata metadata) external",
      "function getReputation(uint256 agentId) external view returns (uint256 tasks, uint256 avgScore, uint8 tier, string memory tierName)",
      "function getCompletions(uint256 agentId) external view returns (tuple(uint256 agentId, uint8 taskType, uint8 score, address verifier, uint256 timestamp, bytes32 evidenceHash, string metadata)[])",
      "event TaskCompleted(uint256 indexed agentId, uint8 taskType, uint8 score, address indexed verifier, bytes32 evidenceHash, uint256 completionIndex)"
    ];
    const repRegistry = new ethers.Contract(REPUTATION_REGISTRY, reputationABI, wallet);
    
    const tx = await repRegistry.recordCompletion(
      agentId,
      TASK_TYPES.BUG_FIX,
      score,
      evidenceHash,
      `ipfs://QmFuseboxDemo|${prUrl}`
    );
    const receipt = await tx.wait();
    console.log(`✅ Reputation event recorded — tx: ${tx.hash}`);
    
    // ── Step 5: Read Reputation ────────────────────────────────────────────────
    console.log("\nSTEP 5 — Read Agent Reputation");
    const [tasks, avgScore, tier, tierName] = await repRegistry.getReputation(agentId);
    
    console.log(`\n   Agent ID:    #${agentId}`);
    console.log(`   Tasks Done:  ${tasks}`);
    console.log(`   Avg Score:   ${avgScore}/100`);
    console.log(`   Tier:        ${tierName} (${tier})`);
    console.log(`   Completions: onchain — fully verifiable, immutable`);
  } else {
    // Demo mode — show what would happen
    console.log(`   [DEMO MODE] Would record:`);
    console.log(`     agentId: ${agentId}`);
    console.log(`     taskType: BUG_FIX (0)`);
    console.log(`     score: ${score}/100`);
    console.log(`     evidenceHash: ${evidenceHash}`);
    
    console.log(`\nSTEP 5 — Simulated Reputation State`);
    console.log(`   Agent ID:    #${agentId}`);
    console.log(`   Tasks Done:  1`);
    console.log(`   Avg Score:   92/100`);
    console.log(`   Tier:        Unranked → Junior (after 3 tasks)`);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`⚡ FUSEBOX ERC-8004: Every task is a verifiable credential.`);
  console.log(`   The agent builds a career. Onchain. Immutable. Provable.`);
  console.log(`${"─".repeat(60)}\n`);
}

main().catch(console.error);
