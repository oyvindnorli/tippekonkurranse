// Competition detail page
let competitionId = null;
let competition = null;
let userTips = [];
let competitionMatches = []; // Store competition matches globally

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
        if (user) {
            loadCompetition();
        } else {
            // Redirect to home page if not logged in
            window.location.href = 'index.html';
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

        // Load and render matches first (needed to determine if competition is finished)
        const allMatchesCompleted = await loadCompetitionMatches();

        // Render competition details (with match completion status)
        renderCompetitionDetails(allMatchesCompleted);

        // Load and render leaderboard
        await loadLeaderboard();

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
function renderCompetitionDetails(allMatchesCompleted = false) {
    document.getElementById('competitionName').textContent = competition.name;
    document.getElementById('competitionDescription').textContent = competition.description || 'Ingen beskrivelse';
    document.getElementById('creatorName').textContent = competition.creatorName;

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
    let leaguesText = '';

    // Display period/rounds based on competition type
    if (competition.competitionType === 'round' && competition.selectedRounds) {
        // Round-based competition
        document.getElementById('competitionPeriod').textContent = '🎯 Rundebasert konkurranse';

        // Build leagues text with rounds
        const parts = [];

        if (competition.selectedRounds?.premierLeague) {
            const rounds = competition.selectedRounds.premierLeague.sort((a, b) => a - b);
            const roundText = rounds.length === 1
                ? `Runde ${rounds[0]}`
                : `Runde ${rounds[0]}-${rounds[rounds.length - 1]}`;
            parts.push(`Premier League (${roundText})`);
        }

        if (competition.selectedRounds?.championsLeague) {
            const rounds = competition.selectedRounds.championsLeague;
            const roundText = rounds.map(r => r.replace('League Stage - ', '').replace('Matchday', 'MD')).join(', ');
            parts.push(`Champions League (${roundText})`);
        }

        leaguesText = parts.join(' + ');

    } else {
        // Date-based competition (or round-based without selectedRounds)
        if (competition.startDate && competition.endDate) {
            const startDate = competition.startDate.toDate();
            const endDate = competition.endDate.toDate();
            document.getElementById('competitionPeriod').textContent =
                `${formatDate(startDate)} - ${formatDate(endDate)}`;
        } else {
            document.getElementById('competitionPeriod').textContent = 'Ingen datoer satt';
        }

        leaguesText = leagues.map(id => leagueNames[id] || `Liga ${id}`).join(', ') || 'Alle ligaer';
    }

    document.getElementById('matchCount').textContent = leaguesText;
    document.getElementById('participantCount').textContent = `${competition.participants.length} deltakere`;

    // Determine status
    const now = new Date();
    let startDate, endDate;

    if (competition.competitionType === 'round') {
        // For round-based, determine start/end from matches
        if (competitionMatches.length > 0) {
            const dates = competitionMatches.map(m => new Date(m.commence_time || m.date));
            startDate = new Date(Math.min(...dates));
            endDate = new Date(Math.max(...dates));
        } else {
            startDate = now;
            endDate = now;
        }
    } else {
        startDate = competition.startDate.toDate();
        endDate = competition.endDate.toDate();
    }
    let status = 'upcoming';
    let statusText = '📅 Kommende';
    let statusClass = 'status-upcoming';

    if (now >= startDate && now <= endDate) {
        // Check if all matches are completed even if we're within the date range
        if (allMatchesCompleted === true) {
            status = 'completed';
            statusText = '✅ Fullført';
            statusClass = 'status-completed';
        } else {
            status = 'active';
            statusText = '🔴 Aktiv';
            statusClass = 'status-active';
        }
    } else if (now > endDate) {
        // Only mark as completed if date has passed OR all matches are completed
        if (allMatchesCompleted === true || allMatchesCompleted === null) {
            status = 'completed';
            statusText = '✅ Fullført';
            statusClass = 'status-completed';
        } else {
            status = 'active';
            statusText = '🔴 Aktiv';
            statusClass = 'status-active';
        }
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

    // Show/hide share button based on competition status
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        if (status === 'completed') {
            shareBtn.style.display = 'none';
        } else {
            shareBtn.style.display = 'inline-block';
        }
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

            // Calculate points for this participant
            const points = await calculateParticipantPoints(participant.userId);

            // Fetch actual displayName from users collection
            let userName = participant.userName;
            try {
                const userDoc = await db.collection('users').doc(participant.userId).get();
                if (userDoc.exists && userDoc.data().displayName) {
                    userName = userDoc.data().displayName;
                }
            } catch (error) {
                console.warn('Could not fetch user displayName:', error);
            }

            participants.push({
                userId: participant.userId,
                userName: userName,
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

            // Count points for both completed and live matches (if they have a score)
            if (tip && result && result.result && result.result.home !== null && result.result.away !== null) {
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
        console.log('🔧 fetchMatchResultsForCompetition - SIMPLIFIED VERSION');
        const results = {};

        // Use cached matches if available, otherwise fetch from API
        let scores;
        if (competition.cachedMatches && competition.cachedMatches.length > 0) {
            console.log('💾 Using cached matches for leaderboard calculation');
            scores = competition.cachedMatches;
        } else {
            console.log('🔄 Fetching scores from API for leaderboard calculation');
            scores = await footballApi.fetchScores();
        }

        console.log(`📊 Total scores available: ${scores.length}`);

        const leagues = competition.leagues || [];
        const leagueNames = {
            39: 'Premier League',
            2: 'UEFA Champions League',
            140: 'La Liga',
            78: 'Bundesliga',
            135: 'Serie A',
            1: 'World Cup'
        };

        // SIMPLIFIED LOGIC: Same as loadCompetitionMatches
        scores.forEach(match => {
            // Must be in one of the competition leagues
            const isInLeague = leagues.some(leagueId => {
                const leagueName = leagueNames[leagueId];
                return match.league && match.league.includes(leagueName);
            });

            if (!isInLeague || !match.result) {
                return;
            }

            let includeMatch = false;

            // If we have selected rounds, filter by them
            if (competition.selectedRounds) {
                // Premier League round filtering
                if (competition.selectedRounds.premierLeague && competition.selectedRounds.premierLeague.length > 0 && match.league.includes('Premier League')) {
                    if (match.round) {
                        const roundMatch = match.round.match(/(\d+)/);
                        if (roundMatch) {
                            const roundNumber = parseInt(roundMatch[1]);
                            includeMatch = competition.selectedRounds.premierLeague.includes(roundNumber);
                        }
                    }
                }
                // Champions League round filtering
                else if (competition.selectedRounds.championsLeague && competition.selectedRounds.championsLeague.length > 0 && match.league.includes('Champions League')) {
                    if (match.round) {
                        includeMatch = competition.selectedRounds.championsLeague.includes(match.round);
                    }
                }
            }
            // If competitionType is 'round' but no selectedRounds, assume PL Round 9
            else if (competition.competitionType === 'round' && match.league.includes('Premier League') && match.round) {
                const roundMatch = match.round.match(/(\d+)/);
                if (roundMatch) {
                    const roundNumber = parseInt(roundMatch[1]);
                    includeMatch = roundNumber === 9;
                }
            }
            // For date-based, check date range
            else if (competition.startDate && competition.endDate) {
                const matchDate = new Date(match.commence_time || match.date);
                const startDate = new Date(competition.startDate.toDate());
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(competition.endDate.toDate());
                endDate.setHours(23, 59, 59, 999);
                includeMatch = matchDate >= startDate && matchDate <= endDate;
            }
            // Default: include all league matches with results
            else {
                includeMatch = true;
            }

            if (includeMatch) {
                results[match.id] = match;
            }
        });

        console.log(`📈 Total matches for leaderboard calculation: ${Object.keys(results).length}`);
        Object.keys(results).forEach(id => {
            const m = results[id];
            console.log(`  - ${m.homeTeam} ${m.result.home}-${m.result.away} ${m.awayTeam}`);
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

        // Check if at least one match has started or is completed
        const now = new Date();
        const anyMatchStarted = competitionMatches.some(match => {
            const matchDate = new Date(match.commence_time || match.date);
            return matchDate <= now;
        });

        // Make name clickable only if at least one match has started
        const nameStyle = anyMatchStarted ? 'cursor: pointer;' : 'cursor: default; opacity: 0.7;';
        const nameOnClick = anyMatchStarted ? `onclick="showUserTips('${participant.userId}', '${participant.userName.replace(/'/g, "\\'")}')"` : '';

        row.innerHTML = `
            <div class="leaderboard-position">${positionEmoji}</div>
            <div class="leaderboard-name" style="${nameStyle}" ${nameOnClick}>
                ${participant.userName}
            </div>
            <div class="leaderboard-score">${participant.totalPoints.toFixed(2)}</div>
        `;

        leaderboardList.appendChild(row);
    });
}

// Show user tips modal
async function showUserTips(userId, userName) {
    try {
        // Check if at least one match has started
        const now = new Date();
        const anyMatchStarted = competitionMatches.some(match => {
            const matchDate = new Date(match.commence_time || match.date);
            return matchDate <= now;
        });

        if (!anyMatchStarted) {
            alert('Du kan ikke se andres tips før første kamp har startet!');
            return;
        }

        const db = firebase.firestore();

        // Get user's tips
        const tipsSnapshot = await db.collection('tips')
            .where('userId', '==', userId)
            .get();

        const tips = [];
        tipsSnapshot.forEach(doc => {
            tips.push({ id: doc.id, ...doc.data() });
        });

        // Fetch match results for competition
        const matchResults = await fetchMatchResultsForCompetition();

        // Build modal content
        let modalContent = `
            <div style="padding: 20px;">
                <h2 style="margin-top: 0;">Tips fra ${userName}</h2>
                <div style="margin-bottom: 20px;">
                    <strong>Total poeng: ${await calculateParticipantPoints(userId)} poeng</strong>
                </div>
        `;

        // Group tips by match
        const matchTips = [];
        const userTipCount = tips.filter(t =>
            Object.keys(matchResults).includes(String(t.matchId))
        ).length;

        Object.keys(matchResults).forEach(matchId => {
            const match = matchResults[matchId];
            const tip = tips.find(t => String(t.matchId) === String(matchId));

            if (tip && match.result) {
                const points = calculateMatchPoints(tip, match);
                matchTips.push({
                    match: match,
                    tip: tip,
                    points: points
                });
            }
        });

        if (matchTips.length === 0) {
            if (userTipCount > 0) {
                modalContent += '<p style="color: #64748b; font-style: italic;">Ingen kamper har startet ennå. Tips vises når kampene er i gang.</p>';
            } else {
                modalContent += '<p style="color: #64748b;">Ingen tips funnet for denne konkurransen</p>';
            }
        } else {
            matchTips.forEach(({ match, tip, points }) => {
                const pointsColor = points > 0 ? 'color: #22c55e; font-weight: bold;' : 'color: #64748b;';
                modalContent += `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #f8fafc;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong>${match.homeTeam} vs ${match.awayTeam}</strong>
                            <span style="${pointsColor}">${points.toFixed(2)} poeng</span>
                        </div>
                        <div style="display: flex; gap: 20px; font-size: 14px;">
                            <div>Tips: <strong>${tip.homeScore} - ${tip.awayScore}</strong></div>
                            <div>Resultat: <strong>${match.result.home} - ${match.result.away}</strong></div>
                        </div>
                    </div>
                `;
            });
        }

        modalContent += `
                <button onclick="closeUserTipsModal()" style="margin-top: 20px; padding: 10px 20px; background: #22d3ee; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Lukk
                </button>
            </div>
        `;

        // Create and show modal
        let modal = document.getElementById('userTipsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'userTipsModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `<div class="modal-content" style="max-width: 600px;">${modalContent}</div>`;
        modal.style.display = 'block';

    } catch (error) {
        console.error('Failed to load user tips:', error);
        alert('Kunne ikke laste brukerens tips');
    }
}

// Close user tips modal
function closeUserTipsModal() {
    const modal = document.getElementById('userTipsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load and render competition matches
async function loadCompetitionMatches() {
    const matchesList = document.getElementById('competitionMatchesList');
    matchesList.innerHTML = '<div class="loading-message">Laster kamper...</div>';

    try {
        console.log('=== COMPETITION DEBUG INFO ===');
        console.log('Competition Type:', competition.competitionType);
        console.log('Competition Leagues:', competition.leagues);
        console.log('Selected Rounds:', competition.selectedRounds);
        console.log('Start Date:', competition.startDate);
        console.log('End Date:', competition.endDate);
        console.log('Cached Matches:', competition.cachedMatches?.length || 0);
        console.log('=============================');

        const db = firebase.firestore();
        competitionMatches = []; // Reset global variable

        // Check if competition has cached matches
        if (competition.cachedMatches && competition.cachedMatches.length > 0) {
            console.log('💾 Using cached matches from Firestore:', competition.cachedMatches.length);
            competitionMatches = competition.cachedMatches;
        } else {
            console.log('🔄 Fetching matches from API...');

            // Fetch scores (completed and live matches)
            const scores = await footballApi.fetchScores();
            console.log(`📊 Total scores available: ${scores.length}`);

            const competitionLeagues = competition.leagues || [];
            const leagueNames = {
                39: 'Premier League',
                2: 'UEFA Champions League',
                140: 'La Liga',
                78: 'Bundesliga',
                135: 'Serie A',
                1: 'World Cup'
            };

            // SIMPLIFIED LOGIC: Just filter by league and optionally by round
            competitionMatches = scores.filter(match => {
                // Must be in one of the competition leagues
                const matchInLeague = competitionLeagues.some(leagueId => {
                    const leagueName = leagueNames[leagueId];
                    return match.league && match.league.includes(leagueName);
                });

                if (!matchInLeague) {
                    return false;
                }

                // If we have selected rounds, filter by them
                if (competition.selectedRounds) {
                    let roundMatches = false;

                    // Premier League round filtering
                    if (competition.selectedRounds.premierLeague && competition.selectedRounds.premierLeague.length > 0 && match.league.includes('Premier League')) {
                        if (match.round) {
                            const roundMatch = match.round.match(/(\d+)/);
                            if (roundMatch) {
                                const roundNumber = parseInt(roundMatch[1]);
                                roundMatches = competition.selectedRounds.premierLeague.includes(roundNumber);
                            }
                        }
                        return roundMatches; // Return immediately for PL matches
                    }

                    // Champions League round filtering
                    if (competition.selectedRounds.championsLeague && competition.selectedRounds.championsLeague.length > 0 && match.league.includes('Champions League')) {
                        if (match.round) {
                            roundMatches = competition.selectedRounds.championsLeague.includes(match.round);
                        }
                        return roundMatches; // Return immediately for CL matches
                    }

                    // If we have selectedRounds but this match doesn't match any, exclude it
                    return false;
                }

                // If competitionType is 'round' but no selectedRounds, assume PL Round 9 for backward compatibility
                if (competition.competitionType === 'round' && !competition.selectedRounds && match.league.includes('Premier League') && match.round) {
                    const roundMatch = match.round.match(/(\d+)/);
                    if (roundMatch) {
                        const roundNumber = parseInt(roundMatch[1]);
                        console.log(`🔍 OLD COMPETITION - Checking PL Round ${roundNumber} (looking for round 9)`);
                        return roundNumber === 9;
                    }
                }

                // For date-based or if no other criteria, check date range
                if (competition.startDate && competition.endDate) {
                    const matchDate = new Date(match.commence_time || match.date);
                    const startDate = new Date(competition.startDate.toDate());
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(competition.endDate.toDate());
                    endDate.setHours(23, 59, 59, 999);
                    return matchDate >= startDate && matchDate <= endDate;
                }

                // Default: include all matches in the league
                return true;
            });

            console.log('📥 Competition matches filtered:', competitionMatches.length);
            competitionMatches.forEach(m => {
                console.log(`  - ${m.homeTeam} vs ${m.awayTeam} (${m.round || 'no round'})`);
            });
        }

        if (competitionMatches.length === 0) {
            matchesList.innerHTML = '<div class="no-matches">Ingen kamper funnet i denne perioden for valgte ligaer</div>';
            return null; // No matches found - status indeterminate
        }

        renderCompetitionMatches(competitionMatches);

        // Check if all matches are completed
        const allCompleted = competitionMatches.every(match => match.completed);
        console.log(`🏁 All matches completed: ${allCompleted} (${competitionMatches.length} matches)`);

        // If all matches are completed and we haven't cached yet, save to Firestore
        if (allCompleted && !competition.cachedMatches) {
            console.log('💾 Saving matches to Firestore cache...');
            try {
                await db.collection('competitions').doc(competitionId).update({
                    cachedMatches: competitionMatches,
                    cachedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Matches cached successfully');
            } catch (error) {
                console.warn('⚠️ Could not cache matches:', error);
            }
        }

        return allCompleted;

    } catch (error) {
        console.error('Failed to load competition matches:', error);
        matchesList.innerHTML = '<div class="error-message">Kunne ikke laste kamper</div>';
        return false;
    }
}

// Render competition matches
function renderCompetitionMatches(matches) {
    const matchesList = document.getElementById('competitionMatchesList');
    matchesList.innerHTML = '';

    console.log(`📋 Rendering ${matches.length} competition matches`);

    if (matches.length === 0) {
        matchesList.innerHTML = '<div class="no-matches">Ingen kamper funnet for denne konkurransen</div>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group by date with relative labels
    const matchesByDate = {};
    matches.forEach(match => {
        const matchDate = new Date(match.commence_time || match.date);
        matchDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((matchDate - today) / (1000 * 60 * 60 * 24));

        let dateLabel;
        if (daysDiff === 0) {
            dateLabel = 'I dag';
        } else if (daysDiff === 1) {
            dateLabel = 'I morgen';
        } else if (daysDiff === -1) {
            dateLabel = 'I går';
        } else if (daysDiff < -1 && daysDiff > -7) {
            // Last week
            const weekday = matchDate.toLocaleDateString('nb-NO', { weekday: 'long' });
            dateLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        } else {
            // Format: "Fredag, 17. oktober"
            const weekday = matchDate.toLocaleDateString('nb-NO', { weekday: 'long' });
            const day = matchDate.getDate();
            const month = matchDate.toLocaleDateString('nb-NO', { month: 'long' });
            dateLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}. ${month}`;
        }

        if (!matchesByDate[dateLabel]) {
            matchesByDate[dateLabel] = { date: matchDate, matches: [] };
        }
        matchesByDate[dateLabel].matches.push(match);
    });

    // Sort by actual date
    const sortedDates = Object.keys(matchesByDate).sort((a, b) => {
        return matchesByDate[a].date - matchesByDate[b].date;
    });

    sortedDates.forEach(dateLabel => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateLabel;
        matchesList.appendChild(dateHeader);

        matchesByDate[dateLabel].matches.forEach(match => {
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

    const time = new Date(match.commence_time || match.date).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
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
        // Calculate points for both live and completed matches (if result exists)
        if (match.result && match.result.home !== null && match.result.away !== null) {
            points = calculateMatchPoints(userTip, match);
        }

        tipDisplay = `
            <div class="match-tip-display">
                <span class="tip-label">Ditt tips:</span>
                <span class="tip-score">${userTip.homeScore} - ${userTip.awayScore}</span>
                ${match.result ? `<span class="tip-points">${points.toFixed(2)} poeng${match.completed ? '' : ' (live)'}</span>` : ''}
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

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('userTipsModal');
    if (modal && event.target === modal) {
        closeUserTipsModal();
    }
});

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    init();
});
