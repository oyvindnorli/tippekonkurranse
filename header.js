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
        if (stored) {
            const data = JSON.parse(stored);
            // Check if session exists and hasn't obviously expired
            if (data && data.access_token && data.user) {
                const displayName = data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || '';
                return {
                    isLoggedIn: true,
                    displayName: displayName
                };
            }
        }
    } catch (e) {
        // Ignore errors
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
            <!-- Top Bar with Brand and Points -->
            <div class="header-top-bar">
                <div class="header-brand">
                    <h1 class="brand-title">Tippekonkurranse</h1>
                </div>
                <div class="header-right" id="headerRightContent" style="display: ${btnDisplayStyle};">
                    <span class="user-name-display" id="currentUsername">${usernameText}</span>
                    <button onclick="signOut()" class="btn-logout-neon" title="Logg ut">Logg ut</button>
                </div>
            </div>

            <!-- Navigation -->
            <nav class="nav-premium" id="mainNavButtons" style="display: ${displayStyle};">
                <a href="index.html" class="nav-btn-premium ${activePage === 'index' ? 'active' : ''}">
                    Tipp
                </a>
                <a href="competitions.html" class="nav-btn-premium ${activePage === 'competitions' ? 'active' : ''}">
                    Konkurranser
                </a>
                <a href="my-stats.html" class="nav-btn-premium ${activePage === 'my-stats' ? 'active' : ''}">
                    Statistikk
                </a>
            </nav>
        </header>
    `;
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
    const headerRight = document.getElementById('headerRightContent');
    const navButtons = document.getElementById('mainNavButtons');

    if (headerRight) {
        headerRight.style.display = isLoggedIn ? 'flex' : 'none';
    }
    if (navButtons) {
        navButtons.style.display = isLoggedIn ? 'flex' : 'none';
    }
}
