/**
 * Mock Data Service
 * Provides mock data when API key is not set
 */

/**
 * Get mock upcoming fixtures
 * @returns {Promise<Array>} Mock fixtures
 */
export function getMockFixtures() {
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
 * Get mock scores
 * @returns {Promise<Array>} Mock scores
 */
export function getMockScores() {
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
