// API Configuration
const API_CONFIG = {
    // API-Football - Get your API key from: https://dashboard.api-football.com/
    API_KEY: 'dc3a8f33b796becd652ac9b08a8ff0ce',
    BASE_URL: 'https://v3.football.api-sports.io',

    // League IDs - you can add multiple leagues
    // Available: 39 (Premier League), 140 (La Liga), 78 (Bundesliga),
    //            135 (Serie A), 61 (Ligue 1), 2 (Champions League), 1 (World Cup), etc.
    LEAGUES: [
        39,  // Premier League
        2    // Champions League
    ],
    SEASON: new Date().getFullYear(), // Current season
    MAX_MATCHES: 20, // Maximum number of matches to show

    // Cache settings (15 minutes - you have Pro plan with 7500 requests/day)
    CACHE_DURATION: 15 * 60 * 1000 // 15 minutes in milliseconds
};

// Check if API key is set
function isApiKeySet() {
    return API_CONFIG.API_KEY !== 'YOUR_API_KEY_HERE' && API_CONFIG.API_KEY.length > 0;
}
