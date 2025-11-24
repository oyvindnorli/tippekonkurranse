/**
 * Header Component
 * Shared header for all pages with user stats and navigation
 */

/**
 * Check if user appears to be logged in (from localStorage)
 * This is a quick check to show UI immediately, actual auth state is verified by Supabase
 * @returns {object|null} - Returns user data if logged in, null otherwise
 */
function getStoredSession() {
    try {
        // Supabase stores session in localStorage
        const storageKey = 'sb-ntbhjbstmbnfiaywfkkz-auth-token';
        const stored = localStorage.getItem(storageKey);
        console.log('🔍 Header: localStorage raw:', stored ? 'found' : 'not found');
        if (stored) {
            const data = JSON.parse(stored);
            console.log('🔍 Header: parsed data keys:', Object.keys(data));
            console.log('🔍 Header: user exists?', !!data.user);
            if (data.user) {
                console.log('🔍 Header: user_metadata:', data.user.user_metadata);
            }
            // Check if session exists and hasn't obviously expired
            if (data && data.access_token && data.user) {
                const displayName = data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || '';
                console.log('🔍 Header: displayName =', displayName);
                return {
                    isLoggedIn: true,
                    displayName: displayName
                };
            }
        }
    } catch (e) {
        console.error('🔍 Header: error reading session:', e);
    }
    return null;
}

/**
 * Initialize and render the header
 * @param {string} activePage - The current active page ('index', 'competitions', 'preferences')
 */
export function initHeader(activePage = 'index') {
    const headerContainer = document.getElementById('headerContainer');
    if (!headerContainer) {
        console.error('Header container not found! Add <div id="headerContainer"></div> to your HTML');
        return;
    }

    // Check if user appears to be logged in to show nav immediately
    const session = getStoredSession();
    const isLoggedIn = session !== null;
    const displayStyle = isLoggedIn ? 'flex' : 'none';
    const btnDisplayStyle = isLoggedIn ? 'block' : 'none';
    const usernameText = isLoggedIn && session.displayName ? `Innlogget som ${session.displayName}` : '';

    headerContainer.innerHTML = `
        <header class="header-premium">
            <!-- Top Bar with Brand, User and Logout -->
            <div class="header-top-bar">
                <div class="header-brand">
                    <span class="brand-icon">⚽</span>
                    <h1 class="brand-title">Tippekonkurranse</h1>
                </div>
                <div class="header-right">
                    <span class="user-name-display" id="currentUsername" style="display: ${btnDisplayStyle};">${usernameText}</span>
                    <button id="signOutBtn" onclick="signOut()" class="btn-logout-premium" style="display: ${btnDisplayStyle};">Logg ut</button>
                </div>
            </div>

            <!-- Navigation -->
            <nav class="nav-premium" id="mainNavButtons" style="display: ${displayStyle};">
                <a href="index.html" class="nav-btn-premium ${activePage === 'index' ? 'active' : ''}">
                    <span class="nav-icon-premium">🏠</span>
                    Tipp
                </a>
                <a href="competitions.html" class="nav-btn-premium ${activePage === 'competitions' ? 'active' : ''}">
                    <span class="nav-icon-premium">🏆</span>
                    Konkurranser
                </a>
                <a href="my-stats.html" class="nav-btn-premium ${activePage === 'my-stats' ? 'active' : ''}">
                    <span class="nav-icon-premium">📊</span>
                    Min Statistikk
                </a>
            </nav>
        </header>
    `;
}

/**
 * Update user stats in header (deprecated - kept for compatibility)
 */
export function updateHeaderStats(totalPoints, totalTips) {
    // Stats bar removed from header
}

/**
 * Update username in header
 * @param {string} username - Username to display
 */
export function updateHeaderUsername(username) {
    const usernameElement = document.getElementById('currentUsername');
    if (usernameElement) {
        usernameElement.textContent = `Innlogget som ${username}`;
    }
}

/**
 * Show/hide header elements based on auth state
 * @param {boolean} isLoggedIn - Whether user is logged in
 */
export function updateHeaderAuthState(isLoggedIn) {
    const signOutBtn = document.getElementById('signOutBtn');
    const usernameElement = document.getElementById('currentUsername');
    const navButtons = document.getElementById('mainNavButtons');

    if (signOutBtn) {
        signOutBtn.style.display = isLoggedIn ? 'block' : 'none';
    }
    if (usernameElement) {
        usernameElement.style.display = isLoggedIn ? 'block' : 'none';
    }
    if (navButtons) {
        navButtons.style.display = isLoggedIn ? 'flex' : 'none';
    }
}
