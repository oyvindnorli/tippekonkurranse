/**
 * API Client
 * Handles raw HTTP calls to API-Football via serverless proxy
 */

/**
 * Fetch fixtures from API-Football
 * @param {string} baseUrl - API base URL
 * @param {Array<number>} leagues - League IDs to fetch
 * @param {number} season - Season year
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Raw fixtures from API
 */
export async function fetchFixtures(baseUrl, leagues, season, from, to) {
    let allFixtures = [];
    const fixtureIds = new Set(); // Track unique fixture IDs

    // Fetch fixtures for each league
    for (const leagueId of leagues) {
        // Special handling for WC Qualification Europe - always use 2026
        const leagueSeason = leagueId === 35 ? 2026 : season;
        const url = `${baseUrl}?endpoint=fixtures&league=${leagueId}&season=${leagueSeason}&from=${from}&to=${to}`;

        const response = await fetch(url, {
            method: 'GET'
        });

        if (!response.ok) {
            continue;
        }

        const data = await response.json();

        if (data.response && data.response.length > 0) {
            // Deduplicate fixtures by ID
            data.response.forEach(fixture => {
                if (!fixtureIds.has(fixture.fixture.id)) {
                    fixtureIds.add(fixture.fixture.id);
                    allFixtures.push(fixture);
                }
            });
        }
    }

    console.log(`📅 Fetched ${allFixtures.length} fixtures`);
    return allFixtures;
}

/**
 * Fetch all odds for a league and date
 * @param {string} baseUrl - API base URL
 * @param {number} leagueId - The league ID
 * @param {number} season - Season year
 * @param {string} date - Date in format YYYY-MM-DD
 * @returns {Promise<Object>} Map of fixture ID to odds
 */
export async function fetchOddsForLeague(baseUrl, leagueId, season, date) {
    try {
        // Special handling for WC Qualification Europe - always use 2026
        const leagueSeason = leagueId === 35 ? 2026 : season;
        // Try to fetch all odds for the league on this date
        const url = `${baseUrl}?endpoint=odds&league=${leagueId}&season=${leagueSeason}&date=${date}`;

        const response = await fetch(url, {
            method: 'GET'
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.error('⚠️ API RATE LIMIT EXCEEDED!');
            }
            return {};
        }

        const data = await response.json();

        const oddsMap = {};

        if (data.response && data.response.length > 0) {
            data.response.forEach(oddsData => {
                const fixtureId = oddsData.fixture.id;
                oddsMap[fixtureId] = oddsData;
            });
        }

        return oddsMap;
    } catch (error) {
        return {};
    }
}

/**
 * Fetch odds for a specific fixture
 * @param {string} baseUrl - API base URL
 * @param {number} fixtureId - The fixture ID
 * @returns {Promise<Object|null>} Raw odds data or null
 */
export async function fetchOddsForFixture(baseUrl, fixtureId) {
    try {
        // Try without specifying bookmaker first (gets best available)
        let url = `${baseUrl}?endpoint=odds&fixture=${fixtureId}`;

        let response = await fetch(url, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.response && data.response.length > 0) {
                return data.response[0];
            }
        }

        return null; // No odds available
    } catch (error) {
        return null; // No odds available
    }
}

/**
 * Fetch live and recent scores from API-Football
 * @param {string} baseUrl - API base URL
 * @param {Array<number>} leagues - League IDs to fetch
 * @param {number} season - Season year
 * @returns {Promise<Array>} Raw match data with scores
 */
export async function fetchScores(baseUrl, leagues, season) {
    console.log('🔴 Fetching live scores from API-Football...');
    let allMatches = [];
    const fixtureIds = new Set(); // Track unique fixture IDs

    // Get date range - last 7 days to today
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    const fromDate = weekAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];

    // Fetch live and recent matches for each league - WITH EVENTS
    for (const leagueId of leagues) {
        // Special handling for WC Qualification Europe - always use 2026
        const leagueSeason = leagueId === 35 ? 2026 : season;
        // Use timezone parameter to get events data
        const url = `${baseUrl}?endpoint=fixtures&league=${leagueId}&season=${leagueSeason}&from=${fromDate}&to=${toDate}&timezone=Europe/Oslo`;

        const response = await fetch(url, {
            method: 'GET'
        });

        if (!response.ok) {
            continue;
        }

        const data = await response.json();

        if (data.response && data.response.length > 0) {
            // Deduplicate matches by ID
            data.response.forEach(match => {
                if (!fixtureIds.has(match.fixture.id)) {
                    fixtureIds.add(match.fixture.id);
                    allMatches.push(match);
                }
            });
        }
    }

    console.log(`📊 Fetched ${allMatches.length} completed matches`);
    return allMatches;
}
