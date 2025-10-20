// My Tips Page - Display user's tips with results and points
// Note: currentUser is already declared in firebase-auth.js

let myTipsUserTips = {};
let matchScores = {};

// Points calculation
const POINTS = {
    CORRECT_SCORE: 3,      // Exact score match
    CORRECT_OUTCOME: 1,    // Correct winner/draw but wrong score
    INCORRECT: 0           // Wrong prediction
};

/**
 * Calculate points for a tip
 */
function calculatePoints(tip, result) {
    if (!result || result.home === null || result.away === null) {
        return null; // Match not finished yet
    }

    const tipHome = parseInt(tip.home);
    const tipAway = parseInt(tip.away);
    const resultHome = parseInt(result.home);
    const resultAway = parseInt(result.away);

    // Exact score match
    if (tipHome === resultHome && tipAway === resultAway) {
        return POINTS.CORRECT_SCORE;
    }

    // Determine outcome (home win, draw, away win)
    const tipOutcome = tipHome > tipAway ? 'H' : (tipHome < tipAway ? 'A' : 'D');
    const resultOutcome = resultHome > resultAway ? 'H' : (resultHome < resultAway ? 'A' : 'D');

    // Correct outcome but wrong score
    if (tipOutcome === resultOutcome) {
        return POINTS.CORRECT_OUTCOME;
    }

    // Incorrect
    return POINTS.INCORRECT;
}

/**
 * Get outcome emoji
 */
function getOutcomeEmoji(points) {
    if (points === null) return '⏳';
    if (points === POINTS.CORRECT_SCORE) return '🎯';
    if (points === POINTS.CORRECT_OUTCOME) return '✓';
    return '✗';
}

/**
 * Get outcome class for styling
 */
function getOutcomeClass(points) {
    if (points === null) return '';
    if (points === POINTS.CORRECT_SCORE) return 'correct-score';
    if (points === POINTS.CORRECT_OUTCOME) return 'correct-outcome';
    return 'incorrect';
}

/**
 * Load user tips from Firestore
 */
async function loadMyTipsUserTips() {
    if (!currentUser) {
        console.log('No user logged in');
        return;
    }

    try {
        const snapshot = await firebase.firestore()
            .collection('tips')
            .where('userId', '==', currentUser.uid)
            .get();

        myTipsUserTips = {};
        snapshot.forEach(doc => {
            const tip = doc.data();
            myTipsUserTips[tip.matchId] = {
                home: tip.homeScore,
                away: tip.awayScore,
                homeTeam: tip.homeTeam,
                awayTeam: tip.awayTeam
            };
        });

        console.log(`Loaded ${Object.keys(myTipsUserTips).length} tips`);
    } catch (error) {
        console.error('Error loading tips:', error);
    }
}

/**
 * Fetch live scores and recent results
 */
async function fetchScores() {
    try {
        const scores = await footballApi.fetchScores(3); // Get scores from last 3 days

        // Convert to object keyed by match ID
        matchScores = {};
        scores.forEach(match => {
            matchScores[match.id] = match;
        });

        console.log(`✅ Fetched scores for ${scores.length} matches`);
        console.log('📊 Match IDs from API:', Object.keys(matchScores));
        console.log('🎯 Your tip match IDs:', Object.keys(myTipsUserTips));

        // Log matches
        scores.forEach(match => {
            console.log(`🔹 ${match.homeTeam} vs ${match.awayTeam} (${match.id}) - Completed: ${match.completed}`);
            if (match.result) {
                console.log(`   Score: ${match.result.home}-${match.result.away}`);
            }
        });

        return scores;
    } catch (error) {
        console.error('Error fetching scores:', error);
        throw error;
    }
}

/**
 * Display results
 */
function displayResults() {
    const container = document.getElementById('resultsContainer');

    console.log('🎨 Starting to display results...');
    console.log(`   Tips: ${Object.keys(myTipsUserTips).length}, Scores: ${Object.keys(matchScores).length}`);

    // Filter tips that have results or are ongoing
    const tipsWithMatches = Object.entries(myTipsUserTips)
        .map(([matchId, tip]) => {
            // Try to find match by ID first
            let match = matchScores[matchId];

            // If not found by ID, try to match by team names and date
            if (!match) {
                console.log(`🔍 Trying to match by team names for matchId: ${matchId}`);
                match = Object.values(matchScores).find(m => {
                    const teamsMatch = (
                        (m.homeTeam === tip.homeTeam && m.awayTeam === tip.awayTeam) ||
                        (m.homeTeam.includes(tip.homeTeam) || tip.homeTeam.includes(m.homeTeam)) &&
                        (m.awayTeam.includes(tip.awayTeam) || tip.awayTeam.includes(m.awayTeam))
                    );
                    return teamsMatch;
                });

                if (match) {
                    console.log(`✅ Matched by team names: ${match.homeTeam} vs ${match.awayTeam}`);
                }
            }

            if (!match) {
                console.warn(`❌ No match data found for matchId: ${matchId} (${tip.homeTeam} vs ${tip.awayTeam})`);
                return null;
            }

            console.log(`✅ Match found: ${match.homeTeam} vs ${match.awayTeam}`);
            const points = calculatePoints(tip, match.result);
            return { matchId, tip, match, points };
        })
        .filter(item => item !== null);

    console.log(`🎯 Found ${tipsWithMatches.length} matches with your tips`);

    if (tipsWithMatches.length === 0) {
        container.innerHTML = `
            <div class="no-tips">
                <p>Ingen kamper med resultater enda.</p>
                <p>Du har tippet på ${Object.keys(myTipsUserTips).length} kamper.</p>
                <p>Kampene vil vises her når de starter eller er ferdige.</p>
            </div>
        `;
        return;
    }

    // Sort by match time (oldest first)
    tipsWithMatches.sort((a, b) =>
        new Date(a.match.commence_time) - new Date(b.match.commence_time)
    );

    // Group by date
    const groupedByDate = {};
    const dateOrder = []; // Keep track of date order
    tipsWithMatches.forEach(item => {
        const matchDate = new Date(item.match.commence_time);
        const dateKey = matchDate.toLocaleDateString('nb-NO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
            dateOrder.push(dateKey);
        }
        groupedByDate[dateKey].push(item);
    });

    // Build HTML (use dateOrder to maintain chronological order)
    let html = '';

    dateOrder.forEach(date => {
        const items = groupedByDate[date];
        html += `<div class="date-group">`;
        html += `<div class="date-header">${date}</div>`;

        items.forEach(({ match, tip, points }) => {
            const outcomeClass = getOutcomeClass(points);
            const outcomeEmoji = getOutcomeEmoji(points);

            // Determine match status
            const matchDate = new Date(match.commence_time);
            const now = new Date();
            const hasStarted = matchDate <= now;

            console.log(`🕐 ${match.homeTeam} vs ${match.awayTeam}:`, {
                matchDate: matchDate.toISOString(),
                now: now.toISOString(),
                hasStarted,
                completed: match.completed
            });

            let status, statusBadge;
            if (match.completed) {
                status = 'Fullført';
                statusBadge = '<span class="status-badge completed">✓ Fullført</span>';
                console.log(`   → Status: Fullført`);
            } else if (hasStarted) {
                // Calculate approximate minute (rough estimate)
                const minutesSinceKickoff = Math.floor((now - matchDate) / 1000 / 60);
                let displayMinute = '';

                if (minutesSinceKickoff <= 45) {
                    displayMinute = minutesSinceKickoff + "'";
                } else if (minutesSinceKickoff > 45 && minutesSinceKickoff <= 60) {
                    displayMinute = "45' + HT";
                } else if (minutesSinceKickoff > 60 && minutesSinceKickoff <= 105) {
                    displayMinute = (minutesSinceKickoff - 15) + "'";
                } else {
                    displayMinute = "90'+";
                }

                status = 'Pågår ' + displayMinute;
                statusBadge = '<span class="status-badge live">🔴 LIVE ' + displayMinute + '</span>';
                console.log(`   → Status: LIVE ${displayMinute} (${minutesSinceKickoff} min since kickoff)`);
            } else {
                status = 'Starter ' + match.time;
                statusBadge = '<span class="status-badge upcoming">⏰ ' + match.time + '</span>';
                console.log(`   → Status: Upcoming at ${match.time}`);
            }

            const homeLogo = footballApi.getTeamLogo(match.homeTeam);
            const awayLogo = footballApi.getTeamLogo(match.awayTeam);

            html += `
                <div class="match-card tip-card ${outcomeClass}">
                    <div class="match-info">
                        <div class="match-time">${match.time}</div>
                        <div class="match-teams">
                            <div class="team">
                                ${homeLogo ? `<img src="${homeLogo}" alt="${match.homeTeam}" class="team-logo">` : ''}
                                <span class="team-name">${match.homeTeam}</span>
                            </div>
                            <div class="team">
                                ${awayLogo ? `<img src="${awayLogo}" alt="${match.awayTeam}" class="team-logo">` : ''}
                                <span class="team-name">${match.awayTeam}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tip-result">
                        <div class="tip-details">
                            <div>
                                <strong>Ditt tips:</strong> ${tip.home} - ${tip.away}
                            </div>
                            ${match.result ? `
                                <div>
                                    <strong>Resultat:</strong> ${match.result.home} - ${match.result.away}
                                </div>
                            ` : `<div>${statusBadge}</div>`}
                        </div>
                        <div class="tip-score-display">
                            <span class="tip-points ${outcomeClass}">
                                ${outcomeEmoji} ${points !== null ? `${points} poeng` : status}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    container.innerHTML = html;

    // Calculate and display total points
    updateTotalPoints(tipsWithMatches);
}

/**
 * Update total points display
 */
function updateTotalPoints(tipsWithMatches) {
    const totalPoints = tipsWithMatches
        .filter(item => item.points !== null)
        .reduce((sum, item) => sum + item.points, 0);

    document.getElementById('totalScore').textContent = totalPoints;

    // Also update in Firestore
    if (currentUser) {
        firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .update({ totalScore: totalPoints })
            .catch(error => console.error('Error updating total score:', error));
    }
}

/**
 * Refresh results
 */
async function refreshResults() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const resultsContainer = document.getElementById('resultsContainer');

    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    resultsContainer.innerHTML = '';

    try {
        await loadMyTipsUserTips();
        await fetchScores();
        displayResults();
        loadingMessage.style.display = 'none';
    } catch (error) {
        console.error('Error refreshing results:', error);
        loadingMessage.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.textContent = `Feil ved lasting av resultater: ${error.message}`;
    }
}

/**
 * Initialize Firebase and page
 */
function initializeMyTipsPage() {
    // Initialize Firebase if not already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Listen for auth state changes
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;

            // Update UI - fetch displayName from Firestore
            const usernameElement = document.getElementById('currentUsername');
            const db = firebase.firestore();
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    usernameElement.textContent = doc.data().displayName || user.email;
                } else {
                    usernameElement.textContent = user.email;
                }
            }).catch(error => {
                console.warn('Could not fetch displayName:', error);
                usernameElement.textContent = user.email;
            });

            document.getElementById('signOutBtn').style.display = 'inline-block';

            // Load tips and scores
            await refreshResults();
        } else {
            // Redirect to login
            window.location.href = 'index.html';
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMyTipsPage);
} else {
    initializeMyTipsPage();
}

/**
 * Sign out
 */
function signOut() {
    firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Auto-refresh every 60 seconds to get live updates
setInterval(() => {
    if (currentUser) {
        console.log('Auto-refreshing results...');
        refreshResults();
    }
}, 60000);
