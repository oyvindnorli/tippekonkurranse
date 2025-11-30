// Supabase Authentication and Database Service
// Replaces Firebase with Supabase

let supabase, currentUser = null;

// Initialize Supabase
function initializeSupabase() {
    // Check if already initialized
    if (supabase && supabase.auth) {
        console.log('✅ Supabase already initialized');
        return;
    }

    try {
        // Store the original Supabase module before we overwrite window.supabase
        const supabaseModule = window.supabase;
        if (!supabaseModule || !supabaseModule.createClient) {
            throw new Error('Supabase SDK not loaded');
        }

        // Create Supabase client globally
        const { createClient } = supabaseModule;
        supabase = createClient(
            'https://ntbhjbstmbnfiaywfkkz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E',
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage
                }
            }
        );

        // Make supabase globally available
        window.supabase = supabase;
        window.currentUser = currentUser;

        console.log('✅ Supabase initialized successfully');

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                currentUser = session.user;
                window.currentUser = currentUser; // Update global
                window.currentSession = session; // Store session globally
                onUserLoggedIn(session.user);
            } else {
                currentUser = null;
                window.currentUser = null; // Update global
                window.currentSession = null; // Clear session
                onUserLoggedOut();
            }
        });

        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                currentUser = session.user;
                window.currentUser = currentUser; // Update global
                window.currentSession = session; // Store session globally
                onUserLoggedIn(session.user);
            }
        });

    } catch (error) {
        console.error('❌ Supabase initialization error:', error);
        alert('Kunne ikke koble til Supabase. Sjekk konsollen for detaljer.');
    }
}

// Sign up with email and password
async function signUp(email, password, displayName) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    display_name: displayName
                }
            }
        });

        if (error) throw error;

        // User record is automatically created by database trigger
        console.log('✅ User registered:', displayName);

        // Check if email confirmation is required
        // When email confirmation is enabled in Supabase:
        // - data.session will be null (no session until confirmed)
        // - data.user will exist (user is created)
        // - data.user.email_confirmed_at will be null
        const requiresEmailConfirmation = !data.session && !!data.user;

        return {
            success: true,
            requiresEmailConfirmation,
            user: data.user
        };
    } catch (error) {
        console.error('❌ Sign up error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in with Google OAuth
async function signInWithGoogle() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;

        console.log('✅ Redirecting to Google sign in...');
        return { success: true };
    } catch (error) {
        console.error('❌ Google sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in with email and password
async function signIn(email, password) {
    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        console.log('✅ User signed in');
        return { success: true };
    } catch (error) {
        console.error('❌ Sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        console.log('✅ User signed out');
        return { success: true };
    } catch (error) {
        console.error('❌ Sign out error:', error);
        return { success: false, error: error.message };
    }
}

// Reset password
async function resetPassword(email) {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });

        if (error) throw error;

        console.log('✅ Password reset email sent');
        return { success: true };
    } catch (error) {
        console.error('❌ Password reset error:', error);
        return { success: false, error: error.message };
    }
}

// Save tip to database
async function saveTipToFirestore(tip) {
    if (!currentUser) {
        console.error('No user logged in');
        return false;
    }

    try {
        const tipData = {
            user_id: currentUser.id,
            match_id: parseInt(tip.matchId),
            home_score: tip.homeScore,
            away_score: tip.awayScore,
            home_team: tip.homeTeam,
            away_team: tip.awayTeam,
            odds: tip.odds || null
        };

        // Use fetch() directly for upsert
        const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';

        // Get user's access token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            throw new Error('No access token available');
        }

        // Check if tip already exists
        const checkUrl = `${SUPABASE_URL}/rest/v1/tips?user_id=eq.${currentUser.id}&match_id=eq.${tip.matchId}`;
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
            // Update existing tip
            const updateUrl = `${SUPABASE_URL}/rest/v1/tips?user_id=eq.${currentUser.id}&match_id=eq.${tip.matchId}`;
            response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    home_score: tip.homeScore,
                    away_score: tip.awayScore,
                    updated_at: new Date().toISOString()
                })
            });
        } else {
            // Insert new tip
            response = await fetch(`${SUPABASE_URL}/rest/v1/tips`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tipData)
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        console.log('✅ Tip saved to Supabase');
        return true;
    } catch (error) {
        console.error('❌ Error saving tip:', error);
        return false;
    }
}

// Get current user's tips
async function getCurrentUserTips() {
    if (!currentUser) {
        return [];
    }

    try {
        // Use fetch() directly
        const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';

        const url = `${SUPABASE_URL}/rest/v1/tips?select=*&user_id=eq.${currentUser.id}`;

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Convert to Firebase-like format for compatibility
        return data.map(tip => ({
            matchId: String(tip.match_id),
            homeScore: tip.home_score,
            awayScore: tip.away_score,
            homeTeam: tip.home_team,
            awayTeam: tip.away_team,
            odds: tip.odds,
            timestamp: tip.timestamp,
            userId: tip.user_id,
            userDisplayName: currentUser.user_metadata?.display_name || currentUser.email
        }));
    } catch (error) {
        console.error('❌ Error getting user tips:', error);
        return [];
    }
}

// Get all users with their tips for leaderboard
async function getAllUsersWithTips() {
    try {
        // Use fetch() directly with join
        const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';

        const url = `${SUPABASE_URL}/rest/v1/tips?select=*,users(id,display_name,email)`;

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Group tips by user
        const userTipsMap = {};
        data.forEach(tip => {
            const userId = tip.user_id;
            if (!userTipsMap[userId]) {
                userTipsMap[userId] = {
                    userId: userId,
                    displayName: tip.users?.display_name || tip.users?.email || 'Unknown',
                    tips: []
                };
            }
            userTipsMap[userId].tips.push({
                matchId: String(tip.match_id),
                homeScore: tip.home_score,
                awayScore: tip.away_score,
                homeTeam: tip.home_team,
                awayTeam: tip.away_team,
                odds: tip.odds,
                timestamp: tip.timestamp,
                userId: tip.user_id
            });
        });

        return Object.values(userTipsMap);
    } catch (error) {
        console.error('❌ Error getting all users:', error);
        return [];
    }
}

// Wait for header elements to exist (header.js is a module and loads after this script)
async function waitForHeaderElements(maxAttempts = 50) {
    let attempts = 0;
    // Wait for both mainNavButtons and currentUsername to exist
    while ((!document.getElementById('mainNavButtons') || !document.getElementById('currentUsername')) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    return document.getElementById('currentUsername') !== null;
}

// Called when user logs in
async function onUserLoggedIn(user) {
    // Hide auth modal (only exists on index.html)
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'none';
    }

    // Wait for header elements to be rendered (header.js is a module, loads after regular scripts)
    await waitForHeaderElements();

    // Update UI - fetch displayName from database
    const currentUsername = document.getElementById('currentUsername');
    const usernameDisplay = document.getElementById('usernameDisplay');

    if (currentUsername) {
        // Use displayName from user metadata (set during signup)
        const displayName = user.user_metadata?.display_name || user.email.split('@')[0];
        currentUsername.textContent = `Innlogget som ${displayName}`;
        currentUsername.style.display = 'block';

        // Show username display
        if (usernameDisplay) {
            usernameDisplay.style.display = 'inline';
        }
        // Show user section with fade-in
        const currentUserDiv = currentUsername.closest('.current-user');
        if (currentUserDiv) {
            currentUserDiv.classList.add('loaded');
        }
    }

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.style.display = 'inline-block';
    }

    // Show user stats bar (for premium header)
    const userStatsBar = document.getElementById('userStatsBar');
    if (userStatsBar) {
        userStatsBar.style.display = 'flex';
    }

    // Show navigation buttons immediately
    const mainNavButtons = document.getElementById('mainNavButtons');
    if (mainNavButtons) {
        mainNavButtons.style.display = 'flex';
    }

    // NOTE: Data loading is handled by app-firebase.js onAuthStateChange listener
    // No need to call loadFirebaseData here as it causes duplicate loads
}

// Called when user logs out
function onUserLoggedOut() {
    console.log('User logged out');

    // Redirect to home page after logout (except if already on index.html)
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
        return;
    }

    // Update UI on index.html
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) {
        usernameDisplay.style.display = 'none';
    }

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.style.display = 'none';
    }

    // Hide user stats bar (for premium header)
    const userStatsBar = document.getElementById('userStatsBar');
    if (userStatsBar) {
        userStatsBar.style.display = 'none';
    }

    // Hide navigation buttons
    const mainNavButtons = document.getElementById('mainNavButtons');
    if (mainNavButtons) {
        mainNavButtons.style.display = 'none';
    }

    // Show welcome section, hide main content
    const welcomeSection = document.getElementById('welcomeSection');
    const mainContent = document.getElementById('mainContent');
    if (welcomeSection) {
        welcomeSection.style.display = 'block';
    }
    if (mainContent) {
        mainContent.style.display = 'none';
    }

    // Clear data
    if (typeof userTips !== 'undefined') {
        userTips = [];
    }

    if (typeof renderMatches === 'function') {
        renderMatches();
    }

    // Clear leaderboard
    const leaderboardDiv = document.getElementById('leaderboard');
    if (leaderboardDiv) {
        leaderboardDiv.innerHTML = '<div class="no-tips">Logg inn for å se topplisten</div>';
    }
}

// NOTE: loadFirebaseData() is now defined in app-firebase.js and exported to window
// This file calls window.loadFirebaseData() when user logs in

// Load leaderboard from Supabase
async function loadFirebaseLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');

    // Check if leaderboard element exists (only on leaderboard.html page)
    if (!leaderboardDiv) {
        return;
    }

    // Wait for matches to be loaded if calculatePlayerScore exists (on leaderboard page)
    if (typeof calculatePlayerScore === 'function') {
        // Check if matches array exists and wait if needed
        let attempts = 0;
        while (typeof matches === 'undefined' || matches.length === 0) {
            if (attempts > 50) { // Max 5 seconds wait
                console.error('❌ Timeout waiting for matches to load');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        console.log(`✅ Matches loaded for leaderboard: ${matches ? matches.length : 0}`);
    }

    const usersData = await getAllUsersWithTips();
    console.log(`👥 Users with tips: ${usersData.length}`);

    // Calculate scores
    const players = usersData.map(userData => ({
        name: userData.displayName,
        score: calculatePlayerScore(userData.tips),
        isCurrentUser: currentUser && userData.userId === currentUser.id
    }));

    // Sort and render
    players.sort((a, b) => b.score - a.score);

    leaderboardDiv.innerHTML = '';

    if (players.length === 0) {
        leaderboardDiv.innerHTML = '<div class="no-tips">Ingen tips lagt inn ennå</div>';
        return;
    }

    players.forEach((player, index) => {
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';

        const playerRow = document.createElement('div');
        playerRow.className = `leaderboard-row ${player.isCurrentUser ? 'current-user' : ''}`;
        playerRow.innerHTML = `
            <div class="leaderboard-position">${medal || position}</div>
            <div class="leaderboard-name">${player.name}</div>
            <div class="leaderboard-score">${player.score.toFixed(1)} poeng</div>
        `;
        leaderboardDiv.appendChild(playerRow);
    });
}

// Make signOut available globally for onclick handler in header
window.signOut = signOut;

// Initialize Supabase when script loads
initializeSupabase();
