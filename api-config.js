// API Configuration
// League IDs are now centralized in leagues.config.js
// These are hardcoded here for backward compatibility with non-module scripts
// To add new leagues, update leagues.config.js instead!

const API_CONFIG = {
    // Using Vercel serverless function as proxy to API-Football
    // This hides the API key and avoids CORS issues
    BASE_URL: '/api/football',

    // League IDs - Synchronized with leagues.config.js
    // DO NOT edit here - edit leagues.config.js instead!
    LEAGUES: [39, 2, 3, 32, 48, 135], // PL, CL, EL, WCQ Europe, EFL Cup, Serie A
    SEASON: new Date().getFullYear(), // Current season
    MAX_MATCHES: 100, // Maximum number of matches to show (increased to show all in 7-day period)

    // Cache settings (30 minutes - you have Pro plan with 7500 requests/day)
    CACHE_DURATION: 30 * 60 * 1000 // 30 minutes in milliseconds
};

// Check if API is available (always true now since we use serverless function)
function isApiKeySet() {
    return true; // Serverless function handles API key
}
