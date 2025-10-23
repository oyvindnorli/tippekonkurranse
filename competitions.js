// Competitions functionality
let selectedLeagues = new Set([39, 2]); // Default: Premier League and Champions League
let availableRounds = null; // Store fetched rounds
let selectedPLRounds = new Set(); // Selected Premier League rounds
let selectedCLRounds = new Set(); // Selected Champions League rounds

// Initialize page
function init() {
    // Initialize Firebase
    initializeFirebase();

    // Wait for auth state to be ready
    firebase.auth().onAuthStateChanged((user) => {
        const loadingMessage = document.getElementById('loadingMessage');

        if (user) {
            loadCompetitions();
        } else {
            // Hide loading message when not logged in
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            // Redirect to home page if not logged in
            window.location.href = 'index.html';
        }
    });
}

// Load all competitions
async function loadCompetitions() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        const user = firebase.auth().currentUser;
        if (!user) return;

        // Get all competitions where user is a participant
        // Remove orderBy to avoid needing a composite index
        const competitionsSnapshot = await firebase.firestore().collection('competitions')
            .where('participants', 'array-contains', user.uid)
            .get();

        const competitions = [];
        competitionsSnapshot.forEach(doc => {
            competitions.push({ id: doc.id, ...doc.data() });
        });

        // Sort by createdAt on client side
        competitions.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        console.log('📥 Loaded competitions:', competitions.length);

        loadingMessage.style.display = 'none';

        // Fetch match results to check if competitions are actually finished
        const scores = await footballApi.fetchScores();

        // Categorize competitions
        const now = new Date();
        const active = [];
        const upcoming = [];
        const completed = [];

        competitions.forEach(c => {
            const leagueNames = { 39: 'Premier League', 2: 'UEFA Champions League', 140: 'La Liga', 78: 'Bundesliga', 135: 'Serie A', 1: 'World Cup' };
            const leagues = c.leagues || [];

            let competitionMatches = [];
            let start, end;

            if (c.competitionType === 'round') {
                // Round-based competition - filter by rounds
                competitionMatches = scores.filter(match => {
                    if (!match.round) return false;

                    // Check PL rounds
                    if (c.selectedRounds?.premierLeague && match.league?.includes('Premier League')) {
                        const roundMatch = match.round.match(/(\d+)/);
                        if (roundMatch) {
                            const roundNumber = parseInt(roundMatch[1]);
                            return c.selectedRounds.premierLeague.includes(roundNumber);
                        }
                    }

                    // Check CL rounds
                    if (c.selectedRounds?.championsLeague && match.league?.includes('Champions League')) {
                        return c.selectedRounds.championsLeague.includes(match.round);
                    }

                    return false;
                });

                // Determine start/end from matches
                if (competitionMatches.length > 0) {
                    const dates = competitionMatches.map(m => new Date(m.commence_time || m.date));
                    start = new Date(Math.min(...dates));
                    end = new Date(Math.max(...dates));
                } else {
                    start = now;
                    end = now;
                }

            } else {
                // Date-based competition
                start = new Date(c.startDate.toDate());
                start.setHours(0, 0, 0, 0);

                end = new Date(c.endDate.toDate());
                end.setHours(23, 59, 59, 999);

                competitionMatches = scores.filter(match => {
                    const matchDate = new Date(match.commence_time || match.date);
                    if (matchDate < start || matchDate > end) return false;

                    return leagues.some(leagueId => {
                        const leagueName = leagueNames[leagueId];
                        return match.league && match.league.includes(leagueName);
                    });
                });
            }

            // Categorize competition
            if (start > now) {
                upcoming.push(c);
            } else {
                const allMatchesCompleted = competitionMatches.length > 0 &&
                    competitionMatches.every(match => match.completed);

                if (allMatchesCompleted || end < now) {
                    completed.push(c);
                } else {
                    active.push(c);
                }
            }
        });

        renderCompetitions(active, 'activeCompetitionsList');
        renderCompetitions(upcoming, 'upcomingCompetitionsList');
        renderCompetitions(completed, 'completedCompetitionsList');

    } catch (error) {
        console.error('Failed to load competitions:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste konkurranser. Prøv igjen senere.';
        errorMessage.style.display = 'block';
    }
}

// Render competitions list
function renderCompetitions(competitions, elementId) {
    const listElement = document.getElementById(elementId);

    if (competitions.length === 0) {
        listElement.innerHTML = '<div class="no-competitions">Ingen konkurranser</div>';
        return;
    }

    listElement.innerHTML = '';
    competitions.forEach(competition => {
        const card = createCompetitionCard(competition);
        listElement.appendChild(card);
    });
}

// Create competition card
function createCompetitionCard(competition) {
    const card = document.createElement('div');
    card.className = 'competition-card';

    const user = firebase.auth().currentUser;
    const isCreator = user && competition.creatorId === user.uid;

    // Get league names
    const leagueNames = {
        39: 'Premier League',
        2: 'Champions League',
        140: 'La Liga',
        78: 'Bundesliga',
        135: 'Serie A',
        1: 'World Cup'
    };

    const leagues = competition.leagues || competition.matchIds || [];
    let leaguesList = '';
    let periodText = '';

    if (competition.competitionType === 'round') {
        // Round-based competition
        periodText = '🎯 Rundebasert';

        const parts = [];
        if (competition.selectedRounds?.premierLeague) {
            const rounds = competition.selectedRounds.premierLeague.sort((a, b) => a - b);
            const roundText = rounds.length === 1
                ? `Runde ${rounds[0]}`
                : `Runde ${rounds[0]}-${rounds[rounds.length - 1]}`;
            parts.push(`PL (${roundText})`);
        }

        if (competition.selectedRounds?.championsLeague) {
            const rounds = competition.selectedRounds.championsLeague;
            const roundText = rounds.map(r => r.replace('League Stage - ', '').replace('Matchday', 'MD')).join(', ');
            parts.push(`CL (${roundText})`);
        }

        leaguesList = parts.join(' + ');

    } else {
        // Date-based competition
        const startDate = competition.startDate.toDate();
        const endDate = competition.endDate.toDate();
        periodText = `${formatDate(startDate)} - ${formatDate(endDate)}`;

        leaguesList = Array.isArray(leagues) && typeof leagues[0] === 'number'
            ? leagues.map(id => leagueNames[id] || `Liga ${id}`).join(', ')
            : 'Alle ligaer';
    }

    card.innerHTML = `
        <div class="competition-header">
            <h3 class="competition-name">${competition.name}</h3>
            ${isCreator ? '<span class="creator-badge">👑 Opprettet av deg</span>' : ''}
        </div>
        <p class="competition-description">${competition.description || 'Ingen beskrivelse'}</p>
        <div class="competition-info">
            <div class="info-item">
                <span class="info-label">📅 Type:</span>
                <span class="info-value">${periodText}</span>
            </div>
            <div class="info-item">
                <span class="info-label">🏆 Ligaer/Runder:</span>
                <span class="info-value">${leaguesList}</span>
            </div>
            <div class="info-item">
                <span class="info-label">👥 Deltakere:</span>
                <span class="info-value">${competition.participants.length} personer</span>
            </div>
        </div>
        <button onclick="viewCompetition('${competition.id}')" class="btn-view-competition">
            Se konkurranse →
        </button>
    `;

    return card;
}

// Format date
function formatDate(date) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('no-NO', options);
}

// Show create competition modal
async function showCreateCompetitionModal() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Du må være innlogget for å opprette en konkurranse');
        return;
    }

    const modal = document.getElementById('createCompetitionModal');
    modal.style.display = 'block';

    // Set default dates (next 7 days)
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    document.getElementById('startDate').valueAsDate = today;
    document.getElementById('endDate').valueAsDate = nextWeek;

    // Reset to all leagues selected
    selectedLeagues = new Set([39, 2]);
    document.querySelectorAll('.comp-league-checkbox').forEach(cb => {
        cb.checked = true;
    });
    document.getElementById('comp-league-all').checked = true;

    // Reset competition type to date-based
    document.querySelector('input[name="competitionType"][value="date"]').checked = true;
    toggleCompetitionType();

    // Fetch available rounds if not already loaded
    if (!availableRounds) {
        await loadAvailableRounds();
    }
}

// Toggle between date-based and round-based competition
function toggleCompetitionType() {
    const type = document.querySelector('input[name="competitionType"]:checked').value;
    const dateSelection = document.getElementById('dateSelection');
    const roundSelection = document.getElementById('roundSelection');
    const leagueSelection = document.getElementById('leagueSelection');

    if (type === 'date') {
        dateSelection.style.display = 'grid';
        roundSelection.style.display = 'none';
        leagueSelection.style.display = 'block';

        // Make date fields required
        document.getElementById('startDate').required = true;
        document.getElementById('endDate').required = true;
    } else {
        dateSelection.style.display = 'none';
        roundSelection.style.display = 'block';
        leagueSelection.style.display = 'none';

        // Remove required from date fields
        document.getElementById('startDate').required = false;
        document.getElementById('endDate').required = false;
    }
}

// Load available rounds from API
async function loadAvailableRounds() {
    try {
        console.log('🔍 Loading available rounds...');
        availableRounds = await footballApi.fetchAvailableRounds();

        // Populate Premier League rounds
        const plContainer = document.getElementById('plRoundsContainer');
        if (availableRounds.premierLeague.length > 0) {
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'round-checkbox-group';

            availableRounds.premierLeague.forEach(round => {
                const item = document.createElement('div');
                item.className = 'round-checkbox-item';
                item.innerHTML = `
                    <input type="checkbox" id="pl-round-${round.value}" value="${round.value}" onchange="updateSelectedRounds('pl')">
                    <label for="pl-round-${round.value}">${round.label}</label>
                `;
                checkboxGroup.appendChild(item);
            });

            plContainer.innerHTML = '';
            plContainer.appendChild(checkboxGroup);
        } else {
            plContainer.innerHTML = '<div class="loading-rounds">Ingen runder funnet</div>';
        }

        // Populate Champions League rounds
        const clContainer = document.getElementById('clRoundsContainer');
        if (availableRounds.championsLeague.length > 0) {
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'round-checkbox-group';

            availableRounds.championsLeague.forEach(round => {
                const item = document.createElement('div');
                item.className = 'round-checkbox-item';
                item.innerHTML = `
                    <input type="checkbox" id="cl-round-${round.value.replace(/\s+/g, '-')}" value="${round.value}" onchange="updateSelectedRounds('cl')">
                    <label for="cl-round-${round.value.replace(/\s+/g, '-')}">${round.label}</label>
                `;
                checkboxGroup.appendChild(item);
            });

            clContainer.innerHTML = '';
            clContainer.appendChild(checkboxGroup);
        } else {
            clContainer.innerHTML = '<div class="loading-rounds">Ingen runder funnet</div>';
        }

        console.log('✅ Rounds loaded');
    } catch (error) {
        console.error('Failed to load rounds:', error);
    }
}

// Toggle round league visibility
function toggleRoundLeague(league) {
    const checkbox = document.getElementById(league === 'pl' ? 'includePL' : 'includeCL');
    const container = document.getElementById(league === 'pl' ? 'plRoundsContainer' : 'clRoundsContainer');

    if (checkbox.checked) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        // Uncheck all rounds in this league
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateSelectedRounds(league);
    }
}

// Update selected rounds
function updateSelectedRounds(league) {
    if (league === 'pl') {
        selectedPLRounds.clear();
        document.querySelectorAll('#plRoundsContainer input[type="checkbox"]:checked').forEach(cb => {
            selectedPLRounds.add(parseInt(cb.value));
        });
        console.log('Selected PL rounds:', Array.from(selectedPLRounds));
    } else {
        selectedCLRounds.clear();
        document.querySelectorAll('#clRoundsContainer input[type="checkbox"]:checked').forEach(cb => {
            selectedCLRounds.add(cb.value);
        });
        console.log('Selected CL rounds:', Array.from(selectedCLRounds));
    }
}

// Close create competition modal
function closeCreateCompetitionModal() {
    const modal = document.getElementById('createCompetitionModal');
    modal.style.display = 'none';
    document.getElementById('createCompetitionForm').reset();
}

// Toggle all leagues checkbox
function toggleAllCompLeagues(checkbox) {
    const leagueCheckboxes = document.querySelectorAll('.comp-league-checkbox');
    leagueCheckboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateCompLeagues();
}

// Update selected leagues
function updateCompLeagues() {
    const leagueCheckboxes = document.querySelectorAll('.comp-league-checkbox');
    const allCheckbox = document.getElementById('comp-league-all');
    const plRoundSelection = document.getElementById('plRoundSelection');

    selectedLeagues.clear();
    let allChecked = true;
    let plSelected = false;

    leagueCheckboxes.forEach(cb => {
        if (cb.checked) {
            const leagueId = parseInt(cb.id.replace('comp-league-', ''));
            selectedLeagues.add(leagueId);
            if (leagueId === 39) {
                plSelected = true;
            }
        } else {
            allChecked = false;
        }
    });

    // Update "All" checkbox state
    allCheckbox.checked = allChecked;

    // Show/hide Premier League round selection
    if (plRoundSelection) {
        plRoundSelection.style.display = plSelected ? 'block' : 'none';
    }

    console.log('Selected leagues:', Array.from(selectedLeagues));
}

// Create competition form submission
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createCompetitionForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createCompetition();
        });
    }
});

// Create competition
async function createCompetition() {
    const errorDiv = document.getElementById('createCompetitionError');
    errorDiv.style.display = 'none';

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Du må være innlogget');
        }

        const name = document.getElementById('competitionName').value.trim();
        const description = document.getElementById('competitionDescription').value.trim();
        const competitionType = document.querySelector('input[name="competitionType"]:checked').value;

        // Validation
        if (!name) {
            throw new Error('Navn på konkurranse er påkrevd');
        }

        let competitionData = {
            name,
            description,
            creatorId: user.uid,
            creatorName: user.displayName || user.email,
            participants: [user.uid], // Creator automatically joins
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            competitionType: competitionType // 'date' or 'round'
        };

        if (competitionType === 'date') {
            // Date-based competition
            const startDate = new Date(document.getElementById('startDate').value);
            const endDate = new Date(document.getElementById('endDate').value);

            if (!startDate || !endDate) {
                throw new Error('Startdato og sluttdato er påkrevd');
            }

            if (endDate < startDate) {
                throw new Error('Sluttdato kan ikke være før startdato');
            }

            if (selectedLeagues.size === 0) {
                throw new Error('Du må velge minst én liga');
            }

            competitionData.leagues = Array.from(selectedLeagues);
            competitionData.startDate = firebase.firestore.Timestamp.fromDate(startDate);
            competitionData.endDate = firebase.firestore.Timestamp.fromDate(endDate);

        } else {
            // Round-based competition
            if (selectedPLRounds.size === 0 && selectedCLRounds.size === 0) {
                throw new Error('Du må velge minst én runde');
            }

            const leagues = [];
            const rounds = {};

            if (selectedPLRounds.size > 0) {
                leagues.push(39); // Premier League
                rounds.premierLeague = Array.from(selectedPLRounds).sort((a, b) => a - b);
            }

            if (selectedCLRounds.size > 0) {
                leagues.push(2); // Champions League
                rounds.championsLeague = Array.from(selectedCLRounds);
            }

            competitionData.leagues = leagues;
            competitionData.selectedRounds = rounds;

            // For round-based, we don't set start/end dates initially
            // They will be determined by the actual match dates
        }

        const db = firebase.firestore();
        const docRef = await db.collection('competitions').add(competitionData);
        console.log('✅ Competition created:', docRef.id);

        // Create participant entry for creator
        await db.collection('competitionParticipants').doc(`${docRef.id}_${user.uid}`).set({
            competitionId: docRef.id,
            userId: user.uid,
            userName: user.email,
            totalPoints: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeCreateCompetitionModal();
        loadCompetitions();

        alert('Konkurranse opprettet! Del linken med venner så de kan bli med.');

    } catch (error) {
        console.error('Failed to create competition:', error);
        errorDiv.textContent = error.message || 'Kunne ikke opprette konkurranse';
        errorDiv.style.display = 'block';
    }
}

// View competition details
function viewCompetition(competitionId) {
    window.location.href = `competition-detail.html?id=${competitionId}`;
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('createCompetitionModal');
    if (event.target === modal) {
        closeCreateCompetitionModal();
    }
};

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    init();
});
