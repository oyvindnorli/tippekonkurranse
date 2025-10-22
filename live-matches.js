// Live matches functionality
let liveMatches = [];
let allLiveMatches = []; // Store all matches before filtering
let userTips = [];
let updateInterval = null;

// LocalStorage functions for league preferences
function loadSelectedLeagues() {
    try {
        const saved = localStorage.getItem('selectedLeagues');
        if (saved) {
            const leagueArray = JSON.parse(saved);
            console.log('📂 Loaded saved league preferences:', leagueArray);
            return new Set(leagueArray);
        }
    } catch (error) {
        console.warn('⚠️ Could not load league preferences:', error);
    }
    // Default: Premier League and Champions League
    return new Set([39, 2]);
}

function saveSelectedLeagues() {
    try {
        const leagueArray = Array.from(selectedLeagues);
        localStorage.setItem('selectedLeagues', JSON.stringify(leagueArray));
        console.log('💾 Saved league preferences:', leagueArray);
    } catch (error) {
        console.warn('⚠️ Could not save league preferences:', error);
    }
}

let selectedLeagues = loadSelectedLeagues();

// Initialize UI checkboxes based on saved preferences
function initializeLeagueCheckboxes() {
    const leagueCheckboxes = document.querySelectorAll('.league-filter-checkbox');
    const allCheckbox = document.getElementById('league-all');

    let allChecked = true;

    leagueCheckboxes.forEach(cb => {
        const leagueId = parseInt(cb.id.replace('league-', ''));
        cb.checked = selectedLeagues.has(leagueId);

        if (!cb.checked) {
            allChecked = false;
        }
    });

    if (allCheckbox) {
        allCheckbox.checked = allChecked;
    }

    console.log('✅ Initialized league checkboxes from saved preferences');
}

// Initialize the live page
function init() {
    // Initialize Firebase first
    initializeFirebase();
    // Initialize league checkboxes from saved preferences
    initializeLeagueCheckboxes();
    loadLiveMatches();

    // Auto-refresh every 60 seconds
    updateInterval = setInterval(() => {
        refreshLiveMatches();
    }, 60000);
}

// Load live matches
async function loadLiveMatches() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const liveMatchesList = document.getElementById('liveMatchesList');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        // Fetch live matches from API
        const scores = await footballApi.fetchScores();

        // Filter to show only live and finished matches from today
        allLiveMatches = scores.filter(match => {
            return match.statusShort !== 'NS'; // Not scheduled (i.e., has started)
        });

        console.log('🔴 All live matches loaded:', allLiveMatches.length);

        // Apply league filter
        applyLeagueFilter();

        // Load user tips if logged in
        if (currentUser) {
            userTips = await getCurrentUserTips();
            console.log('📥 User tips loaded:', userTips.length);
        }

        loadingMessage.style.display = 'none';

        if (liveMatches.length === 0) {
            liveMatchesList.innerHTML = '<div class="no-matches">Ingen pågående eller ferdige kamper i dag</div>';
        } else {
            renderLiveMatches();
            updateProvisionalScore();
        }
    } catch (error) {
        console.error('Failed to load live matches:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste live kamper. Prøv igjen senere.';
        errorMessage.style.display = 'block';
        liveMatchesList.innerHTML = '';
    }
}

// Refresh live matches
function refreshLiveMatches() {
    console.log('🔄 Refreshing live matches...');
    loadLiveMatches();
}

// Render live matches
function renderLiveMatches() {
    const liveMatchesList = document.getElementById('liveMatchesList');
    liveMatchesList.innerHTML = '';

    // Separate live and finished matches
    const currentlyLive = liveMatches.filter(m => !m.completed);
    const finished = liveMatches.filter(m => m.completed);

    // Render live matches first
    if (currentlyLive.length > 0) {
        const liveSection = document.createElement('div');
        liveSection.className = 'live-section';

        const liveHeader = document.createElement('h3');
        liveHeader.className = 'section-header live-header';
        liveHeader.innerHTML = '🔴 Pågående kamper';
        liveSection.appendChild(liveHeader);

        currentlyLive.forEach(match => {
            liveSection.appendChild(createLiveMatchCard(match, true));
        });

        liveMatchesList.appendChild(liveSection);
    }

    // Render finished matches
    if (finished.length > 0) {
        const finishedSection = document.createElement('div');
        finishedSection.className = 'finished-section';

        const finishedHeader = document.createElement('h3');
        finishedHeader.className = 'section-header finished-header';
        finishedHeader.innerHTML = '✅ Ferdige kamper';
        finishedSection.appendChild(finishedHeader);

        finished.forEach(match => {
            finishedSection.appendChild(createLiveMatchCard(match, false));
        });

        liveMatchesList.appendChild(finishedSection);
    }
}

// Create a live match card
function createLiveMatchCard(match, isLive) {
    // Find user's tip for this match
    const userTip = userTips.find(tip => String(tip.matchId) === String(match.id));

    // Calculate provisional points if match has a result
    let points = 0;
    let pointsBreakdown = '';
    if (match.result && userTip) {
        const tipOutcome = getOutcome(userTip.homeScore, userTip.awayScore);
        const resultOutcome = getOutcome(match.result.home, match.result.away);

        // Points for correct outcome
        if (tipOutcome === resultOutcome && userTip.odds) {
            points += userTip.odds[resultOutcome];
            pointsBreakdown += `Riktig utfall: ${userTip.odds[resultOutcome].toFixed(2)} poeng`;
        }

        // Bonus points for exact score
        if (userTip.homeScore === match.result.home && userTip.awayScore === match.result.away) {
            points += 3;
            if (pointsBreakdown) pointsBreakdown += '<br>';
            pointsBreakdown += 'Eksakt resultat: 3 poeng';
        }
    }

    const matchCard = document.createElement('div');
    matchCard.className = 'live-match-card';
    if (points > 0) matchCard.classList.add('has-points');

    // Get team logos
    const homeLogo = match.homeLogo || footballApi.getTeamLogo(match.homeTeam);
    const awayLogo = match.awayLogo || footballApi.getTeamLogo(match.awayTeam);

    matchCard.innerHTML = `
        <div class="live-match-header">
            <div class="league-info">
                ${match.leagueLogo ? `<img src="${match.leagueLogo}" alt="${match.league}" class="league-logo-small" onerror="this.style.display='none'">` : ''}
                <span class="league-name">${match.league || ''}</span>
            </div>

            <div class="live-teams">
                <div class="live-team">
                    ${homeLogo ? `<img src="${homeLogo}" alt="${match.homeTeam}" class="team-logo-large" onerror="this.style.display='none'">` : ''}
                    <span class="team-name-large">${match.homeTeam}</span>
                </div>
                <span class="live-score ${match.result && match.result.home > match.result.away ? 'winning' : ''}">${match.result ? match.result.home : '-'}</span>
                <div class="score-separator-live">-</div>
                <span class="live-score ${match.result && match.result.away > match.result.home ? 'winning' : ''}">${match.result ? match.result.away : '-'}</span>
                <div class="live-team">
                    ${awayLogo ? `<img src="${awayLogo}" alt="${match.awayTeam}" class="team-logo-large" onerror="this.style.display='none'">` : ''}
                    <span class="team-name-large">${match.awayTeam}</span>
                </div>
            </div>

            <span class="match-status ${isLive ? 'status-live' : 'status-finished'}">
                ${isLive ? `🔴 ${match.status}${match.elapsed ? ` (${match.elapsed}')` : ''}` : '✅ Fullført'}
            </span>

            ${userTip ? `
                <div class="user-tip-display">
                    <span class="tip-label">Tips:</span>
                    <span class="tip-score">${userTip.homeScore}-${userTip.awayScore}</span>
                    ${points > 0 ? `
                        <div class="provisional-points">
                            <span class="points-label">Poeng:</span>
                            <span class="points-value">${points.toFixed(2)}</span>
                        </div>
                    ` : match.completed ? `
                        <span class="no-points">0 poeng</span>
                    ` : ''}
                </div>
            ` : `
                <div class="no-tip-display">
                    <span class="no-tip-text">Ikke tippet</span>
                </div>
            `}
        </div>
    `;

    return matchCard;
}

// Calculate outcome (H, U, B)
function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

// Calculate provisional score
function updateProvisionalScore() {
    let totalPoints = 0;

    liveMatches.forEach(match => {
        if (!match.result) return;

        const userTip = userTips.find(tip => String(tip.matchId) === String(match.id));
        if (!userTip) return;

        const tipOutcome = getOutcome(userTip.homeScore, userTip.awayScore);
        const resultOutcome = getOutcome(match.result.home, match.result.away);

        // Points for correct outcome
        if (tipOutcome === resultOutcome && userTip.odds) {
            totalPoints += userTip.odds[resultOutcome];
        }

        // Bonus points for exact score
        if (userTip.homeScore === match.result.home && userTip.awayScore === match.result.away) {
            totalPoints += 3;
        }
    });

    const scoreElement = document.getElementById('provisionalScore');
    if (scoreElement) {
        scoreElement.textContent = totalPoints.toFixed(2);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});

// Toggle all leagues checkbox
function toggleAllLeagues(checkbox) {
    const leagueCheckboxes = document.querySelectorAll('.league-filter-checkbox');
    leagueCheckboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    filterLeagues();
}

// Filter leagues based on checkboxes
function filterLeagues() {
    const leagueCheckboxes = document.querySelectorAll('.league-filter-checkbox');
    const allCheckbox = document.getElementById('league-all');

    selectedLeagues.clear();
    let allChecked = true;

    leagueCheckboxes.forEach(cb => {
        if (cb.checked) {
            const leagueId = parseInt(cb.id.replace('league-', ''));
            selectedLeagues.add(leagueId);
        } else {
            allChecked = false;
        }
    });

    // Update "All" checkbox state
    allCheckbox.checked = allChecked;

    // Save preferences to localStorage
    saveSelectedLeagues();

    // Filter and render matches
    applyLeagueFilter();
}

// Apply league filter to matches
function applyLeagueFilter() {
    // Get league name from league ID mapping
    const leagueNames = {
        39: 'Premier League',
        2: 'UEFA Champions League',
        140: 'La Liga',
        78: 'Bundesliga',
        135: 'Serie A',
        1: 'World Cup'
    };

    if (selectedLeagues.size === 0) {
        liveMatches = [];
    } else {
        liveMatches = allLiveMatches.filter(match => {
            // Check if match league name matches any selected league
            const matchLeague = match.league;
            for (const leagueId of selectedLeagues) {
                const leagueName = leagueNames[leagueId];
                if (matchLeague && (matchLeague.includes(leagueName) ||
                    leagueName.includes(matchLeague) ||
                    matchLeague.toLowerCase().includes(leagueName.toLowerCase()))) {
                    return true;
                }
            }
            return false;
        });
    }

    console.log(`🔍 Filtered to ${liveMatches.length} matches`);

    // Re-render matches
    const liveMatchesList = document.getElementById('liveMatchesList');
    if (liveMatches.length === 0) {
        liveMatchesList.innerHTML = '<div class="no-matches">Ingen pågående eller ferdige kamper i dag for valgte ligaer</div>';
    } else {
        renderLiveMatches();
        updateProvisionalScore();
    }
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    init();
});
