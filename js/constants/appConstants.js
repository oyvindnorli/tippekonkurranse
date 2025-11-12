/**
 * Application Constants
 * Sentral fil for alle magic numbers og strings i applikasjonen
 */

// League IDs
export const LEAGUE_IDS = {
    PREMIER_LEAGUE: 39,
    CHAMPIONS_LEAGUE: 2,
    EUROPA_LEAGUE: 3,
    WORLD_CUP_QUALIFIERS: 32,
    LA_LIGA: 140,
    BUNDESLIGA: 78,
    SERIE_A: 135,
    LIGUE_1: 61,
    ELITESERIEN: 103
};

// Poeng-systemet
export const POINTS = {
    EXACT_SCORE_BONUS: 3,  // Bonus poeng for eksakt resultat
    MIN_POINTS: 0,          // Minimum poeng
};

// Timeouts og delays (i millisekunder)
export const TIMEOUTS = {
    CACHE_CLEANUP_DELAY: 2000,      // Delay før cache cleanup starter
    DEBOUNCE_SAVE_TIP: 500,         // Debounce for tip lagring
    API_RETRY_DELAY: 1000,          // Delay før API retry
    AUTO_REFRESH_INTERVAL: 60000,   // Auto-refresh interval for live matches (60 sekunder)
};

// Tid-relaterte konstanter
export const TIME = {
    MILLISECONDS_PER_MINUTE: 60000,     // 1 minutt i millisekunder
    MATCH_DURATION_MINUTES: 120,        // Antatt varighet av fotballkamp i minutter (90 + overtid)
};

// Cache varighet (i millisekunder)
export const CACHE_DURATION = {
    MATCHES: 5 * 60 * 1000,         // 5 minutter
    USER_PREFERENCES: 24 * 60 * 60 * 1000, // 24 timer
};

// UI-relaterte constants
export const UI = {
    MAX_CONTENT_WIDTH: 800,         // Max bredde på hovedinnhold (px)
    MOBILE_BREAKPOINT: 768,         // Mobile breakpoint (px)
    MATCH_CARD_ANIMATION_DURATION: 200, // Match card animasjon (ms)
};

// Match statuser
export const MATCH_STATUS = {
    NOT_STARTED: 'NS',
    FIRST_HALF: '1H',
    HALFTIME: 'HT',
    SECOND_HALF: '2H',
    EXTRA_TIME: 'ET',
    PENALTIES: 'P',
    FINISHED: 'FT',
    CANCELLED: 'CANC',
    POSTPONED: 'PST',
};

// Match outcomes
export const OUTCOME = {
    HOME: 'H',
    DRAW: 'U',
    AWAY: 'B',
};

// Local storage keys
export const STORAGE_KEYS = {
    CACHED_MATCHES: 'cachedMatches',
    CACHED_MATCHES_TIME: 'cachedMatchesTime',
    FOOTBALL_MATCHES: 'footballMatches',
    FOOTBALL_MATCHES_TIMESTAMP: 'footballMatchesTimestamp',
    ACTIVE_LEAGUE_FILTER: 'activeLeagueFilter',
    USER_PREFERENCES: 'userPreferences',
};

// Error messages
export const ERROR_MESSAGES = {
    LOAD_MATCHES_FAILED: 'Kunne ikke laste kamper',
    SAVE_TIP_FAILED: 'Kunne ikke lagre tips',
    LOAD_COMPETITION_FAILED: 'Kunne ikke laste konkurranse',
    AUTH_REQUIRED: 'Du må være innlogget',
    NETWORK_ERROR: 'Nettverksfeil - sjekk internettforbindelsen',
};
