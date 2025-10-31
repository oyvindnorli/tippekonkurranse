// Import utility modules
import { LEAGUE_NAMES, getLeagueName } from './js/utils/leagueConfig.js';
import { calculatePoints, getOutcome, formatMatchTime, sortMatchesByDate } from './js/utils/matchUtils.js';
import { formatDateRange, getDateLabel, groupMatchesByDate, toISODate, getStartOfDay, getEndOfDay } from './js/utils/dateUtils.js';

// Match data - will be loaded from API or mock data
let matches = [];
let allMatches = []; // Store all matches for filtering
let leagueFilteredMatches = []; // Matches after league filter, before date filter

// User's tips - loaded from Firebase
let userTips = [];

// Date navigation
let selectedDate = null; // null = show all dates, otherwise show only this date

// Active league filter - tracks which leagues are currently visible
let activeLeagueFilter = new Set(); // Empty = show all from preferences

// Load league preferences from Firestore (user preferences)
async function loadSelectedLeagues(userId) {
    try {
        if (!userId) {
            console.log('⚠️ No user logged in, using default leagues');
            return new Set([39, 2, 48, 135]); // Default: Premier League, Champions League, EFL Cup, Serie A
        }

        const db = firebase.firestore();
        const prefsDoc = await db.collection('userPreferences').doc(userId).get();

        if (prefsDoc.exists && prefsDoc.data().leagues) {
            const leagueArray = prefsDoc.data().leagues;

            // Only allow Premier League (39), Champions League (2), EFL Cup (48), and Serie A (135)
            const validLeagues = [39, 2, 48, 135];
            const defaultLeagues = [39, 2, 48, 135];
            const filteredLeagues = leagueArray.filter(id => validLeagues.includes(id));

            // Check if user is missing any default leagues or has invalid leagues
            const hasAllDefaultLeagues = defaultLeagues.every(id => leagueArray.includes(id));
            const needsMigration = filteredLeagues.length !== leagueArray.length ||
                                   filteredLeagues.length === 0 ||
                                   !hasAllDefaultLeagues;

            if (needsMigration) {
                console.log('🔄 Migrating league preferences to include all default leagues (PL + CL + EFL + Serie A)');

                // Save corrected preferences back to Firestore
                await db.collection('userPreferences').doc(userId).set({
                    leagues: defaultLeagues,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                return new Set(defaultLeagues);
            }

            return new Set(filteredLeagues.length > 0 ? filteredLeagues : defaultLeagues);
        } else {
            console.log('📂 No preferences found, using defaults');
            return new Set([39, 2, 48, 135]); // Default: Premier League, Champions League, EFL Cup, Serie A
        }
    } catch (error) {
        console.warn('⚠️ Could not load league preferences:', error);
        return new Set([39, 2, 48, 135]); // Default on error
    }
}

// Save league preferences to Firestore
async function saveSelectedLeagues() {
    try {
        if (!currentUser) {
            console.log('⚠️ No user logged in, cannot save preferences');
            return;
        }

        const leagueArray = Array.from(selectedLeagues);
        const db = firebase.firestore();

        await db.collection('userPreferences').doc(currentUser.uid).set({
            leagues: leagueArray,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('💾 Saved league preferences to Firestore:', leagueArray);

        // Also update API_CONFIG.LEAGUES for immediate effect
        API_CONFIG.LEAGUES = leagueArray;
    } catch (error) {
        console.warn('⚠️ Could not save league preferences:', error);
    }
}

// Selected leagues for filtering (will be updated when user logs in)
let selectedLeagues = new Set([39, 2, 48, 135]); // Default: Premier League, Champions League, EFL Cup, Serie A

// Load user tips from Firebase
async function loadUserTips() {
    userTips = await getCurrentUserTips();
}

// UI Functions for Auth Modal
function showAuthModal(type) {
    document.getElementById('authModal').style.display = 'block';

    // Hide all forms first
    document.getElementById('signinForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';

    // Show the requested form
    if (type === 'signin') {
        document.getElementById('signinForm').style.display = 'block';
    } else if (type === 'signup') {
        document.getElementById('signupForm').style.display = 'block';
    } else if (type === 'reset') {
        document.getElementById('resetForm').style.display = 'block';
    }
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

async function handleSignIn() {
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;

    const result = await signIn(email, password);
    if (!result.success) {
        alert('Innlogging feilet: ' + result.error);
    }
}

async function handleSignUp() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!name || !email || !password) {
        alert('Vennligst fyll ut alle feltene');
        return;
    }

    const result = await signUp(email, password, name);
    if (!result.success) {
        alert('Registrering feilet: ' + result.error);
    }
}

async function handleResetPassword() {
    const email = document.getElementById('resetEmail').value;

    if (!email) {
        alert('Vennligst fyll inn e-postadressen din');
        return;
    }

    // Check if resetPassword function exists
    if (typeof resetPassword === 'undefined') {
        console.error('resetPassword function not found!');
        alert('Teknisk feil: Kunne ikke laste tilbakestillingsfunksjonen. Prøv å refresh siden.');
        return;
    }

    const result = await resetPassword(email);
    if (result.success) {
        alert('En e-post med tilbakestillingslenke er sendt til ' + email + '. Sjekk innboksen din!');
        closeAuthModal();
    } else {
        alert('Kunne ikke sende tilbakestillingslenke: ' + result.error);
    }
}

// Mock leaderboard data - REMOVED
const mockPlayers = [
    {
        name: "Ole",
        tips: [
            { matchId: 1, homeScore: 2, awayScore: 1 },
            { matchId: 2, homeScore: 2, awayScore: 1 },
            { matchId: 3, homeScore: 3, awayScore: 1 },
            { matchId: 4, homeScore: 1, awayScore: 1 },
            { matchId: 5, homeScore: 2, awayScore: 2 }
        ]
    },
    {
        name: "Kari",
        tips: [
            { matchId: 1, homeScore: 1, awayScore: 2 },
            { matchId: 2, homeScore: 1, awayScore: 1 },
            { matchId: 3, homeScore: 3, awayScore: 0 },
            { matchId: 4, homeScore: 2, awayScore: 1 },
            { matchId: 5, homeScore: 1, awayScore: 1 }
        ]
    },
    {
        name: "Per",
        tips: [
            { matchId: 1, homeScore: 3, awayScore: 1 },
            { matchId: 2, homeScore: 0, awayScore: 0 },
            { matchId: 3, homeScore: 2, awayScore: 1 },
            { matchId: 4, homeScore: 1, awayScore: 2 },
            { matchId: 5, homeScore: 2, awayScore: 0 }
        ]
    },
    {
        name: "Lise",
        tips: [
            { matchId: 1, homeScore: 2, awayScore: 0 },
            { matchId: 2, homeScore: 2, awayScore: 2 },
            { matchId: 3, homeScore: 3, awayScore: 0 },
            { matchId: 4, homeScore: 0, awayScore: 2 },
            { matchId: 5, homeScore: 1, awayScore: 2 }
        ]
    },
    {
        name: "Thomas",
        tips: [
            { matchId: 1, homeScore: 1, awayScore: 1 },
            { matchId: 2, homeScore: 1, awayScore: 1 },
            { matchId: 3, homeScore: 4, awayScore: 0 },
            { matchId: 4, homeScore: 2, awayScore: 2 },
            { matchId: 5, homeScore: 3, awayScore: 1 }
        ]
    }
];

// Calculate total score for a player
function calculatePlayerScore(tips) {
    let totalScore = 0;
    tips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        if (!match) return;

        // Skip if odds are missing
        if (!tip.odds && !match.odds) {
            console.warn(`Skipping points calculation for match without odds: ${match.homeTeam} vs ${match.awayTeam}`);
            return;
        }

        // Add odds to tip if missing (for mock players)
        const tipWithOdds = {
            ...tip,
            odds: tip.odds || match.odds
        };

        totalScore += calculatePoints(tipWithOdds, match);
    });
    return totalScore;
}

// Leaderboard is now on separate page (leaderboard.html)
// League selection is now done via preferences page

// Apply league filter to matches
function applyLeagueFilter() {
    // Get league name from league ID mapping (comprehensive list)
    const leagueNames = {
        1: 'World Cup',
        4: 'Euro Championship',
        9: 'Copa America',
        15: 'FIFA Club World Cup',
        2: 'Champions League',
        3: 'Europa League',
        848: 'Conference League',
        960: 'UEFA Nations League',
        531: 'UEFA Super Cup',
        39: 'Premier League',
        40: 'Championship',
        41: 'League One',
        42: 'League Two',
        45: 'FA Cup',
        48: 'League Cup',
        46: 'FA Community Shield',
        140: 'La Liga',
        141: 'La Liga 2',
        143: 'Copa del Rey',
        556: 'Super Cup',
        78: 'Bundesliga',
        79: '2. Bundesliga',
        80: '3. Liga',
        81: 'DFB Pokal',
        529: 'Super Cup',
        135: 'Serie A',
        136: 'Serie B',
        137: 'Coppa Italia',
        547: 'Super Cup',
        61: 'Ligue 1',
        62: 'Ligue 2',
        66: 'National',
        65: 'Coupe de France',
        526: 'Coupe de la Ligue',
        527: 'Trophée des Champions',
        88: 'Eredivisie',
        89: 'Eerste Divisie',
        90: 'KNVB Beker',
        94: 'Primeira Liga',
        95: 'Segunda Liga',
        96: 'Taça de Portugal',
        550: 'Super Cup',
        144: 'Jupiler Pro League',
        145: 'Challenger Pro League',
        203: 'Süper Lig',
        204: '1. Lig',
        206: 'Turkish Cup',
        197: 'Super League',
        198: 'Super League 2',
        235: 'Premier League',
        236: 'FNL',
        333: 'Premier League',
        218: 'Bundesliga',
        207: 'Super League',
        208: 'Challenge League',
        113: 'Allsvenskan',
        114: 'Superettan',
        103: 'Eliteserien',
        104: 'OBOS-ligaen',
        105: 'NM Cupen',
        119: 'Superliga',
        120: '1. Division',
        244: 'Veikkausliiga',
        106: 'Ekstraklasa',
        345: 'Czech Liga',
        271: 'NB I',
        283: 'Liga I',
        172: 'First League',
        289: 'SuperLiga',
        210: '1. HNL',
        179: 'Premiership',
        180: 'Championship',
        357: 'Premier Division',
        253: 'MLS',
        254: 'USL Championship',
        262: 'Liga MX',
        263: 'Liga de Expansión MX',
        71: 'Série A',
        72: 'Série B',
        73: 'Copa do Brasil',
        128: 'Liga Profesional',
        129: 'Copa Argentina',
        265: 'Primera División',
        239: 'Primera A',
        13: 'Copa Libertadores',
        11: 'Copa Sudamericana',
        98: 'J1 League',
        99: 'J2 League',
        292: 'K League 1',
        17: 'Super League',
        188: 'A-League',
        307: 'Pro League',
        301: 'Pro League',
        305: 'Stars League',
        233: 'Premier League',
        288: 'Premier Division',
        12: 'CAF Champions League',
        14: 'CAF Confederation Cup'
    };

    // Determine which leagues to show based on active filter
    const leaguesToShow = activeLeagueFilter.size > 0 ? activeLeagueFilter : selectedLeagues;

    if (leaguesToShow.size === 0) {
        leagueFilteredMatches = [];
    } else {
        leagueFilteredMatches = allMatches.filter(match => {
            // Check if match league ID matches any active league
            // Support multiple field names: league (new), league_id, leagueId (old)
            const matchLeagueId = (typeof match.league === 'number' ? match.league : null)
                                || match.league_id
                                || match.leagueId;

            // If we have league ID, match directly
            if (matchLeagueId) {
                return leaguesToShow.has(matchLeagueId);
            }

            // Fallback: match by league name (for older data format with string league)
            const matchLeague = typeof match.league === 'string' ? match.league : (match.league?.name || '');
            if (!matchLeague) return false;

            for (const leagueId of leaguesToShow) {
                const leagueName = leagueNames[leagueId];
                if (!leagueName) continue;

                if (matchLeague.includes(leagueName) ||
                    leagueName.includes(matchLeague) ||
                    matchLeague.toLowerCase().includes(leagueName.toLowerCase())) {
                    return true;
                }
            }
            return false;
        });
    }

    // After applying league filter, apply date filter
    applyDateFilter();
}

// Cache matches in localStorage for faster loading
function getCachedMatches() {
    try {
        const cached = localStorage.getItem('cachedMatches');
        const cacheTime = localStorage.getItem('cachedMatchesTime');

        if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            // Cache valid for 5 minutes
            if (age < 5 * 60 * 1000) {
                return JSON.parse(cached);
            }
        }
    } catch (error) {
    }
    return null;
}

function setCachedMatches(matches) {
    try {
        localStorage.setItem('cachedMatches', JSON.stringify(matches));
        localStorage.setItem('cachedMatchesTime', Date.now().toString());
    } catch (error) {
    }
}

// Load matches from API
async function loadMatches() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        // Try to load from cache first for instant display
        const cachedMatches = getCachedMatches();
        if (cachedMatches && cachedMatches.length > 0) {
            allMatches = cachedMatches;

            // Ensure cached matches are sorted by date
            allMatches.sort((a, b) => {
                const dateA = new Date(a.commence_time || a.date || a.timestamp * 1000);
                const dateB = new Date(b.commence_time || b.date || b.timestamp * 1000);
                return dateA - dateB;
            });

            applyLeagueFilter();

            // Load user tips in parallel
            const tipsPromise = currentUser ? loadUserTips() : Promise.resolve();

            // Render immediately with cached data
            renderMatches();

            await tipsPromise;
            updateTotalScore();
        }

        // Fetch fresh data from API (in parallel)
        const [upcomingMatches, completedMatches] = await Promise.all([
            footballApi.getUpcomingFixtures(),
            footballApi.fetchScores().catch(error => {
                return [];
            })
        ]);

        // Deduplicate matches
        const existingIds = new Set(upcomingMatches.map(m => String(m.id)));
        const uniqueCompletedMatches = completedMatches.filter(m => {
            const id = String(m.id);
            if (existingIds.has(id)) {
                return false;
            }
            existingIds.add(id);
            return true;
        });

        // Combine all matches
        allMatches = upcomingMatches.concat(uniqueCompletedMatches);

        // Sort all matches by date (chronological order)
        allMatches.sort((a, b) => {
            const dateA = new Date(a.commence_time || a.date || a.timestamp * 1000);
            const dateB = new Date(b.commence_time || b.date || b.timestamp * 1000);
            return dateA - dateB;
        });

        console.log(`📊 ${upcomingMatches.length} upcoming, ${completedMatches.length} completed`);

        // Cache the fresh data
        setCachedMatches(allMatches);

        // Apply initial filter
        applyLeagueFilter();

        // Load user tips if not already loaded
        if (currentUser && !cachedMatches) {
            await loadUserTips();
        }

        loadingMessage.style.display = 'none';

        // Re-render with fresh data
        renderMatches();
        updateTotalScore();
    } catch (error) {
        console.error('Failed to load matches:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste kamper. Bruker mock-data.';
        errorMessage.style.display = 'block';

        // Fallback to mock data
        allMatches = await footballApi.getMockFixtures();

        // Sort mock data by date too
        allMatches.sort((a, b) => {
            const dateA = new Date(a.commence_time || a.date || a.timestamp * 1000);
            const dateB = new Date(b.commence_time || b.date || b.timestamp * 1000);
            return dateA - dateB;
        });

        applyLeagueFilter();

        // Load user tips first before rendering
        if (currentUser) {
            await loadUserTips();
        }

        renderMatches();
        updateTotalScore();
    }
}

// League checkboxes removed - preferences are now managed via preferences page

// Initialize the app
function init() {
    // Initialize Firebase first
    initializeFirebase();

    // Initialize date navigation
    initDateNavigation();

    // Hide everything until we know auth state (prevent flash of wrong content)
    const welcomeSection = document.getElementById('welcomeSection');
    const mainContent = document.getElementById('mainContent');
    const authSection = document.getElementById('authSection');
    const authLoading = document.getElementById('authLoading');

    if (welcomeSection) welcomeSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';

    // Wait for auth state before loading matches
    firebase.auth().onAuthStateChanged(async (user) => {
        // Hide loading spinner
        if (authLoading) authLoading.style.display = 'none';

        if (user) {
            // User is signed in, load preferences first
            const previousLeagues = API_CONFIG.LEAGUES ? [...API_CONFIG.LEAGUES] : [];
            selectedLeagues = await loadSelectedLeagues(user.uid);

            // Update API_CONFIG.LEAGUES to use user's preferred leagues
            const newLeagues = Array.from(selectedLeagues);

            // Only clear cache if leagues actually changed
            const leaguesChanged = JSON.stringify(previousLeagues.sort()) !== JSON.stringify(newLeagues.sort());
            if (leaguesChanged && footballApi && footballApi.clearCache) {
                console.log('🔄 Leagues changed, clearing cache');
                footballApi.clearCache();
            }

            API_CONFIG.LEAGUES = newLeagues;

            // Show main content, hide welcome
            if (welcomeSection) {
                welcomeSection.style.display = 'none';
            }
            if (mainContent) {
                mainContent.style.display = 'block';
            }

            // Load matches with user's preferred leagues
            loadMatches();
        } else {
            // User is not signed in, show welcome section
            if (welcomeSection) {
                welcomeSection.style.display = 'block';
            }
            if (mainContent) {
                mainContent.style.display = 'none';
            }
            if (authSection) {
                authSection.style.display = 'block';
            }
        }
    });
}

// groupMatchesByDate() is now imported from dateUtils.js

// Render matches list
function renderMatches() {
    const matchesList = document.getElementById('matchesList');
    matchesList.innerHTML = '';

    const groupedMatches = groupMatchesByDate(matches);

    // Show message if no matches
    if (Object.keys(groupedMatches).length === 0) {
        const noMatchesDiv = document.createElement('div');
        noMatchesDiv.className = 'info-message';
        noMatchesDiv.innerHTML = `
            <h3>Ingen kamper funnet</h3>
            <p>Det er ingen kommende kamper for de valgte ligaene og datoen.</p>
            <p>Prøv å velge en annen dato eller vent til nye kamper er planlagt.</p>
        `;
        matchesList.appendChild(noMatchesDiv);
        return;
    }

    Object.entries(groupedMatches).forEach(([dateLabel, dateMatches]) => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateLabel;
        dateGroup.appendChild(dateHeader);

        // Group matches by time within this date
        const matchesByTime = {};
        dateMatches.forEach(match => {
            if (!matchesByTime[match.time]) {
                matchesByTime[match.time] = [];
            }
            matchesByTime[match.time].push(match);
        });

        // Render each time group
        Object.entries(matchesByTime).forEach(([time, timeMatches]) => {
            // Filter out matches that have already started
            const upcomingMatches = timeMatches.filter(match => {
                const matchDate = match.commence_time ? new Date(match.commence_time) : (match.timestamp ? new Date(match.timestamp * 1000) : null);
                const hasStarted = matchDate && matchDate < new Date();
                return !hasStarted;
            });

            // Skip this time group if no upcoming matches
            if (upcomingMatches.length === 0) {
                return;
            }

            // Create time header only if we have upcoming matches
            const timeHeader = document.createElement('div');
            timeHeader.className = 'time-header';
            // Clean time format - extract only HH:MM if it contains more
            const cleanTime = time.includes(',') ? time.split(',').pop().trim() : time;

            // Get league info from first match in this time group
            const firstMatch = upcomingMatches[0];
            const leagueLogo = firstMatch.leagueLogo ? `<img src="${firstMatch.leagueLogo}" alt="${firstMatch.league}" class="league-logo-small" onerror="this.style.display='none'">` : '';
            const leagueName = firstMatch.league ? `<span class="league-name">${firstMatch.league}</span>` : '';

            timeHeader.innerHTML = `<strong>${cleanTime}</strong> ${leagueLogo} ${leagueName}`;
            dateGroup.appendChild(timeHeader);

            // Render all upcoming matches for this time
            upcomingMatches.forEach(match => {

                const existingTip = userTips.find(tip => String(tip.matchId) === String(match.id));

                if (!existingTip && userTips.length > 0) {
                }

                const homeScore = existingTip ? existingTip.homeScore : '?';
                const awayScore = existingTip ? existingTip.awayScore : '?';
                const hasTip = existingTip !== undefined;

                if (existingTip) {
                }

                const matchCard = document.createElement('div');
                matchCard.className = hasTip ? 'match-card has-tip' : 'match-card';

                // Get team logos - prioritize match data over cache
                const homeLogo = match.homeLogo || footballApi.getTeamLogo(match.homeTeam);
                const awayLogo = match.awayLogo || footballApi.getTeamLogo(match.awayTeam);

                // Log missing logos
                if (!homeLogo) {
                }
                if (!awayLogo) {
                }

                matchCard.innerHTML = `
                    <div class="match-info-inline">
                        <!-- Team names and logos -->
                        <div class="teams-section">
                            <div class="team-inline">
                                ${homeLogo ? `<img src="${homeLogo}" alt="${match.homeTeam}" class="team-logo-inline" onerror="this.style.display='none'">` : ''}
                                <span class="team-name-inline">${match.homeTeam}</span>
                            </div>
                            <span class="vs-text">vs</span>
                            <div class="team-inline">
                                ${awayLogo ? `<img src="${awayLogo}" alt="${match.awayTeam}" class="team-logo-inline" onerror="this.style.display='none'">` : ''}
                                <span class="team-name-inline">${match.awayTeam}</span>
                            </div>
                        </div>

                        <!-- Score controls -->
                        <div class="score-section">
                            <div class="score-controls-inline">
                                <button class="score-btn-inline minus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''}>−</button>
                                <span class="score-display-inline" id="home-score-${match.id}">${homeScore}</span>
                                <span class="score-separator">-</span>
                                <span class="score-display-inline" id="away-score-${match.id}">${awayScore}</span>
                                <button class="score-btn-inline plus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''}>+</button>
                            </div>
                            <div class="score-fine-tune">
                                <button class="score-btn-small minus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''} title="Hjemme -">H−</button>
                                <button class="score-btn-small plus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''} title="Hjemme +">H+</button>
                                <button class="score-btn-small minus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''} title="Borte -">B−</button>
                                <button class="score-btn-small plus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''} title="Borte +">B+</button>
                            </div>
                        </div>

                        <!-- Odds buttons -->
                        ${match.odds ? `
                            <div class="odds-section">
                                <button class="odd-btn-inline home-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''} title="Hjemmeseier 1-0">
                                    <span class="odd-label-inline">H</span>
                                    <span class="odd-value-inline">${match.odds.H.toFixed(2)}</span>
                                </button>
                                <button class="odd-btn-inline draw-btn" data-match-id="${match.id}" data-type="draw" ${match.result ? 'disabled' : ''} title="Uavgjort 0-0">
                                    <span class="odd-label-inline">U</span>
                                    <span class="odd-value-inline">${match.odds.U.toFixed(2)}</span>
                                </button>
                                <button class="odd-btn-inline away-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''} title="Borteseier 0-1">
                                    <span class="odd-label-inline">B</span>
                                    <span class="odd-value-inline">${match.odds.B.toFixed(2)}</span>
                                </button>
                            </div>
                        ` : '<div class="odds-section"><span class="no-odds">Ingen odds</span></div>'}
                    </div>
                `;
                dateGroup.appendChild(matchCard);

                // Add event listeners for odds buttons
                if (!match.result) {
                    const oddsButtons = matchCard.querySelectorAll('.odd-btn-inline');
                    oddsButtons.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const matchId = btn.dataset.matchId;
                            const type = btn.dataset.type;

                            console.log('Odds button clicked:', { matchId, type });
                            setScoreFromOdds(matchId, type);
                        });
                    });

                    // Add event listeners for +/- buttons (both inline and small)
                    const buttons = matchCard.querySelectorAll('.score-btn-inline, .score-btn-small');
                    buttons.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const matchId = e.target.dataset.matchId; // Keep as string, don't parse
                            const type = e.target.dataset.type;
                            const isPlus = e.target.classList.contains('plus-btn');

                            console.log('Button clicked:', { matchId, type, isPlus });
                            updateScore(matchId, type, isPlus);
                        });
                    });
                }
            });
        });

        matchesList.appendChild(dateGroup);
    });
}

// Set score based on odds button clicked
function setScoreFromOdds(matchId, type) {
    const homeScoreElement = document.getElementById(`home-score-${matchId}`);
    const awayScoreElement = document.getElementById(`away-score-${matchId}`);

    if (!homeScoreElement || !awayScoreElement) {
        console.error('Score elements not found for match', matchId);
        return;
    }

    // Set scores based on which odds button was clicked
    if (type === 'home') {
        // Hjemmeseier: 1-0
        homeScoreElement.textContent = '1';
        awayScoreElement.textContent = '0';
    } else if (type === 'draw') {
        // Uavgjort: 0-0
        homeScoreElement.textContent = '0';
        awayScoreElement.textContent = '0';
    } else if (type === 'away') {
        // Borteseier: 0-1
        homeScoreElement.textContent = '0';
        awayScoreElement.textContent = '1';
    }

    // Auto-save the tip
    const homeScore = parseInt(homeScoreElement.textContent);
    const awayScore = parseInt(awayScoreElement.textContent);
    submitTip(matchId, homeScore, awayScore);
}

// Update score with +/- buttons
function updateScore(matchId, type, isPlus) {
    const scoreElement = document.getElementById(`${type}-score-${matchId}`);

    if (!scoreElement) {
        console.error(`Score element not found: ${type}-score-${matchId}`);
        return;
    }

    let currentScore = scoreElement.textContent === '?' ? 0 : parseInt(scoreElement.textContent);

    if (isPlus) {
        currentScore = Math.min(currentScore + 1, 20);
    } else {
        currentScore = Math.max(currentScore - 1, 0);
    }

    scoreElement.textContent = currentScore;

    // Auto-save after score change
    const homeScoreElement = document.getElementById(`home-score-${matchId}`);
    const awayScoreElement = document.getElementById(`away-score-${matchId}`);

    if (!homeScoreElement || !awayScoreElement) {
        console.error('Score elements not found for match', matchId);
        return;
    }

    const homeScore = homeScoreElement.textContent === '?' ? 0 : parseInt(homeScoreElement.textContent);
    const awayScore = awayScoreElement.textContent === '?' ? 0 : parseInt(awayScoreElement.textContent);

    submitTip(matchId, homeScore, awayScore);
}

// Submit a tip
async function submitTip(matchId, homeScore, awayScore) {
    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
        return;
    }

    // Ensure matchId is the same type as match.id for comparison
    const match = matches.find(m => String(m.id) === String(matchId));

    // Create tip object
    const tip = {
        matchId: matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: homeScore,
        awayScore: awayScore,
        timestamp: new Date().toISOString()
    };

    // Only include odds if they exist
    if (match.odds) {
        tip.odds = match.odds;
    }

    // Save tip to Firebase
    const saved = await saveTipToFirestore(tip);
    if (saved) {
        // Reload user tips
        await loadUserTips();
        renderMatches();
        updateTotalScore();
    }
}

// Calculate outcome (H, U, B)
// getOutcome() and calculatePoints() are now imported from matchUtils.js

// Update total score
function updateTotalScore() {
    let totalScore = 0;
    let tipsWithPoints = 0;
    let tipsWithoutPoints = 0;
    let oldTipsCount = 0;

    userTips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        if (match) {
            const points = calculatePoints(tip, match);
            if (points > 0) {
                tipsWithPoints++;
            } else if (match.result) {
                tipsWithoutPoints++;
            }
            totalScore += points;
        } else {
            // Match not found - likely an old match no longer in API response
            oldTipsCount++;
        }
    });

    if (tipsWithPoints > 0 || tipsWithoutPoints > 0) {
        console.log(`💰 ${totalScore.toFixed(2)} poeng (${tipsWithPoints} riktige${oldTipsCount > 0 ? `, ${oldTipsCount} gamle` : ''})`);
    }

    const scoreElement = document.getElementById('totalScore');
    if (scoreElement) {
        scoreElement.textContent = totalScore.toFixed(2);
    }
}

// Simulate match results (for testing)
function simulateResult(matchId) {
    const match = matches.find(m => String(m.id) === String(matchId));
    if (!match) return;

    match.result = {
        home: Math.floor(Math.random() * 5),
        away: Math.floor(Math.random() * 5)
    };

    renderMatches();
    updateTotalScore();
}

// Date navigation functions
function changeDay(offset) {
    if (!selectedDate) {
        // If no date selected, start from today
        selectedDate = new Date();
        selectedDate.setHours(0, 0, 0, 0);
    }

    selectedDate.setDate(selectedDate.getDate() + offset);
    updateDateDisplay();
    applyDateFilter();
}

function showDatePicker() {
    const modal = document.getElementById('datePickerModal');
    const picker = document.getElementById('datePicker');

    // Set current value
    const dateToShow = selectedDate || new Date();
    picker.value = dateToShow.toISOString().split('T')[0];

    modal.style.display = 'block';
}

function closeDatePicker() {
    const modal = document.getElementById('datePickerModal');
    modal.style.display = 'none';
}

function selectDate() {
    const picker = document.getElementById('datePicker');
    selectedDate = new Date(picker.value);
    selectedDate.setHours(0, 0, 0, 0);

    closeDatePicker();
    updateDateDisplay();
    applyDateFilter();
}

function selectToday() {
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);

    closeDatePicker();
    updateDateDisplay();
    applyDateFilter();
}

function updateDateDisplay() {
    const dateLabel = document.getElementById('dateLabel');

    if (!selectedDate) {
        dateLabel.textContent = 'Alle dager';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today, tomorrow, or yesterday
    if (selectedDate.getTime() === today.getTime()) {
        dateLabel.textContent = 'I dag';
    } else if (selectedDate.getTime() === tomorrow.getTime()) {
        dateLabel.textContent = 'I morgen';
    } else if (selectedDate.getTime() === yesterday.getTime()) {
        dateLabel.textContent = 'I går';
    } else {
        // Format: "Fredag 1. nov"
        const options = { weekday: 'long', day: 'numeric', month: 'short' };
        const formatted = selectedDate.toLocaleDateString('no-NO', options);
        dateLabel.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
}

function applyDateFilter() {
    // Start with league-filtered matches
    let filteredMatches = [...leagueFilteredMatches];

    if (selectedDate) {
        // Filter to show only matches on selected date
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        filteredMatches = filteredMatches.filter(match => {
            const matchDate = new Date(match.commence_time || match.date || match.timestamp * 1000);
            return matchDate >= startOfDay && matchDate <= endOfDay;
        });

    }

    matches = filteredMatches;
    renderMatches();
}

// Initialize date display on page load
function initDateNavigation() {
    // Start with today's date
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    updateDateDisplay();
}

// League filter functions
function showLeagueFilter() {
    const container = document.getElementById('leagueFilterContainer');
    const isVisible = container.style.display !== 'none';

    if (isVisible) {
        container.style.display = 'none';
    } else {
        populateLeagueFilter();
        container.style.display = 'block';
    }
}

function populateLeagueFilter() {
    const listContainer = document.getElementById('leagueFilterList');
    listContainer.innerHTML = '';

    // LEAGUE_NAMES is now imported from leagueConfig.js

    // Create checkboxes for each league in user's preferences
    selectedLeagues.forEach(leagueId => {
        const leagueName = getLeagueName(leagueId);
        const isActive = activeLeagueFilter.size === 0 || activeLeagueFilter.has(leagueId);

        const checkbox = document.createElement('div');
        checkbox.className = 'league-filter-item';
        checkbox.innerHTML = `
            <label>
                <input type="checkbox"
                       value="${leagueId}"
                       ${isActive ? 'checked' : ''}
                       onchange="toggleLeagueFilter(${leagueId})">
                <span>${leagueName}</span>
            </label>
        `;
        listContainer.appendChild(checkbox);
    });
}

function toggleLeagueFilter(leagueId) {
    // Initialize filter if empty (means "show all")
    if (activeLeagueFilter.size === 0) {
        activeLeagueFilter = new Set(selectedLeagues);
    }

    if (activeLeagueFilter.has(leagueId)) {
        activeLeagueFilter.delete(leagueId);
    } else {
        activeLeagueFilter.add(leagueId);
    }

    // If all leagues are selected again, clear filter (show all)
    if (activeLeagueFilter.size === selectedLeagues.size) {
        activeLeagueFilter.clear();
    }


    // Re-apply filters
    applyLeagueFilter();
}

function selectAllLeaguesFilter() {
    activeLeagueFilter.clear(); // Empty = show all
    populateLeagueFilter();
    applyLeagueFilter();
}

function deselectAllLeaguesFilter() {
    activeLeagueFilter = new Set(); // Empty set, but we'll add one to avoid showing nothing
    if (selectedLeagues.size > 0) {
        const firstLeague = Array.from(selectedLeagues)[0];
        activeLeagueFilter.add(firstLeague);
    }
    populateLeagueFilter();
    applyLeagueFilter();
}

// Export functions to window object so they're accessible from HTML onclick attributes
// (needed because this file is loaded as a module)
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleSignIn = handleSignIn;
window.handleSignUp = handleSignUp;
window.handleResetPassword = handleResetPassword;
window.changeDay = changeDay;
window.showDatePicker = showDatePicker;
window.closeDatePicker = closeDatePicker;
window.selectToday = selectToday;
window.showLeagueFilter = showLeagueFilter;
window.toggleLeagueFilter = toggleLeagueFilter;
window.selectAllLeaguesFilter = selectAllLeaguesFilter;
window.deselectAllLeaguesFilter = deselectAllLeaguesFilter;

// Close auth modal when clicking outside of it (but not on modal content)
window.onclick = function(event) {
    const modal = document.getElementById('authModal');
    if (event.target === modal) {
        closeAuthModal();
    }

    const dateModal = document.getElementById('datePickerModal');
    if (event.target === dateModal) {
        closeDatePicker();
    }
};

// Prevent modal content clicks from closing the modal
window.addEventListener('DOMContentLoaded', () => {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    }
});

// Force refresh data from API (bypass cache)
async function refreshData() {
    console.log('🔄 Force refreshing data from API...');

    // Clear localStorage cache
    localStorage.removeItem('cachedMatches');
    localStorage.removeItem('cachedMatchesTime');

    try {
        const loadingMessage = document.getElementById('loadingMessage');
        loadingMessage.style.display = 'block';

        // Clean up old format matches from Firestore first
        const { cleanupOldFormatMatches } = await import('./js/utils/matchCache.js');
        await cleanupOldFormatMatches();

        // Fetch fresh data from API (skip Firestore cache)
        const [upcomingMatches, completedMatches] = await Promise.all([
            footballApi.getUpcomingFixtures(true), // skipCache = true
            footballApi.fetchScores()
        ]);

        console.log(`✅ Fetched ${upcomingMatches.length} upcoming, ${completedMatches.length} completed`);

        // Deduplicate matches
        const existingIds = new Set(upcomingMatches.map(m => String(m.id)));
        const uniqueCompletedMatches = completedMatches.filter(m => {
            const id = String(m.id);
            if (existingIds.has(id)) return false;
            existingIds.add(id);
            return true;
        });

        // Combine and sort
        allMatches = upcomingMatches.concat(uniqueCompletedMatches);
        allMatches.sort((a, b) => {
            const dateA = new Date(a.commence_time || a.date || a.timestamp * 1000);
            const dateB = new Date(b.commence_time || b.date || b.timestamp * 1000);
            return dateA - dateB;
        });

        // Cache the fresh data
        setCachedMatches(allMatches);

        // Apply filter and render
        applyLeagueFilter();
        await loadUserTips();
        renderMatches();
        updateTotalScore();

        loadingMessage.style.display = 'none';
        console.log('✅ Data refreshed successfully!');
    } catch (error) {
        console.error('❌ Failed to refresh data:', error);
    }
}

// Make refreshData available globally
window.refreshData = refreshData;
window.forceRefreshData = refreshData; // Alias for onclick handler

// Make cleanup function available globally
window.cleanupFirestore = async function() {
    console.log('🧹 Starting complete Firestore cleanup...');
    const { cleanupAllOutdatedMatches } = await import('./js/utils/matchCache.js');
    const deleted = await cleanupAllOutdatedMatches();
    console.log(`✅ Cleanup complete! Deleted ${deleted} outdated matches.`);
    console.log('🔄 Refreshing data...');
    await refreshData();
};

// Add button to simulate results for testing (can be removed later)
window.addEventListener('DOMContentLoaded', () => {
    init();

    // Add debug functions in console
    console.log('🔥 Tippekonkurranse loaded | simulateResult(matchId) | refreshData() | cleanupFirestore()');
});
