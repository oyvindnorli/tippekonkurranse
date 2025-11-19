// Import utility modules
import { LEAGUE_NAMES, getLeagueName } from './js/utils/leagueConfig.js';
import { calculatePoints, getOutcome, formatMatchTime, sortMatchesByDate, filterUpcomingMatches } from './js/utils/matchUtils.js';
import { formatDateRange, getDateLabel, groupMatchesByDate, toISODate, getStartOfDay, getEndOfDay } from './js/utils/dateUtils.js';
import { STORAGE_KEYS, TIMEOUTS, ERROR_MESSAGES } from './js/constants/appConstants.js';
import { ErrorHandler, retryOperation } from './js/utils/errorHandler.js';
import { updateHeaderStats } from './header.js';

// Match data - will be loaded from API or mock data
let matches = [];
let allMatches = []; // Store all matches for filtering
let leagueFilteredMatches = []; // Matches after league filter, before date filter

// User's tips - loaded from Firebase
let userTips = [];

// Date navigation
let selectedDate = null; // null = show all dates, otherwise show only this date

// All available leagues that can be enabled
const AVAILABLE_LEAGUES = [39, 2, 3, 32, 48, 135]; // PL, CL, EL, WCQ Europe, EFL Cup, Serie A

// Save league preferences to Supabase
async function saveLeaguePreferences() {
    try {
        console.log('   💾 saveLeaguePreferences starting...');
        if (!currentUser) {
            console.log('   ⚠️ No user logged in, skipping save');
            return;
        }

        // Use fetch() directly
        const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';

        // Get user's access token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            throw new Error('No access token available');
        }

        // Check if preferences already exist
        const checkUrl = `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${currentUser.id}`;
        const checkResponse = await fetch(checkUrl, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!checkResponse.ok) throw new Error(`HTTP ${checkResponse.status}`);

        const existing = await checkResponse.json();

        let response;
        if (existing && existing.length > 0) {
            // Update existing preferences
            const updateUrl = `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${currentUser.id}`;
            response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    selected_leagues: Array.from(selectedLeagues),
                    updated_at: new Date().toISOString()
                })
            });
        } else {
            // Insert new preferences
            response = await fetch(`${SUPABASE_URL}/rest/v1/user_preferences`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    selected_leagues: Array.from(selectedLeagues)
                })
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        console.log('✅ League preferences saved:', Array.from(selectedLeagues));
    } catch (error) {
        console.warn('❌ Failed to save league preferences:', error);
    }
}

// Load league preferences from Supabase (user preferences)
async function loadSelectedLeagues(userId) {
    try {
        if (!userId) {
            return new Set([39, 2, 3, 48, 135]); // Default: Premier League, Champions League, Europa League, EFL Cup, Serie A
        }

        // Use fetch() directly instead of Supabase SDK (same issue as matches)
        const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';

        const url = `${SUPABASE_URL}/rest/v1/user_preferences?select=selected_leagues&user_id=eq.${userId}`;

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch preferences:', response.status);
            return new Set([39, 2, 3, 32, 48, 135]);
        }

        const results = await response.json();
        const data = results[0]; // Get first result

        if (data && data.selected_leagues) {
            const leagueArray = data.selected_leagues;

            // Only allow valid leagues from AVAILABLE_LEAGUES
            const filteredLeagues = leagueArray.filter(id => AVAILABLE_LEAGUES.includes(id));

            // Migrate old WCQ league ID (35) to new ID (32)
            const migratedLeagues = filteredLeagues.map(id => id === 35 ? 32 : id);

            // Remove duplicates in case user somehow has both 35 and 32
            const uniqueLeagues = [...new Set(migratedLeagues)];

            // Check if user needs migration
            const needsMigration = JSON.stringify(uniqueLeagues.sort()) !== JSON.stringify(leagueArray.sort());

            if (needsMigration) {
                console.log('🔄 Migrating league preferences (35 → 32)');

                // Get user's access token for authenticated request
                const { data: { session } } = await supabase.auth.getSession();
                const accessToken = session?.access_token;

                if (accessToken) {
                    // Update preferences with migrated leagues (use PATCH since they already exist)
                    const updateUrl = `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}`;
                    await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            selected_leagues: uniqueLeagues,
                            updated_at: new Date().toISOString()
                        })
                    });
                }
            }

            // Empty array is valid (user wants to see nothing)
            return new Set(uniqueLeagues);
        } else {
            return new Set([39, 2, 3, 32, 48, 135]); // Default: Premier League, Champions League, Europa League, WCQ Europe, EFL Cup, Serie A
        }
    } catch (error) {
        return new Set([39, 2, 3, 32, 48, 135]); // Default on error
    }
}

// Save league preferences to Supabase
async function saveSelectedLeagues() {
    try {
        if (!currentUser) {
            console.log('⚠️ No user logged in, cannot save preferences');
            return;
        }

        const leagueArray = Array.from(selectedLeagues);

        // Use fetch() directly
        const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';

        // Get user's access token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            throw new Error('No access token available');
        }

        // Check if preferences already exist
        const checkUrl = `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${currentUser.id}`;
        const checkResponse = await fetch(checkUrl, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!checkResponse.ok) throw new Error(`HTTP ${checkResponse.status}`);

        const existing = await checkResponse.json();

        let response;
        if (existing && existing.length > 0) {
            // Update existing preferences
            const updateUrl = `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${currentUser.id}`;
            response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    selected_leagues: leagueArray,
                    updated_at: new Date().toISOString()
                })
            });
        } else {
            // Insert new preferences
            response = await fetch(`${SUPABASE_URL}/rest/v1/user_preferences`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    selected_leagues: leagueArray
                })
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        console.log('💾 Saved league preferences to Supabase:', leagueArray);

        // Also update API_CONFIG.LEAGUES for immediate effect
        API_CONFIG.LEAGUES = leagueArray;
    } catch (error) {
        console.warn('⚠️ Could not save league preferences:', error);
    }
}

// Selected leagues for filtering (will be updated when user logs in)
let selectedLeagues = new Set([39, 2, 3, 32, 48, 135]); // Default: Premier League, Champions League, Europa League, WCQ Europe, EFL Cup, Serie A

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
    console.log('🔵 handleSignUp called');

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    console.log('📝 Form values:', { name, email, passwordLength: password?.length });

    if (!name || !email || !password) {
        alert('Vennligst fyll ut alle feltene');
        return;
    }

    if (password.length < 6) {
        alert('Passord må være minst 6 tegn');
        return;
    }

    // Disable button to prevent double-clicks
    const buttons = document.querySelectorAll('#signupForm button');
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === 'Registrer') {
            btn.textContent = 'Registrerer...';
        }
    });

    try {
        console.log('🚀 Calling signUp...');
        const result = await signUp(email, password, name);
        console.log('✅ signUp result:', result);

        if (!result.success) {
            alert('Registrering feilet: ' + result.error);
        } else {
            console.log('🎉 Registration successful!');
            alert('Registrering vellykket! Du blir nå logget inn...');
        }
    } catch (error) {
        console.error('❌ Unexpected error in handleSignUp:', error);
        alert('En uventet feil oppstod: ' + error.message);
    } finally {
        buttons.forEach(btn => {
            btn.disabled = false;
            if (btn.textContent === 'Registrerer...') {
                btn.textContent = 'Registrer';
            }
        });
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

// Load matches from Supabase only
async function loadMatches() {
    const startTime = performance.now();

    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        // Import matchCache module
        const { getUpcomingMatchesFromCache } = await import('./js/utils/matchCache.js?v=20251119j');

        // Fetch ALL matches from Supabase (no date filtering - get everything)
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 365); // Get matches for next year

        const leagueIds = API_CONFIG.LEAGUES && API_CONFIG.LEAGUES.length > 0
            ? API_CONFIG.LEAGUES
            : [39, 2, 3, 32, 48, 135]; // Default leagues

        // Fetch from Supabase only
        const matchesFromSupabase = await getUpcomingMatchesFromCache(today, futureDate, leagueIds);

        if (!matchesFromSupabase || matchesFromSupabase.length === 0) {
            console.warn('⚠️ No matches found in Supabase');
            errorMessage.textContent = 'Ingen kamper funnet. Venter på at GitHub Actions skal oppdatere...';
            errorMessage.style.display = 'block';
            loadingMessage.style.display = 'none';
            return;
        }

        allMatches = matchesFromSupabase;

        // Sort by date (chronological order)
        allMatches.sort((a, b) => {
            const dateA = new Date(a.commence_time || a.date || a.timestamp * 1000);
            const dateB = new Date(b.commence_time || b.date || b.timestamp * 1000);
            return dateA - dateB;
        });

        console.log(`✅ Loaded ${allMatches.length} matches from Supabase`);

        // Apply league filter
        applyLeagueFilter();

        // Load user tips
        if (currentUser) {
            await loadUserTips();
        }

        loadingMessage.style.display = 'none';

        // Render matches
        renderMatches();
        updateTotalScore();

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✅ Matches loaded in ${duration}s (Supabase only)`);
    } catch (error) {
        console.error('❌ Error loading matches:', error);

        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste kamper. Prøv å refresh siden.';
        errorMessage.style.display = 'block';

        // Show empty state
        allMatches = [];
        renderMatches();
    }
}

// League checkboxes removed - preferences are now managed via preferences page

// Load all data (called by supabase-auth.js when user logs in)
async function loadFirebaseData() {
    // Loading data from Supabase

    // Show main content, hide welcome
    const welcomeSection = document.getElementById('welcomeSection');
    const mainContent = document.getElementById('mainContent');
    if (welcomeSection) {
        welcomeSection.style.display = 'none';
    }
    if (mainContent) {
        mainContent.style.display = 'block';
    }

    // Load matches
    await loadMatches();

    // Load user tips (if on index.html where userTips exists)
    if (typeof userTips !== 'undefined' && typeof getCurrentUserTips === 'function') {
        userTips = await getCurrentUserTips();
        console.log('📥 Loaded tips from Supabase:', userTips.length);
    }

    // Re-render with loaded tips
    if (typeof renderMatches === 'function') {
        renderMatches();
    }

    if (typeof updateTotalScore === 'function') {
        updateTotalScore();
    }
}

// Make loadFirebaseData globally available
window.loadFirebaseData = loadFirebaseData;

// Initialize the app
function init() {
    // Initialize Supabase first
    initializeSupabase();

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
    // NOTE: preferencesUnsubscribe removed - Realtime is disabled
    let hasLoadedInitialMatches = false;

    supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        // Hide loading spinner
        if (authLoading) authLoading.style.display = 'none';

        // Clean up previous listener if exists
        // NOTE: Realtime is currently disabled, so no cleanup needed
        // if (preferencesUnsubscribe) {
        //     try {
        //         await preferencesUnsubscribe();
        //     } catch (error) {
        //         // Ignore cleanup errors
        //     }
        //     preferencesUnsubscribe = null;
        // }

        if (user) {
            // Skip if we've already initialized for this user
            if (hasLoadedInitialMatches) {
                return;
            }

            // Set flag IMMEDIATELY to prevent race condition
            hasLoadedInitialMatches = true;

            // User is signed in, load preferences first
            selectedLeagues = await loadSelectedLeagues(user.id);
            API_CONFIG.LEAGUES = Array.from(selectedLeagues);

            // Show main content, hide welcome
            if (welcomeSection) {
                welcomeSection.style.display = 'none';
            }
            if (mainContent) {
                mainContent.style.display = 'block';
            }

            // Load matches once
            await loadMatches();

            // NOTE: Realtime listener for preferences changes is disabled to avoid
            // WebSocket connection errors. Users can refresh the page to see changes
            // from other devices/tabs. This is not a critical feature.

            // If you need cross-tab sync, uncomment this and ensure Realtime is enabled:
            /*
            const channel = supabase
                .channel(`preferences:${user.id}`)
                .on('postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'user_preferences',
                        filter: `user_id=eq.${user.id}`
                    },
                    async (payload) => {
                        if (payload.new && payload.new.selected_leagues) {
                            let newPreferences = payload.new.selected_leagues;

                            // Migrate old WCQ ID (35 → 32) if present
                            const needsMigration = newPreferences.includes(35);
                            if (needsMigration) {
                                console.log('🔄 Migrating WCQ from 35 to 32');
                                newPreferences = newPreferences.map(id => id === 35 ? 32 : id);
                                // Remove duplicates
                                newPreferences = [...new Set(newPreferences)];

                                // Save migrated preferences back
                                await supabase
                                    .from('user_preferences')
                                    .upsert({
                                        user_id: user.id,
                                        selected_leagues: newPreferences
                                    });
                            }

                            // Filter to only valid leagues
                            const validPreferences = newPreferences.filter(id => AVAILABLE_LEAGUES.includes(id));

                            const currentLeagues = Array.from(selectedLeagues);

                            // Check if preferences actually changed
                            if (JSON.stringify(validPreferences.sort()) !== JSON.stringify(currentLeagues.sort())) {
                                console.log('🔄 Preferences changed remotely, reloading...', validPreferences);

                                // Update selectedLeagues
                                selectedLeagues = new Set(validPreferences);
                                API_CONFIG.LEAGUES = validPreferences;

                                // Clear cache and reload
                                if (footballApi && footballApi.clearCache) {
                                    footballApi.clearCache();
                                }

                                // Update filter UI if it's open
                                const filterModal = document.querySelector('.filter-modal');
                                if (filterModal && filterModal.style.display !== 'none') {
                                    populateLeagueFilter();
                                }

                                // Reload matches with new preferences
                                loadMatches();
                            }
                        }
                    }
                )
                .subscribe();

            preferencesUnsubscribe = async () => {
                try {
                    await channel.unsubscribe();
                    setTimeout(() => {
                        supabase.removeChannel(channel);
                    }, 100);
                } catch (error) {
                    console.debug('Channel cleanup:', error.message);
                }
            };
            */

            // Clean up old matches from Firestore in background (don't await)
            // DISABLED: User doesn't have delete permissions, causes console errors
            // cleanupOldMatchesInBackground();
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
            // Calculate time from commence_time or timestamp
            const matchDate = match.commence_time ? new Date(match.commence_time) : (match.timestamp ? new Date(match.timestamp * 1000) : null);
            const time = matchDate ? matchDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : 'Ukjent tid';

            if (!matchesByTime[time]) {
                matchesByTime[time] = [];
            }
            matchesByTime[time].push(match);
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

            // Get round info
            const roundInfo = firstMatch.round ? `<span class="round-info">${firstMatch.round}</span>` : '';

            timeHeader.innerHTML = cleanTime ? `<strong>${cleanTime}</strong> ${leagueLogo} ${leagueName} ${roundInfo}` : `${leagueLogo} ${leagueName} ${roundInfo}`;
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
                    <!-- Design 4: Splittet Layout -->
                    <div class="split-container-v4">
                        <!-- Home Team Half -->
                        <div class="team-half-v4 home" style="${homeLogo ? `background: linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)), url('${homeLogo}') center/cover no-repeat;` : ''}">
                            <span class="team-name-v4">${match.homeTeam}</span>
                            <div class="score-controls-v4">
                                <button class="score-btn-v4" onclick="updateScore('${match.id}', 'home', false)" ${match.result ? 'disabled' : ''}>−</button>
                                <span class="score-display-v4" id="home-score-${match.id}">${homeScore === '?' ? '?' : homeScore}</span>
                                <button class="score-btn-v4" onclick="updateScore('${match.id}', 'home', true)" ${match.result ? 'disabled' : ''}>+</button>
                            </div>
                        </div>

                        <!-- VS Divider -->
                        <div class="split-divider-v4">
                            <span class="vs-split-v4">VS</span>
                        </div>

                        <!-- Away Team Half -->
                        <div class="team-half-v4 away" style="${awayLogo ? `background: linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)), url('${awayLogo}') center/cover no-repeat;` : ''}">
                            <span class="team-name-v4">${match.awayTeam}</span>
                            <div class="score-controls-v4">
                                <button class="score-btn-v4" onclick="updateScore('${match.id}', 'away', false)" ${match.result ? 'disabled' : ''}>−</button>
                                <span class="score-display-v4" id="away-score-${match.id}">${awayScore === '?' ? '?' : awayScore}</span>
                                <button class="score-btn-v4" onclick="updateScore('${match.id}', 'away', true)" ${match.result ? 'disabled' : ''}>+</button>
                            </div>
                        </div>
                    </div>

                    <!-- Odds Buttons (from Design 3) -->
                    ${match.odds && match.odds.H && match.odds.U && match.odds.B ? `
                        <div class="odds-buttons-v4">
                            <button class="odd-btn-v4" onclick="setScoreFromOdds('${match.id}', 'H')" ${match.result ? 'disabled' : ''}>
                                <span class="odd-label-v4">H</span>
                                <span class="odd-value-v4">${match.odds.H.toFixed(1)}</span>
                            </button>
                            <button class="odd-btn-v4" onclick="setScoreFromOdds('${match.id}', 'U')" ${match.result ? 'disabled' : ''}>
                                <span class="odd-label-v4">U</span>
                                <span class="odd-value-v4">${match.odds.U.toFixed(1)}</span>
                            </button>
                            <button class="odd-btn-v4" onclick="setScoreFromOdds('${match.id}', 'B')" ${match.result ? 'disabled' : ''}>
                                <span class="odd-label-v4">B</span>
                                <span class="odd-value-v4">${match.odds.B.toFixed(1)}</span>
                            </button>
                        </div>
                    ` : ''}
                `;
                dateGroup.appendChild(matchCard);
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

    // If the other score is still '?', set it to 0 visually
    if (homeScoreElement.textContent === '?') {
        homeScoreElement.textContent = '0';
    }
    if (awayScoreElement.textContent === '?') {
        awayScoreElement.textContent = '0';
    }

    const homeScore = parseInt(homeScoreElement.textContent);
    const awayScore = parseInt(awayScoreElement.textContent);

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

    // Update old score element (if it exists)
    const scoreElement = document.getElementById('totalScore');
    if (scoreElement) {
        scoreElement.textContent = totalScore.toFixed(1);
    }

    // Update header stats using shared header component
    updateHeaderStats(totalScore, userTips.length);
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

    // Guard: Element may not exist yet during initialization
    if (!dateLabel) return;

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
    // Note: updateDateDisplay() not called here since date navigation UI was removed
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
    if (!listContainer) {
        return;
    }

    listContainer.innerHTML = '';

    // Show all available leagues (not just selected ones)
    // This allows users to enable/disable leagues they want to see
    AVAILABLE_LEAGUES.forEach(leagueId => {
        const leagueName = getLeagueName(leagueId);
        const isSelected = selectedLeagues.has(leagueId);

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

    // Update API_CONFIG.LEAGUES to match selectedLeagues
    API_CONFIG.LEAGUES = Array.from(selectedLeagues);
    console.log('🔄 Updated API_CONFIG.LEAGUES:', API_CONFIG.LEAGUES);

    // Save to Firestore
    saveLeaguePreferences();

    // Update UI
    populateLeagueFilter();

    // Clear cache and reload matches with new leagues
    if (footballApi && footballApi.clearCache) {
        footballApi.clearCache();
    }
    loadMatches();
}

async function selectAllLeaguesFilter() {
    console.log('✅ SELECT ALL clicked!');
    console.log('   Before:', Array.from(selectedLeagues));

    try {
        // Select all available leagues
        selectedLeagues = new Set(AVAILABLE_LEAGUES);

        console.log('   After:', Array.from(selectedLeagues));

        // Update API_CONFIG.LEAGUES to match selectedLeagues
        API_CONFIG.LEAGUES = Array.from(selectedLeagues);

        console.log('   Saving preferences (in background)...');
        saveLeaguePreferences(); // Don't await - run in background

        console.log('   Calling populateLeagueFilter...');
        populateLeagueFilter();

        console.log('   Clearing cache and reloading...');
        // Clear cache and reload matches with new leagues
        if (footballApi && footballApi.clearCache) {
            footballApi.clearCache();
        }
        loadMatches();
    } catch (error) {
        console.error('❌ Error in selectAllLeaguesFilter:', error);
    }
}

async function deselectAllLeaguesFilter() {
    console.log('❌ DESELECT ALL clicked!');
    console.log('   Before:', Array.from(selectedLeagues));

    try {
        // Empty set = show nothing
        selectedLeagues = new Set();

        console.log('   After:', Array.from(selectedLeagues));

        // Update API_CONFIG.LEAGUES to match selectedLeagues
        API_CONFIG.LEAGUES = [];

        console.log('   Saving preferences (in background)...');
        saveLeaguePreferences(); // Don't await - run in background

        console.log('   Calling populateLeagueFilter...');
        populateLeagueFilter();

        console.log('   Clearing matches...');
        // Clear matches since no leagues are selected
        allMatches = [];
        applyLeagueFilter();
    } catch (error) {
        console.error('❌ Error in deselectAllLeaguesFilter:', error);
    }
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
window.updateScore = updateScore;

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

// Initialize app on page load
window.addEventListener('DOMContentLoaded', () => {
    init();
});
