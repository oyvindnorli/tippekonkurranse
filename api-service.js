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
     * Get upcoming fixtures (main method)
     * Now uses Firestore as single source of truth for odds consistency
     */
    async getUpcomingFixtures(skipCache = false) {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 7); // Get fixtures for next 7 days

        // Try Firestore first (fastest and ensures consistent odds)
        if (!skipCache) {
            try {
                const { getUpcomingMatchesFromCache, saveMatchesToFirestore, cleanupOldFormatMatches } = await import('./js/utils/matchCache.js');
                const cachedMatches = await getUpcomingMatchesFromCache(today, tomorrow, API_CONFIG.LEAGUES);

                if (cachedMatches && cachedMatches.length > 0) {
                    console.log(`⚡ Loaded ${cachedMatches.length} matches from Firestore cache for leagues ${API_CONFIG.LEAGUES.join(',')}`);

                    // Return cached matches immediately for fast loading
                    // Note: Results will be updated by loadMatches() which calls fetchScores() separately
                    return cachedMatches;
                } else {
                    console.log(`⚠️ Firestore cache returned 0 matches for leagues ${API_CONFIG.LEAGUES.join(',')}, fetching from API...`);

                    // If cache is empty/invalid, clean up old format matches in background
                    cleanupOldFormatMatches().catch(err => console.warn('Cleanup failed:', err));
                }
            } catch (error) {
                console.warn('⚠️ Firestore cache failed, falling back to API:', error);
            }
        } else {
            console.log('🔄 Skipping Firestore cache, fetching fresh data from API...');
        }

        // Firestore cache miss - fetch from API
        const from = today.toISOString().split('T')[0];
        const to = tomorrow.toISOString().split('T')[0];

        console.log(`📅 Fetching fixtures from API ${from} to ${to}`);
        const fixtures = await this.fetchFixtures(from, to);

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

                // Early exit: if we've made 2+ calls and found no odds, API likely has none
                if (oddsCallCount >= 2 && !foundAnyOdds) {
                    console.log('⚡ No odds found after 2 calls, skipping rest');
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay
            }

            // Break outer loop too if we're skipping
            if (oddsCallCount >= 2 && !foundAnyOdds) {
                break;
            }
        }

        console.log(`📊 Bulk fetch complete. Found odds for ${Object.keys(allOddsMap).length} fixtures`);

        // Assign odds to fixtures (no individual fallback - too slow)
        for (let i = 0; i < fixtures.length; i++) {
            const fixture = fixtures[i];

            if (allOddsMap[fixture.id]) {
                fixture.odds = allOddsMap[fixture.id];
                successCount++;
            } else {
                fixture.odds = null;
                defaultCount++;
            }
        }

        console.log(`💰 Odds: ${successCount} fetched${defaultCount > 0 ? `, ${defaultCount} missing` : ''}`);

        // Save to Firestore for consistent odds across all users
        try {
            const { saveMatchesToFirestore } = await import('./js/utils/matchCache.js');
            const saved = await saveMatchesToFirestore(fixtures);
            if (saved === 0) {
                console.log('ℹ️ No new matches to save (all already in Firestore)');
            }
        } catch (error) {
            console.error('⚠️ Failed to save matches to Firestore:', error);
        }

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
     * Fetch available rounds for Premier League and Champions League
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
                ]
            };
        }

        try {
            console.log('🔍 Fetching available rounds...');

            // Get fixtures for next 60 days to find upcoming rounds
            const today = new Date();
            const twoMonthsLater = new Date();
            twoMonthsLater.setDate(today.getDate() + 60);

            const fromDate = today.toISOString().split('T')[0];
            const toDate = twoMonthsLater.toISOString().split('T')[0];

            const plRoundsMap = new Map(); // Map<roundNumber, { fixtures: [...] }>
            const clRoundsMap = new Map(); // Map<roundString, { fixtures: [...] }>

            // Fetch fixtures for both leagues
            for (const leagueId of API_CONFIG.LEAGUES) {
                const url = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${API_CONFIG.SEASON}&from=${fromDate}&to=${toDate}`;

                const response = await fetch(url, {
                    method: 'GET'
                });

                if (!response.ok) continue;

                const data = await response.json();

                if (data.response && data.response.length > 0) {
                    data.response.forEach(fixture => {
                        const round = fixture.league.round;
                        if (!round) return;

                        if (leagueId === 39) {
                            // Premier League - extract round number
                            const match = round.match(/(\d+)/);
                            if (match) {
                                const roundNum = parseInt(match[1]);
                                if (!plRoundsMap.has(roundNum)) {
                                    plRoundsMap.set(roundNum, { fixtures: [] });
                                }
                                plRoundsMap.get(roundNum).fixtures.push(fixture);
                            }
                        } else if (leagueId === 2) {
                            // Champions League - store full round string
                            if (!clRoundsMap.has(round)) {
                                clRoundsMap.set(round, { fixtures: [] });
                            }
                            clRoundsMap.get(round).fixtures.push(fixture);
                        }
                    });
                }
            }

            // Convert to sorted arrays with date ranges
            const plRoundsArray = Array.from(plRoundsMap.entries())
                .sort((a, b) => a[0] - b[0])
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

            console.log('✅ Found rounds:', { pl: plRoundsArray.length, cl: clRoundsArray.length });

            return {
                premierLeague: plRoundsArray,
                championsLeague: clRoundsArray
            };

        } catch (error) {
            console.error('Failed to fetch available rounds:', error);
            return {
                premierLeague: [],
                championsLeague: []
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
