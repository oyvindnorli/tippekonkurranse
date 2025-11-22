/**
 * Live & Resultater Page
 * Shows live matches and recent results with user tips and points
 */

import { LEAGUE_NAMES } from './js/utils/leagueConfig.js';
import { calculatePoints } from './js/utils/matchUtils.js';

let currentUser = null;
let allMatches = [];
let userTips = new Map(); // Map of fixtureId -> tip
let userCompetitions = new Set(); // Set of competition IDs user is in
let activeFilter = 'all';
let refreshInterval = null;
let displayedMatchCount = 20; // Number of matches to show initially
const MATCHES_PER_PAGE = 20;

// Initialize
supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user;
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
        console.log('📡 Fetching matches...');

        // Get date range - last 7 days to today (for live and recent results only)
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
                    // Include only live matches and finished matches (no upcoming)
                    const isLiveMatch = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
                    const isFinished = status === 'FT';
                    return isLiveMatch || isFinished;
                })
                .sort((a, b) => {
                    // Sort: Live first, then finished (newest first)
                    const aLive = isLive(a);
                    const bLive = isLive(b);

                    // Live matches first
                    if (aLive && !bLive) return -1;
                    if (!aLive && bLive) return 1;

                    // Both same status: sort by date (newest first)
                    return new Date(b.fixture.date) - new Date(a.fixture.date);
                });

            console.log(`✅ Loaded ${allMatches.length} matches`);
        }
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

/**
 * Load user's tips from Supabase
 */
async function loadUserTips() {
    try {
        const { data, error } = await supabase
            .from('tips')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        userTips.clear();
        data.forEach(tip => {
            // Tips stored with match_id, convert to Firebase-compatible format
            const tipData = {
                matchId: String(tip.match_id),
                homeScore: tip.home_score,
                awayScore: tip.away_score,
                homeTeam: tip.home_team,
                awayTeam: tip.away_team,
                odds: tip.odds,
                timestamp: tip.timestamp
            };
            userTips.set(String(tip.match_id), tipData);
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
        const { data, error } = await supabase
            .from('competition_participants')
            .select('competition_id')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        userCompetitions.clear();
        data.forEach(row => {
            userCompetitions.add(row.competition_id);
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
 * Check if match is upcoming
 */
function isUpcoming(match) {
    return match.fixture.status.short === 'NS';
}

/**
 * Check if match is in user's competition
 */
async function isInUserCompetition(fixtureId) {
    try {
        // Check if this fixture is in any competition the user is in
        for (const competitionId of userCompetitions) {
            const { data, error } = await supabase
                .from('competitions')
                .select('match_ids')
                .eq('id', competitionId)
                .single();

            if (!error && data) {
                const matchIds = data.match_ids || [];
                if (matchIds.includes(parseInt(fixtureId))) {
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

// calculatePoints is now imported from matchUtils.js

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
    } else if (activeFilter === 'my-tips') {
        // Only show finished matches where user has tipped (to match Min Statistikk page)
        filteredMatches = allMatches.filter(m => {
            const hasTip = userTips.has(String(m.fixture.id));
            const finished = isFinished(m);
            return hasTip && finished;
        });
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
    } else if (activeFilter === 'all') {
        // "Alle" viser kun live og fullførte - ikke kommende
        filteredMatches = allMatches.filter(m => isLive(m) || isFinished(m));
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

    // Paginate matches - only show first displayedMatchCount
    const matchesToShow = filteredMatches.slice(0, displayedMatchCount);
    const hasMore = filteredMatches.length > displayedMatchCount;

    // Render match cards
    const cardsHTML = await Promise.all(matchesToShow.map(match => renderMatchCard(match)));
    container.innerHTML = cardsHTML.join('');

    // Add "Load more" button if there are more matches
    if (hasMore) {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.className = 'load-more-container';
        loadMoreBtn.innerHTML = `
            <button class="load-more-btn" onclick="loadMoreMatches()">
                Last inn flere kamper (${filteredMatches.length - displayedMatchCount} til)
            </button>
        `;
        container.appendChild(loadMoreBtn);
    }

    updateCounts();
}

/**
 * Load more matches (pagination)
 */
window.loadMoreMatches = function() {
    displayedMatchCount += MATCHES_PER_PAGE;
    renderMatches();
};

/**
 * Render a single match card
 */
async function renderMatchCard(match) {
    const fixtureId = String(match.fixture.id); // Convert to string for consistent comparison
    const live = isLive(match);
    const finished = isFinished(match);
    const tip = userTips.get(fixtureId);
    const competitionId = await isInUserCompetition(match.fixture.id);
    const inCompetition = !!competitionId;

    // League name
    const leagueName = LEAGUE_NAMES[match.league.id] || match.league.name;

    // Status text
    let statusText = '';
    let statusClass = '';
    const upcoming = isUpcoming(match);

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
    } else if (upcoming) {
        statusText = 'Kommende';
        statusClass = 'upcoming';
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
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (matchDate.toDateString() === today.toDateString()) {
            timeDisplay = `I dag ${matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (matchDate.toDateString() === yesterday.toDateString()) {
            timeDisplay = `I går ${matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (matchDate.toDateString() === tomorrow.toDateString()) {
            timeDisplay = `I morgen ${matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            const time = matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
            const date = matchDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
            timeDisplay = `${date} ${time}`;
        }
    }

    // Scores
    const homeScore = match.goals.home !== null ? match.goals.home : '-';
    const awayScore = match.goals.away !== null ? match.goals.away : '-';

    // Tip section and scores with tips
    let tipScoreHTML = '';
    let competitionLinkHTML = '';

    if (tip) {
        // Calculate points for both live and finished matches
        let points = 0;
        let pointsDisplay = '';

        if (live || finished) {
            // Has result (live or finished)
            // Create match object in the format expected by calculatePoints
            const matchForPoints = {
                result: {
                    home: match.goals.home,
                    away: match.goals.away
                },
                odds: tip.odds || null // Use odds from tip if available
            };
            points = calculatePoints(tip, matchForPoints);
            const pointsClass = points > 0 ? 'has-points' : 'no-points';
            const liveText = live ? ' (live)' : '';
            pointsDisplay = `<span class="tip-points ${pointsClass}">${points.toFixed(1)} poeng${liveText}</span>`;
        }

        // Competition link
        if (inCompetition) {
            competitionLinkHTML = `<a href="competition-detail.html?id=${competitionId}" class="competition-link">Konkurranse →</a>`;
        }

        // Show tip with result
        tipScoreHTML = `
            <div class="score-comparison">
                <div class="comparison-row">
                    <span class="comparison-label">Resultat:</span>
                    <span class="comparison-score actual">${homeScore} - ${awayScore}</span>
                </div>
                <div class="comparison-row">
                    <span class="comparison-label">Ditt tips:</span>
                    <span class="comparison-score tip">${tip.homeScore} - ${tip.awayScore}</span>
                    ${pointsDisplay}
                </div>
            </div>
        `;
    }

    return `
        <div class="match-card ${live ? 'live' : ''} ${inCompetition ? 'in-competition' : ''} ${tip ? 'has-tip' : ''}">
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
                    </div>
                    <div class="team">
                        <img src="${match.teams.away.logo}" alt="${match.teams.away.name}" class="team-logo">
                        <span class="team-name">${match.teams.away.name}</span>
                    </div>
                </div>
                ${tip ? tipScoreHTML : `
                    <div class="score-only">
                        <span class="score ${live ? 'live' : ''}">${homeScore}</span>
                        <span class="score-separator">-</span>
                        <span class="score ${live ? 'live' : ''}">${awayScore}</span>
                    </div>
                `}
                <div class="match-info">
                    <div class="match-time ${live ? 'live' : ''}">${timeDisplay}</div>
                    ${competitionLinkHTML}
                </div>
            </div>
        </div>
    `;
}

/**
 * Update filter counts
 */
function updateCounts() {
    const liveCount = allMatches.filter(m => isLive(m)).length;
    const finishedCount = allMatches.filter(m => isFinished(m)).length;
    // Mine tips: only finished matches where user has tipped (same as Min Statistikk)
    // Don't count live matches to match the stats page behavior
    const myTipsCount = allMatches.filter(m => {
        const hasTip = userTips.has(String(m.fixture.id));
        const finished = isFinished(m);
        return hasTip && finished;
    }).length;
    const allCount = allMatches.filter(m => isLive(m) || isFinished(m)).length; // "Alle" = live + fullført

    // Count competitions (async - will update after)
    let competitionCount = 0;
    Promise.all(allMatches.map(m => isInUserCompetition(m.fixture.id)))
        .then(results => {
            competitionCount = results.filter(r => r !== null).length;
            document.getElementById('count-competition').textContent = competitionCount;
        });

    document.getElementById('count-all').textContent = allCount;
    document.getElementById('count-live').textContent = liveCount;
    document.getElementById('count-finished').textContent = finishedCount;
    document.getElementById('count-my-tips').textContent = myTipsCount;
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

        // Reset pagination when changing filters
        displayedMatchCount = MATCHES_PER_PAGE;

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
