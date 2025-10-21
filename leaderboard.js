// Leaderboard page script
let matches = [];

// Initialize the page
function init() {
    initializeFirebase();
    loadLeaderboardData();
}

// Load matches and leaderboard data
async function loadLeaderboardData() {
    try {
        // Fetch upcoming matches from API (needed for score calculation)
        matches = await footballApi.getUpcomingFixtures();

        // Also fetch completed matches for score calculation
        try {
            const completedMatches = await footballApi.fetchScores();
            console.log('📊 Loaded completed matches for leaderboard:', completedMatches.length);
            // Add completed matches for score calculation
            matches = matches.concat(completedMatches);
        } catch (error) {
            console.warn('⚠️ Could not load completed matches:', error);
        }
    } catch (error) {
        console.error('Failed to load matches:', error);
        // Fallback to mock data
        matches = await footballApi.getMockFixtures();
    }

    console.log(`✅ Total matches loaded for leaderboard: ${matches.length}`);

    // Now load the leaderboard if user is logged in
    if (currentUser && typeof loadFirebaseLeaderboard === 'function') {
        console.log('🔄 Matches ready, loading leaderboard...');
        await loadFirebaseLeaderboard();
    }
}

// Calculate total score for a player
function calculatePlayerScore(tips) {
    let totalScore = 0;

    console.log(`📊 Calculating score for player with ${tips.length} tips`);
    console.log(`📊 Available matches: ${matches.length}`);

    tips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        if (!match) {
            console.log(`⚠️ Match not found for tip matchId: ${tip.matchId}`);
            return;
        }

        // Add odds to tip if missing or ensure odds exist
        const tipWithOdds = {
            ...tip,
            odds: tip.odds || match.odds || { H: 2.0, U: 3.0, B: 3.5 }
        };

        // Ensure odds is an object with H, U, B properties
        if (!tipWithOdds.odds || typeof tipWithOdds.odds !== 'object') {
            tipWithOdds.odds = { H: 2.0, U: 3.0, B: 3.5 };
            console.warn(`⚠️ Using default odds for match ${match.homeTeam} vs ${match.awayTeam}`);
        }

        const points = calculatePoints(tipWithOdds, match);

        if (points > 0) {
            console.log(`✅ Points earned: ${points.toFixed(2)} for ${match.homeTeam} vs ${match.awayTeam}`);
        }

        totalScore += points;
    });

    console.log(`💰 Total score calculated: ${totalScore.toFixed(2)}`);
    return totalScore;
}

// Calculate outcome (H, U, B)
function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

// Calculate points for a tip
function calculatePoints(tip, match) {
    if (!match.result) return 0;

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

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    init();
});
