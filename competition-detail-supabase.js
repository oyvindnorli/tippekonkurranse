/**
 * Competition Detail Page - Supabase version
 */

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
    console.log('🏆 Competition detail page loaded');

    // Wait for Supabase
    const supabase = await waitForSupabase();

    if (!supabase) {
        console.error('❌ Supabase not initialized');
        showError('Kunne ikke initialisere. Last siden på nytt.');
        return;
    }

    // Get competition ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const competitionId = urlParams.get('id');

    if (!competitionId) {
        console.error('❌ No competition ID in URL');
        showError('Ingen konkurranse-ID funnet');
        return;
    }

    console.log('📋 Loading competition:', competitionId);

    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.log('❌ No user logged in, redirecting');
        window.location.href = 'index.html';
        return;
    }

    // Load competition details
    await loadCompetitionDetails(competitionId, user.id);
});

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
            console.error('❌ Error loading competition:', competitionError);
            throw new Error('Kunne ikke laste konkurranse');
        }

        console.log('✅ Loaded competition:', competition);

        // Get participants
        const { data: participants, error: participantsError } = await window.supabase
            .from('competition_participants')
            .select('*')
            .eq('competition_id', competitionId);

        if (participantsError) {
            console.error('❌ Error loading participants:', participantsError);
            throw new Error('Kunne ikke laste deltakere');
        }

        // Get user IDs to fetch display names
        const userIds = participants.map(p => p.user_id);

        // Fetch display names from users table
        const { data: usersData, error: usersError } = await window.supabase
            .from('users')
            .select('id, display_name, email')
            .in('id', userIds);

        if (usersError) {
            console.error('❌ Error loading users:', usersError);
        }

        // Create lookup for user display names
        const usersMap = {};
        (usersData || []).forEach(user => {
            usersMap[user.id] = user.display_name || user.email?.split('@')[0] || 'Ukjent';
        });

        console.log('👥 Users map:', usersMap);

        // Map participants with display names
        const mappedParticipants = participants.map(p => ({
            ...p,
            display_name: usersMap[p.user_id] || p.user_name || 'Ukjent'
        }));

        console.log('✅ Mapped participants:', mappedParticipants);

        // Display competition
        displayCompetition(competition, mappedParticipants, userId);

        loadingMessage.style.display = 'none';
        detailsSection.style.display = 'block';

    } catch (error) {
        console.error('❌ Error in loadCompetitionDetails:', error);
        loadingMessage.style.display = 'none';
        showError(error.message || 'Kunne ikke laste konkurranse');
    }
}

/**
 * Display competition details
 */
function displayCompetition(competition, participants, userId) {
    // Set name
    document.getElementById('competitionName').textContent = competition.name;

    // Set description (if exists)
    const descElement = document.getElementById('competitionDescription');
    if (competition.description) {
        descElement.textContent = competition.description;
        descElement.style.display = 'block';
    } else {
        descElement.style.display = 'none';
    }

    // Set status
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

    // Set creator (would need to fetch user data)
    document.getElementById('creatorName').textContent = 'Admin'; // Simplified for now

    // Set period
    const periodText = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    document.getElementById('competitionPeriod').textContent = periodText;

    // Set match count
    const matchCount = competition.match_ids ? competition.match_ids.length : 0;
    document.getElementById('matchCount').textContent = `${matchCount} kamper`;

    // Set participant count
    document.getElementById('participantCount').textContent = `${participants.length} deltakere`;

    // Show/hide join button
    const isParticipant = participants.some(p => p.user_id === userId);
    const joinBtn = document.getElementById('joinBtn');
    if (!isParticipant && now < endDate) {
        joinBtn.style.display = 'inline-block';
    } else {
        joinBtn.style.display = 'none';
    }

    // Show/hide delete button (only for creator)
    const isCreator = competition.creator_id === userId;
    const deleteBtn = document.getElementById('deleteBtn');
    if (isCreator) {
        deleteBtn.style.display = 'inline-block';
    } else {
        deleteBtn.style.display = 'none';
    }

    // Display initial leaderboard (will be updated with scores after matches load)
    displayLeaderboard(participants, userId, []);

    // Load and display matches (this also updates the leaderboard with scores)
    if (competition.match_ids && competition.match_ids.length > 0) {
        loadCompetitionMatches(competition, participants, userId);
    } else {
        const matchesTable = document.getElementById('matchesWithTipsTable');
        matchesTable.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #64748b;">
                <p style="font-size: 16px;">Ingen kamper i denne konkurransen</p>
            </div>
        `;
    }
}

/**
 * Display leaderboard with scores
 * @param {Array} participants - Participants list
 * @param {string} currentUserId - Current user ID
 * @param {Object} scoresByUser - Object mapping user_id to total points
 * @param {boolean} hasLiveMatches - Whether there are live matches
 */
function displayLeaderboard(participants, currentUserId, scoresByUser = {}, hasLiveMatches = false) {
    const leaderboardList = document.getElementById('leaderboardList');

    // Update leaderboard header with LIVE indicator
    const leaderboardHeader = document.querySelector('.competition-leaderboard h3');
    if (leaderboardHeader) {
        const hasScores = Object.keys(scoresByUser).length > 0;
        if (hasLiveMatches) {
            leaderboardHeader.innerHTML = '🏆 Tabell <span class="live-indicator">LIVE</span>';
        } else if (hasScores) {
            leaderboardHeader.innerHTML = '🏆 Tabell';
        }
    }

    if (participants.length === 0) {
        leaderboardList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Ingen deltakere ennå</p>';
        return;
    }

    // Calculate scores for each participant
    const participantsWithScores = participants.map(participant => ({
        ...participant,
        score: scoresByUser[participant.user_id] || 0,
        name: participant.display_name || participant.user_name || 'Ukjent'
    }));

    // Sort by score (highest first)
    participantsWithScores.sort((a, b) => b.score - a.score);

    // Render leaderboard
    leaderboardList.innerHTML = participantsWithScores.map((participant, index) => {
        const isCurrentUser = participant.user_id === currentUserId;
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';

        return `
            <div class="leaderboard-row ${isCurrentUser ? 'current-user' : ''}">
                <div class="leaderboard-position">${medal || position}</div>
                <div class="leaderboard-name">${participant.name}${isCurrentUser ? ' (deg)' : ''}</div>
                <div class="leaderboard-score">${participant.score} poeng</div>
            </div>
        `;
    }).join('');
}

/**
 * Load and display competition matches
 */
async function loadCompetitionMatches(competition, participants, currentUserId) {
    const matchesTable = document.getElementById('matchesWithTipsTable');

    // Show loading state
    matchesTable.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #64748b;">
            <p>Laster kamper...</p>
        </div>
    `;

    try {
        // Fetch match data from API
        const matchIds = competition.match_ids;
        console.log('📥 Loading matches:', matchIds);

        // Fetch fixtures from API (batch by getting date range)
        const startDate = new Date(competition.start_date);
        const endDate = new Date(competition.end_date);
        const fromDate = startDate.toISOString().split('T')[0];
        const toDate = endDate.toISOString().split('T')[0];

        // Get league ID from competition
        const leagueId = competition.league_ids?.[0] || 39;
        const season = new Date().getFullYear();

        const url = `/api/football?endpoint=fixtures&league=${leagueId}&season=${season}&from=${fromDate}&to=${toDate}`;
        console.log('📥 Fetching fixtures:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Kunne ikke hente kamper fra API');
        }

        const data = await response.json();
        console.log('📥 API response:', data);

        // Filter to only matches in this competition
        const matches = (data.response || []).filter(fixture =>
            matchIds.includes(fixture.fixture.id)
        );

        console.log('✅ Filtered matches:', matches.length);

        // Fetch tips for all participants in this competition
        const participantIds = participants.map(p => p.user_id);
        const { data: allTips, error: tipsError } = await window.supabase
            .from('tips')
            .select('*')
            .in('user_id', participantIds)
            .in('match_id', matchIds);

        if (tipsError) {
            console.error('❌ Error loading tips:', tipsError);
        }

        console.log('📥 Loaded tips:', allTips?.length || 0);

        // Calculate scores for leaderboard
        const { scoresByUser, hasLiveMatches } = calculateAllScores(matches, allTips || [], participants);
        console.log('📊 Scores calculated:', scoresByUser, 'hasLive:', hasLiveMatches);

        // Update leaderboard with actual scores
        displayLeaderboard(participants, currentUserId, scoresByUser, hasLiveMatches);

        // Display matches
        displayMatches(matches, allTips || [], participants, currentUserId);

    } catch (error) {
        console.error('❌ Error loading matches:', error);
        matchesTable.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                <p>Kunne ikke laste kamper: ${error.message}</p>
            </div>
        `;
    }
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

    // Sort matches by date
    matches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    // Create tips lookup by match_id and user_id
    const tipsMap = {};
    tips.forEach(tip => {
        const key = `${tip.match_id}_${tip.user_id}`;
        tipsMap[key] = tip;
    });

    // Build HTML
    let html = '<div class="matches-list">';

    matches.forEach(match => {
        const fixture = match.fixture;
        const teams = match.teams;
        const goals = match.goals;
        const matchId = fixture.id;

        // Format date/time
        const matchDate = new Date(fixture.date);
        const dateStr = matchDate.toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = matchDate.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });

        // Check match status
        const isFinished = fixture.status.short === 'FT' || fixture.status.short === 'AET' || fixture.status.short === 'PEN';
        const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(fixture.status.short);
        const hasStarted = isFinished || isLive || new Date() > matchDate;

        // Result
        const resultStr = isFinished || isLive ? `${goals.home ?? '-'} - ${goals.away ?? '-'}` : 'vs';

        html += `
            <div class="competition-match-card">
                <div class="match-header">
                    <span class="match-date">${dateStr} ${timeStr}</span>
                    ${isLive ? '<span class="live-badge">LIVE</span>' : ''}
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

        // Show tips from participants (only if match has started)
        if (hasStarted) {
            html += '<div class="match-tips">';
            html += '<div class="tips-header">Tips fra deltakere:</div>';
            html += '<div class="tips-grid">';

            participants.forEach(participant => {
                const tip = tipsMap[`${matchId}_${participant.user_id}`];
                const isCurrentUser = participant.user_id === currentUserId;

                if (tip) {
                    // Calculate points if match is finished
                    let points = 0;
                    let pointsClass = '';
                    if (isFinished && goals.home !== null && goals.away !== null) {
                        points = calculatePoints(tip.home_score, tip.away_score, goals.home, goals.away);
                        pointsClass = points > 0 ? 'has-points' : 'no-points';
                    }

                    const tipUserName = participant.display_name || participant.user_name || 'Ukjent';
                    html += `
                        <div class="tip-item ${isCurrentUser ? 'current-user-tip' : ''} ${pointsClass}">
                            <span class="tip-user">${tipUserName}</span>
                            <span class="tip-score">${tip.home_score} - ${tip.away_score}</span>
                            ${isFinished ? `<span class="tip-points">${points}p</span>` : ''}
                        </div>
                    `;
                } else {
                    const tipUserName = participant.display_name || participant.user_name || 'Ukjent';
                    html += `
                        <div class="tip-item no-tip ${isCurrentUser ? 'current-user-tip' : ''}">
                            <span class="tip-user">${tipUserName}</span>
                            <span class="tip-score">-</span>
                        </div>
                    `;
                }
            });

            html += '</div></div>';
        } else {
            html += `
                <div class="match-tips-hidden">
                    <p>Tips vises når kampen starter</p>
                </div>
            `;
        }

        html += '</div>';
    });

    html += '</div>';
    matchesTable.innerHTML = html;
}

/**
 * Calculate scores for all participants
 */
function calculateAllScores(matches, tips, participants) {
    const scoresByUser = {};
    let hasLiveMatches = false;

    // Initialize scores for all participants
    participants.forEach(p => {
        scoresByUser[p.user_id] = 0;
    });

    // Create tips lookup
    const tipsMap = {};
    tips.forEach(tip => {
        const key = `${tip.match_id}_${tip.user_id}`;
        tipsMap[key] = tip;
    });

    // Calculate points for each match
    matches.forEach(match => {
        const fixture = match.fixture;
        const goals = match.goals;
        const matchId = fixture.id;

        // Check match status
        const isFinished = ['FT', 'AET', 'PEN'].includes(fixture.status.short);
        const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(fixture.status.short);

        if (isLive) {
            hasLiveMatches = true;
        }

        // Only calculate points for finished matches
        if (isFinished && goals.home !== null && goals.away !== null) {
            participants.forEach(participant => {
                const tip = tipsMap[`${matchId}_${participant.user_id}`];
                if (tip) {
                    const points = calculatePoints(tip.home_score, tip.away_score, goals.home, goals.away);
                    scoresByUser[participant.user_id] += points;
                }
            });
        }
    });

    return { scoresByUser, hasLiveMatches };
}

/**
 * Calculate points for a tip
 */
function calculatePoints(tipHome, tipAway, actualHome, actualAway) {
    // Exact score = 3 points
    if (tipHome === actualHome && tipAway === actualAway) {
        return 3;
    }

    // Correct outcome = 1 point
    const tipOutcome = tipHome > tipAway ? 'H' : tipHome < tipAway ? 'A' : 'D';
    const actualOutcome = actualHome > actualAway ? 'H' : actualHome < actualAway ? 'A' : 'D';

    if (tipOutcome === actualOutcome) {
        return 1;
    }

    return 0;
}

/**
 * Format date
 */
function formatDate(date) {
    return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Show error
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
 * Delete competition (only for creator)
 */
window.deleteCompetition = async function() {
    if (!confirm('Er du sikker på at du vil slette denne konkurransen? Dette kan ikke angres.')) {
        return;
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const competitionId = urlParams.get('id');

        console.log('🗑️ Attempting to delete competition:', competitionId);

        const { data: { user } } = await window.supabase.auth.getUser();

        if (!user) {
            alert('Du må være innlogget');
            return;
        }

        console.log('👤 User ID:', user.id);

        // First verify the user is the creator
        const { data: competition, error: fetchError } = await window.supabase
            .from('competitions')
            .select('creator_id')
            .eq('id', competitionId)
            .single();

        if (fetchError) {
            console.error('❌ Error fetching competition:', fetchError);
            alert('Kunne ikke finne konkurransen');
            return;
        }

        console.log('📋 Competition creator_id:', competition.creator_id);

        if (competition.creator_id !== user.id) {
            alert('Du kan bare slette konkurranser du har opprettet');
            return;
        }

        // Delete participants first
        const { error: participantsError, count: participantsCount } = await window.supabase
            .from('competition_participants')
            .delete()
            .eq('competition_id', competitionId)
            .select();

        console.log('👥 Deleted participants, error:', participantsError);

        // Then delete the competition
        const { data: deletedData, error: competitionError } = await window.supabase
            .from('competitions')
            .delete()
            .eq('id', competitionId)
            .select();

        console.log('🗑️ Delete result:', { deletedData, competitionError });

        if (competitionError) {
            console.error('❌ Error deleting competition:', competitionError);
            alert('Kunne ikke slette konkurransen: ' + competitionError.message);
            return;
        }

        if (!deletedData || deletedData.length === 0) {
            console.error('❌ No rows deleted - RLS policy may be blocking');
            alert('Kunne ikke slette konkurransen. Sjekk at du har rettigheter.');
            return;
        }

        console.log('✅ Competition deleted successfully');
        alert('Konkurransen er slettet');

        // Redirect to competitions list
        window.location.href = 'competitions.html';

    } catch (error) {
        console.error('❌ Error in deleteCompetition:', error);
        alert('Noe gikk galt: ' + error.message);
    }
};

/**
 * Share competition
 */
window.shareCompetition = function() {
    const url = window.location.href;

    if (navigator.share) {
        navigator.share({
            title: 'Bli med i tippekonkurranse!',
            url: url
        });
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
    console.log('🎯 Joining competition...');

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const competitionId = urlParams.get('id');

        const { data: { user } } = await window.supabase.auth.getUser();

        if (!user) {
            alert('Du må være innlogget for å bli med');
            return;
        }

        // Add user as participant
        const { error } = await window.supabase
            .from('competition_participants')
            .insert({
                competition_id: competitionId,
                user_id: user.id,
                user_name: user.user_metadata?.display_name || user.email.split('@')[0]
            });

        if (error) {
            console.error('❌ Error joining competition:', error);
            alert('Kunne ikke bli med i konkurransen');
            return;
        }

        console.log('✅ Joined competition successfully');
        alert('Du er nå med i konkurransen! 🎉');

        // Reload page to update
        window.location.reload();

    } catch (error) {
        console.error('❌ Error in joinCompetition:', error);
        alert('Noe gikk galt. Prøv igjen.');
    }
};
