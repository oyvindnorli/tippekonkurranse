// vm2026.js — VM 2026 tippekonkurranse (standalone module)

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
let userTips = {};   // matchId (string) → { homeScore, awayScore, odds, points }
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

async function onLoggedIn(user) {
    updateAuthUI(true, user);
    await loadMatches();
    await loadUserTips();
    renderCurrentTab();
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
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Bruker';
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

// --- MATCH DATA ---
async function loadMatches() {
    // 1. Try Supabase cache
    const supabaseMatches = await fetchMatchesFromSupabase();

    if (supabaseMatches.length > 0) {
        wcMatches = supabaseMatches;
        return;
    }

    // 2. Fetch from API-Football and try to cache
    const apiMatches = await fetchMatchesFromAPI();
    if (apiMatches.length > 0) {
        await tryInsertMatchesToSupabase(apiMatches);
        wcMatches = apiMatches;
    } else {
        wcMatches = [];
    }
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
            result: (row.home_score !== null && row.away_score !== null)
                ? { home: row.home_score, away: row.away_score }
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
    const odds = tip.odds || match.odds || { H: 2.0, U: 3.0, B: 2.0 };
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
        // Fetch all WC match IDs
        const matchIds = wcMatches.filter(m => m.completed).map(m => m.id);
        if (!matchIds.length) {
            container.innerHTML = `<div class="vm-leaderboard-empty">Ingen fullførte kamper ennå — kom tilbake etter første kampdag!</div>`;
            return;
        }

        const filter = matchIds.map(id => `match_id.eq.${id}`).join(',');
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/tips?or=(${filter})&select=*,users(id,display_name,email)`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tips = await res.json();

        // Group by user and calculate total points
        const users = {};
        tips.forEach(tip => {
            const uid = tip.user_id;
            if (!users[uid]) {
                users[uid] = {
                    name: tip.users?.display_name || tip.users?.email?.split('@')[0] || 'Ukjent',
                    totalPoints: 0,
                    tipsCount: 0
                };
            }
            const match = wcMatches.find(m => m.id === tip.match_id);
            if (match?.completed && match.result) {
                const pts = calculatePoints(
                    { homeScore: tip.home_score, awayScore: tip.away_score, odds: tip.odds },
                    { result: match.result, odds: match.odds }
                );
                users[uid].totalPoints += pts;
                users[uid].tipsCount++;
            }
        });

        const sorted = Object.entries(users)
            .map(([uid, data]) => ({ uid, ...data }))
            .sort((a, b) => b.totalPoints - a.totalPoints);

        if (!sorted.length) {
            container.innerHTML = `<div class="vm-leaderboard-empty">Ingen har tippet ennå.</div>`;
            return;
        }

        container.innerHTML = sorted.map((player, i) => {
            const pos = i + 1;
            const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
            const isCurrent = currentUser && player.uid === currentUser.id;
            return `
                <div class="vm-leaderboard-row${isCurrent ? ' current-user' : ''}">
                    <div class="vm-lb-pos">${medal}</div>
                    <div class="vm-lb-name">${escapeHtml(player.name)}${isCurrent ? ' <span style="color:var(--wc-red);font-size:0.75rem">(deg)</span>' : ''}</div>
                    <div class="vm-lb-score">${player.totalPoints.toFixed(1)} p</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="vm-leaderboard-empty">Kunne ikke laste ledertabell.</div>`;
        console.error(e);
    }
}

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
            <p>Logg inn med Google for å legge inn tips og se deg selv på ledertabellen.</p>
            <button class="vm-btn-google" onclick="handleGoogleSignIn()" style="max-width:260px;margin:0 auto;">
                ${googleSvg()}
                Logg inn med Google
            </button>
        </div>
    ` : '';

    // Sort: live first, then upcoming (chronological), then finished (most recent last)
    const sorted = [...wcMatches].sort((a, b) => {
        const priority = m => {
            if (isMatchLive(m.status)) return 0;
            if (!m.completed && !isMatchLive(m.status)) return 1;
            return 2;
        };
        const pa = priority(a), pb = priority(b);
        if (pa !== pb) return pa - pb;
        return new Date(a.commence_time) - new Date(b.commence_time);
    });

    // Group matches by round
    const rounds = groupByRound(sorted);

    const roundsHtml = rounds.map(({ round, matches }) => `
        <div class="vm-round-group">
            <div class="vm-round-header">
                <span class="vm-round-title">${escapeHtml(formatRound(round))}</span>
                <div class="vm-round-line"></div>
            </div>
            ${matches.map(m => renderMatchCard(m)).join('')}
        </div>
    `).join('');

    container.innerHTML = loginPrompt + roundsHtml;

    // Attach tip input listeners
    if (currentUser) {
        container.querySelectorAll('.vm-score-input').forEach(input => {
            input.addEventListener('input', onScoreInput);
        });
    }
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

    const timeStr = matchTime.toLocaleString('no-NO', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    const statusBadge = isLive
        ? `<span class="vm-match-status-live">LIVE ${match.elapsed ? match.elapsed + "'" : ''}</span>`
        : isFinished
            ? `<span style="color:var(--wc-green);font-size:0.75rem;font-weight:700">FULLFØRT</span>`
            : '';

    const vsOrScore = isFinished && match.result
        ? `<span class="vm-result-score">${match.result.home}–${match.result.away}</span>`
        : isLive && match.result
            ? `<span class="vm-result-score" style="color:var(--wc-red)">${match.result.home}–${match.result.away}</span>`
            : `<span class="vm-match-vs">vs</span>`;

    const tipSection = renderTipSection(match, tip, started, isFinished, isLive);
    const oddsSection = match.odds ? renderOdds(match.odds) : '';

    return `
        <div class="${cardClass}" data-match-id="${match.id}">
            <div class="vm-match-meta">
                <span>${timeStr}</span>
                ${statusBadge}
            </div>
            <div class="vm-match-teams">
                <div class="vm-team">
                    ${teamLogo(match.homeLogo, match.homeTeam)}
                    <span>${escapeHtml(match.homeTeam)}</span>
                </div>
                ${vsOrScore}
                <div class="vm-team away">
                    ${teamLogo(match.awayLogo, match.awayTeam)}
                    <span>${escapeHtml(match.awayTeam)}</span>
                </div>
            </div>
            ${oddsSection}
            ${tipSection}
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
        return `<div class="vm-tip-locked">Kampen har startet — tipping er stengt.</div>`;
    }

    // Upcoming — show tip form
    const savedHome = tip?.homeScore ?? '';
    const savedAway = tip?.awayScore ?? '';
    return `
        <div class="vm-tip-form">
            <span class="vm-tip-label">Ditt tips:</span>
            <input class="vm-score-input" type="number" min="0" max="20"
                data-match-id="${mid}" data-team="home"
                value="${savedHome}" placeholder="0">
            <span class="vm-score-dash">–</span>
            <input class="vm-score-input" type="number" min="0" max="20"
                data-match-id="${mid}" data-team="away"
                value="${savedAway}" placeholder="0">
            <button class="vm-btn-sm" onclick="submitTip('${mid}')">Lagre</button>
        </div>
        <div class="vm-save-feedback" id="feedback-${mid}"></div>
    `;
}

function renderOdds(odds) {
    if (!odds) return '';
    return `
        <div class="vm-odds">
            <span class="vm-odd-btn">H ${odds.H?.toFixed(2) ?? '–'}</span>
            <span class="vm-odd-btn">U ${odds.U?.toFixed(2) ?? '–'}</span>
            <span class="vm-odd-btn">B ${odds.B?.toFixed(2) ?? '–'}</span>
        </div>
    `;
}

// --- TIP SUBMISSION ---
const tipDebounce = {};

function onScoreInput(e) {
    const input = e.target;
    // Clamp value
    if (input.value < 0) input.value = 0;
    if (input.value > 20) input.value = 20;
}

window.submitTip = async function(matchId) {
    const homeInput = document.querySelector(`.vm-score-input[data-match-id="${matchId}"][data-team="home"]`);
    const awayInput = document.querySelector(`.vm-score-input[data-match-id="${matchId}"][data-team="away"]`);
    const feedback = document.getElementById(`feedback-${matchId}`);

    if (!homeInput || !awayInput) return;
    const homeScore = homeInput.value;
    const awayScore = awayInput.value;

    if (homeScore === '' || awayScore === '' || homeScore === null || awayScore === null) {
        if (feedback) { feedback.textContent = 'Fyll inn begge scorene.'; feedback.style.color = '#ef4444'; }
        return;
    }

    const match = wcMatches.find(m => String(m.id) === String(matchId));
    if (!match) return;

    if (feedback) { feedback.textContent = 'Lagrer...'; feedback.style.color = 'var(--wc-muted)'; }

    const ok = await saveTip(matchId, homeScore, awayScore, match.homeTeam, match.awayTeam, match.odds);

    if (ok) {
        if (feedback) {
            feedback.textContent = '✓ Lagret!';
            feedback.style.color = 'var(--wc-green)';
            setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2500);
        }
    } else {
        if (feedback) { feedback.textContent = 'Kunne ikke lagre. Prøv igjen.'; feedback.style.color = '#ef4444'; }
    }
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
        'Group Stage - 1': 'Gruppespill – Runde 1',
        'Group Stage - 2': 'Gruppespill – Runde 2',
        'Group Stage - 3': 'Gruppespill – Runde 3',
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

function teamLogo(logoUrl, teamName) {
    if (logoUrl) {
        return `<img class="vm-team-logo" src="${logoUrl}" alt="${escapeHtml(teamName)}" loading="lazy" onerror="this.style.display='none'">`;
    }
    return `<div class="vm-team-logo-placeholder">${escapeHtml(teamName.charAt(0))}</div>`;
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
    const target = new Date('2026-06-11T18:00:00Z');
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
