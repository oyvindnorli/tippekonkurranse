/**
 * SENTRALISERT LIGA-KONFIGURASJON
 * ================================
 *
 * Dette er DEN ENESTE filen du trenger å oppdatere for å legge til nye ligaer!
 *
 * Hvordan legge til en ny liga:
 * 1. Finn liga-ID fra API-Football (https://dashboard.api-football.com/)
 * 2. Legg til et nytt objekt i LEAGUES array nedenfor
 * 3. Ferdig! Alt annet oppdateres automatisk.
 *
 * Eksempel:
 * {
 *     id: 78,
 *     name: 'Bundesliga',
 *     emoji: '🇩🇪',
 *     displayName: 'Bundesliga',
 *     enabled: true  // Sett til false for å skjule liga uten å slette den
 * }
 */

// Alle ligaer i systemet
const LEAGUES = [
    {
        id: 39,
        name: 'Premier League',
        emoji: '⚽',
        displayName: 'Premier League',
        enabled: true
    },
    {
        id: 2,
        name: 'Champions League',
        emoji: '⭐',
        displayName: 'UEFA Champions League',
        enabled: true
    },
    {
        id: 3,
        name: 'Europa League',
        emoji: '🌟',
        displayName: 'UEFA Europa League',
        enabled: true
    },
    {
        id: 32,
        name: 'WC Kvalifisering Europa',
        emoji: '🇪🇺',
        displayName: 'World Cup - Qualification Europe',
        enabled: true
    },
    {
        id: 48,
        name: 'EFL Cup',
        emoji: '🏆',
        displayName: 'EFL Cup',
        enabled: true
    },
    {
        id: 135,
        name: 'Serie A',
        emoji: '🇮🇹',
        displayName: 'Serie A',
        enabled: true
    }
];

// ============================================
// Eksporter-funksjoner (IKKE ENDRE UNDER HER)
// ============================================

/**
 * Hent alle aktiverte ligaer
 */
export function getEnabledLeagues() {
    return LEAGUES.filter(league => league.enabled);
}

/**
 * Hent alle liga-IDer (for API-kall)
 */
export function getLeagueIds() {
    return getEnabledLeagues().map(league => league.id);
}

/**
 * Hent liga-navn med emoji
 */
export function getLeagueNameWithEmoji(leagueId) {
    const league = LEAGUES.find(l => l.id === leagueId);
    return league ? `${league.emoji} ${league.name}` : `Liga ${leagueId}`;
}

/**
 * Hent liga-navn uten emoji
 */
export function getLeagueName(leagueId) {
    const league = LEAGUES.find(l => l.id === leagueId);
    return league ? league.displayName : `Liga ${leagueId}`;
}

/**
 * Hent liga-emoji
 */
export function getLeagueEmoji(leagueId) {
    const league = LEAGUES.find(l => l.id === leagueId);
    return league ? league.emoji : '⚽';
}

/**
 * Sjekk om en liga er aktivert
 */
export function isLeagueEnabled(leagueId) {
    const league = LEAGUES.find(l => l.id === leagueId);
    return league ? league.enabled : false;
}

/**
 * Hent komplett liga-objekt
 */
export function getLeague(leagueId) {
    return LEAGUES.find(l => l.id === leagueId);
}

/**
 * Hent alle ligaer (inkludert deaktiverte)
 */
export function getAllLeagues() {
    return LEAGUES;
}

// Legacy exports for backward compatibility
export const LEAGUE_NAMES = {};
export const LEAGUE_NAMES_SIMPLE = {};
export const LEAGUE_IDS = {};

// Populate legacy objects
LEAGUES.forEach(league => {
    LEAGUE_NAMES[league.id] = `${league.emoji} ${league.name}`;
    LEAGUE_NAMES_SIMPLE[league.id] = league.displayName;
    LEAGUE_IDS[league.name.toUpperCase().replace(/ /g, '_')] = league.id;
});

// Default export for convenience
export default {
    getEnabledLeagues,
    getLeagueIds,
    getLeagueNameWithEmoji,
    getLeagueName,
    getLeagueEmoji,
    isLeagueEnabled,
    getLeague,
    getAllLeagues,
    LEAGUE_NAMES,
    LEAGUE_NAMES_SIMPLE,
    LEAGUE_IDS
};
