// Vercel Serverless Function - API-Football Proxy
// This function acts as a proxy to API-Football to:
// 1. Hide the API key from frontend code
// 2. Avoid CORS issues

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the API key from environment variable
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
        console.error('API_FOOTBALL_KEY environment variable is not set');
        return res.status(500).json({ error: 'API key not configured' });
    }

    // Get the endpoint path from query parameter
    const { endpoint } = req.query;
    if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    // Build query string from all query params except 'endpoint'
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'endpoint') {
            queryParams.append(key, value);
        }
    }

    // Build the full API-Football URL
    const apiUrl = `https://v3.football.api-sports.io/${endpoint}?${queryParams.toString()}`;

    console.log(`📡 Proxying request to: ${apiUrl}`);

    try {
        // Make request to API-Football
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            }
        });

        // Get response data
        const data = await response.json();

        // Log API usage if available
        if (data.requests) {
            console.log(`📊 API Usage: ${data.requests.current}/${data.requests.limit_day} requests used today`);
        }

        // Return the response with appropriate status code
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('Error proxying to API-Football:', error);
        return res.status(500).json({
            error: 'Failed to fetch from API-Football',
            message: error.message
        });
    }
}
