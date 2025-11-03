// Import utility modules
import { LEAGUE_NAMES, getLeagueName } from './js/utils/leagueConfig.js';
import { calculatePoints, getOutcome, formatMatchTime, sortMatchesByDate, filterUpcomingMatches } from './js/utils/matchUtils.js';
import { formatDateRange, getDateLabel, groupMatchesByDate, toISODate, getStartOfDay, getEndOfDay } from './js/utils/dateUtils.js';
import { STORAGE_KEYS, TIMEOUTS, ERROR_MESSAGES } from './js/constants/appConstants.js';
import { ErrorHandler, retryOperation } from './js/utils/errorHandler.js';

// Match data - will be loaded from API or mock data
let matches = [];
let allMatches = []; // Store all matches for filtering
let leagueFilteredMatches = []; // Matches after league filter, before date filter

// User's tips - loaded from Firebase
let userTips = [];

// Date navigation
let selectedDate = null; // null = show all dates, otherwise show only this date

// All available leagues that can be enabled
const AVAILABLE_LEAGUES = [39, 2, 48, 135]; // PL, CL, EFL Cup, Serie A

// Save league preferences to Firestore
async function saveLeaguePreferences() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const db = firebase.firestore();
        await db.collection('userPreferences').doc(user.uid).set({
            leagues: Array.from(selectedLeagues)
        }, { merge: true });

        console.log('✅ League preferences saved:', Array.from(selectedLeagues));
    } catch (error) {
        console.warn('Failed to save league preferences:', error);
    }
}

// Load league preferences from Firestore (user preferences)
async function loadSelectedLeagues(userId) {
    try {
        if (!userId) {
            console.log('⚠️ No user logged in, using default leagues');
            return new Set([39, 2, 48, 135]); // Default: Premier League, Champions League, EFL Cup, Serie A
        }

        const db = firebase.firestore();
        const prefsDoc = await db.collection('userPreferences').doc(userId).get();

        if (prefsDoc.exists && prefsDoc.data().leagues !== undefined) {
            const leagueArray = prefsDoc.data().leagues;
            console.log('📂 Loaded leagues from Firestore:', leagueArray);

            // Only allow Premier League (39), Champions League (2), EFL Cup (48), and Serie A (135)
            const validLeagues = [39, 2, 48, 135];
            const filteredLeagues = leagueArray.filter(id => validLeagues.includes(id));

            // Check if user has invalid leagues (needs cleanup)
            const needsMigration = filteredLeagues.length !== leagueArray.length;

            if (needsMigration) {
                console.log('🔄 Cleaning up invalid league preferences');

                // Save corrected preferences back to Firestore (keep only valid leagues)
                await db.collection('userPreferences').doc(userId).set({
                    leagues: filteredLeagues,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // Empty array is valid (user wants to see nothing)
            console.log('✅ Returning leagues:', filteredLeagues);
            return new Set(filteredLeagues);
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

    // Show matches for selected leagues only
    // If no leagues selected (empty set), show nothing
    if (selectedLeagues.size === 0) {
        leagueFilteredMatches = [];
    } else {
        leagueFilteredMatches = allMatches.filter(match => {
            // Check if match league ID matches any selected league
            // Support multiple field names: league (new), league_id, leagueId (old)
            const matchLeagueId = (typeof match.league === 'number' ? match.league : null)
                                || match.league_id
                                || match.leagueId;

            // If we have league ID, match directly
            if (matchLeagueId) {
                return selectedLeagues.has(matchLeagueId);
            }

            // Fallback: match by league name (for older data format with string league)
            const matchLeague = typeof match.league === 'string' ? match.league : (match.league?.name || '');
            if (!matchLeague) return false;

            for (const leagueId of selectedLeagues) {
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
        const cached = localStorage.getItem(STORAGE_KEYS.CACHED_MATCHES);
        const cacheTime = localStorage.getItem(STORAGE_KEYS.CACHED_MATCHES_TIME);

        if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            // Cache valid for configured duration
            if (age < import.meta.env?.VITE_CACHE_DURATION || 5 * 60 * 1000) {
                return JSON.parse(cached);
            }
        }
    } catch (error) {
    }
    return null;
}

function setCachedMatches(matches) {
    try {
        localStorage.setItem(STORAGE_KEYS.CACHED_MATCHES, JSON.stringify(matches));
        localStorage.setItem(STORAGE_KEYS.CACHED_MATCHES_TIME, Date.now().toString());
    } catch (error) {
    }
}

// Load matches from API
async function loadMatches() {
    const startTime = performance.now();
    console.log('⏱️ Starting to load matches...');

    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        // Try to load from cache first for instant display
        const cachedMatches = getCachedMatches();
        if (cachedMatches && cachedMatches.length > 0) {
            const cacheTime = performance.now();
            console.log(`📦 Loaded ${cachedMatches.length} matches from cache in ${((cacheTime - startTime) / 1000).toFixed(2)}s`);

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
        const apiStartTime = performance.now();
        const [upcomingMatches, completedMatches] = await Promise.all([
            footballApi.getUpcomingFixtures(),
            footballApi.fetchScores().catch(error => {
                return [];
            })
        ]);
        const apiEndTime = performance.now();
        console.log(`🌐 API fetch completed in ${((apiEndTime - apiStartTime) / 1000).toFixed(2)}s`);

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

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✅ Matches loaded successfully in ${duration}s`);
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'loadMatches',
            showUser: true,
            userMessage: ERROR_MESSAGES.LOAD_MATCHES_FAILED + ' Bruker mock-data.',
            logToConsole: true
        });

        loadingMessage.style.display = 'none';

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

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`⚠️ Matches loaded with fallback in ${duration}s`);
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

            // Clean up old matches from Firestore in background (don't await)
            // Has proper error handling for permission issues
            cleanupOldMatchesInBackground();
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

    // Filter out matches from previous days using utility function
    const upcomingMatches = filterUpcomingMatches(matches);
    const groupedMatches = groupMatchesByDate(upcomingMatches);

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
            const cleanTime = time && time !== 'undefined' ?
                (time.includes(',') ? time.split(',').pop().trim() : time) :
                '';

            // Get league info from first match in this time group
            const firstMatch = upcomingMatches[0];
            const leagueLogo = firstMatch.leagueLogo ? `<img src="${firstMatch.leagueLogo}" alt="${firstMatch.leagueName || 'Liga'}" class="league-logo-small" onerror="this.style.display='none'">` : '';
            const leagueName = firstMatch.leagueName ? `<span class="league-name">${firstMatch.leagueName}</span>` : '';

            timeHeader.innerHTML = cleanTime ? `<strong>${cleanTime}</strong> ${leagueLogo} ${leagueName}` : `${leagueLogo} ${leagueName}`;
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
                                <button class="score-btn-inline minus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''} title="Reduser hjemmelag">−</button>
                                <span class="score-display-inline" id="home-score-${match.id}">${homeScore}</span>
                                <button class="score-btn-inline plus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''} title="Øk hjemmelag">+</button>
                                <span class="score-separator">-</span>
                                <button class="score-btn-inline minus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''} title="Reduser bortelag">−</button>
                                <span class="score-display-inline" id="away-score-${match.id}">${awayScore}</span>
                                <button class="score-btn-inline plus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''} title="Øk bortelag">+</button>
                            </div>
                        </div>

                        <!-- Odds buttons -->
                        ${match.odds ? `
                            <div class="odds-section">
                                <button class="odd-btn-inline home-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''} title="Hjemmeseier 1-0">
                                    <span class="odd-label-inline">H</span>
                                    <span class="odd-value-inline">${match.odds.H.toFixed(1)}</span>
                                </button>
                                <button class="odd-btn-inline draw-btn" data-match-id="${match.id}" data-type="draw" ${match.result ? 'disabled' : ''} title="Uavgjort 0-0">
                                    <span class="odd-label-inline">U</span>
                                    <span class="odd-value-inline">${match.odds.U.toFixed(1)}</span>
                                </button>
                                <button class="odd-btn-inline away-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''} title="Borteseier 0-1">
                                    <span class="odd-label-inline">B</span>
                                    <span class="odd-value-inline">${match.odds.B.toFixed(1)}</span>
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

                    // Add event listeners for +/- buttons
                    const buttons = matchCard.querySelectorAll('.score-btn-inline');
                    buttons.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const matchId = e.target.dataset.matchId;
                            const type = e.target.dataset.type;
                            const isPlus = e.target.classList.contains('plus-btn');

                            console.log('Button clicked:', { matchId, type, isPlus });
                            updateScore(matchId, type, isPlus);
                        });
                    });

                    // Add horizontal swipe functionality for score displays (mobile friendly)
                    const homeScoreElement = document.getElementById(`home-score-${match.id}`);
                    const awayScoreElement = document.getElementById(`away-score-${match.id}`);

                    if (homeScoreElement && awayScoreElement) {
                        [
                            { element: homeScoreElement, type: 'home' },
                            { element: awayScoreElement, type: 'away' }
                        ].forEach(({ element, type }) => {
                            let touchStartX = 0;
                            let touchStartY = 0;

                            element.addEventListener('touchstart', (e) => {
                                touchStartX = e.touches[0].clientX;
                                touchStartY = e.touches[0].clientY;
                            }, { passive: true });

                            element.addEventListener('touchend', (e) => {
                                const touchEndX = e.changedTouches[0].clientX;
                                const touchEndY = e.changedTouches[0].clientY;
                                const deltaX = touchEndX - touchStartX;
                                const deltaY = Math.abs(touchEndY - touchStartY);

                                // Only trigger if horizontal swipe is dominant (not vertical scroll)
                                if (Math.abs(deltaX) > 50 && deltaY < 30) {
                                    if (deltaX > 0) {
                                        // Swipe right - increase
                                        updateScore(match.id, type, true);
                                    } else {
                                        // Swipe left - decrease
                                        updateScore(match.id, type, false);
                                    }
                                }
                            }, { passive: true });
                        });
                    }

                }
            });
        });

        // Only append the date group if it has matches (more than just the date header)
        if (dateGroup.children.length > 1) {
            matchesList.appendChild(dateGroup);
        }
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
        console.log(`💰 ${totalScore.toFixed(1)} poeng (${tipsWithPoints} riktige${oldTipsCount > 0 ? `, ${oldTipsCount} gamle` : ''})`);
    }

    const scoreElement = document.getElementById('totalScore');
    if (scoreElement) {
        scoreElement.textContent = totalScore.toFixed(1);
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
    // Show all dates by default (no date filter)
    selectedDate = null;
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
    console.log('🔄 Populating league filter, selectedLeagues:', Array.from(selectedLeagues));
    const listContainer = document.getElementById('leagueFilterList');
    listContainer.innerHTML = '';

    // Show all available leagues (not just selected ones)
    // This allows users to enable/disable leagues they want to see
    AVAILABLE_LEAGUES.forEach(leagueId => {
        const leagueName = getLeagueName(leagueId);
        const isSelected = selectedLeagues.has(leagueId);
        console.log(`  League ${leagueName} (${leagueId}): ${isSelected ? 'CHECKED' : 'unchecked'}`);

        const checkbox = document.createElement('div');
        checkbox.className = 'league-filter-item';
        checkbox.innerHTML = `
            <label>
                <input type="checkbox"
                       value="${leagueId}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleLeagueFilter(${leagueId})">
                <span>${leagueName}</span>
            </label>
        `;
        listContainer.appendChild(checkbox);
    });

    // Update header to show count
    updateLeagueFilterHeader();
}

function updateLeagueFilterHeader() {
    const headerElement = document.querySelector('.filter-modal h3');
    if (headerElement) {
        const selectedCount = selectedLeagues.size;
        const totalCount = AVAILABLE_LEAGUES.length;
        headerElement.textContent = `Filtrer ligaer (${selectedCount} av ${totalCount} valgt)`;
    }
}

function toggleLeagueFilter(leagueId) {
    // Toggle league in selectedLeagues
    if (selectedLeagues.has(leagueId)) {
        selectedLeagues.delete(leagueId);
    } else {
        selectedLeagues.add(leagueId);
    }

    // Save to Firestore
    saveLeaguePreferences();

    // Update UI
    populateLeagueFilter();

    // Re-apply filters
    applyLeagueFilter();
}

async function selectAllLeaguesFilter() {
    console.log('🔵 Velg alle ligaer');
    // Select all available leagues
    selectedLeagues = new Set(AVAILABLE_LEAGUES);
    console.log('Selected leagues:', Array.from(selectedLeagues));
    await saveLeaguePreferences();
    populateLeagueFilter();
    applyLeagueFilter();
}

async function deselectAllLeaguesFilter() {
    console.log('🔴 Fjern alle ligaer');
    // Empty set = show nothing
    selectedLeagues = new Set();
    console.log('Selected leagues after clear:', Array.from(selectedLeagues));
    await saveLeaguePreferences();
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
    localStorage.removeItem(STORAGE_KEYS.CACHED_MATCHES);
    localStorage.removeItem(STORAGE_KEYS.CACHED_MATCHES_TIME);

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
        ErrorHandler.success('Data refreshed successfully!', 'refreshData');
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'refreshData',
            showUser: true,
            userMessage: 'Kunne ikke oppdatere data. Prøv igjen senere.',
            logToConsole: true
        });
    }
}

// Make refreshData available globally
window.refreshData = refreshData;
window.forceRefreshData = refreshData; // Alias for onclick handler

// Clean up old matches in background (automatic cleanup)
async function cleanupOldMatchesInBackground() {
    try {
        // Wait a bit before starting cleanup (let the page load first)
        await new Promise(resolve => setTimeout(resolve, TIMEOUTS.CACHE_CLEANUP_DELAY));

        console.log('🧹 Starting automatic cleanup of old matches...');

        // Clear localStorage cache first
        localStorage.removeItem(STORAGE_KEYS.CACHED_MATCHES);
        localStorage.removeItem(STORAGE_KEYS.CACHED_MATCHES_TIME);

        const { cleanupAllOutdatedMatches } = await import('./js/utils/matchCache.js');
        const deleted = await cleanupAllOutdatedMatches();

        if (deleted > 0) {
            console.log(`✅ Automatic cleanup complete! Deleted ${deleted} outdated matches.`);
            // Refresh data to show updated list
            await refreshData();
        } else {
            console.log('✅ No old matches to clean up');
        }
    } catch (error) {
        console.warn('⚠️ Background cleanup failed:', error);
    }
}

// Make cleanup function available globally
window.cleanupFirestore = async function() {
    console.log('🧹 Starting complete Firestore cleanup...');

    // Clear all caches first
    localStorage.removeItem(STORAGE_KEYS.CACHED_MATCHES);
    localStorage.removeItem(STORAGE_KEYS.CACHED_MATCHES_TIME);
    localStorage.removeItem(STORAGE_KEYS.FOOTBALL_MATCHES);
    localStorage.removeItem(STORAGE_KEYS.FOOTBALL_MATCHES_TIMESTAMP);
    console.log('🗑️ Cleared localStorage cache');

    const { cleanupAllOutdatedMatches } = await import('./js/utils/matchCache.js');
    const deleted = await cleanupAllOutdatedMatches();
    console.log(`✅ Cleanup complete! Deleted ${deleted} outdated matches.`);
    console.log('🔄 Refreshing data...');

    // Force page reload to ensure clean state
    window.location.reload();
};

// Make convert function available globally
window.convertOldMatches = async function() {
    console.log('🔄 Starting conversion of old format matches...');
    const { convertOldFormatMatches } = await import('./js/utils/matchCache.js');
    const converted = await convertOldFormatMatches();
    console.log(`✅ Conversion complete! Converted ${converted} matches.`);
    console.log('🔄 Refreshing data...');
    await refreshData();
};

// Make delete all matches function available globally
window.deleteAllMatchesFromFirestore = async function() {
    const confirmDelete = confirm('⚠️ Er du sikker på at du vil slette ALLE kamper fra Firestore?\n\nDette kan ikke angres, men kampene vil bli hentet på nytt fra API ved neste refresh.');

    if (!confirmDelete) {
        console.log('❌ Sletting avbrutt av bruker');
        return;
    }

    console.log('🗑️ Sletter alle kamper fra Firestore...');
    const { deleteAllMatches } = await import('./js/utils/matchCache.js');
    const deleted = await deleteAllMatches();
    console.log(`✅ Sletting fullført! Slettet ${deleted} kamper.`);
    console.log('🔄 Refresher data fra API...');

    // Clear localStorage cache too
    localStorage.removeItem('footballMatches');
    localStorage.removeItem('footballMatchesTimestamp');

    await refreshData();
};

// Add button to simulate results for testing (can be removed later)
window.addEventListener('DOMContentLoaded', () => {
    init();

    // Add debug functions in console
    console.log('🔥 Tippekonkurranse loaded | simulateResult(matchId) | refreshData() | cleanupFirestore() | convertOldMatches() | deleteAllMatchesFromFirestore()');
});
