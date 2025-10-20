// Competitions functionality
let selectedLeagues = new Set([39, 2, 140, 78, 135]); // Default: all leagues

// Initialize page
function init() {
    // Initialize Firebase
    initializeFirebase();

    // Wait for auth state to be ready
    firebase.auth().onAuthStateChanged((user) => {
        const usernameElement = document.getElementById('currentUsername');
        const authSection = document.getElementById('authSection');
        const signOutBtn = document.getElementById('signOutBtn');

        if (user) {
            // Fetch displayName from Firestore users collection
            const db = firebase.firestore();
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    usernameElement.textContent = doc.data().displayName || user.email;
                } else {
                    usernameElement.textContent = user.email;
                }
                // Show user section with fade-in
                const currentUserDiv = usernameElement.closest('.current-user');
                if (currentUserDiv) {
                    currentUserDiv.classList.add('loaded');
                }
            }).catch(error => {
                console.warn('Could not fetch displayName:', error);
                usernameElement.textContent = user.email;
                // Show user section even on error
                const currentUserDiv = usernameElement.closest('.current-user');
                if (currentUserDiv) {
                    currentUserDiv.classList.add('loaded');
                }
            });

            authSection.style.display = 'none';
            signOutBtn.style.display = 'inline-block';
            loadCompetitions();
        } else {
            usernameElement.textContent = 'Ikke innlogget';
            authSection.style.display = 'block';
            signOutBtn.style.display = 'none';
            // Show user section with fade-in even when logged out
            const currentUserDiv = usernameElement.closest('.current-user');
            if (currentUserDiv) {
                currentUserDiv.classList.add('loaded');
            }
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

        // Categorize competitions
        const now = new Date();
        const active = competitions.filter(c => {
            const start = c.startDate.toDate();
            const end = c.endDate.toDate();
            return start <= now && now <= end;
        });
        const upcoming = competitions.filter(c => c.startDate.toDate() > now);
        const completed = competitions.filter(c => c.endDate.toDate() < now);

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

    const startDate = competition.startDate.toDate();
    const endDate = competition.endDate.toDate();
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
    const leaguesList = Array.isArray(leagues) && typeof leagues[0] === 'number'
        ? leagues.map(id => leagueNames[id] || `Liga ${id}`).join(', ')
        : 'Alle ligaer';

    card.innerHTML = `
        <div class="competition-header">
            <h3 class="competition-name">${competition.name}</h3>
            ${isCreator ? '<span class="creator-badge">👑 Opprettet av deg</span>' : ''}
        </div>
        <p class="competition-description">${competition.description || 'Ingen beskrivelse'}</p>
        <div class="competition-info">
            <div class="info-item">
                <span class="info-label">📅 Periode:</span>
                <span class="info-value">${formatDate(startDate)} - ${formatDate(endDate)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">🏆 Ligaer:</span>
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
function showCreateCompetitionModal() {
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
    selectedLeagues = new Set([39, 2, 140, 78, 135]);
    document.querySelectorAll('.comp-league-checkbox').forEach(cb => {
        cb.checked = true;
    });
    document.getElementById('comp-league-all').checked = true;
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

    selectedLeagues.clear();
    let allChecked = true;

    leagueCheckboxes.forEach(cb => {
        if (cb.checked) {
            const leagueId = parseInt(cb.id.replace('comp-league-', ''));
            selectedLeagues.add(leagueId);
        } else {
            allChecked = false;
        }
    });

    // Update "All" checkbox state
    allCheckbox.checked = allChecked;

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
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);

        // Set time to start of day for startDate (00:00)
        startDate.setHours(0, 0, 0, 0);

        // Set time to end of day for endDate (23:59:59)
        endDate.setHours(23, 59, 59, 999);

        // Validation
        if (!name) {
            throw new Error('Navn på konkurranse er påkrevd');
        }

        if (selectedLeagues.size === 0) {
            throw new Error('Du må velge minst én liga');
        }

        if (endDate < startDate) {
            throw new Error('Sluttdato kan ikke være før startdato');
        }

        // Create competition document
        const competitionData = {
            name,
            description,
            creatorId: user.uid,
            creatorName: user.displayName || user.email,
            leagues: Array.from(selectedLeagues), // Store league IDs instead of match IDs
            participants: [user.uid], // Creator automatically joins
            startDate: firebase.firestore.Timestamp.fromDate(startDate),
            endDate: firebase.firestore.Timestamp.fromDate(endDate),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

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
