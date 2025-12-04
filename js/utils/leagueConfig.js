/**
 * League Configuration
 * NOW IMPORTS FROM CENTRALIZED leagues.config.js
 * This file is kept for backward compatibility
 */

import {
    LEAGUE_NAMES as IMPORTED_LEAGUE_NAMES,
    LEAGUE_NAMES_SIMPLE as IMPORTED_LEAGUE_NAMES_SIMPLE,
    getLeagueNameWithEmoji,
    getLeagueName as getLeagueNameSimple
} from '../../leagues.config.js';

// Re-export for backward compatibility
export const LEAGUE_NAMES = IMPORTED_LEAGUE_NAMES;
export const LEAGUE_NAMES_SIMPLE = IMPORTED_LEAGUE_NAMES_SIMPLE;

/**
 * Hent liga-navn for en gitt liga-ID
 * @param {number} leagueId - Liga-ID
 * @param {boolean} withEmoji - Inkluder emoji (default: true)
 * @returns {string} Liga-navn
 */
export function getLeagueName(leagueId, withEmoji = true) {
    if (withEmoji) {
        return getLeagueNameWithEmoji(leagueId);
    }
    return getLeagueNameSimple(leagueId);
}

/**
 * Get league display name (same as LEAGUE_NAMES_SIMPLE)
 * Used for backward compatibility
 * @param {number} leagueId - Liga-ID
 * @returns {string} Liga-navn uten emoji
 */
export function getLeagueDisplayName(leagueId) {
    return getLeagueNameSimple(leagueId);
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
