/**
 * Live & Resultater Page
 * Shows live matches and recent results with user tips and points
 */

import { LEAGUE_NAMES } from './js/utils/leagueConfig.js';

// Initialize Firebase
initializeFirebase();

let currentUser = null;
let allMatches = [];
let userTips = new Map(); // Map of fixtureId -> tip
let userCompetitions = new Set(); // Set of competition IDs user is in
let activeFilter = 'all';
let refreshInterval = null;

// Initialize
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await Promise.all([
            loadMatches(),
            loadUserTips(),
            loadUserCompetitions()
        ]);
        renderMatches();

        // Auto-refresh every 30 seconds for live matches
        startAutoRefresh();
    } else {
        window.location.href = 'index.html';
    }
});

/**
 * Load live and recent matches from API
 */
async function loadMatches() {
    try {
        console.log('📡 Fetching live and recent matches...');

        // Get date range - last 7 days to today
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);

        const fromDate = weekAgo.toISOString().split('T')[0];
        const toDate = today.toISOString().split('T')[0];

        // Fetch fixtures for all leagues
        const allFixtures = [];
        for (const leagueId of API_CONFIG.LEAGUES) {
            const season = leagueId === 32 ? 2024 : API_CONFIG.SEASON;
            const url = `${API_CONFIG.BASE_URL}?endpoint=fixtures&league=${leagueId}&season=${season}&from=${fromDate}&to=${toDate}&timezone=Europe/Oslo`;

            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.response && data.response.length > 0) {
                        allFixtures.push(...data.response);
                    }
                }
            } catch (err) {
                console.warn(`Failed to fetch league ${leagueId}:`, err);
            }
        }

        if (allFixtures.length > 0) {
            allMatches = allFixtures
                .filter(match => {
                    const status = match.fixture.status.short;
                    // Include live matches and finished matches
                    const isLiveMatch = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
                    const isFinished = status === 'FT';
                    return isLiveMatch || isFinished;
                })
                .sort((a, b) => {
                    // Sort: Live first, then by date (newest first)
                    const aLive = isLive(a);
                    const bLive = isLive(b);

                    if (aLive && !bLive) return -1;
                    if (!aLive && bLive) return 1;

                    return new Date(b.fixture.date) - new Date(a.fixture.date);
                });

            console.log(`✅ Loaded ${allMatches.length} matches`);
        }
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

/**
 * Load user's tips from Firebase
 */
async function loadUserTips() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('tips')
            .where('userId', '==', currentUser.uid)
            .get();

        userTips.clear();
        snapshot.forEach(doc => {
            const tip = doc.data();
            userTips.set(tip.fixtureId, tip);
        });

        console.log(`✅ Loaded ${userTips.size} user tips`);
    } catch (error) {
        console.error('Error loading user tips:', error);
    }
}

/**
 * Load competitions user is participating in
 */
async function loadUserCompetitions() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('competitionParticipants')
            .where('userId', '==', currentUser.uid)
            .get();

        userCompetitions.clear();
        snapshot.forEach(doc => {
            const data = doc.data();
            userCompetitions.add(data.competitionId);
        });

        console.log(`✅ User is in ${userCompetitions.size} competitions`);
    } catch (error) {
        console.error('Error loading user competitions:', error);
    }
}

/**
 * Check if match is live
 */
function isLive(match) {
    const status = match.fixture.status.short;
    return ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
}

/**
 * Check if match is finished
 */
function isFinished(match) {
    return match.fixture.status.short === 'FT';
}

/**
 * Check if match is in user's competition
 */
async function isInUserCompetition(fixtureId) {
    try {
        const db = firebase.firestore();

        // Check if this fixture is in any competition the user is in
        for (const competitionId of userCompetitions) {
            const compDoc = await db.collection('competitions').doc(competitionId).get();
            if (compDoc.exists) {
                const fixtures = compDoc.data().fixtures || [];
                if (fixtures.includes(fixtureId)) {
                    return competitionId;
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Error checking competition:', error);
        return null;
    }
}

/**
 * Calculate points for a tip
 */
function calculatePoints(tip, actualHome, actualAway) {
    if (actualHome === null || actualAway === null) {
        return null; // Match not finished
    }

    const tipHome = tip.homeScore;
    const tipAway = tip.awayScore;

    // Exact score
    if (tipHome === actualHome && tipAway === actualAway) {
        return 3 + 1; // 3 bonus + 1 for correct outcome = 4 total
    }

    // Correct goal difference
    const tipDiff = tipHome - tipAway;
    const actualDiff = actualHome - actualAway;
    if (tipDiff === actualDiff && tipDiff !== 0) {
        return 2;
    }

    // Correct outcome (H/D/A)
    const tipOutcome = tipHome > tipAway ? 'H' : tipHome < tipAway ? 'A' : 'D';
    const actualOutcome = actualHome > actualAway ? 'H' : actualHome < actualAway ? 'A' : 'D';
    if (tipOutcome === actualOutcome) {
        return 1;
    }

    return 0;
}

/**
 * Render all matches
 */
async function renderMatches() {
    const container = document.getElementById('matchesContainer');

    if (allMatches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚽</div>
                <div class="empty-state-text">Ingen kamper å vise</div>
            </div>
        `;
        updateCounts();
        return;
    }

    // Filter matches based on active filter
    let filteredMatches = allMatches;

    if (activeFilter === 'live') {
        filteredMatches = allMatches.filter(m => isLive(m));
    } else if (activeFilter === 'finished') {
        filteredMatches = allMatches.filter(m => isFinished(m));
    } else if (activeFilter === 'competition') {
        // Check which matches are in user's competitions (async)
        const matchesInCompetitions = [];
        for (const match of allMatches) {
            const competitionId = await isInUserCompetition(match.fixture.id);
            if (competitionId) {
                matchesInCompetitions.push(match);
            }
        }
        filteredMatches = matchesInCompetitions;
    }

    if (filteredMatches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚽</div>
                <div class="empty-state-text">Ingen kamper i dette filteret</div>
            </div>
        `;
        updateCounts();
        return;
    }

    // Render match cards
    const cardsHTML = await Promise.all(filteredMatches.map(match => renderMatchCard(match)));
    container.innerHTML = cardsHTML.join('');

    updateCounts();
}

/**
 * Render a single match card
 */
async function renderMatchCard(match) {
    const fixtureId = match.fixture.id;
    const live = isLive(match);
    const finished = isFinished(match);
    const tip = userTips.get(fixtureId);
    const competitionId = await isInUserCompetition(fixtureId);
    const inCompetition = !!competitionId;

    // League name
    const leagueName = LEAGUE_NAMES[match.league.id] || match.league.name;

    // Status text
    let statusText = '';
    let statusClass = '';
    if (live) {
        const elapsed = match.fixture.status.elapsed;
        const short = match.fixture.status.short;
        if (short === 'HT') {
            statusText = 'Pause';
        } else if (short === 'ET') {
            statusText = `${elapsed}'`;
        } else {
            statusText = `${elapsed}'`;
        }
        statusClass = 'live';
    } else if (finished) {
        statusText = 'Fullført';
        statusClass = 'finished';
    }

    // Time display
    let timeDisplay = '';
    if (live) {
        const elapsed = match.fixture.status.elapsed;
        const short = match.fixture.status.short;
        timeDisplay = short === 'HT' ? 'HT' : `${elapsed}'`;
    } else {
        const matchDate = new Date(match.fixture.date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (matchDate.toDateString() === today.toDateString()) {
            timeDisplay = `I dag ${matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (matchDate.toDateString() === yesterday.toDateString()) {
            timeDisplay = `I går ${matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            timeDisplay = matchDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
        }
    }

    // Scores
    const homeScore = match.goals.home !== null ? match.goals.home : '-';
    const awayScore = match.goals.away !== null ? match.goals.away : '-';

    // Tip section
    let tipHTML = '';
    if (tip && inCompetition) {
        const points = finished ? calculatePoints(tip, match.goals.home, match.goals.away) : null;
        let pointsHTML = '';

        if (points !== null) {
            const pointsClass = points > 0 ? 'correct' : 'wrong';
            pointsHTML = `<span class="tip-points ${pointsClass}">+${points}p</span>`;
        } else if (live) {
            pointsHTML = `<span class="tip-points pending">?</span>`;
        }

        tipHTML = `
            <div class="user-tip">
                <div>
                    <span class="tip-label">Ditt tips:</span>
                    <span class="tip-prediction">
                        <span class="tip-score">${tip.homeScore}-${tip.awayScore}</span>
                        ${pointsHTML}
                    </span>
                </div>
                <a href="competition-detail.html?id=${competitionId}" class="competition-link">
                    Vis konkurranse →
                </a>
            </div>
        `;
    }

    return `
        <div class="match-card ${live ? 'live' : ''} ${inCompetition ? 'in-competition' : ''}">
            <div class="match-header">
                <span class="league-name">${leagueName}</span>
                <div class="status-badges">
                    ${statusText ? `<span class="badge ${statusClass}">${statusText}</span>` : ''}
                    ${inCompetition ? '<span class="badge competition">Konkurranse</span>' : ''}
                </div>
            </div>
            <div class="match-content">
                <div class="teams">
                    <div class="team">
                        <img src="${match.teams.home.logo}" alt="${match.teams.home.name}" class="team-logo">
                        <span class="team-name">${match.teams.home.name}</span>
                        <span class="score ${live ? 'live' : ''}">${homeScore}</span>
                    </div>
                    <div class="team">
                        <img src="${match.teams.away.logo}" alt="${match.teams.away.name}" class="team-logo">
                        <span class="team-name">${match.teams.away.name}</span>
                        <span class="score ${live ? 'live' : ''}">${awayScore}</span>
                    </div>
                </div>
                <div class="match-time ${live ? 'live' : ''}">${timeDisplay}</div>
            </div>
            ${tipHTML}
        </div>
    `;
}

/**
 * Update filter counts
 */
function updateCounts() {
    const liveCount = allMatches.filter(m => isLive(m)).length;
    const finishedCount = allMatches.filter(m => isFinished(m)).length;

    // Count competitions (async - will update after)
    let competitionCount = 0;
    Promise.all(allMatches.map(m => isInUserCompetition(m.fixture.id)))
        .then(results => {
            competitionCount = results.filter(r => r !== null).length;
            document.getElementById('count-competition').textContent = competitionCount;
        });

    document.getElementById('count-all').textContent = allMatches.length;
    document.getElementById('count-live').textContent = liveCount;
    document.getElementById('count-finished').textContent = finishedCount;
}

/**
 * Start auto-refresh for live matches
 */
function startAutoRefresh() {
    // Clear existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }

    // Refresh every 30 seconds
    refreshInterval = setInterval(async () => {
        const hasLiveMatches = allMatches.some(m => isLive(m));
        if (hasLiveMatches) {
            console.log('🔄 Auto-refreshing live matches...');
            await loadMatches();
            await renderMatches();
        }
    }, 30000);
}

/**
 * Setup filter tabs
 */
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const filter = tab.dataset.filter;
        activeFilter = filter;

        // Update active state
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Re-render
        renderMatches();
    });
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
