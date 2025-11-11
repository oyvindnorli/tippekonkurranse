// Import utility modules
import { getOutcome } from './js/utils/matchUtils.js';
import { LEAGUE_NAMES } from './js/utils/leagueConfig.js';
import { updateMatchResults } from './js/utils/matchCache.js';
import { footballApi } from './api-service.js';

// Global state
let userTips = [];
let matches = [];
let filteredHistory = 'all';
let isUpdatingInBackground = false; // Prevent multiple simultaneous updates

// Initialize Firebase if not already initialized
function initializeFirebaseIfNeeded() {
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
}

// Simple points calculation for my-stats (3-1-0 system)
function calculatePointsSimple(tip, result) {
    if (!result) return 0;

    const tipHomeScore = tip.homeScore;
    const tipAwayScore = tip.awayScore;
    const actualHomeScore = result.home;
    const actualAwayScore = result.away;

    // Exact score: 3 points
    if (tipHomeScore === actualHomeScore && tipAwayScore === actualAwayScore) {
        return 3;
    }

    // Correct outcome (winner/draw): 1 point
    const tipOutcome = getOutcome(tipHomeScore, tipAwayScore);
    const actualOutcome = getOutcome(actualHomeScore, actualAwayScore);

    if (tipOutcome === actualOutcome) {
        return 1;
    }

    // Wrong: 0 points
    return 0;
}

// Initialize the page
initializeFirebaseIfNeeded();

firebase.auth().onAuthStateChanged(async (user) => {

    // Hide loading spinner
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.style.display = 'none';

    if (user) {
        document.getElementById('authRequired').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';

        // Show navigation
        const navButtons = document.getElementById('mainNavButtons');
        if (navButtons) navButtons.style.display = 'flex';

        await loadUserStats(user.uid);
    } else {
        document.getElementById('authRequired').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';

        // Hide navigation
        const navButtons = document.getElementById('mainNavButtons');
        if (navButtons) navButtons.style.display = 'none';
    }
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

        // Sort by timestamp (newest first)
        userTips.sort((a, b) => {
            // Handle both Firestore Timestamp objects and ISO string timestamps
            let timeA, timeB;

            if (typeof a.timestamp === 'string') {
                timeA = new Date(a.timestamp).getTime();
            } else if (a.timestamp?.seconds) {
                timeA = a.timestamp.seconds * 1000;
            } else {
                timeA = 0;
            }

            if (typeof b.timestamp === 'string') {
                timeB = new Date(b.timestamp).getTime();
            } else if (b.timestamp?.seconds) {
                timeB = b.timestamp.seconds * 1000;
            } else {
                timeB = 0;
            }

            return timeB - timeA;
        });

        console.log('Total user tips loaded:', userTips.length);
        console.log('Last 5 tips (nyeste først):', userTips.slice(0, 5).map(t => {
            let dateStr;
            if (typeof t.timestamp === 'string') {
                dateStr = new Date(t.timestamp).toLocaleString('nb-NO');
            } else if (t.timestamp?.seconds) {
                dateStr = new Date(t.timestamp.seconds * 1000).toLocaleString('nb-NO');
            } else {
                dateStr = 'No date';
            }

            return {
                matchId: t.matchId,
                homeTeam: t.homeTeam,
                awayTeam: t.awayTeam,
                homeScore: t.homeScore,
                awayScore: t.awayScore,
                date: dateStr
            };
        }));

        console.log('Loading matches...');

        // Step 1: Load ALL matches from matches collection (fast, cached)
        const matchesSnapshot = await db.collection('matches').get();
        const allMatches = new Map();

        matchesSnapshot.docs.forEach(doc => {
            const match = { id: doc.id, ...doc.data() };
            allMatches.set(match.id, match);
        });

        console.log('Loaded', allMatches.size, 'matches from cache');

        // Step 2: Also get matches from competitions (they may have results)
        const competitionsSnapshot = await db.collection('competitions')
            .where('members', 'array-contains', userId)
            .get();

        for (const compDoc of competitionsSnapshot.docs) {
            const competition = compDoc.data();
            if (competition.matches && Array.isArray(competition.matches)) {
                competition.matches.forEach(match => {
                    const existing = allMatches.get(match.id);
                    // Prefer competition match if it has result and cache doesn't
                    if (!existing || (match.result && !existing.result)) {
                        allMatches.set(match.id, match);
                    }
                });
            }
        }

        matches = Array.from(allMatches.values());
        const matchesWithResults = matches.filter(m => m.result).length;
        console.log('Total unique matches:', matches.length);
        console.log('Matches with results:', matchesWithResults);

        // Calculate and display statistics with what we have now
        calculateAndDisplayStats();
        displayMatchHistory();

        // Step 3: If some matches don't have results, update them in background (once)
        const incompleteMatches = matches.filter(m => !m.result && !m.completed);
        if (incompleteMatches.length > 0 && !isUpdatingInBackground) {
            console.log('Updating', incompleteMatches.length, 'incomplete matches in background...');
            updateResultsInBackground();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Background update of match results
async function updateResultsInBackground() {
    if (isUpdatingInBackground) {
        console.log('Background update already running, skipping...');
        return;
    }

    isUpdatingInBackground = true;

    try {
        // Fetch live scores
        const liveScores = await footballApi.fetchScores();

        // Update Firestore with new results
        const matchesWithResults = liveScores.filter(m => m.result && m.completed);
        if (matchesWithResults.length > 0) {
            const updated = await updateMatchResults(matchesWithResults);
            console.log(`✅ Background update complete: ${updated} matches updated`);

            // Refresh the page data without triggering another background update
            const db = firebase.firestore();
            const matchesSnapshot = await db.collection('matches').get();
            const allMatches = new Map();

            matchesSnapshot.docs.forEach(doc => {
                const match = { id: doc.id, ...doc.data() };
                allMatches.set(match.id, match);
            });

            matches = Array.from(allMatches.values());
            console.log('Refreshed matches, now have', matches.filter(m => m.result).length, 'with results');

            // Recalculate stats with new data
            calculateAndDisplayStats();
            displayMatchHistory();
        }
    } catch (error) {
        console.warn('Background update failed:', error);
    } finally {
        isUpdatingInBackground = false;
    }
}

// Calculate all statistics
function calculateAndDisplayStats() {
    console.log('=== Calculating stats ===');
    console.log('User tips:', userTips.length);
    console.log('Matches:', matches.length);

    // Filter tips that have results
    const finishedTips = userTips.filter(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        const hasResult = match && match.result;
        if (match && !match.result) {
            console.log('Match found but no result:', match.homeTeam, 'vs', match.awayTeam);
        }
        return hasResult;
    });

    console.log('Finished tips (tips with match results):', finishedTips.length);
    if (finishedTips.length > 0) {
        console.log('Sample finished tip FULL:', finishedTips[0]);
        console.log('Tip fields:', {
            homeScore: finishedTips[0].homeScore,
            awayScore: finishedTips[0].awayScore,
            homeTeam: finishedTips[0].homeTeam,
            awayTeam: finishedTips[0].awayTeam,
            matchId: finishedTips[0].matchId
        });
        const sampleMatch = matches.find(m => String(m.id) === String(finishedTips[0].matchId));
        console.log('Sample match:', sampleMatch);
    }

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

        // Still update league stats container to show message
        const leagueStatsContainer = document.getElementById('leagueStats');
        if (leagueStatsContainer) {
            leagueStatsContainer.innerHTML = '<div class="stats-row"><span>Ingen ferdige kamper ennå</span></div>';
        }
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

    const tipsWithResults = finishedTips.map((tip, index) => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        const points = calculatePointsSimple(tip, match.result);

        if (index < 3) {
            console.log(`Tip ${index + 1}:`, tip.homeScore, '-', tip.awayScore, 'Result:', match.result.home, '-', match.result.away, 'Points:', points);
        }

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
    document.getElementById('totalMatches').textContent = userTips.length; // Show TOTAL tips, not just finished
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
    if (!leagueStatsContainer) return;

    leagueStatsContainer.innerHTML = '';

    const leagueStatsArray = Object.values(leagueStats);

    if (leagueStatsArray.length === 0) {
        leagueStatsContainer.innerHTML = '<div class="stats-row"><span>Ingen data tilgjengelig</span></div>';
        return;
    }

    leagueStatsArray.forEach(league => {
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
        const points = calculatePointsSimple(tip, match.result);
        return { tip, match, points };
    });

    if (finishedTips.length === 0) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px 20px; font-size: 15px;">📊 Ingen ferdige kamper ennå. Statistikk vil vises når kampene er ferdige!</p>';
        return;
    }

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
