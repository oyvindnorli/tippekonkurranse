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
        2,   // Champions League
        140, // La Liga
        78,  // Bundesliga
        135, // Serie A
        1    // World Cup
    ],
    SEASON: new Date().getFullYear(), // Current season
    MAX_MATCHES: 20, // Maximum number of matches to show

    // Cache settings (24 hours to save API calls)
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

    // The Odds API (backup) - Get your free API key from: https://the-odds-api.com/
    ODDS_API_KEY: 'bb337ba5cf1a4fda9826d6ef3833297c',
    ODDS_BASE_URL: 'https://api.the-odds-api.com/v4',
    SPORTS: [
        'soccer_epl',  // Premier League
        'soccer_fifa_world_cup_qualifiers_europe',  // World Cup Qualifiers
        'soccer_uefa_champs_league_women'  // UEFA Women's Champions League
    ],
    REGIONS: 'uk,eu',
    MARKETS: 'h2h',
    RATE_LIMIT: 500,

    // Football-Data.org API (backup) - Get your free API key from: https://www.football-data.org/
    FOOTBALL_DATA_API_KEY: '90fa9e0fe08d4851a9cf7770df4730f0',
    FOOTBALL_DATA_BASE_URL: 'https://api.football-data.org/v4'
};

// Check if API key is set
function isApiKeySet() {
    return API_CONFIG.API_KEY !== 'YOUR_API_KEY_HERE' && API_CONFIG.API_KEY.length > 0;
}
