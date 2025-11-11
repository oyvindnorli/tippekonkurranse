// Import utility modules
import { calculatePoints, getOutcome } from './js/utils/matchUtils.js';
import { LEAGUE_NAMES } from './js/utils/leagueConfig.js';

// Global state
let userTips = [];
let matches = [];
let filteredHistory = 'all';

// Wait for Firebase to be initialized
function waitForFirebase() {
    return new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        }
    });
}

// Initialize the page
waitForFirebase().then(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            document.getElementById('authRequired').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';

            await loadUserStats(user.uid);
        } else {
            document.getElementById('authRequired').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'none';
        }
    });
});

// Load all user statistics
async function loadUserStats(userId) {
    try {
        const db = firebase.firestore();

        // Load user tips
        const tipsSnapshot = await db.collection('tips')
            .where('userId', '==', userId)
            .get();

        userTips = tipsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Load all matches to get results
        const matchesSnapshot = await db.collection('matches').get();
        matches = matchesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Calculate and display statistics
        calculateAndDisplayStats();
        displayMatchHistory();
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Calculate all statistics
function calculateAndDisplayStats() {
    // Filter tips that have results
    const finishedTips = userTips.filter(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        return match && match.result;
    });

    if (finishedTips.length === 0) {
        document.getElementById('totalPoints').textContent = '0';
        document.getElementById('totalMatches').textContent = '0';
        document.getElementById('exactMatches').textContent = '0';
        document.getElementById('correctDirection').textContent = '0';
        document.getElementById('exactPercentage').textContent = '0%';
        document.getElementById('directionPercentage').textContent = '0%';
        document.getElementById('avgPoints').textContent = '0.0';
        document.getElementById('bestStreak').textContent = '0';
        document.getElementById('currentStreak').textContent = '0';
        document.getElementById('oddsValue').textContent = '0';
        document.getElementById('avgOdds').textContent = '-';
        return;
    }

    // Calculate points for each tip
    let totalPoints = 0;
    let exactMatches = 0;
    let correctDirection = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;
    let totalOddsValue = 0;
    let oddsCount = 0;

    const tipsWithResults = finishedTips.map(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        const points = calculatePoints(tip, match.result);
        totalPoints += points;

        if (points === 3) {
            exactMatches++;
            tempStreak++;
            currentStreak = tempStreak;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else if (points === 1) {
            correctDirection++;
            tempStreak = 0;
        } else {
            tempStreak = 0;
        }

        // Calculate odds value
        if (match.odds && tip.homeScore !== undefined && tip.awayScore !== undefined) {
            const outcome = getOutcome(tip.homeScore, tip.awayScore);
            let oddValue = 0;
            if (outcome === 'H' && match.odds.H) oddValue = match.odds.H;
            else if (outcome === 'U' && match.odds.U) oddValue = match.odds.U;
            else if (outcome === 'B' && match.odds.B) oddValue = match.odds.B;

            if (oddValue > 0 && points > 0) {
                totalOddsValue += oddValue;
                oddsCount++;
            }
        }

        return { tip, match, points };
    });

    // Update summary stats
    document.getElementById('totalPoints').textContent = totalPoints;
    document.getElementById('totalMatches').textContent = finishedTips.length;
    document.getElementById('exactMatches').textContent = exactMatches;
    document.getElementById('correctDirection').textContent = correctDirection;
    document.getElementById('exactPercentage').textContent =
        `${((exactMatches / finishedTips.length) * 100).toFixed(1)}%`;
    document.getElementById('directionPercentage').textContent =
        `${(((correctDirection + exactMatches) / finishedTips.length) * 100).toFixed(1)}%`;

    // Update detailed stats
    document.getElementById('avgPoints').textContent =
        (totalPoints / finishedTips.length).toFixed(2);
    document.getElementById('bestStreak').textContent = bestStreak;
    document.getElementById('currentStreak').textContent = currentStreak;
    document.getElementById('oddsValue').textContent =
        totalOddsValue > 0 ? totalOddsValue.toFixed(1) : '0';
    document.getElementById('avgOdds').textContent =
        oddsCount > 0 ? (totalOddsValue / oddsCount).toFixed(2) : '-';

    // Calculate per-league stats
    displayLeagueStats(tipsWithResults);
}

// Display stats per league
function displayLeagueStats(tipsWithResults) {
    const leagueStats = {};

    tipsWithResults.forEach(({ tip, match, points }) => {
        const leagueId = match.league || match.league_id || match.leagueId;
        if (!leagueId) return;

        if (!leagueStats[leagueId]) {
            leagueStats[leagueId] = {
                name: LEAGUE_NAMES[leagueId] || `Liga ${leagueId}`,
                total: 0,
                points: 0,
                exact: 0
            };
        }

        leagueStats[leagueId].total++;
        leagueStats[leagueId].points += points;
        if (points === 3) leagueStats[leagueId].exact++;
    });

    const leagueStatsContainer = document.getElementById('leagueStats');
    leagueStatsContainer.innerHTML = '';

    Object.values(leagueStats).forEach(league => {
        const avgPoints = (league.points / league.total).toFixed(2);
        const exactRate = ((league.exact / league.total) * 100).toFixed(1);

        const leagueDiv = document.createElement('div');
        leagueDiv.className = 'stats-row';
        leagueDiv.innerHTML = `
            <span>${league.name}:</span>
            <strong>${league.points} poeng (${avgPoints} snitt, ${exactRate}% riktig)</strong>
        `;
        leagueStatsContainer.appendChild(leagueDiv);
    });
}

// Display match history
function displayMatchHistory() {
    const historyContainer = document.getElementById('matchHistoryList');
    historyContainer.innerHTML = '';

    // Filter tips that have results
    const finishedTips = userTips.filter(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        return match && match.result;
    }).map(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        const points = calculatePoints(tip, match.result);
        return { tip, match, points };
    });

    // Sort by date (newest first)
    finishedTips.sort((a, b) => {
        const dateA = new Date(a.match.commence_time || a.match.timestamp * 1000);
        const dateB = new Date(b.match.commence_time || b.match.timestamp * 1000);
        return dateB - dateA;
    });

    // Apply filter
    let filteredTips = finishedTips;
    if (filteredHistory === 'correct') {
        filteredTips = finishedTips.filter(t => t.points === 3);
    } else if (filteredHistory === 'direction') {
        filteredTips = finishedTips.filter(t => t.points === 1);
    } else if (filteredHistory === 'wrong') {
        filteredTips = finishedTips.filter(t => t.points === 0);
    }

    if (filteredTips.length === 0) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Ingen kamper å vise</p>';
        return;
    }

    filteredTips.forEach(({ tip, match, points }) => {
        const matchDate = new Date(match.commence_time || match.timestamp * 1000);
        const dateStr = matchDate.toLocaleDateString('nb-NO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        const pointsClass = points === 3 ? 'points-exact' : points === 1 ? 'points-direction' : 'points-wrong';
        const pointsText = points === 3 ? '3 poeng' : points === 1 ? '1 poeng' : '0 poeng';

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-date">${dateStr}</div>
            <div class="history-match">
                <div class="history-teams">
                    <strong>${match.homeTeam}</strong> - <strong>${match.awayTeam}</strong>
                </div>
                <div class="history-scores">
                    <span class="history-label">Ditt tips:</span>
                    <span class="history-score">${tip.homeScore}-${tip.awayScore}</span>
                    <span class="history-label">Resultat:</span>
                    <span class="history-score">${match.result.home}-${match.result.away}</span>
                </div>
            </div>
            <div class="history-points ${pointsClass}">${pointsText}</div>
        `;
        historyContainer.appendChild(historyItem);
    });
}

// Filter history
window.filterHistory = function(filter) {
    filteredHistory = filter;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    displayMatchHistory();
};
