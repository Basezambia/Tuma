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

    // Validate required parameters
    if (!req.body.pricing_type) {
      return res.status(400).json({ 
        error: 'pricing_type is required',
        details: 'pricing_type must be either "fixed_price" or "no_price"'
      });
    }

    // Ensure pricing_type is one of the allowed values
    if (!['fixed_price', 'no_price'].includes(req.body.pricing_type)) {
      return res.status(400).json({
        error: 'Invalid pricing_type',
        details: 'pricing_type must be either "fixed_price" or "no_price"'
      });
    }

    // Prepare the charge data with required fields
    const chargeData = {
      ...req.body,
      pricing_type: req.body.pricing_type,
      // Ensure local_price is included for fixed_price
      ...(req.body.pricing_type === 'fixed_price' && !req.body.local_price && {
        local_price: {
          amount: req.body.amount || '0.00',
          currency: req.body.currency || 'USD'
        }
      })
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
