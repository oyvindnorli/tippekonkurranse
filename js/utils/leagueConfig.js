/**
 * League Configuration
 * Kun Premier League og Champions League
 */

// Liga-navn med emojis (matches preferences.js AVAILABLE_LEAGUES)
export const LEAGUE_NAMES = {
    2: '⭐ Champions League',
    39: '⚽ Premier League'
};

/**
 * Hent liga-navn for en gitt liga-ID
 * @param {number} leagueId - Liga-ID
 * @returns {string} Liga-navn med emoji
 */
export function getLeagueName(leagueId) {
    return LEAGUE_NAMES[leagueId] || `Liga ${leagueId}`;
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
