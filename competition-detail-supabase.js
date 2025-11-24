/**
 * Competition Detail Page - Supabase version
 */

// Constants
const MATCH_STATUS = {
    FINISHED: ['FT', 'AET', 'PEN'],
    LIVE: ['1H', '2H', 'HT', 'ET', 'P', 'LIVE']
};

const DEFAULT_ODDS = { H: 2.0, U: 3.0, B: 2.0 };
const EXACT_SCORE_BONUS = 3;

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
        showError('Kunne ikke initialisere. Last siden på nytt.');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const competitionId = urlParams.get('id');

    if (!competitionId) {
        showError('Ingen konkurranse-ID funnet');
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    await loadCompetitionDetails(competitionId, user.id);
});

// ============================================
// Helper Functions
// ============================================

/**
 * Get display name for a participant
 */
function getDisplayName(participant) {
    return participant.display_name || participant.user_name || 'Ukjent';
}

/**
 * Check if match is finished
 */
function isMatchFinished(statusShort) {
    return MATCH_STATUS.FINISHED.includes(statusShort);
}

/**
 * Check if match is live
 */
function isMatchLive(statusShort) {
    return MATCH_STATUS.LIVE.includes(statusShort);
}

/**
 * Create tips lookup map
 */
function createTipsMap(tips) {
    const map = {};
    tips.forEach(tip => {
        map[`${tip.match_id}_${tip.user_id}`] = tip;
    });
    return map;
}

/**
 * Get outcome from score (H = Home, U = Draw, B = Away)
 */
function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

/**
 * Format date for display
 */
function formatDate(date) {
    return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Show error message
 */
function showError(message) {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    if (loadingMessage) loadingMessage.style.display = 'none';
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
}

/**
 * Parse odds ensuring they are numbers
 */
function parseOdds(odds) {
    if (!odds || typeof odds !== 'object') {
        return DEFAULT_ODDS;
    }
    return {
        H: parseFloat(odds.H) || DEFAULT_ODDS.H,
        U: parseFloat(odds.U) || DEFAULT_ODDS.U,
        B: parseFloat(odds.B) || DEFAULT_ODDS.B
    };
}

// ============================================
// Data Loading
// ============================================

/**
 * Load competition details
 */
async function loadCompetitionDetails(competitionId, userId) {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const detailsSection = document.getElementById('competitionDetails');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        // Get competition
        const { data: competition, error: competitionError } = await window.supabase
            .from('competitions')
            .select('*')
            .eq('id', competitionId)
            .single();

        if (competitionError) {
            throw new Error('Kunne ikke laste konkurranse');
        }

        // Get participants
        const { data: participants, error: participantsError } = await window.supabase
            .from('competition_participants')
            .select('*')
            .eq('competition_id', competitionId);

        if (participantsError) {
            throw new Error('Kunne ikke laste deltakere');
        }

        // Fetch display names from users table
        const userIds = participants.map(p => p.user_id);
        const { data: usersData } = await window.supabase
            .from('users')
            .select('id, display_name, email')
            .in('id', userIds);

        // Create lookup for user display names
        const usersMap = {};
        (usersData || []).forEach(user => {
            usersMap[user.id] = user.display_name || user.email?.split('@')[0] || 'Ukjent';
        });

        // Map participants with display names
        const mappedParticipants = participants.map(p => ({
            ...p,
            display_name: usersMap[p.user_id] || p.user_name || 'Ukjent'
        }));

        // Display competition
        displayCompetition(competition, mappedParticipants, userId);

        loadingMessage.style.display = 'none';
        detailsSection.style.display = 'block';

    } catch (error) {
        console.error('Error loading competition:', error);
        loadingMessage.style.display = 'none';
        showError(error.message || 'Kunne ikke laste konkurranse');
    }
}

/**
 * Load and display competition matches
 */
async function loadCompetitionMatches(competition, participants, currentUserId) {
    const matchesTable = document.getElementById('matchesWithTipsTable');

    matchesTable.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #64748b;">
            <p>Laster kamper...</p>
        </div>
    `;

    try {
        const matchIds = competition.match_ids;

        // Fetch fixtures from API
        const startDate = new Date(competition.start_date);
        const endDate = new Date(competition.end_date);
        const fromDate = startDate.toISOString().split('T')[0];
        const toDate = endDate.toISOString().split('T')[0];
        const leagueId = competition.league_ids?.[0] || 39;
        const season = new Date().getFullYear();

        const url = `/api/football?endpoint=fixtures&league=${leagueId}&season=${season}&from=${fromDate}&to=${toDate}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Kunne ikke hente kamper fra API');
        }

        const data = await response.json();
        const matches = (data.response || []).filter(fixture =>
            matchIds.includes(fixture.fixture.id)
        );

        // Fetch tips and match odds in parallel
        const participantIds = participants.map(p => p.user_id);
        const [tipsResult, matchesResult] = await Promise.all([
            window.supabase
                .from('tips')
                .select('*')
                .in('user_id', participantIds)
                .in('match_id', matchIds),
            window.supabase
                .from('matches')
                .select('id, odds')
                .in('id', matchIds)
        ]);

        const allTips = tipsResult.data || [];
        const matchesWithOdds = matchesResult.data || [];

        // Create odds lookup from matches table
        const matchOddsLookup = {};
        matchesWithOdds.forEach(m => {
            if (m.odds) {
                matchOddsLookup[m.id] = m.odds;
            }
        });

        // Enrich tips with match odds if tip.odds is missing
        const enrichedTips = allTips.map(tip => {
            if (!tip.odds || Object.keys(tip.odds).length === 0) {
                return { ...tip, odds: matchOddsLookup[tip.match_id] || null };
            }
            return tip;
        });

        // Calculate scores and display
        const { scoresByUser, potentialScoresByUser, hasLiveMatches } = calculateAllScores(matches, enrichedTips, participants);

        displayLeaderboard(participants, currentUserId, scoresByUser, hasLiveMatches, potentialScoresByUser);
        displayMatches(matches, enrichedTips, participants, currentUserId);

    } catch (error) {
        console.error('Error loading matches:', error);
        matchesTable.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                <p>Kunne ikke laste kamper: ${error.message}</p>
            </div>
        `;
    }
}

// ============================================
// Score Calculation
// ============================================

/**
 * Calculate points for a tip using odds-based scoring
 */
function calculatePointsWithOdds(tip, actualHome, actualAway) {
    const odds = parseOdds(tip.odds);

    const tipHome = Number(tip.home_score);
    const tipAway = Number(tip.away_score);
    const actHome = Number(actualHome);
    const actAway = Number(actualAway);

    const tipOutcome = getOutcome(tipHome, tipAway);
    const actualOutcome = getOutcome(actHome, actAway);

    let points = 0;

    // Correct outcome = odds value
    if (tipOutcome === actualOutcome) {
        points += odds[actualOutcome];
    }

    // Exact score bonus
    if (tipHome === actHome && tipAway === actAway) {
        points += EXACT_SCORE_BONUS;
    }

    return Math.round(points * 10) / 10;
}

/**
 * Calculate scores for all participants
 */
function calculateAllScores(matches, tips, participants) {
    const scoresByUser = {};
    const potentialScoresByUser = {};
    let hasLiveMatches = false;

    // Initialize scores
    participants.forEach(p => {
        scoresByUser[p.user_id] = 0;
        potentialScoresByUser[p.user_id] = 0;
    });

    const tipsMap = createTipsMap(tips);

    matches.forEach(match => {
        const { fixture, goals } = match;
        const matchId = fixture.id;
        const isFinished = isMatchFinished(fixture.status.short);
        const isLive = isMatchLive(fixture.status.short);

        if (isLive) hasLiveMatches = true;

        const hasResult = goals.home !== null && goals.away !== null;

        if (hasResult && (isFinished || isLive)) {
            participants.forEach(participant => {
                const tip = tipsMap[`${matchId}_${participant.user_id}`];
                if (tip) {
                    const points = calculatePointsWithOdds(tip, goals.home, goals.away);
                    if (isFinished) {
                        scoresByUser[participant.user_id] += points;
                    } else {
                        potentialScoresByUser[participant.user_id] += points;
                    }
                }
            });
        }
    });

    return { scoresByUser, potentialScoresByUser, hasLiveMatches };
}

// ============================================
// Display Functions
// ============================================

/**
 * Display competition details
 */
function displayCompetition(competition, participants, userId) {
    document.getElementById('competitionName').textContent = competition.name;

    // Description
    const descElement = document.getElementById('competitionDescription');
    if (competition.description) {
        descElement.textContent = competition.description;
        descElement.style.display = 'block';
    } else {
        descElement.style.display = 'none';
    }

    // Status
    const now = new Date();
    const startDate = new Date(competition.start_date);
    const endDate = new Date(competition.end_date);
    const statusBadge = document.getElementById('competitionStatus');

    if (now < startDate) {
        statusBadge.textContent = '📅 KOMMER';
        statusBadge.className = 'competition-status-badge status-upcoming';
    } else if (now > endDate) {
        statusBadge.textContent = '✅ FERDIG';
        statusBadge.className = 'competition-status-badge status-completed';
    } else {
        statusBadge.textContent = '🔴 LIVE';
        statusBadge.className = 'competition-status-badge status-active';
    }

    // Info
    document.getElementById('creatorName').textContent = 'Admin';
    document.getElementById('competitionPeriod').textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    document.getElementById('matchCount').textContent = `${competition.match_ids?.length || 0} kamper`;
    document.getElementById('participantCount').textContent = `${participants.length} deltakere`;

    // Buttons
    const isParticipant = participants.some(p => p.user_id === userId);
    document.getElementById('joinBtn').style.display = (!isParticipant && now < endDate) ? 'inline-block' : 'none';
    document.getElementById('deleteBtn').style.display = (competition.creator_id === userId) ? 'inline-block' : 'none';

    // Initial leaderboard
    displayLeaderboard(participants, userId, {});

    // Load matches
    if (competition.match_ids?.length > 0) {
        loadCompetitionMatches(competition, participants, userId);
    } else {
        document.getElementById('matchesWithTipsTable').innerHTML = `
            <div style="padding: 40px; text-align: center; color: #64748b;">
                <p style="font-size: 16px;">Ingen kamper i denne konkurransen</p>
            </div>
        `;
    }
}

/**
 * Display leaderboard with scores
 */
function displayLeaderboard(participants, currentUserId, scoresByUser = {}, hasLiveMatches = false, potentialScoresByUser = {}) {
    const leaderboardList = document.getElementById('leaderboardList');
    const leaderboardHeader = document.querySelector('.competition-leaderboard h3');

    // Update header
    if (leaderboardHeader) {
        leaderboardHeader.innerHTML = hasLiveMatches
            ? '🏆 Tabell <span class="live-indicator">LIVE</span>'
            : '🏆 Tabell';
    }

    if (participants.length === 0) {
        leaderboardList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Ingen deltakere ennå</p>';
        return;
    }

    // Build participant scores
    const participantsWithScores = participants.map(p => ({
        ...p,
        score: scoresByUser[p.user_id] || 0,
        potentialScore: potentialScoresByUser[p.user_id] || 0,
        name: getDisplayName(p)
    }));

    // Sort by total score
    participantsWithScores.sort((a, b) => (b.score + b.potentialScore) - (a.score + a.potentialScore));

    // Render
    leaderboardList.innerHTML = participantsWithScores.map((p, index) => {
        const isCurrentUser = p.user_id === currentUserId;
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
        // Format scores to avoid floating point issues (e.g., 6.800000000000001 -> 6.8)
        const formattedScore = Number(p.score.toFixed(1));
        const formattedPotential = Number(p.potentialScore.toFixed(1));
        const potentialDisplay = formattedPotential > 0 ? ` <span class="potential-score">(+${formattedPotential})</span>` : '';

        return `
            <div class="leaderboard-row ${isCurrentUser ? 'current-user' : ''}">
                <div class="leaderboard-position">${medal || position}</div>
                <div class="leaderboard-name">${p.name}${isCurrentUser ? ' (deg)' : ''}</div>
                <div class="leaderboard-score">${formattedScore}${potentialDisplay} poeng</div>
            </div>
        `;
    }).join('');
}

/**
 * Display matches with tips
 */
function displayMatches(matches, tips, participants, currentUserId) {
    const matchesTable = document.getElementById('matchesWithTipsTable');

    if (matches.length === 0) {
        matchesTable.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #64748b;">
                <p>Ingen kamper funnet</p>
            </div>
        `;
        return;
    }

    // Sort: Live first, then upcoming (soonest first), then finished (newest first)
    matches.sort((a, b) => {
        const aLive = isMatchLive(a.fixture.status.short);
        const bLive = isMatchLive(b.fixture.status.short);
        const aFinished = isMatchFinished(a.fixture.status.short);
        const bFinished = isMatchFinished(b.fixture.status.short);

        // Live matches first
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;

        // Then upcoming (not started, not finished)
        const aUpcoming = !aLive && !aFinished;
        const bUpcoming = !bLive && !bFinished;
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;

        // Among upcoming: soonest first
        if (aUpcoming && bUpcoming) {
            return new Date(a.fixture.date) - new Date(b.fixture.date);
        }

        // Among finished: newest first
        return new Date(b.fixture.date) - new Date(a.fixture.date);
    });

    const tipsMap = createTipsMap(tips);
    let html = '<div class="matches-list">';

    matches.forEach(match => {
        const { fixture, teams, goals } = match;
        const matchId = fixture.id;
        const matchDate = new Date(fixture.date);
        const dateStr = matchDate.toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = matchDate.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });

        const isFinished = isMatchFinished(fixture.status.short);
        const isLive = isMatchLive(fixture.status.short);
        const hasStarted = isFinished || isLive || new Date() > matchDate;
        const resultStr = (isFinished || isLive) ? `${goals.home ?? '-'} - ${goals.away ?? '-'}` : 'vs';

        // Live match minute display
        let liveMinuteDisplay = '';
        if (isLive) {
            const elapsed = fixture.status.elapsed;
            const statusShort = fixture.status.short;
            if (statusShort === 'HT') {
                liveMinuteDisplay = 'Pause';
            } else if (elapsed) {
                liveMinuteDisplay = `${elapsed}'`;
            } else {
                liveMinuteDisplay = 'LIVE';
            }
        }

        html += `
            <div class="competition-match-card ${isLive ? 'live-match' : ''}">
                <div class="match-header">
                    <span class="match-date">${dateStr} ${timeStr}</span>
                    ${isLive ? `<span class="live-badge">${liveMinuteDisplay}</span>` : ''}
                    ${isFinished ? '<span class="finished-badge">Ferdig</span>' : ''}
                </div>
                <div class="match-teams">
                    <div class="team home">
                        <img src="${teams.home.logo}" alt="${teams.home.name}" class="team-logo-small">
                        <span class="team-name">${teams.home.name}</span>
                    </div>
                    <div class="match-result ${isFinished ? 'final' : ''}">${resultStr}</div>
                    <div class="team away">
                        <span class="team-name">${teams.away.name}</span>
                        <img src="${teams.away.logo}" alt="${teams.away.name}" class="team-logo-small">
                    </div>
                </div>
        `;

        if (hasStarted) {
            html += '<div class="match-tips"><div class="tips-header">Tips fra deltakere:</div><div class="tips-grid">';

            participants.forEach(participant => {
                const tip = tipsMap[`${matchId}_${participant.user_id}`];
                const isCurrentUser = participant.user_id === currentUserId;
                const userName = getDisplayName(participant);

                if (tip) {
                    let points = 0;
                    let pointsClass = '';
                    let showPoints = false;

                    if ((isFinished || isLive) && goals.home !== null && goals.away !== null) {
                        points = calculatePointsWithOdds(tip, goals.home, goals.away);
                        pointsClass = points > 0 ? 'has-points' : 'no-points';
                        showPoints = true;
                    }

                    const pointsLabel = isLive ? `(${points}p)` : `${points}p`;
                    html += `
                        <div class="tip-item ${isCurrentUser ? 'current-user-tip' : ''} ${pointsClass}">
                            <span class="tip-user">${userName}</span>
                            <span class="tip-score">${tip.home_score} - ${tip.away_score}</span>
                            ${showPoints ? `<span class="tip-points ${isLive ? 'potential' : ''}">${pointsLabel}</span>` : ''}
                        </div>
                    `;
                } else {
                    html += `
                        <div class="tip-item no-tip ${isCurrentUser ? 'current-user-tip' : ''}">
                            <span class="tip-user">${userName}</span>
                            <span class="tip-score">-</span>
                        </div>
                    `;
                }
            });

            html += '</div></div>';
        } else {
            html += `<div class="match-tips-hidden"><p>Tips vises når kampen starter</p></div>`;
        }

        html += '</div>';
    });

    html += '</div>';
    matchesTable.innerHTML = html;
}

// ============================================
// Global Actions
// ============================================

/**
 * Delete competition (only for creator)
 */
window.deleteCompetition = async function() {
    if (!confirm('Er du sikker på at du vil slette denne konkurransen? Dette kan ikke angres.')) {
        return;
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const competitionId = urlParams.get('id');
        const { data: { user } } = await window.supabase.auth.getUser();

        if (!user) {
            alert('Du må være innlogget');
            return;
        }

        // Verify creator
        const { data: competition, error: fetchError } = await window.supabase
            .from('competitions')
            .select('creator_id')
            .eq('id', competitionId)
            .single();

        if (fetchError || competition.creator_id !== user.id) {
            alert('Du kan bare slette konkurranser du har opprettet');
            return;
        }

        // Delete participants first, then competition
        await window.supabase
            .from('competition_participants')
            .delete()
            .eq('competition_id', competitionId);

        const { data: deletedData, error: deleteError } = await window.supabase
            .from('competitions')
            .delete()
            .eq('id', competitionId)
            .select();

        if (deleteError || !deletedData?.length) {
            alert('Kunne ikke slette konkurransen. Sjekk at du har rettigheter.');
            return;
        }

        alert('Konkurransen er slettet');
        window.location.href = 'competitions.html';

    } catch (error) {
        console.error('Error deleting competition:', error);
        alert('Noe gikk galt: ' + error.message);
    }
};

/**
 * Share competition
 */
window.shareCompetition = function() {
    const url = window.location.href;

    if (navigator.share) {
        navigator.share({ title: 'Bli med i tippekonkurranse!', url });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        alert('Link kopiert til utklippstavlen!');
    } else {
        prompt('Kopier denne linken:', url);
    }
};

/**
 * Join competition
 */
window.joinCompetition = async function() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const competitionId = urlParams.get('id');
        const { data: { user } } = await window.supabase.auth.getUser();

        if (!user) {
            alert('Du må være innlogget for å bli med');
            return;
        }

        const { error } = await window.supabase
            .from('competition_participants')
            .insert({
                competition_id: competitionId,
                user_id: user.id,
                user_name: user.user_metadata?.display_name || user.email.split('@')[0]
            });

        if (error) {
            alert('Kunne ikke bli med i konkurransen');
            return;
        }

        alert('Du er nå med i konkurransen!');
        window.location.reload();

    } catch (error) {
        console.error('Error joining competition:', error);
        alert('Noe gikk galt. Prøv igjen.');
    }
};
