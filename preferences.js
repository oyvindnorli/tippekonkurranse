// Preferences Management
let preferencesUser = null;

// Available leagues from API-Football (organized by country)
const AVAILABLE_LEAGUES = [
    // 🌍 INTERNATIONAL
    { id: 1, name: 'World Cup', country: '🌍 Internasjonalt', icon: '🌍' },
    { id: 4, name: 'Euro Championship', country: '🌍 Internasjonalt', icon: '🇪🇺' },
    { id: 9, name: 'Copa America', country: '🌍 Internasjonalt', icon: '🌎' },
    { id: 15, name: 'FIFA Club World Cup', country: '🌍 Internasjonalt', icon: '🌍' },
    { id: 2, name: 'Champions League', country: '🌍 Internasjonalt', icon: '⭐' },
    { id: 3, name: 'Europa League', country: '🌍 Internasjonalt', icon: '🇪🇺' },
    { id: 848, name: 'Conference League', country: '🌍 Internasjonalt', icon: '🇪🇺' },
    { id: 960, name: 'UEFA Nations League', country: '🌍 Internasjonalt', icon: '🇪🇺' },
    { id: 531, name: 'UEFA Super Cup', country: '🌍 Internasjonalt', icon: '🏆' },

    // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND
    { id: 39, name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '⚽' },
    { id: 40, name: 'Championship', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '⚽' },
    { id: 41, name: 'League One', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '⚽' },
    { id: 42, name: 'League Two', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '⚽' },
    { id: 45, name: 'FA Cup', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '🏆' },
    { id: 48, name: 'League Cup (EFL Cup)', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '🏆' },
    { id: 46, name: 'FA Community Shield', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', icon: '🏆' },

    // 🇪🇸 SPANIA
    { id: 140, name: 'La Liga', country: '🇪🇸 Spania', icon: '⚽' },
    { id: 141, name: 'La Liga 2', country: '🇪🇸 Spania', icon: '⚽' },
    { id: 143, name: 'Copa del Rey', country: '🇪🇸 Spania', icon: '🏆' },
    { id: 556, name: 'Super Cup', country: '🇪🇸 Spania', icon: '🏆' },

    // 🇩🇪 TYSKLAND
    { id: 78, name: 'Bundesliga', country: '🇩🇪 Tyskland', icon: '⚽' },
    { id: 79, name: '2. Bundesliga', country: '🇩🇪 Tyskland', icon: '⚽' },
    { id: 80, name: '3. Liga', country: '🇩🇪 Tyskland', icon: '⚽' },
    { id: 81, name: 'DFB Pokal', country: '🇩🇪 Tyskland', icon: '🏆' },
    { id: 529, name: 'Super Cup', country: '🇩🇪 Tyskland', icon: '🏆' },

    // 🇮🇹 ITALIA
    { id: 135, name: 'Serie A', country: '🇮🇹 Italia', icon: '⚽' },
    { id: 136, name: 'Serie B', country: '🇮🇹 Italia', icon: '⚽' },
    { id: 137, name: 'Coppa Italia', country: '🇮🇹 Italia', icon: '🏆' },
    { id: 547, name: 'Super Cup', country: '🇮🇹 Italia', icon: '🏆' },

    // 🇫🇷 FRANKRIKE
    { id: 61, name: 'Ligue 1', country: '🇫🇷 Frankrike', icon: '⚽' },
    { id: 62, name: 'Ligue 2', country: '🇫🇷 Frankrike', icon: '⚽' },
    { id: 66, name: 'National', country: '🇫🇷 Frankrike', icon: '⚽' },
    { id: 65, name: 'Coupe de France', country: '🇫🇷 Frankrike', icon: '🏆' },
    { id: 526, name: 'Coupe de la Ligue', country: '🇫🇷 Frankrike', icon: '🏆' },
    { id: 527, name: 'Trophée des Champions', country: '🇫🇷 Frankrike', icon: '🏆' },

    // 🇳🇱 NEDERLAND
    { id: 88, name: 'Eredivisie', country: '🇳🇱 Nederland', icon: '⚽' },
    { id: 89, name: 'Eerste Divisie', country: '🇳🇱 Nederland', icon: '⚽' },
    { id: 90, name: 'KNVB Beker', country: '🇳🇱 Nederland', icon: '🏆' },

    // 🇵🇹 PORTUGAL
    { id: 94, name: 'Primeira Liga', country: '🇵🇹 Portugal', icon: '⚽' },
    { id: 95, name: 'Segunda Liga', country: '🇵🇹 Portugal', icon: '⚽' },
    { id: 96, name: 'Taça de Portugal', country: '🇵🇹 Portugal', icon: '🏆' },
    { id: 550, name: 'Super Cup', country: '🇵🇹 Portugal', icon: '🏆' },

    // 🇧🇪 BELGIA
    { id: 144, name: 'Jupiler Pro League', country: '🇧🇪 Belgia', icon: '⚽' },
    { id: 145, name: 'Challenger Pro League', country: '🇧🇪 Belgia', icon: '⚽' },

    // 🇹🇷 TYRKIA
    { id: 203, name: 'Süper Lig', country: '🇹🇷 Tyrkia', icon: '⚽' },
    { id: 204, name: '1. Lig', country: '🇹🇷 Tyrkia', icon: '⚽' },
    { id: 206, name: 'Turkish Cup', country: '🇹🇷 Tyrkia', icon: '🏆' },

    // 🇬🇷 HELLAS
    { id: 197, name: 'Super League', country: '🇬🇷 Hellas', icon: '⚽' },
    { id: 198, name: 'Super League 2', country: '🇬🇷 Hellas', icon: '⚽' },

    // 🇷🇺 RUSSLAND
    { id: 235, name: 'Premier League', country: '🇷🇺 Russland', icon: '⚽' },
    { id: 236, name: 'FNL', country: '🇷🇺 Russland', icon: '⚽' },

    // 🇺🇦 UKRAINA
    { id: 333, name: 'Premier League', country: '🇺🇦 Ukraina', icon: '⚽' },

    // 🇦🇹 ØSTERRIKE
    { id: 218, name: 'Bundesliga', country: '🇦🇹 Østerrike', icon: '⚽' },

    // 🇨🇭 SVEITS
    { id: 207, name: 'Super League', country: '🇨🇭 Sveits', icon: '⚽' },
    { id: 208, name: 'Challenge League', country: '🇨🇭 Sveits', icon: '⚽' },

    // 🇸🇪 SVERIGE
    { id: 113, name: 'Allsvenskan', country: '🇸🇪 Sverige', icon: '⚽' },
    { id: 114, name: 'Superettan', country: '🇸🇪 Sverige', icon: '⚽' },

    // 🇳🇴 NORGE
    { id: 103, name: 'Eliteserien', country: '🇳🇴 Norge', icon: '⚽' },
    { id: 104, name: 'OBOS-ligaen', country: '🇳🇴 Norge', icon: '⚽' },
    { id: 105, name: 'NM Cupen', country: '🇳🇴 Norge', icon: '🏆' },

    // 🇩🇰 DANMARK
    { id: 119, name: 'Superliga', country: '🇩🇰 Danmark', icon: '⚽' },
    { id: 120, name: '1. Division', country: '🇩🇰 Danmark', icon: '⚽' },

    // 🇫🇮 FINLAND
    { id: 244, name: 'Veikkausliiga', country: '🇫🇮 Finland', icon: '⚽' },

    // 🇵🇱 POLEN
    { id: 106, name: 'Ekstraklasa', country: '🇵🇱 Polen', icon: '⚽' },

    // 🇨🇿 TSJEKKIA
    { id: 345, name: 'Czech Liga', country: '🇨🇿 Tsjekkia', icon: '⚽' },

    // 🇭🇺 UNGARN
    { id: 271, name: 'NB I', country: '🇭🇺 Ungarn', icon: '⚽' },

    // 🇷🇴 ROMANIA
    { id: 283, name: 'Liga I', country: '🇷🇴 Romania', icon: '⚽' },

    // 🇧🇬 BULGARIA
    { id: 172, name: 'First League', country: '🇧🇬 Bulgaria', icon: '⚽' },

    // 🇷🇸 SERBIA
    { id: 289, name: 'SuperLiga', country: '🇷🇸 Serbia', icon: '⚽' },

    // 🇭🇷 KROATIA
    { id: 210, name: '1. HNL', country: '🇭🇷 Kroatia', icon: '⚽' },

    // 🏴󠁧󠁢󠁳󠁣󠁴󠁿 SKOTTLAND
    { id: 179, name: 'Premiership', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Skottland', icon: '⚽' },
    { id: 180, name: 'Championship', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Skottland', icon: '⚽' },

    // 🇮🇪 IRLAND
    { id: 357, name: 'Premier Division', country: '🇮🇪 Irland', icon: '⚽' },

    // 🇺🇸 USA
    { id: 253, name: 'MLS', country: '🇺🇸 USA', icon: '⚽' },
    { id: 254, name: 'USL Championship', country: '🇺🇸 USA', icon: '⚽' },

    // 🇲🇽 MEXICO
    { id: 262, name: 'Liga MX', country: '🇲🇽 Mexico', icon: '⚽' },
    { id: 263, name: 'Liga de Expansión MX', country: '🇲🇽 Mexico', icon: '⚽' },

    // 🇧🇷 BRASIL
    { id: 71, name: 'Série A', country: '🇧🇷 Brasil', icon: '⚽' },
    { id: 72, name: 'Série B', country: '🇧🇷 Brasil', icon: '⚽' },
    { id: 73, name: 'Copa do Brasil', country: '🇧🇷 Brasil', icon: '🏆' },

    // 🇦🇷 ARGENTINA
    { id: 128, name: 'Liga Profesional', country: '🇦🇷 Argentina', icon: '⚽' },
    { id: 129, name: 'Copa Argentina', country: '🇦🇷 Argentina', icon: '🏆' },

    // 🇨🇱 CHILE
    { id: 265, name: 'Primera División', country: '🇨🇱 Chile', icon: '⚽' },

    // 🇨🇴 COLOMBIA
    { id: 239, name: 'Primera A', country: '🇨🇴 Colombia', icon: '⚽' },

    // 🌎 SØR-AMERIKA
    { id: 13, name: 'Copa Libertadores', country: '🌎 Sør-Amerika', icon: '🏆' },
    { id: 11, name: 'Copa Sudamericana', country: '🌎 Sør-Amerika', icon: '🏆' },

    // 🇯🇵 JAPAN
    { id: 98, name: 'J1 League', country: '🇯🇵 Japan', icon: '⚽' },
    { id: 99, name: 'J2 League', country: '🇯🇵 Japan', icon: '⚽' },

    // 🇰🇷 SØR-KOREA
    { id: 292, name: 'K League 1', country: '🇰🇷 Sør-Korea', icon: '⚽' },

    // 🇨🇳 KINA
    { id: 17, name: 'Super League', country: '🇨🇳 Kina', icon: '⚽' },

    // 🇦🇺 AUSTRALIA
    { id: 188, name: 'A-League', country: '🇦🇺 Australia', icon: '⚽' },

    // 🇸🇦 SAUDI-ARABIA
    { id: 307, name: 'Pro League', country: '🇸🇦 Saudi-Arabia', icon: '⚽' },

    // 🇦🇪 UAE
    { id: 301, name: 'Pro League', country: '🇦🇪 UAE', icon: '⚽' },

    // 🇶🇦 QATAR
    { id: 305, name: 'Stars League', country: '🇶🇦 Qatar', icon: '⚽' },

    // 🇪🇬 EGYPT
    { id: 233, name: 'Premier League', country: '🇪🇬 Egypt', icon: '⚽' },

    // 🇿🇦 SØR-AFRIKA
    { id: 288, name: 'Premier Division', country: '🇿🇦 Sør-Afrika', icon: '⚽' },

    // 🌍 AFRIKA
    { id: 12, name: 'CAF Champions League', country: '🌍 Afrika', icon: '🏆' },
    { id: 14, name: 'CAF Confederation Cup', country: '🌍 Afrika', icon: '🏆' }
];

// Default leagues (Premier League and Champions League)
const DEFAULT_LEAGUES = [39, 2];

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
