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
            <!-- Top Bar with Brand and Logout -->
            <div class="header-top-bar">
                <div class="header-brand">
                    <span class="brand-icon">⚽</span>
                    <h1 class="brand-title">Tippekonkurranse</h1>
                </div>
                <button id="signOutBtn" onclick="signOut()" class="btn-logout-premium" style="display: ${btnDisplayStyle};">Logg ut</button>
            </div>

            <!-- User Stats Bar -->
            <div class="user-stats-bar" id="userStatsBar" style="display: ${displayStyle};">
                <div class="user-info-premium">
                    <span class="user-label-premium">Bruker:</span>
                    <span class="user-name-premium" id="currentUsername"></span>
                </div>
                <div class="stats-premium">
                    <div class="stat-item-premium">
                        <span class="stat-value-premium" id="totalPointsDisplay">0</span>
                        <span class="stat-label-premium">Poeng</span>
                    </div>
                    <div class="stat-divider-premium"></div>
                    <div class="stat-item-premium">
                        <span class="stat-value-premium" id="totalTipsDisplay">0</span>
                        <span class="stat-label-premium">Tips</span>
                    </div>
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
 * Update user stats in header
 * @param {number} totalPoints - Total points
 * @param {number} totalTips - Total tips count
 */
export function updateHeaderStats(totalPoints, totalTips) {
    const totalPointsDisplay = document.getElementById('totalPointsDisplay');
    const totalTipsDisplay = document.getElementById('totalTipsDisplay');

    if (totalPointsDisplay) {
        totalPointsDisplay.textContent = Math.round(totalPoints);
    }
    if (totalTipsDisplay) {
        totalTipsDisplay.textContent = totalTips;
    }
}

/**
 * Update username in header
 * @param {string} username - Username to display
 */
export function updateHeaderUsername(username) {
    const usernameElement = document.getElementById('currentUsername');
    if (usernameElement) {
        usernameElement.textContent = username;
    }
}

/**
 * Show/hide header elements based on auth state
 * @param {boolean} isLoggedIn - Whether user is logged in
 */
export function updateHeaderAuthState(isLoggedIn) {
    const signOutBtn = document.getElementById('signOutBtn');
    const userStatsBar = document.getElementById('userStatsBar');
    const navButtons = document.getElementById('mainNavButtons');

    if (signOutBtn) {
        signOutBtn.style.display = isLoggedIn ? 'block' : 'none';
    }
    if (userStatsBar) {
        userStatsBar.style.display = isLoggedIn ? 'flex' : 'none';
    }
    if (navButtons) {
        navButtons.style.display = isLoggedIn ? 'flex' : 'none';
    }
}
