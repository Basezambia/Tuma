import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-V, Authorization'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const COINBASE_COMMERCE_API_KEY = process.env.COINBASE_COMMERCE_API_KEY;
    const COINBASE_COMMERCE_API_URL = 'https://api.commerce.coinbase.com/charges';

    if (!COINBASE_COMMERCE_API_KEY) {
      console.error('Missing COINBASE_COMMERCE_API_KEY environment variable');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Ensure required fields are present
    const { amount, currency, name, description, fileSize } = req.body;
    if (!amount || !currency || !name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'currency', 'name']
      });
    }

    // Determine pricing tier based on file size
    let tier = 'Tier 1 (<100KB)';
    const sizeMB = parseFloat(fileSize) / 1024 / 1024; // Convert bytes to MB
    
    if (sizeMB < 0.1) {
      tier = 'Tier 1 (<100KB)';
    } else if (sizeMB < 20) {
      tier = 'Tier 2 (100KB-20MB)';
    } else if (sizeMB < 50) {
      tier = 'Tier 3 (20-50MB)';
    } else if (sizeMB < 100) {
      tier = 'Tier 4 (50-100MB)';
    } else {
      tier = 'Tier 5 (>100MB)';
    }

    // Prepare the charge data with required fields
    const chargeData = {
      name: `Document Upload - ${tier}`,
      description: description || `Payment for document upload (${tier})`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: amount.toString(),
        currency: currency.toLowerCase()
      },
      metadata: {
        ...(req.body.metadata || {}),
        file_size: fileSize,
        tier: tier,
        timestamp: new Date().toISOString()
      },
      redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/upload?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/upload?status=canceled`
    };

    const response = await fetch(COINBASE_COMMERCE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': COINBASE_COMMERCE_API_KEY,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify(chargeData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Coinbase API error:', data);
      return res.status(response.status).json({ 
        error: data.error?.message || 'Failed to create charge',
        details: data.error
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
}
