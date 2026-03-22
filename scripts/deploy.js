/**
 * Fusebox ERC-8004 Deploy Script
 * Deploys to Base Sepolia using pre-compiled bytecode
 */
const { ethers } = require("ethers");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = "https://sepolia.base.org";

// Pre-compiled bytecode for simple versions of the contracts
// FuseboxAgentRegistry — minimal ERC-721 with URI storage
const AGENT_REGISTRY_ABI = [
  "constructor()",
  "function registerAgent(string calldata agentURI) external returns (uint256)",
  "function totalAgents() external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)"
];

// FuseboxReputationRegistry — task completion + reputation tiers
const REPUTATION_REGISTRY_ABI = [
  "constructor(address _identityRegistry)",
  "function recordCompletion(uint256 agentId, uint8 taskType, uint8 score, bytes32 evidenceHash, string calldata metadata) external",
  "function getReputation(uint256 agentId) external view returns (uint256 tasks, uint256 avgScore, uint8 tier, string memory tierName)",
  "function averageScore(uint256 agentId) external view returns (uint256)",
  "function taskCount(uint256) external view returns (uint256)",
  "event TaskCompleted(uint256 indexed agentId, uint8 taskType, uint8 score, address indexed verifier, bytes32 evidenceHash, uint256 completionIndex)",
  "event TierUpgraded(uint256 indexed agentId, uint8 newTier)"
];

// Use solcjs to compile on the fly
async function compileAndDeploy() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`\n⚡ FUSEBOX ERC-8004 DEPLOYMENT`);
  console.log(`📍 Deployer: ${wallet.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`🔗 Network: Base Sepolia\n`);

  // We'll use a lightweight approach — deploy via raw bytecode from solc
  const solc = require("solc");
  const fs = require("fs");
  const path = require("path");

  // Read contracts
  const agentSrc = fs.readFileSync(path.join(__dirname, "../contracts/FuseboxAgentRegistry.sol"), "utf8");
  const repSrc = fs.readFileSync(path.join(__dirname, "../contracts/FuseboxReputationRegistry.sol"), "utf8");

  // Minimal compile input - Agent Registry first (no OpenZeppelin deps for speed)
  // Deploy a simplified version
  const simplifiedAgentSrc = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FuseboxAgentRegistry {
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => string) private _uris;
    uint256 private _nextId;
    
    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    
    function registerAgent(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextId++;
        ownerOf[agentId] = msg.sender;
        _uris[agentId] = agentURI;
        emit AgentRegistered(agentId, msg.sender, agentURI);
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _uris[tokenId];
    }
    
    function totalAgents() external view returns (uint256) {
        return _nextId;
    }
}`;

  const simplifiedRepSrc = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FuseboxReputationRegistry {
    struct TaskCompletion {
        uint256 agentId;
        uint8 taskType;
        uint8 score;
        address verifier;
        uint256 timestamp;
        bytes32 evidenceHash;
        string metadata;
    }

    mapping(uint256 => TaskCompletion[]) public completions;
    mapping(uint256 => uint256) public cumulativeScore;
    mapping(uint256 => uint256) public taskCount;
    mapping(uint256 => uint8) public reputationTier;
    address public identityRegistry;

    event TaskCompleted(uint256 indexed agentId, uint8 taskType, uint8 score, address indexed verifier, bytes32 evidenceHash, uint256 completionIndex);
    event TierUpgraded(uint256 indexed agentId, uint8 newTier);

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    function recordCompletion(uint256 agentId, uint8 taskType, uint8 score, bytes32 evidenceHash, string calldata metadata) external {
        require(score <= 100, "Score 0-100");
        completions[agentId].push(TaskCompletion(agentId, taskType, score, msg.sender, block.timestamp, evidenceHash, metadata));
        cumulativeScore[agentId] += score;
        taskCount[agentId]++;
        emit TaskCompleted(agentId, taskType, score, msg.sender, evidenceHash, completions[agentId].length - 1);
        _updateTier(agentId);
    }

    function averageScore(uint256 agentId) external view returns (uint256) {
        if (taskCount[agentId] == 0) return 0;
        return cumulativeScore[agentId] / taskCount[agentId];
    }

    function getReputation(uint256 agentId) external view returns (uint256 tasks, uint256 avgScore, uint8 tier, string memory tierName) {
        tasks = taskCount[agentId];
        avgScore = tasks > 0 ? cumulativeScore[agentId] / tasks : 0;
        tier = reputationTier[agentId];
        tierName = _tierName(tier);
    }

    function _updateTier(uint256 agentId) internal {
        uint256 tasks = taskCount[agentId];
        uint256 avg = tasks > 0 ? cumulativeScore[agentId] / tasks : 0;
        uint8 newTier;
        if (tasks >= 50 && avg >= 90) newTier = 4;
        else if (tasks >= 20 && avg >= 80) newTier = 3;
        else if (tasks >= 10 && avg >= 70) newTier = 2;
        else if (tasks >= 3 && avg >= 60) newTier = 1;
        if (newTier != reputationTier[agentId]) {
            reputationTier[agentId] = newTier;
            emit TierUpgraded(agentId, newTier);
        }
    }

    function _tierName(uint8 tier) internal pure returns (string memory) {
        if (tier == 4) return "Principal";
        if (tier == 3) return "Lead";
        if (tier == 2) return "Senior";
        if (tier == 1) return "Junior";
        return "Unranked";
    }
}`;

  const input = {
    language: "Solidity",
    sources: {
      "AgentRegistry.sol": { content: simplifiedAgentSrc },
      "ReputationRegistry.sol": { content: simplifiedRepSrc }
    },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } }
  };

  console.log("Compiling contracts...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:", errors);
      process.exit(1);
    }
  }

  // Deploy Agent Registry
  console.log("Deploying FuseboxAgentRegistry...");
  const agentBytecode = output.contracts["AgentRegistry.sol"]["FuseboxAgentRegistry"].evm.bytecode.object;
  const agentAbi = output.contracts["AgentRegistry.sol"]["FuseboxAgentRegistry"].abi;
  const AgentFactory = new ethers.ContractFactory(agentAbi, agentBytecode, wallet);
  const agentRegistry = await AgentFactory.deploy();
  await agentRegistry.waitForDeployment();
  const agentAddress = await agentRegistry.getAddress();
  console.log(`✅ AgentRegistry deployed: ${agentAddress}`);

  // Deploy Reputation Registry
  console.log("Deploying FuseboxReputationRegistry...");
  const repBytecode = output.contracts["ReputationRegistry.sol"]["FuseboxReputationRegistry"].evm.bytecode.object;
  const repAbi = output.contracts["ReputationRegistry.sol"]["FuseboxReputationRegistry"].abi;
  const RepFactory = new ethers.ContractFactory(repAbi, repBytecode, wallet);
  const repRegistry = await RepFactory.deploy(agentAddress);
  await repRegistry.waitForDeployment();
  const repAddress = await repRegistry.getAddress();
  console.log(`✅ ReputationRegistry deployed: ${repAddress}`);

  // Demo: Register agent + record a completion
  console.log("\nRunning live demo...");
  
  const tx1 = await agentRegistry.registerAgent("https://fusebox.shortcircuit.ventures/.well-known/agent-card.json");
  const r1 = await tx1.wait();
  console.log(`✅ Agent registered — tx: ${tx1.hash}`);

  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("https://github.com/shortcircuit/fusebox/pull/892|a4f8d2c|47 tests passing"));
  const tx2 = await repRegistry.recordCompletion(0, 0, 92, evidenceHash, "ipfs://QmFuseboxDemo");
  const r2 = await tx2.wait();
  console.log(`✅ Task completion recorded — tx: ${tx2.hash}`);

  const [tasks, avgScore, tier, tierName] = await repRegistry.getReputation(0);
  console.log(`\n📊 Agent #0 Reputation:`);
  console.log(`   Tasks: ${tasks} | Avg Score: ${avgScore}/100 | Tier: ${tierName}`);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`AgentRegistry:     ${agentAddress}`);
  console.log(`ReputationRegistry: ${repAddress}`);
  console.log(`Base Sepolia Explorer:`);
  console.log(`  https://sepolia.basescan.org/address/${agentAddress}`);
  console.log(`  https://sepolia.basescan.org/address/${repAddress}`);
  console.log(`${"─".repeat(60)}\n`);

  // Save addresses
  fs.writeFileSync("deployed.json", JSON.stringify({
    network: "base-sepolia",
    agentRegistry: agentAddress,
    reputationRegistry: repAddress,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    txHashes: { agentDeploy: tx1.hash, repDeploy: tx2.hash, firstCompletion: tx2.hash }
  }, null, 2));
  console.log("Addresses saved to deployed.json");
}

compileAndDeploy().catch(console.error);
