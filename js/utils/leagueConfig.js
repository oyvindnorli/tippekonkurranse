/**
 * League Configuration
 * Centralized league names and utilities
 */

// Liga-navn med emojis (matches preferences.js AVAILABLE_LEAGUES)
export const LEAGUE_NAMES = {
    1: '🏆 World Cup',
    2: '⭐ Champions League',
    39: '⚽ Premier League',
    48: '🏆 EFL Cup',
    78: '🇩🇪 Bundesliga',
    135: '🇮🇹 Serie A',
    140: '🇪🇸 La Liga'
};

// Liga-navn uten emojis (for matching med API data)
export const LEAGUE_NAMES_SIMPLE = {
    1: 'World Cup',
    2: 'UEFA Champions League',
    39: 'Premier League',
    48: 'EFL Cup',
    78: 'Bundesliga',
    135: 'Serie A',
    140: 'La Liga'
};

/**
 * Hent liga-navn for en gitt liga-ID
 * @param {number} leagueId - Liga-ID
 * @param {boolean} withEmoji - Inkluder emoji (default: true)
 * @returns {string} Liga-navn
 */
export function getLeagueName(leagueId, withEmoji = true) {
    const names = withEmoji ? LEAGUE_NAMES : LEAGUE_NAMES_SIMPLE;
    return names[leagueId] || `Liga ${leagueId}`;
}

/**
 * Get league display name (same as LEAGUE_NAMES_SIMPLE)
 * Used for backward compatibility
 * @param {number} leagueId - Liga-ID
 * @returns {string} Liga-navn uten emoji
 */
export function getLeagueDisplayName(leagueId) {
    return LEAGUE_NAMES_SIMPLE[leagueId] || `Liga ${leagueId}`;
}

/**
 * Sjekk om en liga er Champions League
 * @param {number} leagueId - Liga-ID
 * @returns {boolean}
 */
export function isChampionsLeague(leagueId) {
    return leagueId === 2;
}

/**
 * Sjekk om en liga er Premier League
 * @param {number} leagueId - Liga-ID
 * @returns {boolean}
 */
export function isPremierLeague(leagueId) {
    return leagueId === 39;
}
