/**
 * Match Utilities
 * Funksjoner for beregning av poeng, formatering og match-logikk
 */

/**
 * Bestem utfall av en kamp (H/U/B)
 * @param {number} homeScore - Hjemmelagets score
 * @param {number} awayScore - Bortelagets score
 * @returns {string} 'H' (hjemme), 'U' (uavgjort), eller 'B' (borte)
 */
export function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

/**
 * Beregn poeng for et tips basert på resultat
 * @param {Object} tip - Brukerens tips
 * @param {number} tip.homeScore - Tippet hjemmescore
 * @param {number} tip.awayScore - Tippet bortescore
 * @param {Object} tip.odds - Odds for kampen {H, U, B}
 * @param {Object} match - Kampen med resultat
 * @param {Object} match.result - Faktisk resultat {home, away}
 * @returns {number} Poeng opptjent
 */
export function calculatePoints(tip, match) {
    if (!match.result) return 0;
    if (!tip.odds) return 0; // Skip if tip has no odds

    const tipOutcome = getOutcome(tip.homeScore, tip.awayScore);
    const resultOutcome = getOutcome(match.result.home, match.result.away);

    let points = 0;

    // Correct outcome: points equal to odds
    if (tipOutcome === resultOutcome) {
        points += tip.odds[resultOutcome];
    }

    // Exact score: 3 bonus points (in addition to outcome points)
    if (tip.homeScore === match.result.home && tip.awayScore === match.result.away) {
        points += 3;
    }

    return points;
}

/**
 * Formater kamptidspunkt
 * @param {Date|string|number} date - Dato (Date object, ISO string, eller timestamp)
 * @returns {string} Formatert tid (f.eks. "14:30")
 */
export function formatMatchTime(date) {
    let matchDate;

    if (date instanceof Date) {
        matchDate = date;
    } else if (typeof date === 'string') {
        matchDate = new Date(date);
    } else if (typeof date === 'number') {
        // Timestamp in seconds, convert to milliseconds
        matchDate = new Date(date * 1000);
    } else {
        return '--:--';
    }

    if (isNaN(matchDate.getTime())) {
        return '--:--';
    }

    return matchDate.toLocaleTimeString('no-NO', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Sjekk om en kamp har startet
 * @param {Date|string|number} date - Kamptidspunkt
 * @returns {boolean}
 */
export function hasMatchStarted(date) {
    let matchDate;

    if (date instanceof Date) {
        matchDate = date;
    } else if (typeof date === 'string') {
        matchDate = new Date(date);
    } else if (typeof date === 'number') {
        matchDate = new Date(date * 1000);
    } else {
        return false;
    }

    return matchDate <= new Date();
}

/**
 * Sjekk om en kamp er live (pågående)
 * @param {string} status - Kampstatus fra API
 * @returns {boolean}
 */
export function isMatchLive(status) {
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'IN PLAY'];
    return liveStatuses.includes(status);
}

/**
 * Sjekk om en kamp er fullført
 * @param {string} status - Kampstatus fra API
 * @returns {boolean}
 */
export function isMatchFinished(status) {
    const finishedStatuses = ['FT', 'AET', 'PEN', 'FT_PEN'];
    return finishedStatuses.includes(status);
}

/**
 * Hent visningsnavn for kampstatus
 * @param {string} status - Kampstatus fra API
 * @returns {string} Norsk visningsnavn
 */
export function getMatchStatusText(status) {
    const statusMap = {
        'TBD': 'Ikke bekreftet',
        'NS': 'Ikke startet',
        '1H': '1. omgang',
        'HT': 'Pause',
        '2H': '2. omgang',
        'ET': 'Ekstraomganger',
        'BT': 'Pause ekstra',
        'P': 'Straffer',
        'FT': 'Fullført',
        'AET': 'Fullført (ekstraomganger)',
        'PEN': 'Fullført (straffer)',
        'FT_PEN': 'Fullført (straffer)',
        'CANC': 'Avlyst',
        'SUSP': 'Utsatt',
        'INT': 'Avbrutt',
        'PST': 'Utsatt',
        'LIVE': 'Pågår',
        'IN PLAY': 'Pågår'
    };

    return statusMap[status] || status;
}

/**
 * Sorter kamper etter dato (eldste først)
 * @param {Array} matches - Array av kamper
 * @returns {Array} Sortert array
 */
export function sortMatchesByDate(matches) {
    return [...matches].sort((a, b) => {
        const dateA = new Date(a.commence_time || a.date || a.timestamp * 1000);
        const dateB = new Date(b.commence_time || b.date || b.timestamp * 1000);
        return dateA - dateB;
    });
}

/**
 * Dedupliser kamper basert på match ID
 * @param {Array} matches - Array av kamper (kan inneholde duplikater)
 * @returns {Array} Array uten duplikater
 */
export function deduplicateMatches(matches) {
    const uniqueMatches = [];
    const seenIds = new Set();

    matches.forEach(match => {
        if (!seenIds.has(match.id)) {
            seenIds.add(match.id);
            uniqueMatches.push(match);
        }
    });

    return uniqueMatches;
}

/**
 * Filtrer ut gamle kamper - behold kun kamper fra i dag og fremover
 * @param {Array} matches - Array av kamper
 * @returns {Array} Filtrert array med kun kommende kamper
 */
export function filterUpcomingMatches(matches) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today

    return matches.filter(match => {
        const matchDate = new Date(match.commence_time || match.date || match.timestamp * 1000);
        matchDate.setHours(0, 0, 0, 0); // Compare dates without time
        // Only keep matches from today or future dates
        return matchDate >= today;
    });
}
