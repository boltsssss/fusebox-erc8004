import { ethers } from 'ethers';

export async function onRequestGet({ env }) {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL || 'https://sepolia.base.org');
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  const bal = await provider.getBalance(wallet.address);
  return Response.json({ address: wallet.address, balance: ethers.formatEther(bal) });
}
