// vm2026.js – VM 2026 tippekonkurranse (standalone module)

const SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E';
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const WC_FROM = '2026-06-11';
const WC_TO = '2026-07-19';
const API_BASE = '/api/football';
const REDIRECT_URL = window.location.hostname === 'localhost'
    ? window.location.origin
    : 'https://tippekonkurran.se';

// --- STATE ---
let client;
let currentUser = null;
let currentSession = null;
let wcMatches = [];
let userTips = {};      // matchId (string) → { homeScore, awayScore, odds, points }
let allMatchTips = {}; // matchId (string) → [{userId, displayName, homeScore, awayScore}]
let leaderboardUsers = {}; // uid → { name, totalPoints, tipsCount, tips: {matchId:{home,away,odds}} }
let activeTab = 'matches';

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    startCountdown();
});

// --- SUPABASE AUTH ---
function initSupabase() {
    const { createClient } = window.supabase;
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
        }
    });

    client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            currentUser = session.user;
            currentSession = session;
            await onLoggedIn(session.user);
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentSession = null;
            userTips = {};
            onLoggedOut();
        }
    });

    client.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
            currentUser = session.user;
            currentSession = session;
            await onLoggedIn(session.user);
        } else {
            updateAuthUI(false, null);
            await loadMatches();
            renderMatches();
        }
    });
}

async function handleGoogleSignIn() {
    const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: REDIRECT_URL,
            queryParams: { prompt: 'select_account' }
        }
    });
    if (error) console.error('Google sign-in error:', error);
}
window.handleGoogleSignIn = handleGoogleSignIn;

async function handleSignOut() {
    await client.auth.signOut();
}
window.handleSignOut = handleSignOut;

// --- USERNAME/PASSWORD AUTH ---
let authTabMode = 'signin';

window.switchAuthTab = function(mode) {
    authTabMode = mode;
    document.getElementById('tabSignin').classList.toggle('active', mode === 'signin');
    document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
    document.getElementById('vmUserSubmitBtn').textContent = mode === 'signin' ? 'Logg inn' : 'Opprett konto';
    document.getElementById('vmPasswordInput').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    document.getElementById('vmAuthError').style.display = 'none';
};

function usernameToEmail(username) {
    return username.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '') + '@tippekonkurran.se';
}

window.handleUserAuth = async function() {
    const username = document.getElementById('vmUsernameInput').value.trim();
    const password = document.getElementById('vmPasswordInput').value;
    const errorEl = document.getElementById('vmAuthError');
    const btn = document.getElementById('vmUserSubmitBtn');

    errorEl.style.display = 'none';

    if (username.length < 2) {
        errorEl.textContent = 'Brukernavn må ha minst 2 tegn.';
        errorEl.style.display = 'block';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Passord må ha minst 6 tegn.';
        errorEl.style.display = 'block';
        return;
    }

    const email = usernameToEmail(username);
    btn.disabled = true;
    btn.textContent = authTabMode === 'signin' ? 'Logger inn...' : 'Oppretter konto...';

    if (authTabMode === 'signup') {
        const { error } = await client.auth.signUp({
            email,
            password,
            options: { data: { display_name: username } }
        });
        if (error) {
            const alreadyTaken = error.message.toLowerCase().includes('already') || error.status === 422;
            errorEl.textContent = alreadyTaken
                ? 'Dette brukernavnet er tatt. Velg et annet, eller logg inn.'
                : error.message;
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Opprett konto';
        } else {
            closeAuthModal();
        }
    } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
            errorEl.textContent = 'Feil brukernavn eller passord.';
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Logg inn';
        } else {
            closeAuthModal();
        }
    }
};

async function onLoggedIn(user) {
    updateAuthUI(true, user);
    await upsertUserProfile(user);
    await loadMatches();
    await Promise.all([loadUserTips(), loadAllTipsForLiveAndFinished()]);
    if (new URLSearchParams(window.location.search).get('preview') === 'live') injectPreviewTips();
    renderCurrentTab();
}

async function upsertUserProfile(user) {
    const displayName = user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.user_metadata?.display_name
        || user.email?.split('@')[0]
        || 'Ukjent';
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${currentSession.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ id: user.id, display_name: displayName, email: user.email })
        });
        if (!r.ok) console.warn('upsertUserProfile failed:', r.status, await r.text());
    } catch (e) {
        console.warn('Could not upsert user profile:', e);
    }
}

function onLoggedOut() {
    updateAuthUI(false, null);
    // Only re-render if matches are already loaded (i.e. user signed out mid-session)
    if (wcMatches.length > 0) renderCurrentTab();
}

function updateAuthUI(loggedIn, user) {
    const loginBtn = document.getElementById('vmLoginBtn');
    const logoutBtn = document.getElementById('vmLogoutBtn');
    const usernameEl = document.getElementById('vmUsername');

    if (loggedIn && user) {
        const rawName = user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.user_metadata?.display_name
            || user.email?.split('@')[0]
            || 'Bruker';
        const firstName = rawName.trim().split(/\s+/)[0];
        const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (usernameEl) { usernameEl.textContent = name; usernameEl.style.display = 'block'; }
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (usernameEl) usernameEl.style.display = 'none';
    }
}

// --- TABS ---
function showTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.vm-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.vm-tab-content').forEach(el => el.style.display = 'none');
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const contentEl = document.getElementById(`tab-${tab}`);
    if (contentEl) contentEl.style.display = 'block';
    if (tab === 'leaderboard') loadLeaderboard();
}
window.showTab = showTab;

function renderCurrentTab() {
    if (activeTab === 'matches') renderMatches();
    else loadLeaderboard();
}

// --- PREVIEW MODE ---
function getPreviewMatches() {
    return [
        {
            id: 999998,
            homeTeam: 'Brazil',
            awayTeam: 'Argentina',
            homeLogo: 'https://media.api-sports.io/football/teams/6.png',
            awayLogo: 'https://media.api-sports.io/football/teams/26.png',
            commence_time: new Date(Date.now() - 120 * 60000).toISOString(),
            status: 'FT',
            round: 'Group Stage - 1',
            league_id: WC_LEAGUE_ID,
            result: { home: 2, away: 1 },
            odds: { H: 2.1, U: 3.4, B: 3.6 },
            completed: true,
            elapsed: null
        },
        {
            id: 999999,
            homeTeam: 'USA',
            awayTeam: 'Portugal',
            homeLogo: 'https://media.api-sports.io/football/teams/6667.png',
            awayLogo: 'https://media.api-sports.io/football/teams/27.png',
            commence_time: new Date(Date.now() - 63 * 60000).toISOString(),
            status: '2H',
            round: 'Group Stage - 1',
            league_id: WC_LEAGUE_ID,
            result: { home: 1, away: 1 },
            odds: { H: 3.2, U: 3.4, B: 2.1 },
            completed: false,
            elapsed: 63
        }
    ];
}

function getPreviewLeaderboardTips() {
    const mkUser = (id, name) => ({ id, display_name: name, email: null });
    return [
        // Brazil 2–1 Argentina (FT, match 999998) – odds H:2.1
        { user_id: 'p1', match_id: 999998, home_score: 2, away_score: 0, odds: null, users: mkUser('p1', 'Lars Larsen') },
        { user_id: 'p2', match_id: 999998, home_score: 1, away_score: 1, odds: null, users: mkUser('p2', 'Kari Hansen') },
        { user_id: 'p3', match_id: 999998, home_score: 2, away_score: 1, odds: null, users: mkUser('p3', 'Ole Nordmann') },
        { user_id: 'p4', match_id: 999998, home_score: 0, away_score: 2, odds: null, users: mkUser('p4', 'Marte Olsen') },
        // USA 1–1 Portugal (LIVE, match 999999) – not completed, no points yet
        { user_id: 'p1', match_id: 999999, home_score: 2, away_score: 1, odds: null, users: mkUser('p1', 'Lars Larsen') },
        { user_id: 'p2', match_id: 999999, home_score: 0, away_score: 0, odds: null, users: mkUser('p2', 'Kari Hansen') },
        { user_id: 'p3', match_id: 999999, home_score: 1, away_score: 2, odds: null, users: mkUser('p3', 'Ole Nordmann') },
    ];
}

// --- MATCH DATA ---
async function loadMatches() {
    const preview = new URLSearchParams(window.location.search).get('preview') === 'live';

    // 1. Try Supabase cache
    const supabaseMatches = await fetchMatchesFromSupabase();

    if (supabaseMatches.length > 0) {
        wcMatches = preview ? [...getPreviewMatches(), ...supabaseMatches] : supabaseMatches;
    } else {
        // 2. Fetch from API-Football and try to cache
        const apiMatches = await fetchMatchesFromAPI();
        if (apiMatches.length > 0) {
            await tryInsertMatchesToSupabase(apiMatches);
            wcMatches = preview ? [...getPreviewMatches(), ...apiMatches] : apiMatches;
        } else {
            wcMatches = preview ? getPreviewMatches() : [];
        }
    }

}

function injectPreviewTips() {
    // Brazil 2–1 Argentina (FT): variety of tips with different outcomes
    allMatchTips['999998'] = [
        { userId: 'p1', displayName: 'Lars',  homeScore: 2, awayScore: 0 },
        { userId: 'p2', displayName: 'Kari',  homeScore: 1, awayScore: 1 },
        { userId: 'p3', displayName: 'Ole',   homeScore: 2, awayScore: 1 },
        { userId: 'p4', displayName: 'Marte', homeScore: 0, awayScore: 2 },
    ];
    // USA 1–1 Portugal (LIVE 63'): just scores, no points shown
    allMatchTips['999999'] = [
        { userId: 'p1', displayName: 'Lars',  homeScore: 2, awayScore: 1 },
        { userId: 'p2', displayName: 'Kari',  homeScore: 0, awayScore: 0 },
        { userId: 'p3', displayName: 'Ole',   homeScore: 1, awayScore: 2 },
    ];
}

async function fetchMatchesFromSupabase() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/matches?league_id=eq.${WC_LEAGUE_ID}&season=eq.${WC_SEASON}&order=commence_time.asc&select=*`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.map(row => ({
            id: row.id,
            homeTeam: row.home_team,
            awayTeam: row.away_team,
            homeLogo: row.home_logo,
            awayLogo: row.away_logo,
            commence_time: row.commence_time,
            status: row.status,
            round: row.round,
            league_id: row.league_id,
            result: row.home_score !== null
                ? { home: row.home_score, away: row.away_score ?? 0 }
                : null,
            odds: row.odds,
            completed: row.completed,
            elapsed: row.elapsed
        }));
    } catch {
        return [];
    }
}

async function fetchMatchesFromAPI() {
    try {
        const url = `${API_BASE}?endpoint=fixtures&league=${WC_LEAGUE_ID}&season=${WC_SEASON}&from=${WC_FROM}&to=${WC_TO}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.response?.length) return [];

        return data.response
            .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
            .map(f => ({
                id: f.fixture.id,
                homeTeam: f.teams.home.name,
                awayTeam: f.teams.away.name,
                homeLogo: f.teams.home.logo,
                awayLogo: f.teams.away.logo,
                commence_time: f.fixture.date,
                status: f.fixture.status.short,
                round: f.league.round,
                league_id: f.league.id,
                result: (f.goals.home !== null && f.goals.away !== null)
                    ? { home: f.goals.home, away: f.goals.away }
                    : null,
                odds: null,
                completed: ['FT', 'AET', 'PEN'].includes(f.fixture.status.short),
                elapsed: f.fixture.status.elapsed
            }));
    } catch (e) {
        console.error('API fetch error:', e);
        return [];
    }
}

async function tryInsertMatchesToSupabase(matches) {
    if (!currentSession?.access_token) return;
    try {
        const rows = matches.map(m => ({
            id: m.id,
            home_team: m.homeTeam,
            away_team: m.awayTeam,
            home_logo: m.homeLogo || null,
            away_logo: m.awayLogo || null,
            league_id: WC_LEAGUE_ID,
            league_name: 'FIFA World Cup',
            round: m.round || null,
            season: WC_SEASON,
            commence_time: m.commence_time,
            status: m.status,
            home_score: m.result?.home ?? null,
            away_score: m.result?.away ?? null,
            odds: m.odds || null,
            completed: m.completed || false,
            elapsed: m.elapsed || null
        }));

        await fetch(`${SUPABASE_URL}/rest/v1/matches`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${currentSession.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=ignore-duplicates'
            },
            body: JSON.stringify(rows)
        });
    } catch (e) {
        console.warn('Could not cache matches to Supabase:', e);
    }
}

// --- TIPS ---
async function loadUserTips() {
    if (!currentUser) return;
    try {
        const matchIds = wcMatches.map(m => m.id);
        if (!matchIds.length) return;

        const filter = matchIds.map(id => `match_id.eq.${id}`).join(',');
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tips?user_id=eq.${currentUser.id}&or=(${filter})&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${currentSession.access_token}`
                }
            }
        );
        if (!res.ok) return;
        const data = await res.json();

        userTips = {};
        data.forEach(tip => {
            const match = wcMatches.find(m => m.id === tip.match_id);
            let points = null;
            if (match?.completed && match.result) {
                points = calculatePoints(
                    { homeScore: tip.home_score, awayScore: tip.away_score, odds: tip.odds },
                    { result: match.result, odds: match.odds }
                );
            }
            userTips[String(tip.match_id)] = {
                homeScore: tip.home_score,
                awayScore: tip.away_score,
                odds: tip.odds,
                points
            };
        });
    } catch (e) {
        console.error('Error loading tips:', e);
    }
}

async function loadAllTipsForLiveAndFinished() {
    if (!currentSession?.access_token) return;
    const targets = wcMatches.filter(m => m.completed || isMatchLive(m.status));
    if (!targets.length) return;
    const filter = targets.map(m => `match_id.eq.${m.id}`).join(',');
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tips?or=(${filter})&select=match_id,home_score,away_score,user_id,users(display_name,email)`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${currentSession.access_token}` } }
        );
        if (!res.ok) return;
        const tips = await res.json();
        allMatchTips = {};
        tips.forEach(tip => {
            const mid = String(tip.match_id);
            if (!allMatchTips[mid]) allMatchTips[mid] = [];
            const rawName = tip.users?.display_name || tip.users?.email?.split('@')[0] || 'Ukjent';
            allMatchTips[mid].push({
                userId: tip.user_id,
                displayName: rawName.trim().split(/\s+/)[0],
                homeScore: tip.home_score,
                awayScore: tip.away_score
            });
        });
    } catch (e) {
        console.warn('Could not load all tips:', e);
    }
}

async function saveTip(matchId, homeScore, awayScore, homeTeam, awayTeam, odds) {
    if (!currentUser || !currentSession) return;

    const tipData = {
        user_id: currentUser.id,
        match_id: parseInt(matchId),
        home_score: parseInt(homeScore),
        away_score: parseInt(awayScore),
        home_team: homeTeam,
        away_team: awayTeam,
        odds: odds || null
    };

    try {
        const checkRes = await fetch(
            `${SUPABASE_URL}/rest/v1/tips?user_id=eq.${currentUser.id}&match_id=eq.${matchId}`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${currentSession.access_token}` } }
        );
        const existing = await checkRes.json();

        const method = existing?.length > 0 ? 'PATCH' : 'POST';
        const url = existing?.length > 0
            ? `${SUPABASE_URL}/rest/v1/tips?user_id=eq.${currentUser.id}&match_id=eq.${matchId}`
            : `${SUPABASE_URL}/rest/v1/tips`;

        const res = await fetch(url, {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${currentSession.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(method === 'PATCH'
                ? { home_score: tipData.home_score, away_score: tipData.away_score }
                : tipData)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        userTips[String(matchId)] = { homeScore: tipData.home_score, awayScore: tipData.away_score, odds };
        return true;
    } catch (e) {
        console.error('Error saving tip:', e);
        return false;
    }
}

// --- POINTS ---
function calculatePoints(tip, match) {
    if (!match.result) return null;
    const odds = match.odds || { H: 2.0, U: 3.0, B: 2.0 };
    const tipOutcome = getOutcome(tip.homeScore, tip.awayScore);
    const resultOutcome = getOutcome(match.result.home, match.result.away);
    let points = 0;
    if (tipOutcome === resultOutcome) points += (odds[resultOutcome] || 2.0);
    if (tip.homeScore === match.result.home && tip.awayScore === match.result.away) points += 3;
    return points;
}

function getOutcome(home, away) {
    if (home > away) return 'H';
    if (home < away) return 'B';
    return 'U';
}

// --- LEADERBOARD ---
async function loadLeaderboard() {
    const container = document.getElementById('vm-leaderboard-content');
    if (!container) return;
    container.innerHTML = `<div class="vm-loading"><div class="vm-spinner"></div><div>Laster ledertabell...</div></div>`;

    try {
        const allMatchIds = wcMatches.map(m => m.id);
        if (!allMatchIds.length) {
            container.innerHTML = `<div class="vm-leaderboard-empty">Ingen kamper lastet ennå.</div>`;
            return;
        }

        const filter = allMatchIds.map(id => `match_id.eq.${id}`).join(',');
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tips?or=(${filter})&select=*,users(id,display_name,email)`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tips = await res.json();

        if (new URLSearchParams(window.location.search).get('preview') === 'live') {
            tips.push(...getPreviewLeaderboardTips());
        }

        if (!tips.length) {
            container.innerHTML = `<div class="vm-leaderboard-empty">Ingen har tippet ennå – vær først ute!</div>`;
            return;
        }

        const completedCount = wcMatches.filter(m => m.completed).length;

        const EXCLUDED_USERS = new Set(['d4359cc6-3b0f-4464-bd5e-2f4a276441b3']);

        // Group by user
        const users = {};
        tips.forEach(tip => {
            const uid = tip.user_id;
            if (EXCLUDED_USERS.has(uid)) return;
            if (!users[uid]) {
                users[uid] = {
                    name: tip.users?.display_name || tip.users?.email?.split('@')[0] || 'Ukjent',
                    totalPoints: 0,
                    tipsCount: 0,
                    tips: {}   // matchId → { home, away, odds }
                };
            }
            users[uid].tipsCount++;
            users[uid].tips[tip.match_id] = {
                home: tip.home_score,
                away: tip.away_score,
                odds: tip.odds
            };
            const match = wcMatches.find(m => m.id === tip.match_id);
            if (match?.completed && match.result) {
                users[uid].totalPoints += calculatePoints(
                    { homeScore: tip.home_score, awayScore: tip.away_score, odds: tip.odds },
                    { result: match.result, odds: match.odds }
                );
            }
        });

        // Store for the per-user detail page
        leaderboardUsers = users;

        const sorted = Object.entries(users)
            .map(([uid, data]) => ({ uid, ...data }))
            .sort((a, b) => b.totalPoints - a.totalPoints || b.tipsCount - a.tipsCount);

        // Build display names: first name only, add last initial if duplicate first name
        const firstNames = sorted.map(p => p.name.trim().split(/\s+/)[0]);
        sorted.forEach((player, i) => {
            const parts = player.name.trim().split(/\s+/);
            const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            const hasDuplicate = firstNames.some((n, j) => n === firstName && j !== i);
            player.displayName = hasDuplicate && parts[1]
                ? `${firstName} ${parts[1][0]}.`
                : firstName;
        });

        const pretournament = completedCount === 0;
        const header = pretournament
            ? `<div class="vm-leaderboard-empty" style="margin-bottom:16px;color:var(--wc-muted);font-size:0.85rem">VM starter 11. juni – ${sorted.length} deltaker${sorted.length !== 1 ? 'e' : ''} er klare!</div>`
            : '';

        container.innerHTML = header + sorted.map((player, i) => {
            const pos = i === 0 ? 1 : (player.totalPoints === sorted[i - 1].totalPoints ? sorted[i - 1]._pos : i + 1);
            player._pos = pos;
            const medal = pos === 1 && !pretournament ? '🥇' : pos === 2 && !pretournament ? '🥈' : pos === 3 && !pretournament ? '🥉' : pos;
            const isCurrent = currentUser && player.uid === currentUser.id;
            const scoreText = pretournament
                ? `${player.tipsCount} tips`
                : `${player.totalPoints.toFixed(1)} p`;
            return `
                <div class="vm-leaderboard-row${isCurrent ? ' current-user' : ''}" role="button" tabindex="0" onclick="showUserPage('${player.uid}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showUserPage('${player.uid}')}">
                    <div class="vm-lb-pos">${medal}</div>
                    <div class="vm-lb-name">${escapeHtml(player.displayName)}${isCurrent ? ' <span style="color:var(--wc-green);font-size:0.75rem">(deg)</span>' : ''}<span class="vm-lb-chevron">›</span></div>
                    <div class="vm-lb-score">${scoreText}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="vm-leaderboard-empty">Kunne ikke laste ledertabell.</div>`;
        console.error(e);
    }
}

// --- USER DETAIL PAGE (per-player tips & points) ---
window.showUserPage = function(uid) {
    const user = leaderboardUsers[uid];
    if (!user) return;

    const modal = document.getElementById('vmUserModal');
    const body = document.getElementById('vmUserModalBody');
    if (!modal || !body) return;

    const fullName = user.name.trim();
    const firstName = fullName.split(/\s+/)[0];
    const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    const isCurrent = currentUser && uid === currentUser.id;

    // Completed matches, newest first (same ordering as the finished section)
    const finished = wcMatches
        .filter(m => m.completed && m.result)
        .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time));

    let tippedCount = 0;
    const rows = finished.map(match => {
        const tip = user.tips[match.id];
        const homeName = escapeHtml(teamName(match.homeTeam));
        const awayName = escapeHtml(teamName(match.awayTeam));
        const resultStr = `${match.result.home}–${match.result.away}`;

        if (!tip) {
            return `
                <div class="vm-up-row vm-up-row--notip">
                    <div class="vm-up-match">
                        <span class="vm-up-team">${homeName}</span>
                        <span class="vm-up-result">${resultStr}</span>
                        <span class="vm-up-team vm-up-team--away">${awayName}</span>
                    </div>
                    <div class="vm-up-tip">
                        <span class="vm-up-notip">Ikke tippet</span>
                        <span class="vm-up-pts vm-up-pts--zero">0 p</span>
                    </div>
                </div>
            `;
        }

        tippedCount++;
        const pts = calculatePoints(
            { homeScore: tip.home, awayScore: tip.away, odds: tip.odds },
            { result: match.result, odds: match.odds }
        );
        const correctOutcome = getOutcome(tip.home, tip.away) === getOutcome(match.result.home, match.result.away);
        const exact = tip.home === match.result.home && tip.away === match.result.away;
        const tipClass = exact ? 'vm-up-tipscore--exact' : correctOutcome ? 'vm-up-tipscore--correct' : '';

        return `
            <div class="vm-up-row">
                <div class="vm-up-match">
                    <span class="vm-up-team">${homeName}</span>
                    <span class="vm-up-result">${resultStr}</span>
                    <span class="vm-up-team vm-up-team--away">${awayName}</span>
                </div>
                <div class="vm-up-tip">
                    <span class="vm-up-tipscore ${tipClass}">${tip.home}–${tip.away}</span>
                    <span class="vm-up-pts${pts > 0 ? '' : ' vm-up-pts--zero'}">${pts > 0 ? '+' + pts.toFixed(1) + ' p' : '0 p'}</span>
                </div>
            </div>
        `;
    }).join('');

    const summary = finished.length === 0
        ? `<div class="vm-up-empty">Ingen kamper er ferdigspilt ennå.</div>`
        : `<div class="vm-up-list">${rows}</div>`;

    body.innerHTML = `
        <div class="vm-up-header">
            <div class="vm-up-name">${escapeHtml(displayName)}${isCurrent ? ' <span class="vm-up-you">(deg)</span>' : ''}</div>
            <div class="vm-up-total">${user.totalPoints.toFixed(1)} p</div>
        </div>
        <div class="vm-up-sub">${tippedCount} av ${finished.length} ferdige kamper tippet</div>
        ${summary}
    `;

    modal.style.display = 'flex';
};

window.closeUserPage = function() {
    const modal = document.getElementById('vmUserModal');
    if (modal) modal.style.display = 'none';
};

// --- RENDER MATCHES ---
function renderMatches() {
    const container = document.getElementById('vm-matches-content');
    if (!container) return;

    if (!wcMatches.length) {
        container.innerHTML = `
            <div class="vm-empty">
                <div class="vm-empty-icon">⏳</div>
                <div class="vm-empty-title">Kamper lastes snart</div>
                <div class="vm-empty-sub">VM-kampene vil dukke opp her i god tid før første sparkoff 11. juni 2026.</div>
            </div>
        `;
        return;
    }

    // Login prompt for unauthenticated users (above matches, not blocking)
    const loginPrompt = !currentUser ? `
        <div class="vm-login-prompt">
            <p>Logg inn for å legge inn tips og se deg selv på ledertabellen.</p>
            <button class="vm-btn vm-btn-primary" onclick="openAuthModal()" style="margin:0 auto;padding:10px 28px;">
                Logg inn / Opprett konto
            </button>
        </div>
    ` : '';

    // Split into three groups
    const live = wcMatches.filter(m => isMatchLive(m.status));
    const upcoming = wcMatches
        .filter(m => !m.completed && !isMatchLive(m.status))
        .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));
    const finished = wcMatches
        .filter(m => m.completed)
        .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time));

    let html = loginPrompt;

    // Live section
    if (live.length > 0) {
        html += `
            <div class="vm-section-live-header">
                <span class="vm-live-dot"></span>
                Live nå
            </div>
            ${live.map(m => renderMatchCard(m)).join('')}
        `;
    }

    // Upcoming section grouped by round
    if (upcoming.length > 0) {
        const rounds = groupByRound(upcoming);
        html += rounds.map(({ round, matches }) => `
            <div class="vm-round-group">
                <div class="vm-round-header">
                    <span class="vm-round-title">${escapeHtml(formatRound(round))}</span>
                    <div class="vm-round-line"></div>
                </div>
                ${matches.map(m => renderMatchCard(m)).join('')}
            </div>
        `).join('');
    }

    // Finished section (collapsed by default)
    if (finished.length > 0) {
        html += `
            <div class="vm-section-finished">
                <button class="vm-finished-toggle" onclick="toggleFinished(this)" aria-expanded="false">
                    <span>Ferdige kamper (${finished.length})</span>
                    <span class="vm-toggle-arrow">▾</span>
                </button>
                <div class="vm-finished-matches" style="display:none">
                    ${finished.map(m => renderMatchCard(m)).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

}

function renderMatchCard(match) {
    const now = new Date();
    const matchTime = new Date(match.commence_time);
    const started = matchTime <= now;
    const isLive = isMatchLive(match.status);
    const isFinished = match.completed || ['FT', 'AET', 'PEN', 'FT_PEN'].includes(match.status);
    const tip = userTips[String(match.id)];

    let cardClass = 'vm-match-card';
    if (isFinished) cardClass += ' finished';
    else if (isLive) cardClass += ' live';
    else if (started) cardClass += ' locked';

    const DAYS = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
    const MONTHS = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
    const timeStr = `${DAYS[matchTime.getDay()]} ${matchTime.getDate()}. ${MONTHS[matchTime.getMonth()]} ${String(matchTime.getHours()).padStart(2,'0')}:${String(matchTime.getMinutes()).padStart(2,'0')}`;

    const elapsedStr = match.elapsed ? ' ' + match.elapsed + "'" : '';
    let badge;
    if (isLive) {
        badge = `<span class="vm-card-badge vm-card-badge-live">LIVE${elapsedStr}</span>`;
    } else if (isFinished) {
        badge = `<span class="vm-card-badge">FT</span>`;
    } else {
        badge = `<span class="vm-card-badge">${escapeHtml(match.round ? formatRound(match.round) : '')}</span>`;
    }

    const centerContent = (isFinished || isLive) && match.result
        ? `<div class="vm-result-score${isLive ? ' live' : ''}">${match.result.home}–${match.result.away}</div>`
        : `<div class="vm-card-vs">vs</div>`;

    const tipSection = renderTipSection(match, tip, started, isFinished, isLive);
    const oddsSection = match.odds ? renderOdds(match.odds) : '';
    const othersSection = (isFinished || isLive) ? renderOthersTips(match, isFinished) : '';

    return `
        <div class="${cardClass}" data-match-id="${match.id}">
            <div class="vm-card-topbar">
                <span class="vm-card-time">${timeStr}</span>
                ${badge}
            </div>
            <div class="vm-card-body">
                <div class="vm-card-teams">
                    <div class="vm-card-team">
                        ${teamLogo(match.homeLogo, match.homeTeam)}
                        <span class="vm-card-team-name">${escapeHtml(teamName(match.homeTeam))}</span>
                    </div>
                    <div class="vm-card-center">${centerContent}</div>
                    <div class="vm-card-team">
                        ${teamLogo(match.awayLogo, match.awayTeam)}
                        <span class="vm-card-team-name">${escapeHtml(teamName(match.awayTeam))}</span>
                    </div>
                </div>
                ${oddsSection}
                ${tipSection}
                ${othersSection}
            </div>
        </div>
    `;
}

function renderTipSection(match, tip, started, isFinished, isLive) {
    if (!currentUser) return '';

    const mid = match.id;

    if (isFinished) {
        if (!tip) {
            return `<div class="vm-no-tip-locked">Du la ikke inn tips på denne kampen.</div>`;
        }
        const pts = tip.points !== null && tip.points !== undefined
            ? tip.points
            : calculatePoints(tip, match);
        return `
            <div class="vm-tip-saved">
                <span>Ditt tips: <strong class="vm-tip-score">${tip.homeScore}–${tip.awayScore}</strong></span>
                <span class="${pts > 0 ? 'vm-tip-points' : 'vm-tip-no-points'}">
                    ${pts > 0 ? '+' + pts.toFixed(1) + ' p' : '0 p'}
                </span>
            </div>
        `;
    }

    if (isLive || (started && !isFinished)) {
        if (tip) {
            return `<div class="vm-tip-locked">Ditt tips: ${tip.homeScore}–${tip.awayScore} (låst)</div>`;
        }
        return `<div class="vm-tip-locked">Kampen har startet – tipping er stengt.</div>`;
    }

    // Upcoming - show tip form
    const state = scoreState[String(mid)];
    const displayHome = state ? (state.home !== null ? state.home : '–') : (tip ? tip.homeScore : '–');
    const displayAway = state ? (state.away !== null ? state.away : '–') : (tip ? tip.awayScore : '–');
    return `
        <p class="vm-tip-heading">Ditt tips</p>
        <div class="vm-tip-form">
            <div class="vm-tip-block">
                <span class="vm-tip-block-lbl">Hjemme</span>
                <div class="vm-score-ctrl">
                    <button class="vm-score-btn" onclick="adjustScore('${mid}','home',-1)">−</button>
                    <span class="vm-score-val" id="score-home-${mid}">${displayHome}</span>
                    <button class="vm-score-btn" onclick="adjustScore('${mid}','home',1)">+</button>
                </div>
            </div>
            <span class="vm-score-dash">–</span>
            <div class="vm-tip-block">
                <span class="vm-tip-block-lbl">Borte</span>
                <div class="vm-score-ctrl">
                    <button class="vm-score-btn" onclick="adjustScore('${mid}','away',-1)">−</button>
                    <span class="vm-score-val" id="score-away-${mid}">${displayAway}</span>
                    <button class="vm-score-btn" onclick="adjustScore('${mid}','away',1)">+</button>
                </div>
            </div>
        </div>
        <div class="vm-save-feedback" id="feedback-${mid}"></div>
    `;
}

function renderOthersTips(match, isFinished) {
    if (!currentUser) return '';
    const tips = allMatchTips[String(match.id)];
    if (!tips || !tips.length) return '';
    const others = tips.filter(t => t.userId !== currentUser.id);
    if (!others.length) return '';

    const pills = others.map(t => {
        let extra = '';
        if (isFinished && match.result) {
            const pts = calculatePoints(
                { homeScore: t.homeScore, awayScore: t.awayScore, odds: null },
                { result: match.result, odds: match.odds }
            );
            const correct = getOutcome(t.homeScore, t.awayScore) === getOutcome(match.result.home, match.result.away);
            extra = `<span class="vm-others-pts${correct ? ' correct' : ''}">${pts > 0 ? '+' + pts.toFixed(1) : '0'}</span>`;
        }
        return `<div class="vm-others-pill">${escapeHtml(t.displayName)} <strong>${t.homeScore}–${t.awayScore}</strong>${extra}</div>`;
    }).join('');

    return `
        <div class="vm-others-tips">
            <div class="vm-others-label">Andre tips</div>
            <div class="vm-others-list">${pills}</div>
        </div>
    `;
}

function renderOdds(odds) {
    if (!odds) return '';
    const fmt = v => {
        if (!v) return '-';
        const n = parseFloat(v);
        return Number.isInteger(n) ? n : n.toFixed(1);
    };
    return `
        <div class="vm-odds">
            <div class="vm-odd-col"><span class="vm-odd-lbl">Hjemme</span><span class="vm-odd-val">${fmt(odds.H)}</span></div>
            <div class="vm-odd-col"><span class="vm-odd-lbl">Uavgjort</span><span class="vm-odd-val">${fmt(odds.U)}</span></div>
            <div class="vm-odd-col"><span class="vm-odd-lbl">Borte</span><span class="vm-odd-val">${fmt(odds.B)}</span></div>
        </div>
    `;
}

// --- TIP SUBMISSION ---
const scoreState = {};
const autoSaveTimers = {};

window.adjustScore = function(matchId, team, delta) {
    if (!scoreState[matchId]) {
        const t = userTips[String(matchId)];
        scoreState[matchId] = {
            home: t ? t.homeScore : null,
            away: t ? t.awayScore : null
        };
    }
    const state = scoreState[matchId];
    if (state[team] === null) {
        state[team] = delta > 0 ? 1 : 0;
    } else {
        state[team] = Math.max(0, state[team] + delta);
    }
    const el = document.getElementById(`score-${team}-${matchId}`);
    if (el) el.textContent = state[team];

    if (state.home !== null && state.away !== null) {
        clearTimeout(autoSaveTimers[matchId]);
        autoSaveTimers[matchId] = setTimeout(async () => {
            const match = wcMatches.find(m => String(m.id) === String(matchId));
            if (!match) return;
            const feedback = document.getElementById(`feedback-${matchId}`);
            if (feedback) { feedback.textContent = 'Lagrer...'; feedback.style.color = 'var(--wc-muted)'; }
            const ok = await saveTip(matchId, state.home, state.away, match.homeTeam, match.awayTeam, match.odds);
            if (feedback) {
                if (ok) {
                    feedback.textContent = '✓ Lagret';
                    feedback.style.color = 'var(--wc-green)';
                    setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2000);
                } else {
                    feedback.textContent = 'Kunne ikke lagre.';
                    feedback.style.color = '#ef4444';
                }
            }
        }, 600);
    }
};

window.toggleFinished = function(btn) {
    const panel = btn.nextElementSibling;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.querySelector('.vm-toggle-arrow').textContent = expanded ? '▾' : '▴';
    panel.style.display = expanded ? 'none' : 'block';
};

// --- HELPERS ---
function groupByRound(matches) {
    const map = new Map();
    matches.forEach(m => {
        const r = m.round || 'Ukjent runde';
        if (!map.has(r)) map.set(r, []);
        map.get(r).push(m);
    });
    return Array.from(map.entries()).map(([round, matches]) => ({ round, matches }));
}

function formatRound(round) {
    if (!round) return 'Ukjent runde';
    const map = {
        'Group Stage - 1': 'Gruppespill - Runde 1',
        'Group Stage - 2': 'Gruppespill - Runde 2',
        'Group Stage - 3': 'Gruppespill - Runde 3',
        'Round of 32': 'Runde av 32',
        'Round of 16': 'Åttedelsfinale',
        'Quarter-finals': 'Kvartfinale',
        'Semi-finals': 'Semifinale',
        '3rd Place Final': 'Bronsefinale',
        'Final': 'Finale'
    };
    return map[round] || round;
}

function isMatchLive(status) {
    return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status);
}

function teamLogo(logoUrl, rawName) {
    const initial = teamName(rawName).charAt(0);
    if (logoUrl) {
        return `<img class="vm-team-logo" src="${logoUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`;
    }
    return `<div class="vm-team-logo-placeholder">${escapeHtml(initial)}</div>`;
}

const COUNTRY_NO = {
    'Afghanistan': 'Afghanistan',
    'Albania': 'Albania',
    'Algeria': 'Algerie',
    'Argentina': 'Argentina',
    'Australia': 'Australia',
    'Austria': 'Østerrike',
    'Belgium': 'Belgia',
    'Bolivia': 'Bolivia',
    'Bosnia & Herzegovina': 'Bosnia-Hercegovina',
    'Bosnia-Herzegovina': 'Bosnia-Hercegovina',
    'Brazil': 'Brasil',
    'Cameroon': 'Kamerun',
    'Canada': 'Canada',
    'Cape Verde Islands': 'Kapp Verde',
    'Cape Verde': 'Kapp Verde',
    'Chile': 'Chile',
    'China': 'Kina',
    'Colombia': 'Colombia',
    'Congo DR': 'DR Kongo',
    'Costa Rica': 'Costa Rica',
    'Croatia': 'Kroatia',
    'Cuba': 'Cuba',
    'Curaçao': 'Curaçao',
    'Czech Republic': 'Tsjekkia',
    'Czechia': 'Tsjekkia',
    'Denmark': 'Danmark',
    'Ecuador': 'Ecuador',
    'Egypt': 'Egypt',
    'England': 'England',
    'Finland': 'Finland',
    'France': 'Frankrike',
    'Germany': 'Tyskland',
    'Ghana': 'Ghana',
    'Greece': 'Hellas',
    'Haiti': 'Haiti',
    'Honduras': 'Honduras',
    'Hungary': 'Ungarn',
    'Iceland': 'Island',
    'India': 'India',
    'Indonesia': 'Indonesia',
    'Iran': 'Iran',
    'Iraq': 'Irak',
    'Ireland': 'Irland',
    'Israel': 'Israel',
    'Italy': 'Italia',
    'Ivory Coast': 'Elfenbenskysten',
    'Jamaica': 'Jamaica',
    'Japan': 'Japan',
    'Jordan': 'Jordan',
    'Kenya': 'Kenya',
    'Mexico': 'Mexico',
    'Morocco': 'Marokko',
    'Netherlands': 'Nederland',
    'New Zealand': 'New Zealand',
    'Nigeria': 'Nigeria',
    'North Korea': 'Nord-Korea',
    'Norway': 'Norge',
    'Panama': 'Panama',
    'Paraguay': 'Paraguay',
    'Peru': 'Peru',
    'Poland': 'Polen',
    'Portugal': 'Portugal',
    'Qatar': 'Qatar',
    'Romania': 'Romania',
    'Russia': 'Russland',
    'Saudi Arabia': 'Saudi-Arabia',
    'Scotland': 'Skottland',
    'Senegal': 'Senegal',
    'Serbia': 'Serbia',
    'Slovakia': 'Slovakia',
    'Slovenia': 'Slovenia',
    'South Africa': 'Sør-Afrika',
    'South Korea': 'Sør-Korea',
    'Spain': 'Spania',
    'Sweden': 'Sverige',
    'Switzerland': 'Sveits',
    'Tunisia': 'Tunisia',
    'Türkiye': 'Tyrkia',
    'Turkey': 'Tyrkia',
    'USA': 'USA',
    'Ukraine': 'Ukraina',
    'United States': 'USA',
    'Uruguay': 'Uruguay',
    'Uzbekistan': 'Usbekistan',
    'Venezuela': 'Venezuela',
    'Wales': 'Wales',
};

function teamName(name) {
    return COUNTRY_NO[name] || name;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function googleSvg() {
    return `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>`;
}

// --- COUNTDOWN ---
function startCountdown() {
    const target = new Date('2026-06-11T19:00:00Z');
    const el = document.getElementById('vm-countdown');
    if (!el) return;

    function tick() {
        const diff = target - new Date();
        if (diff <= 0) {
            el.innerHTML = '<span style="font-weight:700">VM ER I GANG! ⚽</span>';
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerHTML = `
            <div class="vm-countdown-unit"><div class="vm-countdown-num">${d}</div><div class="vm-countdown-label">dager</div></div>
            <div class="vm-countdown-unit"><div class="vm-countdown-num">${String(h).padStart(2,'0')}</div><div class="vm-countdown-label">timer</div></div>
            <div class="vm-countdown-unit"><div class="vm-countdown-num">${String(m).padStart(2,'0')}</div><div class="vm-countdown-label">min</div></div>
            <div class="vm-countdown-unit"><div class="vm-countdown-num">${String(s).padStart(2,'0')}</div><div class="vm-countdown-label">sek</div></div>
        `;
    }

    tick();
    setInterval(tick, 1000);
}
