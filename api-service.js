// API-Football Service
class FootballApiService {
    constructor() {
        this.useMockData = !isApiKeySet();
        this.cache = this.loadCache();
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
        try {
            const cached = localStorage.getItem('apiFootballCache');
            if (cached) {
                const data = JSON.parse(cached);
                // Check if cache is still valid
                if (data.timestamp && (Date.now() - data.timestamp) < API_CONFIG.CACHE_DURATION) {
                    const hoursRemaining = Math.round((API_CONFIG.CACHE_DURATION - (Date.now() - data.timestamp)) / 1000 / 60 / 60);
                    console.log(`✅ Using cached data (expires in ${hoursRemaining} hours)`);
                    return data;
                }
            }
        } catch (error) {
            console.error('Error loading cache:', error);
        }
        return null;
    }

    /**
     * Save cache to localStorage
     */
    saveCache(data) {
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem('apiFootballCache', JSON.stringify(cacheData));
            console.log('💾 Data cached for 24 hours');
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }

    /**
     * Clear cache (useful for manual refresh)
     */
    clearCache() {
        localStorage.removeItem('apiFootballCache');
        this.cache = null;
        console.log('🗑️ Cache cleared');
    }

    /**
     * Fetch fixtures from API-Football
     * @param {string} from - Date in format YYYY-MM-DD
     * @param {string} to - Date in format YYYY-MM-DD
     */
    async fetchFixtures(from, to) {
        if (this.useMockData) {
            return this.getMockFixtures();
        }

        try {
            console.log('🌐 Fetching fixtures from API-Football...');
            let allFixtures = [];
            const fixtureIds = new Set(); // Track unique fixture IDs

            // Fetch fixtures for each league
            for (const leagueId of API_CONFIG.LEAGUES) {
                const url = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${API_CONFIG.SEASON}&from=${from}&to=${to}`;

                console.log(`📡 Fetching league ${leagueId}...`);
                const response = await fetch(url, {
                    method: 'GET'
                });

                if (!response.ok) {
                    console.warn(`Failed to fetch league ${leagueId}: ${response.status}`);
                    continue;
                }

                const data = await response.json();

                if (data.response && data.response.length > 0) {
                    // Deduplicate fixtures by ID
                    let addedCount = 0;
                    data.response.forEach(fixture => {
                        if (!fixtureIds.has(fixture.fixture.id)) {
                            fixtureIds.add(fixture.fixture.id);
                            allFixtures.push(fixture);
                            addedCount++;
                        } else {
                            console.log(`🔄 Skipping duplicate fixture: ${fixture.teams.home.name} vs ${fixture.teams.away.name} (ID: ${fixture.fixture.id})`);
                        }
                    });
                    console.log(`✅ Added ${addedCount} unique fixtures from league ${leagueId} (${data.response.length} total in response)`);
                }

                // Log API rate limit info
                if (data.parameters && data.parameters.requests) {
                    console.log(`📊 API requests used: ${data.parameters.requests.current}/${data.parameters.requests.limit_day}`);
                }
            }

            console.log(`📅 Total unique fixtures fetched: ${allFixtures.length}`);
            return this.transformFixturesData(allFixtures);
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
            // Try to fetch all odds for the league on this date
            const url = `${API_CONFIG.BASE_URL}?endpoint=odds&league=${leagueId}&season=${API_CONFIG.SEASON}&date=${date}`;

            console.log(`📡 Fetching odds for league ${leagueId} on ${date}...`);

            const response = await fetch(url, {
                method: 'GET'
            });

            if (!response.ok) {
                console.error(`❌ Failed to fetch league odds: ${response.status} ${response.statusText}`);
                if (response.status === 429) {
                    console.error('⚠️ API RATE LIMIT EXCEEDED! You have used up your daily quota.');
                }
                return {};
            }

            const data = await response.json();

            // Log API usage
            if (data.requests) {
                console.log(`📊 API Usage: ${data.requests.current}/${data.requests.limit_day} requests used today`);
            }

            const oddsMap = {};

            if (data.response && data.response.length > 0) {
                console.log(`✅ Found odds for ${data.response.length} fixtures in league ${leagueId} on ${date}`);

                data.response.forEach(oddsData => {
                    const fixtureId = oddsData.fixture.id;
                    const odds = this.transformOddsData(oddsData);
                    if (odds) {
                        oddsMap[fixtureId] = odds;
                        console.log(`  💰 Fixture ${fixtureId}: H:${odds.H} U:${odds.U} B:${odds.B}`);
                    } else {
                        console.warn(`  ⚠️ No odds available for fixture ${fixtureId}`);
                    }
                });
            } else {
                console.warn(`⚠️ No odds data returned for league ${leagueId} on ${date}`);
            }

            return oddsMap;
        } catch (error) {
            console.error(`Error fetching league odds:`, error);
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
            // Try without specifying bookmaker first (gets best available)
            let url = `${API_CONFIG.BASE_URL}?endpoint=odds&fixture=${fixtureId}`;

            let response = await fetch(url, {
                method: 'GET'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.response && data.response.length > 0) {
                    const odds = this.transformOddsData(data.response[0]);
                    if (odds.H !== 2.0 || odds.U !== 3.0 || odds.B !== 3.5) {
                        console.log(`✅ Found odds for fixture ${fixtureId}`);
                        return odds;
                    }
                }
            }

            console.warn(`⚠️ No odds found for fixture ${fixtureId}`);
            return null; // No odds available
        } catch (error) {
            console.error(`❌ Error fetching odds for fixture ${fixtureId}:`, error);
            return null; // No odds available
        }
    }

    /**
     * Transform API-Football fixtures data to our format
     */
    transformFixturesData(apiFixtures) {
        // Log all fixtures before filtering
        console.log(`📋 Total fixtures received from API: ${apiFixtures.length}`);

        // Filter out matches that have already finished or are in progress
        const now = new Date();

        // Log what we're filtering out
        apiFixtures.forEach(fixture => {
            const matchDate = new Date(fixture.fixture.date);
            const status = fixture.fixture.status.short;
            const homeTeam = fixture.teams.home.name;
            const awayTeam = fixture.teams.away.name;

            if (matchDate <= now) {
                console.log(`⏰ Filtering out (already started/past): ${homeTeam} vs ${awayTeam} - Date: ${matchDate.toLocaleString('no-NO')} - Status: ${status}`);
            } else if (status !== 'NS') {
                console.log(`⚠️ Filtering out (status not NS): ${homeTeam} vs ${awayTeam} - Status: ${status}`);
            }
        });

        const upcomingFixtures = apiFixtures.filter(fixture => {
            const matchDate = new Date(fixture.fixture.date);
            return matchDate > now && fixture.fixture.status.short === 'NS'; // NS = Not Started
        });

        // Sort by date
        upcomingFixtures.sort((a, b) => {
            return new Date(a.fixture.date) - new Date(b.fixture.date);
        });

        console.log(`📅 Upcoming fixtures after filtering: ${upcomingFixtures.length}`);

        return upcomingFixtures.slice(0, API_CONFIG.MAX_MATCHES).map(fixture => {
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
                this.teamLogosCache[fixture.teams.home.name] = fixture.teams.home.logo;
            }
            if (fixture.teams.away.logo) {
                this.teamLogosCache[fixture.teams.away.name] = fixture.teams.away.logo;
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
                league: fixture.league.name,
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
     */
    transformOddsData(apiOdds) {
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
            return this.getMockScores();
        }

        try {
            console.log('🔴 Fetching live scores from API-Football...');
            let allMatches = [];
            const fixtureIds = new Set(); // Track unique fixture IDs

            // Get date range - last 7 days to today
            const today = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);

            const fromDate = weekAgo.toISOString().split('T')[0];
            const toDate = today.toISOString().split('T')[0];

            console.log(`📅 Fetching matches from ${fromDate} to ${toDate}`);

            // Fetch live and recent matches for each league - WITH EVENTS
            for (const leagueId of API_CONFIG.LEAGUES) {
                // Use timezone parameter to get events data
                const url = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${API_CONFIG.SEASON}&from=${fromDate}&to=${toDate}&timezone=Europe/Oslo`;

                console.log(`📡 Fetching scores for league ${leagueId}...`);
                const response = await fetch(url, {
                    method: 'GET'
                });

                if (!response.ok) {
                    console.warn(`Failed to fetch scores for league ${leagueId}: ${response.status}`);
                    continue;
                }

                const data = await response.json();

                if (data.response && data.response.length > 0) {
                    // Deduplicate matches by ID
                    let addedCount = 0;
                    data.response.forEach(match => {
                        if (!fixtureIds.has(match.fixture.id)) {
                            fixtureIds.add(match.fixture.id);
                            allMatches.push(match);
                            addedCount++;

                            // Log if match has events
                            if (match.events && match.events.length > 0) {
                                console.log(`📋 Match ${match.teams.home.name} vs ${match.teams.away.name} has ${match.events.length} events`);
                            }
                        }
                    });
                    console.log(`✅ Added ${addedCount} unique matches from league ${leagueId} (${data.response.length} total in response)`);
                }
            }

            console.log(`📊 Total unique matches in last 7 days: ${allMatches.length}`);
            return this.transformScoresData(allMatches);
        } catch (error) {
            console.error('Error fetching scores:', error);
            console.log('💡 Falling back to mock data...');
            return this.getMockScores();
        }
    }

    /**
     * Transform scores data to our format
     */
    transformScoresData(apiMatches) {
        return apiMatches.map(match => {
            const matchDate = new Date(match.fixture.date);
            const time = matchDate.toLocaleTimeString('no-NO', {
                hour: '2-digit',
                minute: '2-digit'
            });

            // Store team logos
            if (match.teams.home.logo) {
                this.teamLogosCache[match.teams.home.name] = match.teams.home.logo;
            }
            if (match.teams.away.logo) {
                this.teamLogosCache[match.teams.away.name] = match.teams.away.logo;
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
                league: match.league.name,
                leagueLogo: match.league.logo,
                round: match.league.round, // e.g. "Regular Season - 10"
                elapsed: match.fixture.status.elapsed,
                last_update: new Date().toISOString()
            };
        });
    }

    /**
     * Get upcoming fixtures (main method)
     */
    async getUpcomingFixtures() {
        // Check if we have valid cached data
        if (this.cache && this.cache.data) {
            return this.cache.data;
        }

        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 14); // Get fixtures for next 2 weeks

        const from = today.toISOString().split('T')[0];
        const to = nextWeek.toISOString().split('T')[0];

        console.log(`📅 Fetching fixtures from ${from} to ${to}`);
        const fixtures = await this.fetchFixtures(from, to);

        // Fetch odds - new strategy: fetch all odds by league and date first
        console.log(`💰 Fetching odds for ${fixtures.length} fixtures...`);
        let successCount = 0;
        let defaultCount = 0;

        // Build a map of all odds by league and date
        const allOddsMap = {};
        const dateSet = new Set();

        // Group fixtures by date
        fixtures.forEach(fixture => {
            const fixtureDate = new Date(fixture.commence_time);
            const dateStr = fixtureDate.toISOString().split('T')[0];
            dateSet.add(dateStr);
        });

        // Fetch odds for each league and date combination
        console.log(`📡 Fetching odds in bulk for ${dateSet.size} dates...`);
        for (const leagueId of API_CONFIG.LEAGUES) {
            for (const dateStr of dateSet) {
                const leagueOdds = await this.fetchOddsForLeague(leagueId, dateStr);
                Object.assign(allOddsMap, leagueOdds);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        console.log(`📊 Bulk fetch complete. Found odds for ${Object.keys(allOddsMap).length} fixtures`);

        // Now assign odds to fixtures
        for (let i = 0; i < fixtures.length; i++) {
            const fixture = fixtures[i];

            // First try to use odds from bulk fetch
            if (allOddsMap[fixture.id]) {
                fixture.odds = allOddsMap[fixture.id];
                console.log(`✅ Odds for ${fixture.homeTeam} vs ${fixture.awayTeam}: H:${fixture.odds.H} U:${fixture.odds.U} B:${fixture.odds.B}`);
                successCount++;
            } else {
                // Fallback: try to fetch individually from API-Football
                console.log(`[${i+1}/${fixtures.length}] Fetching individual odds for ${fixture.homeTeam} vs ${fixture.awayTeam}...`);
                try {
                    fixture.odds = await this.fetchOddsForFixture(fixture.id);

                    if (!fixture.odds) {
                        console.warn(`⚠️ No odds available for ${fixture.homeTeam} vs ${fixture.awayTeam}`);
                        defaultCount++;
                    } else {
                        console.log(`✅ Odds for ${fixture.homeTeam} vs ${fixture.awayTeam}: H:${fixture.odds.H} U:${fixture.odds.U} B:${fixture.odds.B}`);
                        successCount++;
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`❌ Failed to fetch odds for ${fixture.homeTeam} vs ${fixture.awayTeam}:`, error);
                    fixture.odds = null;
                    defaultCount++;
                }
            }
        }

        console.log(`📊 Odds fetch summary: ${successCount} with odds, ${defaultCount} without odds`);
        if (defaultCount > 0) {
            console.warn(`⚠️ ${defaultCount} matches are missing odds from the API. This is normal for some leagues/bookmakers.`);
        }

        // Save to cache
        this.saveCache(fixtures);

        return fixtures;
    }

    /**
     * Mock data when API key is not set
     */
    getMockFixtures() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayMatch1 = new Date(today);
        todayMatch1.setHours(15, 0, 0, 0);

        const todayMatch2 = new Date(today);
        todayMatch2.setHours(17, 30, 0, 0);

        const tomorrowMatch1 = new Date(tomorrow);
        tomorrowMatch1.setHours(14, 0, 0, 0);

        const tomorrowMatch2 = new Date(tomorrow);
        tomorrowMatch2.setHours(16, 30, 0, 0);

        const tomorrowMatch3 = new Date(tomorrow);
        tomorrowMatch3.setHours(19, 0, 0, 0);

        return Promise.resolve([
            {
                id: 1,
                homeTeam: "Manchester United",
                awayTeam: "Liverpool",
                time: "lør. 15:00 18.10",
                commence_time: todayMatch1.toISOString(),
                timestamp: Math.floor(todayMatch1.getTime() / 1000),
                odds: { H: 2.5, U: 3.2, B: 2.8 },
                league: "Premier League",
                venue: "Old Trafford",
                city: "Manchester"
            },
            {
                id: 2,
                homeTeam: "Arsenal",
                awayTeam: "Chelsea",
                time: "lør. 17:30 18.10",
                commence_time: todayMatch2.toISOString(),
                timestamp: Math.floor(todayMatch2.getTime() / 1000),
                odds: { H: 2.1, U: 3.5, B: 3.4 },
                league: "Premier League",
                venue: "Emirates Stadium",
                city: "London"
            },
            {
                id: 3,
                homeTeam: "Manchester City",
                awayTeam: "Tottenham",
                time: "søn. 14:00 19.10",
                commence_time: tomorrowMatch1.toISOString(),
                timestamp: Math.floor(tomorrowMatch1.getTime() / 1000),
                odds: { H: 1.6, U: 4.2, B: 5.5 },
                league: "Premier League",
                venue: "Etihad Stadium",
                city: "Manchester"
            },
            {
                id: 4,
                homeTeam: "Newcastle",
                awayTeam: "Brighton",
                time: "søn. 16:30 19.10",
                commence_time: tomorrowMatch2.toISOString(),
                timestamp: Math.floor(tomorrowMatch2.getTime() / 1000),
                odds: { H: 2.3, U: 3.3, B: 3.1 },
                league: "Premier League",
                venue: "St James' Park",
                city: "Newcastle"
            },
            {
                id: 5,
                homeTeam: "Aston Villa",
                awayTeam: "West Ham",
                time: "søn. 19:00 19.10",
                commence_time: tomorrowMatch3.toISOString(),
                timestamp: Math.floor(tomorrowMatch3.getTime() / 1000),
                odds: { H: 2.0, U: 3.4, B: 3.8 },
                league: "Premier League",
                venue: "Villa Park",
                city: "Birmingham"
            }
        ]);
    }

    /**
     * Mock scores when API is not available
     */
    getMockScores() {
        console.log('🎭 Using mock scores');

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const match1 = new Date(today);
        match1.setHours(15, 0, 0, 0);

        const match2 = new Date(today);
        match2.setHours(17, 30, 0, 0);

        return Promise.resolve([
            {
                id: 1,
                homeTeam: "Manchester United",
                awayTeam: "Liverpool",
                time: "15:00",
                commence_time: match1.toISOString(),
                timestamp: Math.floor(match1.getTime() / 1000),
                completed: true,
                result: { home: 2, away: 1 },
                status: "Match Finished",
                statusShort: "FT",
                league: "Premier League",
                last_update: now.toISOString()
            },
            {
                id: 2,
                homeTeam: "Arsenal",
                awayTeam: "Chelsea",
                time: "17:30",
                commence_time: match2.toISOString(),
                timestamp: Math.floor(match2.getTime() / 1000),
                completed: false,
                result: { home: 1, away: 1 },
                status: "Second Half",
                statusShort: "2H",
                elapsed: 67,
                league: "Premier League",
                last_update: now.toISOString()
            }
        ]);
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
