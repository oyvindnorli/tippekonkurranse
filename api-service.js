/**
 * API-Football Service (Refactored)
 * Main service class that orchestrates API calls, caching, and data transformation
 */

// Import modules
import * as cacheService from './js/services/api/cacheService.js';
import * as apiClient from './js/services/api/apiClient.js';
import * as transformers from './js/services/api/transformers.js';
import * as mockData from './js/services/api/mockData.js';

class FootballApiService {
    constructor() {
        this.useMockData = !isApiKeySet();
        this.cache = cacheService.loadCache();
        this.teamLogosCache = {};

        if (this.useMockData) {
            console.warn('⚠️ API key not set. Using mock data. Get your API key from: https://dashboard.api-football.com/');
        } else {
            console.log('✅ API-Football initialized with key');
        }
    }

    /**
     * Load cache from localStorage
     */
    loadCache() {
        return cacheService.loadCache();
    }

    /**
     * Save cache to localStorage
     */
    saveCache(data) {
        cacheService.saveCache(data);
    }

    /**
     * Clear cache (useful for manual refresh)
     */
    clearCache() {
        cacheService.clearCache();
        this.cache = null;
    }

    /**
     * Fetch fixtures from API-Football
     * @param {string} from - Date in format YYYY-MM-DD
     * @param {string} to - Date in format YYYY-MM-DD
     */
    async fetchFixtures(from, to) {
        if (this.useMockData) {
            return mockData.getMockFixtures();
        }

        try {
            const rawFixtures = await apiClient.fetchFixtures(
                API_CONFIG.BASE_URL,
                API_CONFIG.LEAGUES,
                API_CONFIG.SEASON,
                from,
                to
            );

            return transformers.transformFixturesData(
                rawFixtures,
                API_CONFIG.MAX_MATCHES,
                this.teamLogosCache
            );
        } catch (error) {
            console.error('Error fetching fixtures:', error);
            throw error;
        }
    }

    /**
     * Fetch all odds for a league and date range
     * @param {number} leagueId - The league ID
     * @param {string} date - Date in format YYYY-MM-DD
     */
    async fetchOddsForLeague(leagueId, date) {
        if (this.useMockData) {
            return {};
        }

        try {
            const rawOdds = await apiClient.fetchOddsForLeague(
                API_CONFIG.BASE_URL,
                leagueId,
                API_CONFIG.SEASON,
                date
            );

            const oddsMap = {};
            Object.keys(rawOdds).forEach(fixtureId => {
                const odds = transformers.transformOddsData(rawOdds[fixtureId]);
                if (odds) {
                    oddsMap[fixtureId] = odds;
                }
            });

            return oddsMap;
        } catch (error) {
            return {};
        }
    }

    /**
     * Fetch odds for fixtures from API-Football
     * @param {number} fixtureId - The fixture ID
     */
    async fetchOddsForFixture(fixtureId) {
        if (this.useMockData) {
            return { H: 2.5, U: 3.2, B: 2.8 };
        }

        try {
            const rawOdds = await apiClient.fetchOddsForFixture(
                API_CONFIG.BASE_URL,
                fixtureId
            );

            if (rawOdds) {
                const odds = transformers.transformOddsData(rawOdds);
                if (odds.H !== 2.0 || odds.U !== 3.0 || odds.B !== 3.5) {
                    return odds;
                }
            }

            return null; // No odds available
        } catch (error) {
            return null; // No odds available
        }
    }

    /**
     * Get team logo URL
     */
    getTeamLogo(teamName) {
        return this.teamLogosCache[teamName] || null;
    }

    /**
     * Fetch live and recent scores from API-Football
     */
    async fetchScores() {
        if (this.useMockData) {
            return mockData.getMockScores();
        }

        try {
            const rawMatches = await apiClient.fetchScores(
                API_CONFIG.BASE_URL,
                API_CONFIG.LEAGUES,
                API_CONFIG.SEASON
            );

            return transformers.transformScoresData(rawMatches, this.teamLogosCache);
        } catch (error) {
            console.error('Error fetching scores:', error);
            console.log('💡 Falling back to mock data...');
            return mockData.getMockScores();
        }
    }

    /**
     * Filter matches to only show the next round for each league
     * @param {Array} matches - All matches
     * @returns {Array} - Matches filtered to next round only
     */
    filterToNextRound(matches) {
        const matchesByLeague = {};
        const now = new Date();

        // Group matches by league
        matches.forEach(match => {
            const leagueId = match.league || match.league_id || match.leagueId;
            if (!leagueId) return;

            if (!matchesByLeague[leagueId]) {
                matchesByLeague[leagueId] = [];
            }
            matchesByLeague[leagueId].push(match);
        });

        const nextRoundMatches = [];

        // For each league, find the next round
        Object.entries(matchesByLeague).forEach(([leagueId, leagueMatches]) => {
            // Sort by date
            leagueMatches.sort((a, b) => {
                const dateA = new Date(a.commence_time || a.timestamp * 1000);
                const dateB = new Date(b.commence_time || b.timestamp * 1000);
                return dateA - dateB;
            });

            // Find the earliest upcoming round (not started yet)
            const upcomingMatches = leagueMatches.filter(m => {
                const matchDate = new Date(m.commence_time || m.timestamp * 1000);
                return matchDate > now;
            });

            if (upcomingMatches.length === 0) {
                console.log(`ℹ️ Liga ${leagueId}: Ingen kommende kamper funnet`);
                return;
            }

            console.log(`ℹ️ Liga ${leagueId}: ${upcomingMatches.length} kommende kamper`);

            // Group by round
            const roundsMap = new Map();
            upcomingMatches.forEach(match => {
                const round = match.round || 'Regular Season';
                if (!roundsMap.has(round)) {
                    roundsMap.set(round, []);
                }
                roundsMap.get(round).push(match);
            });

            // Debug logging for Serie A
            if (leagueId === '135') {
                console.log(`🔍 Serie A rounds:`, Array.from(roundsMap.keys()));
                roundsMap.forEach((matches, roundKey) => {
                    console.log(`   Round "${roundKey}": ${matches.length} matches`);
                    matches.forEach(m => {
                        const date = new Date(m.commence_time);
                        console.log(`      ${m.homeTeam} vs ${m.awayTeam} - ${date.toLocaleString('no-NO')}`);
                    });
                });
            }

            // Find the earliest round by date (not just first key)
            let earliestRound = null;
            let earliestDate = null;

            roundsMap.forEach((matches, roundKey) => {
                const firstMatchDate = new Date(matches[0].commence_time || matches[0].timestamp * 1000);
                if (!earliestDate || firstMatchDate < earliestDate) {
                    earliestDate = firstMatchDate;
                    earliestRound = roundKey;
                }
            });

            if (earliestRound) {
                const firstRoundMatches = roundsMap.get(earliestRound) || [];
                console.log(`   ✅ Neste runde for liga ${leagueId}: "${earliestRound}" (${firstRoundMatches.length} kamper)`);
                nextRoundMatches.push(...firstRoundMatches);
            } else {
                console.log(`   ⚠️ Ingen runde funnet for liga ${leagueId}`);
            }
        });

        return nextRoundMatches;
    }

    /**
     * Fetch next round fixtures for each league using next= parameter
     * @returns {Array} - Upcoming fixtures
     */
    async fetchNextRoundFixtures() {
        const allFixtures = [];

        for (const leagueId of API_CONFIG.LEAGUES) {
            try {
                // Special handling for WC Qualification Europe - always use 2024
                const season = leagueId === 32 ? 2024 : API_CONFIG.SEASON;
                const url = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${season}&next=20`;
                const response = await fetch(url, { method: 'GET' });

                if (!response.ok) {
                    console.warn(`Failed to fetch fixtures for league ${leagueId}`);
                    continue;
                }

                const data = await response.json();
                if (data.response && Array.isArray(data.response)) {
                    const transformed = transformers.transformFixturesData(data.response, 20, this.teamLogosCache);
                    allFixtures.push(...transformed);
                }
            } catch (error) {
                console.warn(`Error fetching fixtures for league ${leagueId}:`, error);
            }
        }

        // Filter to next round only
        return this.filterToNextRound(allFixtures);
    }

    /**
     * Get upcoming fixtures (main method)
     * Now uses Supabase as single source of truth for odds consistency
     */
    async getUpcomingFixtures(skipCache = false) {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 60); // Fetch up to 60 days ahead to catch next round

        // Try Supabase first (fastest and ensures consistent odds)
        if (!skipCache) {
            try {
                const { getUpcomingMatchesFromCache, saveMatchesToFirestore, convertOldFormatMatches } = await import('./js/utils/matchCache.js?v=20251118b');
                const cachedMatches = await getUpcomingMatchesFromCache(today, futureDate, API_CONFIG.LEAGUES);

                if (cachedMatches && cachedMatches.length > 0) {
                    console.log(`⚡ Loaded ${cachedMatches.length} matches from Supabase cache for leagues ${API_CONFIG.LEAGUES.join(',')}`);

                    // Filter to only show next round for each league
                    const nextRoundMatches = this.filterToNextRound(cachedMatches);
                    console.log(`📋 Filtered to ${nextRoundMatches.length} matches (next round only)`);

                    // Return cached matches immediately for fast loading
                    // Note: Results will be updated by loadMatches() which calls fetchScores() separately
                    return nextRoundMatches;
                } else {
                    console.log(`⚠️ Supabase cache returned 0 matches for leagues ${API_CONFIG.LEAGUES.join(',')}, fetching from API...`);

                    // If cache is empty/invalid, convert old format matches in background
                    convertOldFormatMatches().catch(err => console.warn('Conversion failed:', err));
                }
            } catch (error) {
                console.warn('⚠️ Supabase cache failed, falling back to API:', error);
            }
        } else {
            console.log('🔄 Skipping Supabase cache, fetching fresh data from API...');
        }

        // Supabase cache miss - fetch from API using next=X parameter for each league
        console.log(`📅 Fetching next round fixtures from API for leagues ${API_CONFIG.LEAGUES.join(',')}`);
        const fixtures = await this.fetchNextRoundFixtures();

        // Skip odds fetching if no fixtures
        if (fixtures.length === 0) {
            console.log('ℹ️ No upcoming fixtures, skipping odds fetch');
            return [];
        }

        // Fetch odds - new strategy: fetch all odds by league and date first
        console.log(`💰 Fetching odds for ${fixtures.length} fixtures...`);
        let successCount = 0;
        let defaultCount = 0;

        // Build a map of all odds by league and date
        const allOddsMap = {};
        const leagueDateMap = new Map(); // Map<leagueId, Set<dateStr>>

        // Group fixtures by league and date (only fetch for leagues that have fixtures)
        fixtures.forEach(fixture => {
            const fixtureDate = new Date(fixture.commence_time);
            const dateStr = fixtureDate.toISOString().split('T')[0];
            const leagueId = fixture.league;

            if (!leagueDateMap.has(leagueId)) {
                leagueDateMap.set(leagueId, new Set());
            }
            leagueDateMap.get(leagueId).add(dateStr);
        });

        // Calculate total API calls needed
        let totalCalls = 0;
        leagueDateMap.forEach((dates) => totalCalls += dates.size);

        // Fetch odds for each league and date combination (only for dates with fixtures)
        console.log(`📡 Fetching odds in bulk for ${totalCalls} league/date combinations...`);
        let oddsCallCount = 0;
        let foundAnyOdds = false;

        for (const [leagueId, dates] of leagueDateMap.entries()) {
            for (const dateStr of dates) {
                oddsCallCount++;
                const leagueOdds = await this.fetchOddsForLeague(leagueId, dateStr);
                Object.assign(allOddsMap, leagueOdds);

                if (Object.keys(leagueOdds).length > 0) {
                    foundAnyOdds = true;
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`📊 Bulk fetch complete. Found odds for ${Object.keys(allOddsMap).length} fixtures`);

        // Assign odds to fixtures from bulk fetch
        const missingOddsFixtures = [];
        for (let i = 0; i < fixtures.length; i++) {
            const fixture = fixtures[i];

            if (allOddsMap[fixture.id]) {
                fixture.odds = allOddsMap[fixture.id];
                successCount++;
            } else {
                fixture.odds = null;
                defaultCount++;
                missingOddsFixtures.push(fixture);
            }
        }

        console.log(`💰 Bulk odds: ${successCount} fetched${defaultCount > 0 ? `, ${defaultCount} missing` : ''}`);

        // Fallback: fetch missing odds individually (only if we have missing fixtures)
        if (missingOddsFixtures.length > 0 && missingOddsFixtures.length <= 10) {
            console.log(`🔄 Fetching ${missingOddsFixtures.length} missing odds individually...`);
            let fallbackSuccess = 0;

            for (const fixture of missingOddsFixtures) {
                try {
                    const fixtureOdds = await this.fetchOddsForFixture(fixture.id);
                    if (fixtureOdds) {
                        fixture.odds = fixtureOdds;
                        fallbackSuccess++;
                        successCount++;
                        defaultCount--;
                    }
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 150));
                } catch (error) {
                    console.warn(`⚠️ Failed to fetch odds for fixture ${fixture.id}`);
                }
            }

            console.log(`✅ Fallback fetch: ${fallbackSuccess} additional odds found`);
        } else if (missingOddsFixtures.length > 10) {
            console.log(`⚠️ Too many missing odds (${missingOddsFixtures.length}), skipping individual fetch`);
        }

        console.log(`💰 Total odds: ${successCount} fetched${defaultCount > 0 ? `, ${defaultCount} missing` : ''}`);

        // Log all fixtures with IDs and odds status for debugging
        console.table(fixtures.map(f => ({
            id: f.id,
            match: `${f.homeTeam} - ${f.awayTeam}`,
            hasOdds: f.odds ? '✅' : '❌',
            date: f.commence_time ? new Date(f.commence_time).toLocaleDateString('no-NO') : 'N/A'
        })));

        // Note: Matches are populated by admin script (see populate_matches.py)
        // Client-side code only reads from Supabase, never writes
        console.log('ℹ️ Matches are managed by admin script. Client has read-only access.');

        // Also save to localStorage for faster initial load
        this.saveCache(fixtures);

        return fixtures;
    }

    /**
     * Update match results in background (for cached matches)
     * Only updates completed status and results, never odds
     */
    async updateResultsInBackground(cachedMatches) {
        try {
            // Get match IDs that need result updates (not completed yet)
            const incompleteMatches = cachedMatches.filter(m => !m.completed);

            if (incompleteMatches.length === 0) {
                return; // All matches completed, no update needed
            }

            console.log(`🔄 Checking results for ${incompleteMatches.length} incomplete matches...`);

            // Fetch latest scores from API
            const updatedScores = await this.fetchScores();

            // Find matches with new results
            const matchesWithResults = [];
            incompleteMatches.forEach(cached => {
                const updated = updatedScores.find(s => String(s.id) === String(cached.id));
                if (updated && updated.completed) {
                    matchesWithResults.push(updated);
                }
            });

            if (matchesWithResults.length > 0) {
                const { updateMatchResults } = await import('./js/utils/matchCache.js');
                await updateMatchResults(matchesWithResults);
            }
        } catch (error) {
            console.warn('⚠️ Background result update failed:', error);
        }
    }

    /**
     * Mock data when API key is not set
     */
    getMockFixtures() {
        return mockData.getMockFixtures();
    }

    /**
     * Mock scores when API is not available
     */
    getMockScores() {
        return mockData.getMockScores();
    }

    /**
     * Format date range for round display
     */
    formatDateRange(startDate, endDate) {
        const options = { day: 'numeric', month: 'short' };
        const start = startDate.toLocaleDateString('no-NO', options);
        const end = endDate.toLocaleDateString('no-NO', options);

        // Same day
        if (startDate.toDateString() === endDate.toDateString()) {
            return start;
        }

        // Same month
        if (startDate.getMonth() === endDate.getMonth()) {
            const dayOptions = { day: 'numeric' };
            const startDay = startDate.toLocaleDateString('no-NO', dayOptions);
            return `${startDay}-${end}`;
        }

        // Different months
        return `${start} - ${end}`;
    }

    /**
     * Fetch available rounds for Premier League, Champions League and Europa League
     * Returns upcoming and recent rounds for competition creation
     */
    async fetchAvailableRounds() {
        if (this.useMockData) {
            return {
                premierLeague: [
                    { value: 10, label: 'Runde 10', status: 'upcoming' },
                    { value: 11, label: 'Runde 11', status: 'upcoming' },
                    { value: 12, label: 'Runde 12', status: 'upcoming' }
                ],
                championsLeague: [
                    { value: 'League Stage - Matchday 3', label: 'Matchday 3', status: 'upcoming' },
                    { value: 'League Stage - Matchday 4', label: 'Matchday 4', status: 'upcoming' }
                ],
                europaLeague: [
                    { value: 'League Stage - Matchday 3', label: 'Matchday 3', status: 'upcoming' },
                    { value: 'League Stage - Matchday 4', label: 'Matchday 4', status: 'upcoming' }
                ]
            };
        }

        try {
            console.log('🔍 Fetching available rounds...');

            const today = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);
            const twoMonthsLater = new Date();
            twoMonthsLater.setDate(today.getDate() + 60);

            const plRoundsMap = new Map(); // Map<roundNumber, { fixtures: [...], hasStarted: boolean }>
            const clRoundsMap = new Map(); // Map<roundString, { fixtures: [...], hasStarted: boolean }>
            const elRoundsMap = new Map(); // Map<roundString, { fixtures: [...], hasStarted: boolean }>

            // Fetch fixtures for both past (to find started matches) and future (to find upcoming rounds)
            // We need a wide range to capture all matches in each round
            for (const leagueId of [39, 2, 3]) { // PL, CL and EL for round-based competitions
                // Fetch recent completed matches (last 7 days)
                const recentUrl = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${API_CONFIG.SEASON}&last=20`;

                // Fetch upcoming matches (next 60 days)
                const upcomingUrl = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${API_CONFIG.SEASON}&next=50`;

                const [recentResponse, upcomingResponse] = await Promise.all([
                    fetch(recentUrl, { method: 'GET' }),
                    fetch(upcomingUrl, { method: 'GET' })
                ]);

                const allFixtures = [];

                if (recentResponse.ok) {
                    const recentData = await recentResponse.json();
                    if (recentData.response) allFixtures.push(...recentData.response);
                }

                if (upcomingResponse.ok) {
                    const upcomingData = await upcomingResponse.json();
                    if (upcomingData.response) allFixtures.push(...upcomingData.response);
                }

                // Group by round
                allFixtures.forEach(fixture => {
                    const round = fixture.league.round;
                    if (!round) return;

                    const fixtureDate = new Date(fixture.fixture.date);
                    const hasStarted = fixtureDate <= today;

                    if (leagueId === 39) {
                        // Premier League
                        const roundMatch = round.match(/(\d+)/);
                        if (roundMatch) {
                            const roundNum = parseInt(roundMatch[1]);
                            if (!plRoundsMap.has(roundNum)) {
                                plRoundsMap.set(roundNum, { fixtures: [], hasStarted: false });
                            }
                            plRoundsMap.get(roundNum).fixtures.push(fixture);
                            if (hasStarted) {
                                plRoundsMap.get(roundNum).hasStarted = true;
                            }
                        }
                    } else if (leagueId === 2) {
                        // Champions League
                        if (!clRoundsMap.has(round)) {
                            clRoundsMap.set(round, { fixtures: [], hasStarted: false });
                        }
                        clRoundsMap.get(round).fixtures.push(fixture);
                        if (hasStarted) {
                            clRoundsMap.get(round).hasStarted = true;
                        }
                    } else if (leagueId === 3) {
                        // Europa League
                        if (!elRoundsMap.has(round)) {
                            elRoundsMap.set(round, { fixtures: [], hasStarted: false });
                        }
                        elRoundsMap.get(round).fixtures.push(fixture);
                        if (hasStarted) {
                            elRoundsMap.get(round).hasStarted = true;
                        }
                    }
                });
            }

            // Convert to sorted arrays with date ranges
            const now = new Date();

            // Debug: Log all PL rounds found
            console.log('🔍 All Premier League rounds found:');
            Array.from(plRoundsMap.entries())
                .sort((a, b) => a[0] - b[0])
                .slice(0, 5)
                .forEach(([num, data]) => {
                    const futureCount = data.fixtures.filter(f => new Date(f.fixture.date) > now).length;
                    console.log(`   Runde ${num}: ${data.fixtures.length} kamper (${futureCount} fremtidige) - ${!data.hasStarted ? '✅ INKLUDERES' : '❌ EKSKLUDERES (har startet)'}`);
                });

            const plRoundsArray = Array.from(plRoundsMap.entries())
                .sort((a, b) => a[0] - b[0])
                .filter(([num, data]) => {
                    // Only include rounds that haven't started yet
                    return !data.hasStarted;
                })
                .slice(0, 10) // Limit to next 10 rounds
                .map(([num, data]) => {
                    // Find earliest and latest fixture dates
                    const dates = data.fixtures.map(f => new Date(f.fixture.date));
                    const startDate = new Date(Math.min(...dates));
                    const endDate = new Date(Math.max(...dates));

                    return {
                        value: num,
                        label: `Runde ${num}`,
                        status: 'upcoming',
                        startDate: startDate,
                        endDate: endDate,
                        dateRange: this.formatDateRange(startDate, endDate)
                    };
                });

            const clRoundsArray = Array.from(clRoundsMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .filter(([round, data]) => {
                    // Only include rounds that haven't started yet
                    return !data.hasStarted;
                })
                .slice(0, 10)
                .map(([round, data]) => {
                    // Find earliest and latest fixture dates
                    const dates = data.fixtures.map(f => new Date(f.fixture.date));
                    const startDate = new Date(Math.min(...dates));
                    const endDate = new Date(Math.max(...dates));

                    // Extract matchday number from "League Stage - Matchday 4"
                    const match = round.match(/Matchday (\d+)/);
                    const label = match ? `Runde ${match[1]}` : round;

                    return {
                        value: round,
                        label: label,
                        status: 'upcoming',
                        startDate: startDate,
                        endDate: endDate,
                        dateRange: this.formatDateRange(startDate, endDate)
                    };
                });

            const elRoundsArray = Array.from(elRoundsMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .filter(([round, data]) => {
                    // Only include rounds that haven't started yet
                    return !data.hasStarted;
                })
                .slice(0, 10)
                .map(([round, data]) => {
                    // Find earliest and latest fixture dates
                    const dates = data.fixtures.map(f => new Date(f.fixture.date));
                    const startDate = new Date(Math.min(...dates));
                    const endDate = new Date(Math.max(...dates));

                    // Extract matchday number from "League Stage - Matchday 4"
                    const match = round.match(/Matchday (\d+)/);
                    const label = match ? `Runde ${match[1]}` : round;

                    return {
                        value: round,
                        label: label,
                        status: 'upcoming',
                        startDate: startDate,
                        endDate: endDate,
                        dateRange: this.formatDateRange(startDate, endDate)
                    };
                });

            // Debug logging
            console.log('✅ Found available rounds (not started):', { pl: plRoundsArray.length, cl: clRoundsArray.length, el: elRoundsArray.length });

            // Show first available round for each league
            if (plRoundsArray.length > 0) {
                console.log(`   Premier League: ${plRoundsArray[0].label} (${plRoundsArray[0].dateRange})`);
            } else {
                console.log(`   Premier League: No upcoming rounds found (all have started)`);
            }

            if (clRoundsArray.length > 0) {
                console.log(`   Champions League: ${clRoundsArray[0].label} (${clRoundsArray[0].dateRange})`);
            } else {
                console.log(`   Champions League: No upcoming rounds found (all have started)`);
            }

            if (elRoundsArray.length > 0) {
                console.log(`   Europa League: ${elRoundsArray[0].label} (${elRoundsArray[0].dateRange})`);
            } else {
                console.log(`   Europa League: No upcoming rounds found (all have started)`);
            }

            return {
                premierLeague: plRoundsArray,
                championsLeague: clRoundsArray,
                europaLeague: elRoundsArray
            };

        } catch (error) {
            console.error('Failed to fetch available rounds:', error);
            return {
                premierLeague: [],
                championsLeague: [],
                europaLeague: []
            };
        }
    }
}

// Create a global instance
const footballApi = new FootballApiService();

// Export for use in other modules
export { footballApi };

// Also expose globally for non-module scripts
if (typeof window !== 'undefined') {
    window.footballApi = footballApi;
}
