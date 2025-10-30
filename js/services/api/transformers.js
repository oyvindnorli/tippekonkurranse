/**
 * Data Transformers
 * Transforms API-Football responses to our internal format
 */

/**
 * Transform API-Football fixtures data to our format
 * @param {Array} apiFixtures - Raw fixtures from API
 * @param {number} maxMatches - Maximum number of matches to return
 * @param {Object} teamLogosCache - Cache object for team logos
 * @returns {Array} Transformed fixtures
 */
export function transformFixturesData(apiFixtures, maxMatches = 30, teamLogosCache = {}) {
    // Filter out matches that have already finished or are in progress
    const now = new Date();
    let filteredCount = 0;

    const upcomingFixtures = apiFixtures.filter(fixture => {
        const matchDate = new Date(fixture.fixture.date);
        if (matchDate <= now || fixture.fixture.status.short !== 'NS') {
            filteredCount++;
            return false;
        }
        return true;
    });

    // Sort by date
    upcomingFixtures.sort((a, b) => {
        return new Date(a.fixture.date) - new Date(b.fixture.date);
    });

    if (filteredCount > 0) {
        console.log(`📅 Filtered ${filteredCount} matches, ${upcomingFixtures.length} upcoming`);
    }

    return upcomingFixtures.slice(0, maxMatches).map(fixture => {
        const matchDate = new Date(fixture.fixture.date);
        const time = matchDate.toLocaleString('no-NO', {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });

        // Store team logos
        if (fixture.teams.home.logo) {
            teamLogosCache[fixture.teams.home.name] = fixture.teams.home.logo;
        }
        if (fixture.teams.away.logo) {
            teamLogosCache[fixture.teams.away.name] = fixture.teams.away.logo;
        }

        return {
            id: fixture.fixture.id,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            homeLogo: fixture.teams.home.logo,
            awayLogo: fixture.teams.away.logo,
            time: time,
            commence_time: fixture.fixture.date,
            timestamp: fixture.fixture.timestamp,
            status: fixture.fixture.status.short,
            league: fixture.league.id, // Use ID not name for filtering
            leagueName: fixture.league.name, // Keep name for display
            leagueLogo: fixture.league.logo,
            round: fixture.league.round, // e.g. "Regular Season - 10"
            venue: fixture.fixture.venue.name,
            city: fixture.fixture.venue.city,
            result: null, // No result yet for upcoming matches
            odds: null // Odds will be fetched separately
        };
    });
}

/**
 * Transform API-Football odds data to our format
 * @param {Object} apiOdds - Raw odds from API
 * @returns {Object|null} Transformed odds or null if unavailable
 */
export function transformOddsData(apiOdds) {
    try {
        if (!apiOdds.bookmakers || apiOdds.bookmakers.length === 0) {
            return null; // No odds available
        }

        const bookmaker = apiOdds.bookmakers[0];
        const matchWinnerBet = bookmaker.bets.find(bet => bet.name === 'Match Winner');

        if (!matchWinnerBet || !matchWinnerBet.values) {
            return null; // No odds available
        }

        const homeOdds = matchWinnerBet.values.find(v => v.value === 'Home');
        const drawOdds = matchWinnerBet.values.find(v => v.value === 'Draw');
        const awayOdds = matchWinnerBet.values.find(v => v.value === 'Away');

        // Only return odds if all three values are present
        if (!homeOdds || !drawOdds || !awayOdds) {
            return null;
        }

        return {
            H: parseFloat(homeOdds.odd),
            U: parseFloat(drawOdds.odd),
            B: parseFloat(awayOdds.odd)
        };
    } catch (error) {
        console.error('Error transforming odds data:', error);
        return null; // No odds available
    }
}

/**
 * Transform scores data to our format
 * @param {Array} apiMatches - Raw matches from API
 * @param {Object} teamLogosCache - Cache object for team logos
 * @returns {Array} Transformed matches with scores
 */
export function transformScoresData(apiMatches, teamLogosCache = {}) {
    return apiMatches.map(match => {
        const matchDate = new Date(match.fixture.date);
        const time = matchDate.toLocaleTimeString('no-NO', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Store team logos
        if (match.teams.home.logo) {
            teamLogosCache[match.teams.home.name] = match.teams.home.logo;
        }
        if (match.teams.away.logo) {
            teamLogosCache[match.teams.away.name] = match.teams.away.logo;
        }

        let result = null;
        if (match.goals.home !== null && match.goals.away !== null) {
            result = {
                home: match.goals.home,
                away: match.goals.away
            };
        }

        const isCompleted = match.fixture.status.short === 'FT' ||
                           match.fixture.status.short === 'AET' ||
                           match.fixture.status.short === 'PEN';

        return {
            id: match.fixture.id,
            homeTeam: match.teams.home.name,
            awayTeam: match.teams.away.name,
            homeLogo: match.teams.home.logo,
            awayLogo: match.teams.away.logo,
            time: time,
            commence_time: match.fixture.date,
            timestamp: match.fixture.timestamp,
            status: match.fixture.status.long,
            statusShort: match.fixture.status.short,
            completed: isCompleted,
            result: result,
            league: match.league.id, // Use ID not name for filtering
            leagueName: match.league.name, // Keep name for display
            leagueLogo: match.league.logo,
            round: match.league.round, // e.g. "Regular Season - 10"
            elapsed: match.fixture.status.elapsed,
            last_update: new Date().toISOString()
        };
    });
}
