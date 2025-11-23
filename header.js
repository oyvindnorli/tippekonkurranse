/**
 * Header Component
 * Shared header for all pages with user stats and navigation
 */

/**
 * Check if user appears to be logged in (from localStorage)
 * This is a quick check to show UI immediately, actual auth state is verified by Supabase
 */
function hasStoredSession() {
    try {
        // Supabase stores session in localStorage
        const storageKey = 'sb-ntbhjbstmbnfiaywfkkz-auth-token';
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const data = JSON.parse(stored);
            // Check if session exists and hasn't obviously expired
            return data && data.access_token;
        }
    } catch (e) {
        // Ignore errors
    }
    return false;
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
    const isLoggedIn = hasStoredSession();
    const displayStyle = isLoggedIn ? 'flex' : 'none';
    const btnDisplayStyle = isLoggedIn ? 'block' : 'none';

    headerContainer.innerHTML = `
        <header class="header-premium">
            <!-- Top Bar with Brand, User and Logout -->
            <div class="header-top-bar">
                <div class="header-brand">
                    <span class="brand-icon">⚽</span>
                    <h1 class="brand-title">Tippekonkurranse</h1>
                </div>
                <div class="header-right">
                    <span class="user-name-display" id="currentUsername" style="display: ${btnDisplayStyle};"></span>
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
