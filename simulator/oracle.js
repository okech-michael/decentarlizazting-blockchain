// simulator/oracle.js
// Simulates a GitHub oracle: watches for events and submits them to the contract
// Run with: node simulator/oracle.js

require("dotenv").config();
const { ethers } = require("ethers");

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL         = process.env.RPC_URL         || "http://127.0.0.1:8545";
const ORACLE_KEY      = process.env.ORACLE_PRIVATE_KEY;
const CONTRACT_ADDR   = process.env.CONTRACT_ADDRESS;
const CONTRIBUTOR_ADDR = process.env.CONTRIBUTOR_ADDRESS;

// Minimal ABI — only the functions we need
const ABI = [
  "function recordContribution(address contributor, string repoName, string eventType, string eventHash, uint256 impactScore) external",
  "function getProfile(address contributor) external view returns (uint256 totalScore, uint256 contributionCount, uint256 streakMultiplier, uint256 lastContribAt)",
  "event ContributionRecorded(address indexed contributor, bytes32 indexed contributionId, string eventType, uint256 impactScore, uint256 newTotalScore)"
];

// ── Oracle Logic ──────────────────────────────────────────────────────────────

/**
 * Simulates fetching GitHub events.
 * In production this would call the GitHub API or a webhook listener.
 */
function generateMockGitHubEvent() {
  const eventTypes = ["PR_MERGE", "COMMIT", "REVIEW"];
  const repos      = ["dao-org/core", "dao-org/docs", "dao-org/sdk"];

  const type   = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const repo   = repos[Math.floor(Math.random() * repos.length)];
  const hash   = Math.random().toString(36).substring(2, 14); // random hex-like string
  const impact = Math.floor(Math.random() * 80) + 10;         // 10–90

  return { type, repo, hash, impact };
}

/**
 * Calculates an impact score based on the event type.
 * In production: use PR diff size, review depth, number of approvals, etc.
 */
function calculateImpact(event) {
  const base = {
    PR_MERGE: 60,
    COMMIT:   30,
    REVIEW:   25,
  };
  // Slightly randomise around the base
  return Math.min(100, Math.max(1, (base[event.type] || 30) + Math.floor(Math.random() * 20 - 10)));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!ORACLE_KEY || !CONTRACT_ADDR || !CONTRIBUTOR_ADDR) {
    console.error("Missing .env values. Make sure you have:");
    console.error("  ORACLE_PRIVATE_KEY=<key>");
    console.error("  CONTRACT_ADDRESS=<address>");
    console.error("  CONTRIBUTOR_ADDRESS=<address>");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const oracle   = new ethers.Wallet(ORACLE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDR, ABI, oracle);

  console.log("==========================================");
  console.log("  PoC Oracle Simulator running");
  console.log("==========================================");
  console.log("Oracle address     :", oracle.address);
  console.log("Contract address   :", CONTRACT_ADDR);
  console.log("Contributor        :", CONTRIBUTOR_ADDR);
  console.log("");
  console.log("Watching for GitHub events... (submitting every 5s)");
  console.log("");

  // Listen for on-chain events
  contract.on("ContributionRecorded", (contributor, id, eventType, impactScore, newTotal) => {
    console.log("  [EVENT] ContributionRecorded");
    console.log("          type       :", eventType);
    console.log("          impact     :", impactScore.toString());
    console.log("          new total  :", newTotal.toString(), "PoCS");
    console.log("");
  });

  // Simulate new GitHub events arriving every 5 seconds
  let count = 0;
  const interval = setInterval(async () => {
    count++;
    if (count > 5) {
      clearInterval(interval);
      await printFinalProfile(contract);
      process.exit(0);
    }

    const event  = generateMockGitHubEvent();
    const impact = calculateImpact(event);

    console.log(`[${count}/5] New GitHub event detected:`);
    console.log(`       repo   : ${event.repo}`);
    console.log(`       type   : ${event.type}`);
    console.log(`       hash   : ${event.hash}`);
    console.log(`       impact : ${impact}`);
    console.log("       Submitting to chain...");

    try {
      const tx = await contract.recordContribution(
        CONTRIBUTOR_ADDR,
        event.repo,
        event.type,
        event.hash,
        impact
      );
      const receipt = await tx.wait();
      console.log(`       Tx hash: ${receipt.hash.slice(0, 20)}...`);
    } catch (err) {
      console.error("       Error:", err.shortMessage || err.message);
    }

    console.log("");
  }, 5000);
}

async function printFinalProfile(contract) {
  console.log("==========================================");
  console.log("  Final contributor profile");
  console.log("==========================================");
  const [score, count, multiplier] = await contract.getProfile(CONTRIBUTOR_ADDR);
  console.log("Total PoCS score   :", score.toString());
  console.log("Contributions      :", count.toString());
  console.log("Streak multiplier  :", (Number(multiplier) / 100).toFixed(2) + "x");
  console.log("");
  console.log("Simulation complete.");
}

main().catch(console.error);