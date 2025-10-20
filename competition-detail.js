// Competition detail page
let competitionId = null;
let competition = null;
let userTips = [];

// Initialize page
function init() {
    // Get competition ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    competitionId = urlParams.get('id');

    if (!competitionId) {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = 'Ingen konkurranse ID funnet i URL';
        errorMessage.style.display = 'block';
        return;
    }

    // Initialize Firebase
    initializeFirebase();

    // Wait for auth state to be ready
    firebase.auth().onAuthStateChanged((user) => {
        const usernameElement = document.getElementById('currentUsername');
        const authSection = document.getElementById('authSection');
        const signOutBtn = document.getElementById('signOutBtn');

        if (user) {
            usernameElement.textContent = user.email;
            authSection.style.display = 'none';
            signOutBtn.style.display = 'inline-block';
            loadCompetition();
        } else {
            usernameElement.textContent = 'Ikke innlogget';
            authSection.style.display = 'block';
            signOutBtn.style.display = 'none';
        }
    });
}

// Load competition details
async function loadCompetition() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const detailsSection = document.getElementById('competitionDetails');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        detailsSection.style.display = 'none';

        // Get competition data
        const db = firebase.firestore();
        const competitionDoc = await db.collection('competitions').doc(competitionId).get();

        if (!competitionDoc.exists) {
            throw new Error('Konkurranse finnes ikke');
        }

        competition = { id: competitionDoc.id, ...competitionDoc.data() };
        console.log('📥 Loaded competition:', competition);

        // Load user tips
        await loadUserTips();

        // Render competition details
        renderCompetitionDetails();

        // Load and render leaderboard
        await loadLeaderboard();

        // Load and render matches
        await loadCompetitionMatches();

        loadingMessage.style.display = 'none';
        detailsSection.style.display = 'block';

    } catch (error) {
        console.error('Failed to load competition:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = error.message || 'Kunne ikke laste konkurranse';
        errorMessage.style.display = 'block';
    }
}

// Load user's tips
async function loadUserTips() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const db = firebase.firestore();
        const tipsSnapshot = await db.collection('tips')
            .where('userId', '==', user.uid)
            .get();

        userTips = [];
        tipsSnapshot.forEach(doc => {
            userTips.push({ id: doc.id, ...doc.data() });
        });

        console.log('📥 Loaded user tips:', userTips.length);
    } catch (error) {
        console.error('Failed to load user tips:', error);
    }
}

// Render competition details
function renderCompetitionDetails() {
    document.getElementById('competitionName').textContent = competition.name;
    document.getElementById('competitionDescription').textContent = competition.description || 'Ingen beskrivelse';
    document.getElementById('creatorName').textContent = competition.creatorName;

    const startDate = competition.startDate.toDate();
    const endDate = competition.endDate.toDate();
    document.getElementById('competitionPeriod').textContent =
        `${formatDate(startDate)} - ${formatDate(endDate)}`;

    // Get league names
    const leagueNames = {
        39: 'Premier League',
        2: 'Champions League',
        140: 'La Liga',
        78: 'Bundesliga',
        135: 'Serie A',
        1: 'World Cup'
    };

    const leagues = competition.leagues || [];
    const leaguesText = leagues.map(id => leagueNames[id] || `Liga ${id}`).join(', ') || 'Alle ligaer';

    document.getElementById('matchCount').textContent = leaguesText;
    document.getElementById('participantCount').textContent = `${competition.participants.length} deltakere`;

    // Determine status
    const now = new Date();
    let status = 'upcoming';
    let statusText = '📅 Kommende';
    let statusClass = 'status-upcoming';

    if (now >= startDate && now <= endDate) {
        status = 'active';
        statusText = '🔴 Aktiv';
        statusClass = 'status-active';
    } else if (now > endDate) {
        status = 'completed';
        statusText = '✅ Fullført';
        statusClass = 'status-completed';
    }

    const statusBadge = document.getElementById('competitionStatus');
    statusBadge.textContent = statusText;
    statusBadge.className = `competition-status-badge ${statusClass}`;

    // Show join button if user is not a participant
    const user = firebase.auth().currentUser;
    const isParticipant = user && competition.participants.includes(user.uid);
    const joinBtn = document.getElementById('joinBtn');

    if (user && !isParticipant && status !== 'completed') {
        joinBtn.style.display = 'inline-block';
    } else {
        joinBtn.style.display = 'none';
    }

    // Show delete button only for creator
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        const isCreator = user && competition.creatorId === user.uid;

        if (isCreator) {
            deleteBtn.style.display = 'inline-block';
        } else {
            deleteBtn.style.display = 'none';
        }
    }
}

// Format date
function formatDate(date) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('no-NO', options);
}

// Join competition
async function joinCompetition() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Du må være innlogget for å bli med');
        return;
    }

    try {
        const db = firebase.firestore();

        // Add user to participants array
        await db.collection('competitions').doc(competitionId).update({
            participants: firebase.firestore.FieldValue.arrayUnion(user.uid)
        });

        // Create participant entry
        await db.collection('competitionParticipants').doc(`${competitionId}_${user.uid}`).set({
            competitionId: competitionId,
            userId: user.uid,
            userName: user.displayName || user.email,
            totalPoints: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Joined competition');
        alert('Du er nå med i konkurransen!');

        // Reload competition
        loadCompetition();

    } catch (error) {
        console.error('Failed to join competition:', error);
        alert('Kunne ikke bli med i konkurransen. Prøv igjen.');
    }
}

// Share competition
function shareCompetition() {
    const url = window.location.href;

    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
        alert('Link kopiert! Del denne med venner så de kan bli med.');
    }).catch(() => {
        // Fallback
        prompt('Kopier denne linken:', url);
    });
}

// Delete competition
async function deleteCompetition() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Du må være innlogget for å slette konkurransen');
        return;
    }

    // Verify user is the creator
    if (competition.creatorId !== user.uid) {
        alert('Kun oppretteren kan slette konkurransen');
        return;
    }

    // Confirm deletion
    const confirmDelete = confirm(
        `Er du sikker på at du vil slette konkurransen "${competition.name}"?\n\n` +
        `Dette vil også slette alle deltakere og kan ikke angres.`
    );

    if (!confirmDelete) {
        return;
    }

    try {
        const db = firebase.firestore();

        // Delete all competition participants
        const participantsSnapshot = await db.collection('competitionParticipants')
            .where('competitionId', '==', competitionId)
            .get();

        const deletePromises = [];
        participantsSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });

        // Delete the competition itself
        deletePromises.push(db.collection('competitions').doc(competitionId).delete());

        await Promise.all(deletePromises);

        console.log('✅ Competition deleted');
        alert('Konkurransen er slettet');

        // Redirect to competitions page
        window.location.href = 'competitions.html';

    } catch (error) {
        console.error('Failed to delete competition:', error);
        alert('Kunne ikke slette konkurransen. Prøv igjen.');
    }
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const db = firebase.firestore();

        // Get all participants for this competition
        const participantsSnapshot = await db.collection('competitionParticipants')
            .where('competitionId', '==', competitionId)
            .get();

        const participants = [];
        for (const doc of participantsSnapshot.docs) {
            const participant = doc.data();

            // Get user display name from users collection
            let displayName = participant.userName; // fallback
            try {
                const userDoc = await db.collection('users').doc(participant.userId).get();
                if (userDoc.exists) {
                    displayName = userDoc.data().displayName || participant.userName;
                }
            } catch (error) {
                console.warn('Could not fetch user displayName:', error);
            }

            // Calculate points for this participant
            const points = await calculateParticipantPoints(participant.userId);

            participants.push({
                userId: participant.userId,
                userName: displayName,
                totalPoints: points
            });
        }

        // Sort by points (descending)
        participants.sort((a, b) => b.totalPoints - a.totalPoints);

        console.log('📊 Leaderboard:', participants);
        renderLeaderboard(participants);

    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

// Calculate points for a participant
async function calculateParticipantPoints(userId) {
    try {
        const db = firebase.firestore();

        // Get user's tips
        const tipsSnapshot = await db.collection('tips')
            .where('userId', '==', userId)
            .get();

        const tips = [];
        tipsSnapshot.forEach(doc => {
            tips.push({ id: doc.id, ...doc.data() });
        });

        // Fetch match results for competition period and leagues
        const matchResults = await fetchMatchResultsForCompetition();

        // Calculate points
        let totalPoints = 0;

        Object.keys(matchResults).forEach(matchId => {
            const tip = tips.find(t => String(t.matchId) === String(matchId));
            const result = matchResults[matchId];

            if (tip && result && result.completed) {
                const points = calculateMatchPoints(tip, result);
                totalPoints += points;
            }
        });

        return totalPoints;

    } catch (error) {
        console.error('Failed to calculate points:', error);
        return 0;
    }
}

// Fetch match results for competition
async function fetchMatchResultsForCompetition() {
    try {
        const results = {};

        // Fetch scores from API for today
        const scores = await footballApi.fetchScores();

        // Filter matches that are:
        // 1. Within competition date range
        // 2. In competition leagues
        const startDate = competition.startDate.toDate();
        const endDate = competition.endDate.toDate();
        const leagues = competition.leagues || [];

        scores.forEach(match => {
            const matchDate = new Date(match.date);

            // Check if match is within date range
            if (matchDate >= startDate && matchDate <= endDate) {
                // Check if match is in one of the competition leagues
                // We need to match by league name since API returns league names
                const leagueNames = {
                    39: 'Premier League',
                    2: 'UEFA Champions League',
                    140: 'La Liga',
                    78: 'Bundesliga',
                    135: 'Serie A',
                    1: 'World Cup'
                };

                const isInLeague = leagues.some(leagueId => {
                    const leagueName = leagueNames[leagueId];
                    return match.league && match.league.includes(leagueName);
                });

                if (isInLeague) {
                    results[match.id] = match;
                }
            }
        });

        return results;

    } catch (error) {
        console.error('Failed to fetch match results:', error);
        return {};
    }
}

// Calculate points for a single match
function calculateMatchPoints(tip, result) {
    let points = 0;

    const tipOutcome = getOutcome(tip.homeScore, tip.awayScore);
    const resultOutcome = getOutcome(result.result.home, result.result.away);

    // Points for correct outcome
    if (tipOutcome === resultOutcome && tip.odds) {
        points += tip.odds[resultOutcome];
    }

    // Bonus points for exact score
    if (tip.homeScore === result.result.home && tip.awayScore === result.result.away) {
        points += 3;
    }

    return points;
}

// Get outcome (H, U, B)
function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

// Render leaderboard
function renderLeaderboard(participants) {
    const leaderboardList = document.getElementById('leaderboardList');

    if (participants.length === 0) {
        leaderboardList.innerHTML = '<div class="no-participants">Ingen deltakere ennå</div>';
        return;
    }

    leaderboardList.innerHTML = '';

    participants.forEach((participant, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';

        const user = firebase.auth().currentUser;
        if (user && participant.userId === user.uid) {
            row.classList.add('current-user');
        }

        let positionEmoji = `${index + 1}.`;
        if (index === 0) positionEmoji = '🥇';
        else if (index === 1) positionEmoji = '🥈';
        else if (index === 2) positionEmoji = '🥉';

        row.innerHTML = `
            <div class="leaderboard-position">${positionEmoji}</div>
            <div class="leaderboard-name">${participant.userName}</div>
            <div class="leaderboard-score">${participant.totalPoints.toFixed(2)}</div>
        `;

        leaderboardList.appendChild(row);
    });
}

// Load and render competition matches
async function loadCompetitionMatches() {
    const matchesList = document.getElementById('competitionMatchesList');
    matchesList.innerHTML = '<div class="loading-message">Laster kamper...</div>';

    try {
        // Fetch scores for live/completed matches
        const scores = await footballApi.fetchScores();

        // Filter to competition date range and leagues
        const startDate = competition.startDate.toDate();
        const endDate = competition.endDate.toDate();
        const competitionLeagues = competition.leagues || [];

        const leagueNames = {
            39: 'Premier League',
            2: 'UEFA Champions League',
            140: 'La Liga',
            78: 'Bundesliga',
            135: 'Serie A',
            1: 'World Cup'
        };

        const competitionMatches = scores.filter(match => {
            const matchDate = new Date(match.commence_time || match.date);

            // Check if match is within date range
            if (matchDate < startDate || matchDate > endDate) {
                return false;
            }

            // Check if match is in one of the competition leagues
            return competitionLeagues.some(leagueId => {
                const leagueName = leagueNames[leagueId];
                return match.league && match.league.includes(leagueName);
            });
        });

        console.log('📥 Competition matches:', competitionMatches.length);

        if (competitionMatches.length === 0) {
            matchesList.innerHTML = '<div class="no-matches">Ingen kamper funnet i denne perioden for valgte ligaer</div>';
            return;
        }

        renderCompetitionMatches(competitionMatches);

    } catch (error) {
        console.error('Failed to load competition matches:', error);
        matchesList.innerHTML = '<div class="error-message">Kunne ikke laste kamper</div>';
    }
}

// Render competition matches
function renderCompetitionMatches(matches) {
    const matchesList = document.getElementById('competitionMatchesList');
    matchesList.innerHTML = '';

    // Group by date
    const matchesByDate = {};
    matches.forEach(match => {
        const matchDate = new Date(match.commence_time || match.date);
        const date = matchDate.toLocaleDateString('no-NO');
        if (!matchesByDate[date]) {
            matchesByDate[date] = [];
        }
        matchesByDate[date].push(match);
    });

    Object.keys(matchesByDate).sort().forEach(date => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = date;
        matchesList.appendChild(dateHeader);

        matchesByDate[date].forEach(match => {
            const card = createCompetitionMatchCard(match);
            matchesList.appendChild(card);
        });
    });
}

// Create competition match card
function createCompetitionMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'competition-match-card';

    const userTip = userTips.find(tip => String(tip.matchId) === String(match.id));
    const hasTip = !!userTip;

    if (hasTip) {
        card.classList.add('has-tip');
    }

    const matchTime = new Date(match.commence_time || match.date);
    const time = matchTime.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    const homeLogo = match.homeLogo || footballApi.getTeamLogo(match.homeTeam);
    const awayLogo = match.awayLogo || footballApi.getTeamLogo(match.awayTeam);

    let resultDisplay = '';
    let statusDisplay = `<span class="match-time">${time}</span>`;

    if (match.result) {
        resultDisplay = `
            <div class="match-result-display">
                <span class="result-score">${match.result.home} - ${match.result.away}</span>
                ${match.completed ? '<span class="result-status">✅ Fullført</span>' : '<span class="result-status live">🔴 Live</span>'}
            </div>
        `;
    }

    let tipDisplay = '';
    if (hasTip) {
        let points = 0;
        if (match.result && match.completed) {
            points = calculateMatchPoints(userTip, match);
        }

        tipDisplay = `
            <div class="match-tip-display">
                <span class="tip-label">Ditt tips:</span>
                <span class="tip-score">${userTip.homeScore} - ${userTip.awayScore}</span>
                ${match.completed ? `<span class="tip-points">${points.toFixed(2)} poeng</span>` : ''}
            </div>
        `;
    } else {
        tipDisplay = '<div class="no-tip-warning">⚠️ Ikke tippet</div>';
    }

    card.innerHTML = `
        <div class="competition-match-info">
            <div class="match-teams-vertical">
                <div class="team-row">
                    ${homeLogo ? `<img src="${homeLogo}" alt="${match.homeTeam}" class="team-logo-small">` : ''}
                    <span class="team-name">${match.homeTeam}</span>
                </div>
                <div class="team-row">
                    ${awayLogo ? `<img src="${awayLogo}" alt="${match.awayTeam}" class="team-logo-small">` : ''}
                    <span class="team-name">${match.awayTeam}</span>
                </div>
            </div>
            <div class="match-status-time">
                ${statusDisplay}
                ${resultDisplay}
            </div>
            ${tipDisplay}
        </div>
    `;

    return card;
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    init();
});
