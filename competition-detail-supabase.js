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

        console.log('✅ Loaded participants:', participants);

        // Display competition
        displayCompetition(competition, participants, userId);

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

    // Display leaderboard
    displayLeaderboard(participants);

    // For now, show a message about matches
    const matchesTable = document.getElementById('matchesWithTipsTable');
    matchesTable.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #64748b;">
            <p style="font-size: 16px; margin-bottom: 8px;">⚽ Kampoversikt kommer snart</p>
            <p style="font-size: 14px;">Denne funksjonen er under utvikling</p>
        </div>
    `;
}

/**
 * Display leaderboard
 */
function displayLeaderboard(participants) {
    const leaderboardList = document.getElementById('leaderboardList');

    if (participants.length === 0) {
        leaderboardList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Ingen deltakere ennå</p>';
        return;
    }

    // For now, just show participants without scores
    // In production, this would calculate scores from tips
    leaderboardList.innerHTML = participants.map((participant, index) => `
        <div class="leaderboard-row">
            <div class="leaderboard-position">${index + 1}</div>
            <div class="leaderboard-name">${participant.user_name}</div>
            <div class="leaderboard-score">0 poeng</div>
        </div>
    `).join('');
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
                user_name: user.email.split('@')[0] // Simple name extraction
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
