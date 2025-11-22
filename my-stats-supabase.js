/**
 * My Stats Page - Supabase version
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
    32: 'VM Kvalifisering Europa'
};

// Global state
let userTips = [];
let matches = [];
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
        showMainContent();
        await loadUserStats(user.id);
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
    if (!match.home_score === null || match.away_score === null) return 0;

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

async function loadUserStats(userId) {
    try {
        // Load user tips
        const { data: tipsData, error: tipsError } = await window.supabase
            .from('tips')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (tipsError) {
            console.error('Error loading tips:', tipsError);
            return;
        }

        userTips = tipsData || [];

        // Get unique match IDs from tips
        const matchIds = [...new Set(userTips.map(t => t.match_id))];

        if (matchIds.length === 0) {
            displayEmptyStats();
            return;
        }

        // Load matches with results
        const { data: matchesData, error: matchesError } = await window.supabase
            .from('matches')
            .select('*')
            .in('id', matchIds);

        if (matchesError) {
            console.error('Error loading matches:', matchesError);
        }

        matches = matchesData || [];

        // Calculate and display statistics
        calculateAndDisplayStats();
        displayMatchHistory();

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// Statistics Calculation
// ============================================

function displayEmptyStats() {
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

    const leagueStatsContainer = document.getElementById('leagueStats');
    if (leagueStatsContainer) {
        leagueStatsContainer.innerHTML = '<div class="stats-row"><span>Ingen ferdige kamper enna</span></div>';
    }

    const historyContainer = document.getElementById('matchHistoryList');
    if (historyContainer) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px 20px;">Ingen tips registrert enna</p>';
    }
}

function calculateAndDisplayStats() {
    // Filter tips that have match results
    const finishedTips = userTips.filter(tip => {
        const match = matches.find(m => m.id === tip.match_id);
        return match && match.home_score !== null && match.away_score !== null;
    });

    if (finishedTips.length === 0) {
        displayEmptyStats();
        return;
    }

    let totalPoints = 0;
    let exactMatches = 0;
    let correctDirection = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;
    let totalOddsValue = 0;
    let oddsCount = 0;

    const tipsWithResults = finishedTips.map(tip => {
        const match = matches.find(m => m.id === tip.match_id);
        const points = calculatePoints(tip, match);

        totalPoints += points;

        const tipHome = Number(tip.home_score);
        const tipAway = Number(tip.away_score);
        const actHome = Number(match.home_score);
        const actAway = Number(match.away_score);

        const isExact = tipHome === actHome && tipAway === actAway;
        const tipOutcome = getOutcome(tipHome, tipAway);
        const resultOutcome = getOutcome(actHome, actAway);
        const isCorrectDirection = tipOutcome === resultOutcome && !isExact;

        if (isExact) {
            exactMatches++;
            tempStreak++;
            currentStreak = tempStreak;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else if (isCorrectDirection) {
            correctDirection++;
            tempStreak = 0;
        } else {
            tempStreak = 0;
        }

        // Calculate odds value
        const odds = parseOdds(tip.odds || match.odds);
        if (points > 0) {
            const outcome = getOutcome(tipHome, tipAway);
            const oddValue = odds[outcome] || 0;
            if (oddValue > 0) {
                totalOddsValue += oddValue;
                oddsCount++;
            }
        }

        return { tip, match, points };
    });

    // Update summary stats
    document.getElementById('totalPoints').textContent = Math.round(totalPoints * 10) / 10;
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

    // Display per-league stats
    displayLeagueStats(tipsWithResults);
}

function displayLeagueStats(tipsWithResults) {
    const leagueStats = {};

    tipsWithResults.forEach(({ tip, match, points }) => {
        const leagueId = match.league_id;
        if (!leagueId) return;

        if (!leagueStats[leagueId]) {
            leagueStats[leagueId] = {
                name: LEAGUE_NAMES[leagueId] || `Liga ${leagueId}`,
                total: 0,
                points: 0,
                exact: 0,
                direction: 0
            };
        }

        leagueStats[leagueId].total++;
        leagueStats[leagueId].points += points;

        const tipHome = Number(tip.home_score);
        const tipAway = Number(tip.away_score);
        const actHome = Number(match.home_score);
        const actAway = Number(match.away_score);

        const isExact = tipHome === actHome && tipAway === actAway;
        if (isExact) {
            leagueStats[leagueId].exact++;
        } else {
            const tipOutcome = getOutcome(tipHome, tipAway);
            const resultOutcome = getOutcome(actHome, actAway);
            if (tipOutcome === resultOutcome) {
                leagueStats[leagueId].direction++;
            }
        }
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
        const directionRate = ((league.direction / league.total) * 100).toFixed(1);
        const totalPoints = Math.round(league.points * 10) / 10;

        const leagueDiv = document.createElement('div');
        leagueDiv.className = 'stats-row';
        leagueDiv.innerHTML = `
            <span>${league.name}:</span>
            <strong>${totalPoints} poeng (${avgPoints} snitt) - ${exactRate}% eksakt - ${directionRate}% utfall</strong>
        `;
        leagueStatsContainer.appendChild(leagueDiv);
    });
}

// ============================================
// Match History Display
// ============================================

function displayMatchHistory() {
    const historyContainer = document.getElementById('matchHistoryList');
    historyContainer.innerHTML = '';

    // Filter tips that have results
    const finishedTips = userTips.filter(tip => {
        const match = matches.find(m => m.id === tip.match_id);
        return match && match.home_score !== null && match.away_score !== null;
    }).map(tip => {
        const match = matches.find(m => m.id === tip.match_id);
        const points = calculatePoints(tip, match);
        return { tip, match, points };
    });

    if (finishedTips.length === 0) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px 20px;">Ingen ferdige kamper enna. Statistikk vil vises nar kampene er ferdige!</p>';
        return;
    }

    // Sort by match date (newest first)
    finishedTips.sort((a, b) => {
        const dateA = new Date(a.match.match_date || a.tip.created_at);
        const dateB = new Date(b.match.match_date || b.tip.created_at);
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
        historyContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Ingen kamper a vise</p>';
        return;
    }

    filteredTips.forEach(({ tip, match, points }) => {
        const matchDate = new Date(match.match_date || tip.created_at);
        const dateStr = matchDate.toLocaleDateString('nb-NO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        const tipHome = Number(tip.home_score);
        const tipAway = Number(tip.away_score);
        const actHome = Number(match.home_score);
        const actAway = Number(match.away_score);
        const isExact = tipHome === actHome && tipAway === actAway;
        const pointsClass = isExact ? 'points-exact' : points > 0 ? 'points-direction' : 'points-wrong';
        const pointsText = points > 0 ? `${points} poeng` : '0 poeng';

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-date">${dateStr}</div>
            <div class="history-match">
                <div class="history-teams">
                    <strong>${match.home_team || tip.home_team}</strong> - <strong>${match.away_team || tip.away_team}</strong>
                </div>
                <div class="history-scores">
                    <span class="history-label">Ditt tips:</span>
                    <span class="history-score">${tipHome}-${tipAway}</span>
                    <span class="history-label">Resultat:</span>
                    <span class="history-score">${actHome}-${actAway}</span>
                </div>
            </div>
            <div class="history-points ${pointsClass}">${pointsText}</div>
        `;
        historyContainer.appendChild(historyItem);
    });
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
