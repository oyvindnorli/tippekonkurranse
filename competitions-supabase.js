/**
 * Competitions with Supabase - Wizard-based creation
 */

// Wizard state
let wizardState = {
    currentStep: 1,
    competitionType: null, // 'round' or 'tournament'
    selectedRound: null,
    selectedTournament: null,
    selectedMatches: [],
    invitedEmails: []
};

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
    console.log('🏆 Competitions page loaded');

    // Wait for Supabase to be initialized
    const supabase = await waitForSupabase();

    if (!supabase) {
        console.error('❌ Supabase not initialized after waiting');
        const errorMessage = document.getElementById('errorMessage');
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (errorMessage) {
            errorMessage.textContent = 'Kunne ikke initialisere. Last siden på nytt.';
            errorMessage.style.display = 'block';
        }
        return;
    }

    console.log('✅ Supabase initialized');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.log('❌ No user logged in, redirecting to index');
        window.location.href = 'index.html';
        return;
    }

    console.log('✅ User logged in:', user.email);

    // Load competitions
    loadCompetitions(user.id);

    // Show create button (all users can create for now)
    const createBtn = document.getElementById('createCompetitionBtn');
    if (createBtn) {
        createBtn.style.display = 'inline-block';
    }
});

/**
 * Load all competitions for user
 */
async function loadCompetitions(userId) {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        console.log('📥 Loading competitions for user:', userId);

        // Get competitions where user is creator or participant
        const { data: participantData, error: participantError } = await window.supabase
            .from('competition_participants')
            .select('competition_id')
            .eq('user_id', userId);

        if (participantError) {
            console.error('❌ Error loading participant data:', participantError);
            throw participantError;
        }

        const competitionIds = participantData.map(p => p.competition_id);
        console.log('📋 User is participant in competitions:', competitionIds);

        if (competitionIds.length === 0) {
            console.log('ℹ️ No competitions found');
            loadingMessage.style.display = 'none';
            displayNoCompetitions();
            return;
        }

        // Get competition details
        const { data: competitions, error: competitionsError } = await window.supabase
            .from('competitions')
            .select('*')
            .in('id', competitionIds)
            .order('created_at', { ascending: false });

        if (competitionsError) {
            console.error('❌ Error loading competitions:', competitionsError);
            throw competitionsError;
        }

        console.log('✅ Loaded competitions:', competitions);

        loadingMessage.style.display = 'none';
        displayCompetitions(competitions);

    } catch (error) {
        console.error('❌ Error in loadCompetitions:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste konkurranser. Prøv igjen senere.';
        errorMessage.style.display = 'block';
    }
}

/**
 * Display competitions grouped by status
 */
function displayCompetitions(competitions) {
    const now = new Date();

    const active = [];
    const upcoming = [];
    const completed = [];

    competitions.forEach(comp => {
        const startDate = new Date(comp.start_date);
        const endDate = new Date(comp.end_date);

        if (now < startDate) {
            upcoming.push(comp);
        } else if (now > endDate) {
            completed.push(comp);
        } else {
            active.push(comp);
        }
    });

    renderCompetitionList('activeCompetitionsList', active, 'active');
    renderCompetitionList('upcomingCompetitionsList', upcoming, 'upcoming');
    renderCompetitionList('completedCompetitionsList', completed, 'completed');
}

/**
 * Render competition list
 */
function renderCompetitionList(containerId, competitions, status) {
    const container = document.getElementById(containerId);

    if (competitions.length === 0) {
        container.innerHTML = '<p class="no-competitions">Ingen konkurranser</p>';
        return;
    }

    container.innerHTML = competitions.map(comp => `
        <div class="competition-card" onclick="window.location.href='competition-detail.html?id=${comp.id}'">
            <div class="competition-header">
                <div class="competition-info">
                    <h4 class="competition-name">${comp.name}</h4>
                    <p class="competition-meta">${formatDateRange(comp.start_date, comp.end_date)}</p>
                </div>
                <div class="competition-status status-${status}">
                    ${status === 'active' ? '🔴 LIVE' : status === 'upcoming' ? '📅 KOMMER' : '✅ FERDIG'}
                </div>
            </div>
            <div class="competition-stats">
                <span>📊 ${comp.match_ids ? comp.match_ids.length : 0} kamper</span>
            </div>
        </div>
    `).join('');
}

/**
 * Display when no competitions found
 */
function displayNoCompetitions() {
    const activeList = document.getElementById('activeCompetitionsList');
    const upcomingList = document.getElementById('upcomingCompetitionsList');
    const completedList = document.getElementById('completedCompetitionsList');

    [activeList, upcomingList, completedList].forEach(list => {
        list.innerHTML = '<p class="no-competitions">Ingen konkurranser</p>';
    });
}

/**
 * Format date range
 */
function formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const options = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('no-NO', options)} - ${end.toLocaleDateString('no-NO', options)}`;
}

// ============================================================================
// Wizard Functions
// ============================================================================

/**
 * Show competition creation wizard
 */
window.showCreateCompetitionWizard = function() {
    console.log('🎯 Opening competition wizard');

    // Reset wizard state
    wizardState = {
        currentStep: 1,
        competitionType: null,
        selectedRound: null,
        selectedTournament: null,
        selectedMatches: [],
        invitedEmails: []
    };

    // Reset UI
    document.getElementById('wizardStep1').style.display = 'block';
    document.getElementById('wizardStep2').style.display = 'none';
    document.getElementById('wizardStep3').style.display = 'none';

    document.getElementById('typeRound').classList.remove('selected');
    document.getElementById('typeTournament').classList.remove('selected');
    document.getElementById('step1Next').disabled = true;

    updateStepIndicators();

    // Show modal
    document.getElementById('competitionWizardModal').style.display = 'block';
};

/**
 * Close wizard
 */
window.closeCompetitionWizard = function() {
    document.getElementById('competitionWizardModal').style.display = 'none';
};

/**
 * Select competition type (Step 1)
 */
window.selectCompetitionType = function(type) {
    console.log('📌 Selected competition type:', type);

    wizardState.competitionType = type;

    // Update UI
    document.getElementById('typeRound').classList.remove('selected');
    document.getElementById('typeTournament').classList.remove('selected');

    if (type === 'round') {
        document.getElementById('typeRound').classList.add('selected');
    } else {
        document.getElementById('typeTournament').classList.add('selected');
    }

    // Enable next button
    document.getElementById('step1Next').disabled = false;
};

/**
 * Next wizard step
 */
window.nextWizardStep = async function() {
    if (wizardState.currentStep === 1) {
        // Moving from step 1 to step 2
        wizardState.currentStep = 2;
        document.getElementById('wizardStep1').style.display = 'none';
        document.getElementById('wizardStep2').style.display = 'block';

        // Load rounds or tournaments based on type
        if (wizardState.competitionType === 'round') {
            document.getElementById('roundSelection').style.display = 'block';
            document.getElementById('tournamentSelection').style.display = 'none';
            await loadAvailableRounds();
        } else {
            document.getElementById('roundSelection').style.display = 'none';
            document.getElementById('tournamentSelection').style.display = 'block';
            await loadAvailableTournaments();
        }

    } else if (wizardState.currentStep === 2) {
        // Moving from step 2 to step 3
        wizardState.currentStep = 3;
        document.getElementById('wizardStep2').style.display = 'none';
        document.getElementById('wizardStep3').style.display = 'block';

        // Pre-fill competition name
        if (wizardState.selectedRound) {
            document.getElementById('competitionName').value = wizardState.selectedRound.name;
        } else if (wizardState.selectedTournament) {
            document.getElementById('competitionName').value = wizardState.selectedTournament.name;
        }
    }

    updateStepIndicators();
};

/**
 * Previous wizard step
 */
window.prevWizardStep = function() {
    wizardState.currentStep--;

    if (wizardState.currentStep === 1) {
        document.getElementById('wizardStep1').style.display = 'block';
        document.getElementById('wizardStep2').style.display = 'none';
    } else if (wizardState.currentStep === 2) {
        document.getElementById('wizardStep2').style.display = 'block';
        document.getElementById('wizardStep3').style.display = 'none';
    }

    updateStepIndicators();
};

/**
 * Update step indicators
 */
function updateStepIndicators() {
    // Remove all active/completed classes
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step${i}Indicator`);
        indicator.classList.remove('active', 'completed');

        if (i < wizardState.currentStep) {
            indicator.classList.add('completed');
        } else if (i === wizardState.currentStep) {
            indicator.classList.add('active');
        }
    }
}

/**
 * Load available rounds (Step 2 for round type)
 */
async function loadAvailableRounds() {
    console.log('📥 Loading available rounds...');

    const roundsList = document.getElementById('roundsList');
    roundsList.innerHTML = '<div class="loading-message">Laster runder...</div>';

    try {
        // For now, show hardcoded rounds for PL, CL, EL
        // In production, this would fetch from API
        const rounds = [
            {
                id: 'pl-13',
                league: 39,
                round: 'Regular Season - 13',
                name: 'Premier League - Runde 13',
                subtitle: '23-24 Nov • ~10 kamper',
                icon: '⚽'
            },
            {
                id: 'cl-5',
                league: 2,
                round: 'League Stage - 5',
                name: 'Champions League - Runde 5',
                subtitle: '26-27 Nov • ~18 kamper',
                icon: '⭐'
            },
            {
                id: 'el-5',
                league: 3,
                round: 'League Stage - 5',
                name: 'Europa League - Runde 5',
                subtitle: '28 Nov • ~18 kamper',
                icon: '🌟'
            }
        ];

        roundsList.innerHTML = rounds.map(round => `
            <div class="selection-item" onclick="selectRound('${round.id}')" id="round-${round.id}">
                <div class="selection-icon">${round.icon}</div>
                <div class="selection-content">
                    <div class="selection-title">${round.name}</div>
                    <div class="selection-subtitle">${round.subtitle}</div>
                </div>
            </div>
        `).join('');

        // Store rounds for later
        window.availableRounds = rounds;

    } catch (error) {
        console.error('❌ Error loading rounds:', error);
        roundsList.innerHTML = '<div class="error-message">Kunne ikke laste runder</div>';
    }
}

/**
 * Select round
 */
window.selectRound = function(roundId) {
    console.log('📌 Selected round:', roundId);

    const round = window.availableRounds.find(r => r.id === roundId);
    wizardState.selectedRound = round;

    // Update UI
    document.querySelectorAll('#roundsList .selection-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.getElementById(`round-${roundId}`).classList.add('selected');

    // Enable next button
    document.getElementById('step2Next').disabled = false;

    // Show match preview (optional for now)
    showMatchPreview(round);
};

/**
 * Show match preview
 */
function showMatchPreview(round) {
    const preview = document.getElementById('matchPreview');
    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="match-preview-header">Forhåndsvisning</div>
        <p style="color: #64748b; font-size: 14px; padding: 12px;">
            ${round.subtitle}
        </p>
    `;
}

/**
 * Load available tournaments (Step 2 for tournament type)
 */
async function loadAvailableTournaments() {
    console.log('📥 Loading available tournaments...');

    const tournamentsList = document.getElementById('tournamentsList');
    tournamentsList.innerHTML = '<div class="loading-message">Laster turneringer...</div>';

    try {
        // Hardcoded tournaments for now
        const tournaments = [
            {
                id: 'wc-2026',
                name: 'FIFA World Cup 2026',
                subtitle: '11 Jun - 19 Jul 2026 • 104 kamper',
                icon: '🌍',
                league: 1
            },
            {
                id: 'euro-2028',
                name: 'UEFA Euro 2028',
                subtitle: 'Jun - Jul 2028 • 51 kamper',
                icon: '🇪🇺',
                league: 4
            },
            {
                id: 'pl-2024-25',
                name: 'Premier League 2024/25 (resterende)',
                subtitle: 'Nov 2024 - Mai 2025 • ~260 kamper',
                icon: '⚽',
                league: 39
            }
        ];

        tournamentsList.innerHTML = tournaments.map(tournament => `
            <div class="selection-item" onclick="selectTournament('${tournament.id}')" id="tournament-${tournament.id}">
                <div class="selection-icon">${tournament.icon}</div>
                <div class="selection-content">
                    <div class="selection-title">${tournament.name}</div>
                    <div class="selection-subtitle">${tournament.subtitle}</div>
                </div>
            </div>
        `).join('');

        window.availableTournaments = tournaments;

    } catch (error) {
        console.error('❌ Error loading tournaments:', error);
        tournamentsList.innerHTML = '<div class="error-message">Kunne ikke laste turneringer</div>';
    }
}

/**
 * Select tournament
 */
window.selectTournament = function(tournamentId) {
    console.log('📌 Selected tournament:', tournamentId);

    const tournament = window.availableTournaments.find(t => t.id === tournamentId);
    wizardState.selectedTournament = tournament;

    // Update UI
    document.querySelectorAll('#tournamentsList .selection-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.getElementById(`tournament-${tournamentId}`).classList.add('selected');

    // Enable next button
    document.getElementById('step2Next').disabled = false;
};

/**
 * Add invite email
 */
window.addInvite = function() {
    const emailInput = document.getElementById('inviteEmail');
    const email = emailInput.value.trim();

    if (!email) return;

    // Simple email validation
    if (!email.includes('@')) {
        alert('Vennligst oppgi en gyldig e-postadresse');
        return;
    }

    // Check if already added
    if (wizardState.invitedEmails.includes(email)) {
        alert('Denne e-postadressen er allerede lagt til');
        return;
    }

    wizardState.invitedEmails.push(email);
    emailInput.value = '';

    renderInvitesList();
};

/**
 * Remove invite
 */
window.removeInvite = function(email) {
    wizardState.invitedEmails = wizardState.invitedEmails.filter(e => e !== email);
    renderInvitesList();
};

/**
 * Render invites list
 */
function renderInvitesList() {
    const list = document.getElementById('invitesList');

    if (wizardState.invitedEmails.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = wizardState.invitedEmails.map(email => `
        <div class="invited-tag">
            <span>${email}</span>
            <span class="remove-invite" onclick="removeInvite('${email}')">×</span>
        </div>
    `).join('');
}

/**
 * Create competition (Step 3 submit)
 */
window.createCompetition = async function(event) {
    event.preventDefault();

    const name = document.getElementById('competitionName').value.trim();
    const description = document.getElementById('competitionDescription').value.trim();
    const wizardError = document.getElementById('wizardError');

    if (!name) {
        wizardError.textContent = 'Vennligst oppgi et navn på konkurransen';
        wizardError.style.display = 'block';
        return;
    }

    wizardError.style.display = 'none';

    try {
        console.log('🏆 Creating competition...');

        const { data: { user } } = await window.supabase.auth.getUser();

        if (!user) {
            throw new Error('Not logged in');
        }

        // Determine league IDs and dates based on selection
        let leagueIds = [];
        let startDate, endDate;

        if (wizardState.competitionType === 'round' && wizardState.selectedRound) {
            leagueIds = [wizardState.selectedRound.league];
            // For now, use approximate dates (would be fetched from API in production)
            startDate = new Date();
            endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
        } else if (wizardState.competitionType === 'tournament' && wizardState.selectedTournament) {
            leagueIds = [wizardState.selectedTournament.league];
            // Tournament dates would come from API
            startDate = new Date();
            endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        }

        // Create competition in Supabase
        const { data: competition, error: createError } = await window.supabase
            .from('competitions')
            .insert({
                name: name,
                creator_id: user.id,
                league_ids: leagueIds,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                match_ids: [] // Would be populated with actual match IDs
            })
            .select()
            .single();

        if (createError) {
            console.error('❌ Error creating competition:', createError);
            throw createError;
        }

        console.log('✅ Competition created:', competition);

        // Add creator as participant
        const { error: participantError } = await window.supabase
            .from('competition_participants')
            .insert({
                competition_id: competition.id,
                user_id: user.id,
                user_name: user.email.split('@')[0] // Simple name extraction
            });

        if (participantError) {
            console.error('⚠️ Error adding creator as participant:', participantError);
        }

        // TODO: Send invites to invited emails

        // Close wizard and reload competitions
        window.closeCompetitionWizard();
        alert('Konkurransen ble opprettet! 🎉');
        loadCompetitions(user.id);

    } catch (error) {
        console.error('❌ Error creating competition:', error);
        wizardError.textContent = 'Kunne ikke opprette konkurranse. Prøv igjen.';
        wizardError.style.display = 'block';
    }
};
