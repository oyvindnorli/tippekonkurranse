/**
 * My Stats Page - Supabase version
 * Design 4: Leaderboard-fokus med ranking og sammenligning
 */

// Constants
const DEFAULT_ODDS = { H: 2.0, U: 3.0, B: 2.0 };
const EXACT_SCORE_BONUS = 3;

const LEAGUE_NAMES = {
    39: 'Premier League',
    140: 'La Liga',
    78: 'Bundesliga',
    135: 'Serie A',
    61: 'Ligue 1',
    2: 'Champions League',
    3: 'Europa League',
    848: 'Conference League',
    32: 'VM Kval. Europa'
};

// Global state
let currentUserId = null;
let userTips = [];
let allMatches = [];
let allUsersStats = [];
let filteredHistory = 'all';

// Wait for Supabase to be initialized
async function waitForSupabase() {
    let attempts = 0;
    while (!window.supabase && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    return window.supabase;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await waitForSupabase();

    if (!supabase) {
        showAuthRequired();
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    hideLoading();

    if (user) {
        currentUserId = user.id;
        showMainContent();
        await loadAllStats();
    } else {
        showAuthRequired();
    }
});

// ============================================
// Helper Functions
// ============================================

function hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.style.display = 'none';
}

function showMainContent() {
    document.getElementById('authRequired').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

function showAuthRequired() {
    document.getElementById('authRequired').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
}

function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

function parseOdds(odds) {
    if (!odds || typeof odds !== 'object') return DEFAULT_ODDS;
    return {
        H: parseFloat(odds.H) || DEFAULT_ODDS.H,
        U: parseFloat(odds.U) || DEFAULT_ODDS.U,
        B: parseFloat(odds.B) || DEFAULT_ODDS.B
    };
}

function calculatePoints(tip, match) {
    if (match.home_score === null || match.away_score === null) return 0;

    const odds = parseOdds(tip.odds || match.odds);
    const tipHome = Number(tip.home_score);
    const tipAway = Number(tip.away_score);
    const actHome = Number(match.home_score);
    const actAway = Number(match.away_score);

    const tipOutcome = getOutcome(tipHome, tipAway);
    const actualOutcome = getOutcome(actHome, actAway);

    let points = 0;

    if (tipOutcome === actualOutcome) {
        points += odds[actualOutcome];
    }

    if (tipHome === actHome && tipAway === actAway) {
        points += EXACT_SCORE_BONUS;
    }

    return Math.round(points * 10) / 10;
}

// ============================================
// Data Loading
// ============================================

async function loadAllStats() {
    try {
        // Load all tips from all users
        const { data: allTips, error: tipsError } = await window.supabase
            .from('tips')
            .select('*');

        if (tipsError) {
            console.error('Error loading tips:', tipsError);
            return;
        }

        // Get unique match IDs
        const matchIds = [...new Set(allTips.map(t => t.match_id))];

        if (matchIds.length === 0) {
            displayEmptyStats();
            return;
        }

        // Load all matches
        const { data: matchesData, error: matchesError } = await window.supabase
            .from('matches')
            .select('*')
            .in('id', matchIds);

        if (matchesError) {
            console.error('Error loading matches:', matchesError);
        }

        allMatches = matchesData || [];

        // Load all users
        const { data: usersData, error: usersError } = await window.supabase
            .from('users')
            .select('id, display_name, email');

        if (usersError) {
            console.error('Error loading users:', usersError);
        }

        const usersMap = {};
        (usersData || []).forEach(u => {
            usersMap[u.id] = u.display_name || u.email?.split('@')[0] || 'Ukjent';
        });

        // Calculate stats for all users
        allUsersStats = calculateAllUsersStats(allTips, usersMap);

        // Get current user's tips
        userTips = allTips.filter(t => t.user_id === currentUserId);

        // Display everything
        displayRankingAndStats();
        displayLeagueStats();
        displayMatchHistory();

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function calculateAllUsersStats(allTips, usersMap) {
    const userStats = {};

    allTips.forEach(tip => {
        const match = allMatches.find(m => m.id === tip.match_id);
        if (!match || match.home_score === null || match.away_score === null) return;

        if (!userStats[tip.user_id]) {
            userStats[tip.user_id] = {
                id: tip.user_id,
                name: usersMap[tip.user_id] || 'Ukjent',
                totalPoints: 0,
                totalMatches: 0,
                exactMatches: 0,
                correctOutcome: 0
            };
        }

        const points = calculatePoints(tip, match);
        userStats[tip.user_id].totalPoints += points;
        userStats[tip.user_id].totalMatches++;

        const tipHome = Number(tip.home_score);
        const tipAway = Number(tip.away_score);
        const actHome = Number(match.home_score);
        const actAway = Number(match.away_score);

        const isExact = tipHome === actHome && tipAway === actAway;
        const tipOutcome = getOutcome(tipHome, tipAway);
        const actualOutcome = getOutcome(actHome, actAway);

        if (isExact) {
            userStats[tip.user_id].exactMatches++;
            userStats[tip.user_id].correctOutcome++;
        } else if (tipOutcome === actualOutcome) {
            userStats[tip.user_id].correctOutcome++;
        }
    });

    // Calculate rates and sort by points
    return Object.values(userStats)
        .map(u => ({
            ...u,
            avgPoints: u.totalMatches > 0 ? u.totalPoints / u.totalMatches : 0,
            exactRate: u.totalMatches > 0 ? (u.exactMatches / u.totalMatches) * 100 : 0,
            outcomeRate: u.totalMatches > 0 ? (u.correctOutcome / u.totalMatches) * 100 : 0
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);
}

// ============================================
// Display Functions
// ============================================

function displayEmptyStats() {
    document.getElementById('userRank').textContent = '-';
    document.getElementById('totalPlayers').textContent = 'av 0 spillere';
    document.getElementById('totalPoints').textContent = '0';
    document.getElementById('outcomeRate').textContent = '0%';
    document.getElementById('exactRate').textContent = '0%';
    document.getElementById('outcomeDetail').textContent = '0 av 0 riktig utfall';
    document.getElementById('exactDetail').textContent = '0 av 0 riktig resultat';

    const leaderboard = document.getElementById('leaderboardList');
    if (leaderboard) {
        leaderboard.innerHTML = '<p class="empty-message">Ingen data ennå</p>';
    }

    const historyList = document.getElementById('matchHistoryList');
    if (historyList) {
        historyList.innerHTML = '<p class="empty-message">Ingen tips registrert ennå</p>';
    }
}

function displayRankingAndStats() {
    const currentUserStats = allUsersStats.find(u => u.id === currentUserId);

    if (!currentUserStats || currentUserStats.totalMatches === 0) {
        displayEmptyStats();
        return;
    }

    // Find user's rank
    const userRank = allUsersStats.findIndex(u => u.id === currentUserId) + 1;
    const totalPlayers = allUsersStats.length;

    // Update ranking display
    document.getElementById('userRank').textContent = userRank;
    document.getElementById('totalPlayers').textContent = `av ${totalPlayers} spillere`;
    document.getElementById('totalPoints').textContent = Math.round(currentUserStats.totalPoints * 10) / 10;

    // Update hit rate circles
    const outcomeRate = currentUserStats.outcomeRate;
    const exactRate = currentUserStats.exactRate;

    document.getElementById('outcomeRate').textContent = `${outcomeRate.toFixed(1)}%`;
    document.getElementById('exactRate').textContent = `${exactRate.toFixed(1)}%`;
    document.getElementById('outcomeDetail').textContent =
        `${currentUserStats.correctOutcome} av ${currentUserStats.totalMatches} riktig utfall`;
    document.getElementById('exactDetail').textContent =
        `${currentUserStats.exactMatches} av ${currentUserStats.totalMatches} riktig resultat`;

    // Animate the circles
    updateCircleProgress('outcomeProgress', outcomeRate);
    updateCircleProgress('exactProgress', exactRate);

    // Calculate averages for comparison
    const avgStats = calculateAverageStats();

    // Update comparison section
    updateComparison(currentUserStats, avgStats);
}

function updateCircleProgress(elementId, percentage) {
    const circle = document.getElementById(elementId);
    if (!circle) return;

    const circumference = 2 * Math.PI * 45; // r = 45
    const offset = circumference - (percentage / 100) * circumference;

    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference;

    // Animate after a short delay
    setTimeout(() => {
        circle.style.strokeDashoffset = offset;
    }, 100);
}

function calculateAverageStats() {
    if (allUsersStats.length === 0) {
        return { avgPoints: 0, outcomeRate: 0, exactRate: 0 };
    }

    const totals = allUsersStats.reduce((acc, u) => ({
        avgPoints: acc.avgPoints + u.avgPoints,
        outcomeRate: acc.outcomeRate + u.outcomeRate,
        exactRate: acc.exactRate + u.exactRate
    }), { avgPoints: 0, outcomeRate: 0, exactRate: 0 });

    return {
        avgPoints: totals.avgPoints / allUsersStats.length,
        outcomeRate: totals.outcomeRate / allUsersStats.length,
        exactRate: totals.exactRate / allUsersStats.length
    };
}

function updateComparison(userStats, avgStats) {
    // Points per match
    const maxAvgPoints = Math.max(userStats.avgPoints, avgStats.avgPoints, 3);
    document.getElementById('avgPointsYou').textContent = userStats.avgPoints.toFixed(2);
    document.getElementById('avgPointsAvg').textContent = `${avgStats.avgPoints.toFixed(2)} snitt`;
    document.getElementById('avgPointsBar').style.width = `${(userStats.avgPoints / maxAvgPoints) * 100}%`;
    document.getElementById('avgPointsAvgBar').style.width = `${(avgStats.avgPoints / maxAvgPoints) * 100}%`;

    // Outcome rate
    document.getElementById('outcomeYou').textContent = `${userStats.outcomeRate.toFixed(1)}%`;
    document.getElementById('outcomeAvg').textContent = `${avgStats.outcomeRate.toFixed(1)}% snitt`;
    document.getElementById('outcomeBar').style.width = `${userStats.outcomeRate}%`;
    document.getElementById('outcomeAvgBar').style.width = `${avgStats.outcomeRate}%`;

    // Exact rate
    document.getElementById('exactYou').textContent = `${userStats.exactRate.toFixed(1)}%`;
    document.getElementById('exactAvg').textContent = `${avgStats.exactRate.toFixed(1)}% snitt`;
    document.getElementById('exactBar').style.width = `${userStats.exactRate}%`;
    document.getElementById('exactAvgBar').style.width = `${avgStats.exactRate}%`;
}

function displayLeagueStats() {
    const leagueStatsList = document.getElementById('leagueStatsList');
    if (!leagueStatsList) return;

    // Calculate stats per league for current user
    const leagueStats = {};

    userTips.forEach(tip => {
        const match = allMatches.find(m => m.id === tip.match_id);
        if (!match || match.home_score === null || match.away_score === null) return;

        const leagueId = match.league_id;
        if (!leagueId) return;

        if (!leagueStats[leagueId]) {
            leagueStats[leagueId] = {
                name: LEAGUE_NAMES[leagueId] || match.league_name || `Liga ${leagueId}`,
                totalMatches: 0,
                totalPoints: 0,
                exactMatches: 0,
                correctOutcome: 0
            };
        }

        const points = calculatePoints(tip, match);
        leagueStats[leagueId].totalMatches++;
        leagueStats[leagueId].totalPoints += points;

        const tipHome = Number(tip.home_score);
        const tipAway = Number(tip.away_score);
        const actHome = Number(match.home_score);
        const actAway = Number(match.away_score);

        const isExact = tipHome === actHome && tipAway === actAway;
        const tipOutcome = getOutcome(tipHome, tipAway);
        const actualOutcome = getOutcome(actHome, actAway);

        if (isExact) {
            leagueStats[leagueId].exactMatches++;
            leagueStats[leagueId].correctOutcome++;
        } else if (tipOutcome === actualOutcome) {
            leagueStats[leagueId].correctOutcome++;
        }
    });

    const leagues = Object.values(leagueStats)
        .map(l => ({
            ...l,
            avgPoints: l.totalMatches > 0 ? l.totalPoints / l.totalMatches : 0,
            outcomeRate: l.totalMatches > 0 ? (l.correctOutcome / l.totalMatches) * 100 : 0,
            exactRate: l.totalMatches > 0 ? (l.exactMatches / l.totalMatches) * 100 : 0
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    if (leagues.length === 0) {
        leagueStatsList.innerHTML = '<p class="empty-message">Ingen ligastatistikk ennå</p>';
        return;
    }

    leagueStatsList.innerHTML = leagues.map(league => `
        <div class="league-stat-item">
            <div class="league-stat-name">${league.name}</div>
            <div class="league-stat-details">
                <span class="league-stat-points">${Math.round(league.totalPoints * 10) / 10} p</span>
                <span class="league-stat-matches">${league.totalMatches} kamper</span>
                <span class="league-stat-rate">${league.outcomeRate.toFixed(0)}% utfall</span>
                <span class="league-stat-exact">${league.exactRate.toFixed(0)}% eksakt</span>
            </div>
        </div>
    `).join('');
}

// ============================================
// Match History Display
// ============================================

function displayMatchHistory() {
    const historyContainer = document.getElementById('matchHistoryList');
    if (!historyContainer) return;

    // Filter tips that have results
    const finishedTips = userTips.filter(tip => {
        const match = allMatches.find(m => m.id === tip.match_id);
        return match && match.home_score !== null && match.away_score !== null;
    }).map(tip => {
        const match = allMatches.find(m => m.id === tip.match_id);
        const points = calculatePoints(tip, match);
        return { tip, match, points };
    });

    if (finishedTips.length === 0) {
        historyContainer.innerHTML = '<p class="empty-message">Ingen ferdige kamper ennå</p>';
        return;
    }

    // Sort by match date (newest first)
    finishedTips.sort((a, b) => {
        const dateA = new Date(a.match.match_date || a.match.commence_time || a.tip.created_at);
        const dateB = new Date(b.match.match_date || b.match.commence_time || b.tip.created_at);
        return dateB - dateA;
    });

    // Apply filter
    let filteredTips = finishedTips;
    if (filteredHistory === 'correct') {
        filteredTips = finishedTips.filter(t =>
            Number(t.tip.home_score) === Number(t.match.home_score) &&
            Number(t.tip.away_score) === Number(t.match.away_score)
        );
    } else if (filteredHistory === 'direction') {
        filteredTips = finishedTips.filter(t => {
            const tipHome = Number(t.tip.home_score);
            const tipAway = Number(t.tip.away_score);
            const actHome = Number(t.match.home_score);
            const actAway = Number(t.match.away_score);
            const isExact = tipHome === actHome && tipAway === actAway;
            const tipOutcome = getOutcome(tipHome, tipAway);
            const resultOutcome = getOutcome(actHome, actAway);
            return tipOutcome === resultOutcome && !isExact;
        });
    } else if (filteredHistory === 'wrong') {
        filteredTips = finishedTips.filter(t => t.points === 0);
    }

    if (filteredTips.length === 0) {
        historyContainer.innerHTML = '<p class="empty-message">Ingen kamper å vise</p>';
        return;
    }

    // Show only last 10
    const recentTips = filteredTips.slice(0, 10);

    historyContainer.innerHTML = recentTips.map(({ tip, match, points }) => {
        const matchDate = new Date(match.match_date || match.commence_time || tip.created_at);
        const dateStr = matchDate.toLocaleDateString('nb-NO', {
            day: 'numeric',
            month: 'short'
        });

        const tipHome = Number(tip.home_score);
        const tipAway = Number(tip.away_score);
        const actHome = Number(match.home_score);
        const actAway = Number(match.away_score);
        const isExact = tipHome === actHome && tipAway === actAway;
        const pointsClass = isExact ? 'exact' : points > 0 ? 'outcome' : 'wrong';

        return `
            <div class="history-item ${pointsClass}">
                <div class="history-date">${dateStr}</div>
                <div class="history-teams">
                    ${match.home_team || tip.home_team} - ${match.away_team || tip.away_team}
                </div>
                <div class="history-scores">
                    <span class="tip-score">${tipHome}-${tipAway}</span>
                    <span class="result-score">${actHome}-${actAway}</span>
                </div>
                <div class="history-points">${points > 0 ? `+${points}` : '0'}</div>
            </div>
        `;
    }).join('');
}

// Filter history - exposed to window for onclick
window.filterHistory = function(filter) {
    filteredHistory = filter;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    displayMatchHistory();
};
