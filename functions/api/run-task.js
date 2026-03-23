import { ethers } from 'ethers';

const REP_ABI = [
  "function recordCompletion(uint256 agentId, uint8 taskType, uint8 score, bytes32 evidenceHash, string calldata metadata) external",
];

export async function onRequestPost({ request, env }) {
  const { taskType, score, evidenceHash, metadata } = await request.json();

  const provider = new ethers.JsonRpcProvider(env.RPC_URL || 'https://sepolia.base.org');
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  const repContract = new ethers.Contract(env.REPUTATION_REGISTRY, REP_ABI, wallet);

  let attempt = 0;
  while (attempt < 3) {
    try {
      const feeData = await provider.getFeeData();
      const tx = await repContract.recordCompletion(
        taskType, taskType, score, evidenceHash,
        metadata || 'fusebox:' + taskType,
        {
          maxFeePerGas: feeData.maxFeePerGas * 2n,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n,
        }
      );
      const receipt = await tx.wait();
      return Response.json({ ok: true, txHash: tx.hash });
    } catch (err) {
      attempt++;
      if (attempt >= 3) return Response.json({ ok: false, error: err.message }, { status: 500 });
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
