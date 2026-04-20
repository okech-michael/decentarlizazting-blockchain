// scripts/deploy.js
// Run with: npx hardhat run scripts/deploy.js --network localhost

const hre = require("hardhat");

async function main() {
  const [deployer, oracle] = await hre.ethers.getSigners();

  console.log("===========================================");
  console.log("  Deploying Proof of Contribution System  ");
  console.log("===========================================");
  console.log("Deployer :", deployer.address);
  console.log("Oracle   :", oracle.address);
  console.log("");

  // Deploy the registry, passing the oracle's address
  const Registry = await hre.ethers.getContractFactory("ContributionRegistry");
  const registry = await Registry.deploy(oracle.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("ContributionRegistry deployed to:", address);
  console.log("");

  // ── Simulate 3 contributions from a third wallet ──────────────────────────
  const [, , contributor] = await hre.ethers.getSigners();
  console.log("Simulating contributions from:", contributor.address);
  console.log("");

  // The oracle submits verified contributions on behalf of contributor
  const oracleConnected = registry.connect(oracle);

  const contributions = [
    {
      repo:    "dao-org/core-protocol",
      type:    "PR_MERGE",
      hash:    "abc123def456",
      impact:  75,
      label:   "Bug fix PR merged"
    },
    {
      repo:    "dao-org/core-protocol",
      type:    "COMMIT",
      hash:    "xyz789uvw012",
      impact:  40,
      label:   "Feature commit"
    },
    {
      repo:    "dao-org/docs",
      type:    "REVIEW",
      hash:    "rev001abc789",
      impact:  30,
      label:   "Code review submitted"
    }
  ];

  for (const c of contributions) {
    const tx = await oracleConnected.recordContribution(
      contributor.address,
      c.repo,
      c.type,
      c.hash,
      c.impact
    );
    await tx.wait();
    console.log(`  ✓ Recorded: ${c.label} (impact: ${c.impact})`);
  }

  // ── Read back the contributor's profile ───────────────────────────────────
  console.log("");
  console.log("── Contributor Profile ─────────────────────");
  const profile = await registry.getProfile(contributor.address);
  console.log("Total PoCS score   :", profile.totalScore.toString());
  console.log("Contributions      :", profile.contributionCount.toString());
  console.log("Streak multiplier  :", (Number(profile.streakMultiplier) / 100).toFixed(2) + "x");

  const history = await registry.getContributorHistory(contributor.address);
  console.log("Contribution IDs   :", history.length);

  console.log("");
  console.log("===========================================");
  console.log("  Deployment + simulation complete!        ");
  console.log("===========================================");
  console.log("");
  console.log("Save this address in your .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});