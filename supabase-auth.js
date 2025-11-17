// Supabase Authentication and Database Service
// Replaces Firebase with Supabase

let supabase, currentUser = null;

// Initialize Supabase
function initializeSupabase() {
    try {
        // Create Supabase client globally
        const { createClient } = window.supabase;
        supabase = createClient(
            'https://ntbhjbstmbnfiaywfkkz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E'
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
                onUserLoggedIn(session.user);
            } else {
                currentUser = null;
                window.currentUser = null; // Update global
                onUserLoggedOut();
            }
        });

        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                currentUser = session.user;
                window.currentUser = currentUser; // Update global
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
        return { success: true };
    } catch (error) {
        console.error('❌ Sign up error:', error);
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

        const { error } = await supabase
            .from('tips')
            .upsert(tipData);

        if (error) throw error;

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
        const { data, error } = await supabase
            .from('tips')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;

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
        // Get all tips with user info
        const { data, error } = await supabase
            .from('tips')
            .select(`
                *,
                users (
                    id,
                    display_name,
                    email
                )
            `);

        if (error) throw error;

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

// Called when user logs in
async function onUserLoggedIn(user) {
    console.log('User logged in:', user.user_metadata?.display_name || user.email);

    // Hide auth modal (only exists on index.html)
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'none';
    }

    // Update UI - fetch displayName from database
    const currentUsername = document.getElementById('currentUsername');
    const usernameDisplay = document.getElementById('usernameDisplay');

    if (currentUsername) {
        try {
            // Fetch displayName from users table
            const { data, error } = await supabase
                .from('users')
                .select('display_name')
                .eq('id', user.id)
                .single();

            if (data && !error) {
                currentUsername.textContent = data.display_name || user.email;
            } else {
                currentUsername.textContent = user.user_metadata?.display_name || user.email;
            }
        } catch (error) {
            console.warn('Could not fetch displayName:', error);
            currentUsername.textContent = user.user_metadata?.display_name || user.email;
        }

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

    // Load user data (wait for function to be available)
    if (typeof window.loadFirebaseData === 'function') {
        window.loadFirebaseData();
    } else {
        // Function not loaded yet, wait and retry
        console.log('⏳ Waiting for loadFirebaseData to be available...');
        const checkInterval = setInterval(() => {
            if (typeof window.loadFirebaseData === 'function') {
                clearInterval(checkInterval);
                console.log('✅ loadFirebaseData is now available, calling it...');
                window.loadFirebaseData();
            }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (typeof window.loadFirebaseData !== 'function') {
                console.error('❌ loadFirebaseData never became available');
            }
        }, 5000);
    }
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

// Load all data from Supabase
async function loadFirebaseData() {
    console.log('🔄 Loading Supabase data...');

    // Load user tips (only if userTips variable exists, i.e., on index.html)
    if (typeof userTips !== 'undefined') {
        userTips = await getCurrentUserTips();
        console.log('📥 Loaded tips from Supabase:', userTips.length);
    }

    // Re-render everything with the loaded tips (only on index.html)
    if (typeof renderMatches === 'function') {
        renderMatches();
    }

    if (typeof updateTotalScore === 'function') {
        updateTotalScore();
    }

    // On leaderboard page, trigger reload if matches are ready
    if (typeof loadLeaderboardData === 'function' && typeof matches !== 'undefined' && matches.length > 0) {
        console.log('🔄 User logged in, reloading leaderboard with existing matches...');
        await loadFirebaseLeaderboard();
    }
    // On other pages, load leaderboard normally
    else if (typeof loadLeaderboardData === 'undefined') {
        await loadFirebaseLeaderboard();
    }
}

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
