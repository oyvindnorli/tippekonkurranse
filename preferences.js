// Preferences Management
let preferencesUser = null;

// Available leagues - Premier League, Champions League and EFL Cup
const AVAILABLE_LEAGUES = [
    { id: 2, name: 'Champions League', country: '🌍 UEFA', icon: '⭐' },
    { id: 39, name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '⚽' },
    { id: 48, name: 'EFL Cup', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '🏆' }
];

// Default leagues (Premier League, Champions League and EFL Cup)
const DEFAULT_LEAGUES = [39, 2, 48];

// Initialize
function init() {
    // Initialize Firebase first
    initializeFirebase();

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            preferencesUser = user;
            document.getElementById('mainContent').style.display = 'block';
            document.getElementById('authRequired').style.display = 'none';
            document.getElementById('mainNavButtons').style.display = 'flex';

            // Get user data
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();

            if (userData && userData.username) {
                document.getElementById('currentUsername').textContent = userData.username;
                document.getElementById('usernameDisplay').style.display = 'inline';
                document.getElementById('signOutBtn').style.display = 'inline-block';
            }

            // Load preferences
            loadPreferences();
        } else {
            preferencesUser = null;
            document.getElementById('mainContent').style.display = 'none';
            document.getElementById('authRequired').style.display = 'flex';
            document.getElementById('mainNavButtons').style.display = 'none';
        }
    });
}

// Load user preferences
async function loadPreferences() {
    try {
        document.getElementById('leaguesLoading').style.display = 'block';
        document.getElementById('leaguesContainer').style.display = 'none';

        const db = firebase.firestore();
        const prefsDoc = await db.collection('userPreferences').doc(preferencesUser.uid).get();

        let selectedLeagues = DEFAULT_LEAGUES;
        if (prefsDoc.exists && prefsDoc.data().leagues) {
            selectedLeagues = prefsDoc.data().leagues;
        }

        renderLeagues(selectedLeagues);

        document.getElementById('leaguesLoading').style.display = 'none';
        document.getElementById('leaguesContainer').style.display = 'grid';

    } catch (error) {
        console.error('Failed to load preferences:', error);
        document.getElementById('leaguesLoading').innerHTML =
            '<div class="error-message">❌ Kunne ikke laste innstillinger</div>';
    }
}

// Render leagues checkboxes
function renderLeagues(selectedLeagues) {
    const container = document.getElementById('leaguesContainer');
    container.innerHTML = '';

    AVAILABLE_LEAGUES.forEach(league => {
        const isSelected = selectedLeagues.includes(league.id);

        const leagueCard = document.createElement('div');
        leagueCard.className = 'league-card';
        if (isSelected) {
            leagueCard.classList.add('selected');
        }

        leagueCard.innerHTML = `
            <input
                type="checkbox"
                id="league-${league.id}"
                value="${league.id}"
                ${isSelected ? 'checked' : ''}
                onchange="toggleLeagueCard(this)"
            >
            <label for="league-${league.id}">
                <span class="league-icon">${league.icon}</span>
                <div class="league-info">
                    <div class="league-name">${league.name}</div>
                    <div class="league-country">${league.country}</div>
                </div>
                <span class="league-checkmark">✓</span>
            </label>
        `;

        container.appendChild(leagueCard);
    });
}

// Toggle league card selection
function toggleLeagueCard(checkbox) {
    const card = checkbox.closest('.league-card');
    if (checkbox.checked) {
        card.classList.add('selected');
    } else {
        card.classList.remove('selected');
    }
}

// Save preferences
async function savePreferences() {
    try {
        const checkboxes = document.querySelectorAll('#leaguesContainer input[type="checkbox"]');
        const selectedLeagues = [];

        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedLeagues.push(parseInt(cb.value));
            }
        });

        if (selectedLeagues.length === 0) {
            showSaveMessage('⚠️ Du må velge minst én liga', 'warning');
            return;
        }

        const db = firebase.firestore();
        await db.collection('userPreferences').doc(preferencesUser.uid).set({
            leagues: selectedLeagues,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showSaveMessage('✅ Innstillinger lagret!', 'success');

    } catch (error) {
        console.error('Failed to save preferences:', error);
        showSaveMessage('❌ Kunne ikke lagre innstillinger', 'error');
    }
}

// Show save message
function showSaveMessage(message, type) {
    const messageEl = document.getElementById('saveMessage');
    messageEl.textContent = message;
    messageEl.className = `save-message ${type}`;
    messageEl.style.display = 'block';

    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

// Select all leagues
function selectAllLeagues() {
    const checkboxes = document.querySelectorAll('#leaguesContainer input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
        toggleLeagueCard(cb);
    });
}

// Deselect all leagues
function deselectAllLeagues() {
    const checkboxes = document.querySelectorAll('#leaguesContainer input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        toggleLeagueCard(cb);
    });
}

// Sign out function
function signOut() {
    firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
