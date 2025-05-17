// /api/chargeStatus.js (Vercel Serverless Function)
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { chargeId } = req.query;
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!chargeId) {
    return res.status(400).json({ error: 'Missing chargeId' });
  }
  if (!apiKey) {
    console.error('Missing COINBASE_COMMERCE_API_KEY environment variable');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  try {
    const response = await fetch(`https://api.commerce.coinbase.com/charges/${chargeId}`, {
      headers: {
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22',
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Failed to get charge status' });
    }
    const timeline = data.data.timeline || [];
    const statusName = timeline.length > 0 ? timeline[timeline.length - 1].status : data.data.status;
    return res.status(200).json({ statusName });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
