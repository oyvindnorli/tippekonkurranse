// API Configuration
const API_CONFIG = {
    // Using Vercel serverless function as proxy to API-Football
    // This hides the API key and avoids CORS issues
    BASE_URL: '/api/football',

    // League IDs
    LEAGUES: [
        39,  // Premier League
        2,   // Champions League
        3,   // Europa League
        32,  // World Cup Qualifiers
        48,  // EFL Cup
        135  // Serie A
    ],
    SEASON: new Date().getFullYear(), // Current season
    MAX_MATCHES: 100, // Maximum number of matches to show (increased to show all in 7-day period)

    // Cache settings (30 minutes - you have Pro plan with 7500 requests/day)
    CACHE_DURATION: 30 * 60 * 1000 // 30 minutes in milliseconds
};

// Check if API is available (always true now since we use serverless function)
function isApiKeySet() {
    return true; // Serverless function handles API key
}
