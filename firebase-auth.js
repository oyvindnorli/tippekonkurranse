// Firebase Authentication and Firestore Service
// Import Firebase (loaded from CDN in HTML)

let auth, db, currentUser = null;

// Initialize Firebase
function initializeFirebase() {
    try {
        // Initialize Firebase App
        firebase.initializeApp(firebaseConfig);

        // Get Auth and Firestore instances
        auth = firebase.auth();
        db = firebase.firestore();

        console.log('✅ Firebase initialized successfully');

        // Listen for auth state changes
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                onUserLoggedIn(user);
            } else {
                currentUser = null;
                onUserLoggedOut();
            }
        });

    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        alert('Kunne ikke koble til Firebase. Sjekk konsollen for detaljer.');
    }
}

// Sign up with email and password
async function signUp(email, password, displayName) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Update display name
        await user.updateProfile({ displayName: displayName });

        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: email,
            displayName: displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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
        await auth.signInWithEmailAndPassword(email, password);
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
        await auth.signOut();
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
        await auth.sendPasswordResetEmail(email);
        console.log('✅ Password reset email sent');
        return { success: true };
    } catch (error) {
        console.error('❌ Password reset error:', error);
        return { success: false, error: error.message };
    }
}

// Save tip to Firestore
async function saveTipToFirestore(tip) {
    if (!currentUser) {
        console.error('No user logged in');
        return false;
    }

    try {
        const tipData = {
            ...tip,
            userId: currentUser.uid,
            userDisplayName: currentUser.displayName || currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Use matchId + userId as document ID to ensure one tip per match per user
        const docId = `${currentUser.uid}_${tip.matchId}`;

        await db.collection('tips').doc(docId).set(tipData);
        console.log('✅ Tip saved to Firestore');
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
        const snapshot = await db.collection('tips')
            .where('userId', '==', currentUser.uid)
            .get();

        const tips = [];
        snapshot.forEach(doc => {
            tips.push(doc.data());
        });

        return tips;
    } catch (error) {
        console.error('❌ Error getting user tips:', error);
        return [];
    }
}

// Get all users with their tips for leaderboard
async function getAllUsersWithTips() {
    try {
        // Get all tips
        const tipsSnapshot = await db.collection('tips').get();

        // Group tips by user
        const userTipsMap = {};
        tipsSnapshot.forEach(doc => {
            const tip = doc.data();
            if (!userTipsMap[tip.userId]) {
                userTipsMap[tip.userId] = {
                    userId: tip.userId,
                    displayName: tip.userDisplayName,
                    tips: []
                };
            }
            userTipsMap[tip.userId].tips.push(tip);
        });

        // Convert to array
        return Object.values(userTipsMap);
    } catch (error) {
        console.error('❌ Error getting all users:', error);
        return [];
    }
}

// Called when user logs in
function onUserLoggedIn(user) {
    console.log('User logged in:', user.displayName || user.email);

    // Hide auth modal (only exists on index.html)
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'none';
    }

    // Update UI - fetch displayName from Firestore
    const currentUsername = document.getElementById('currentUsername');
    if (currentUsername) {
        // Fetch displayName from users collection
        const db = firebase.firestore();
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                currentUsername.textContent = doc.data().displayName || user.email;
            } else {
                currentUsername.textContent = user.email;
            }
            // Show user section with fade-in
            const currentUserDiv = currentUsername.closest('.current-user');
            if (currentUserDiv) {
                currentUserDiv.classList.add('loaded');
            }
        }).catch(error => {
            console.warn('Could not fetch displayName:', error);
            currentUsername.textContent = user.email;
            // Show user section even on error
            const currentUserDiv = currentUsername.closest('.current-user');
            if (currentUserDiv) {
                currentUserDiv.classList.add('loaded');
            }
        });
    }

    const authSection = document.getElementById('authSection');
    if (authSection) {
        authSection.style.display = 'none';
    }

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.style.display = 'inline-block';
    }

    // Show navigation buttons
    const mainNavButtons = document.getElementById('mainNavButtons');
    if (mainNavButtons) {
        mainNavButtons.style.display = 'flex';
    }

    // Load user data
    loadFirebaseData();
}

// Called when user logs out
function onUserLoggedOut() {
    console.log('User logged out');

    // Don't show auth modal automatically - let user click login button instead
    // document.getElementById('authModal').style.display = 'block';

    // Update UI
    const currentUsername = document.getElementById('currentUsername');
    if (currentUsername) {
        currentUsername.textContent = 'Ikke innlogget';
        // Make sure the user section is visible even when logged out
        const currentUserDiv = currentUsername.closest('.current-user');
        if (currentUserDiv) {
            currentUserDiv.classList.add('loaded');
        }
    }

    const authSection = document.getElementById('authSection');
    if (authSection) {
        authSection.style.display = 'block';
    }

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.style.display = 'none';
    }

    // Hide navigation buttons
    const mainNavButtons = document.getElementById('mainNavButtons');
    if (mainNavButtons) {
        mainNavButtons.style.display = 'none';
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

// Load all data from Firebase
async function loadFirebaseData() {
    console.log('🔄 Loading Firebase data...');

    // Load user tips (only if userTips variable exists, i.e., on index.html)
    if (typeof userTips !== 'undefined') {
        userTips = await getCurrentUserTips();
        console.log('📥 Loaded tips from Firebase:', userTips.length);
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

// Load leaderboard from Firebase
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
        isCurrentUser: currentUser && userData.userId === currentUser.uid
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
            <div class="leaderboard-score">${player.score.toFixed(2)} poeng</div>
        `;
        leaderboardDiv.appendChild(playerRow);
    });
}
