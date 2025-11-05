// Import league configuration
import { LEAGUE_NAMES_SIMPLE } from './js/utils/leagueConfig.js';
import { formatDate } from './js/utils/dateUtils.js';
import { deduplicateMatches } from './js/utils/matchUtils.js';
import * as competitionsRenderer from './js/renderers/competitionsRenderer.js';

// Competitions functionality
let selectedLeagues = new Set([39, 2]); // Default: Premier League and Champions League
let availableRounds = null; // Store fetched rounds
let selectedPLRounds = new Set(); // Selected Premier League rounds
let selectedCLRounds = new Set(); // Selected Champions League rounds

// Performance tracking
const pageLoadStart = performance.now();

// Load user's league preferences from Firestore
async function loadUserLeaguePreferences(userId) {
    try {
        const db = firebase.firestore();
        const prefsDoc = await db.collection('userPreferences').doc(userId).get();

        if (prefsDoc.exists && prefsDoc.data().leagues) {
            const leagueArray = prefsDoc.data().leagues;
            console.log('📂 Loaded user league preferences for competitions:', leagueArray);
            return new Set(leagueArray);
        }
    } catch (error) {
        console.warn('⚠️ Could not load league preferences:', error);
    }
    return new Set([39, 2]); // Default
}

// Initialize page
function init() {
    // Initialize Firebase
    initializeFirebase();

    // Wait for auth state to be ready
    firebase.auth().onAuthStateChanged(async (user) => {
        const loadingMessage = document.getElementById('loadingMessage');

        if (user) {
            // Load user's league preferences first
            selectedLeagues = await loadUserLeaguePreferences(user.uid);
            console.log('✅ User preferences loaded for competitions:', Array.from(selectedLeagues));

            loadCompetitions();
        } else {
            // Hide loading message when not logged in
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            // Redirect to home page if not logged in
            window.location.href = 'index.html';
        }
    });
}

// Load all competitions
async function loadCompetitions() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        const user = firebase.auth().currentUser;
        if (!user) return;

        // Get all competitions where user is a participant
        // Remove orderBy to avoid needing a composite index
        const competitionsSnapshot = await firebase.firestore().collection('competitions')
            .where('participants', 'array-contains', user.uid)
            .get();

        const competitions = [];
        competitionsSnapshot.forEach(doc => {
            competitions.push({ id: doc.id, ...doc.data() });
        });

        // Sort by createdAt on client side
        competitions.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        console.log('📥 Loaded competitions:', competitions.length);

        loadingMessage.style.display = 'none';

        // Fetch match results to check if competitions are actually finished
        // Run both API calls in parallel for faster loading
        const t1 = performance.now();
        const [scores, upcomingFixtures] = await Promise.all([
            footballApi.fetchScores(),
            footballApi.getUpcomingFixtures()
        ]);
        console.log(`⏱️ Fetch scores + upcoming (parallel): ${((performance.now() - t1) / 1000).toFixed(2)}s`);

        // Combine scores and upcoming, then deduplicate
        const allMatches = [...scores, ...upcomingFixtures];
        const uniqueMatches = deduplicateMatches(allMatches);

        // Categorize competitions
        const t3 = performance.now();
        const now = new Date();
        const active = [];
        const upcoming = [];
        const completed = [];

        competitions.forEach(c => {
            const leagues = c.leagues || [];

            let competitionMatches = [];
            let start, end;

            // Try to get fresh match data from API first
            if (c.matchIds && c.matchIds.length > 0) {
                // Custom competition with specific matches
                competitionMatches = uniqueMatches.filter(match => c.matchIds.includes(match.id));

                // Determine start/end from matches
                if (competitionMatches.length > 0) {
                    const dates = competitionMatches.map(m => new Date(m.commence_time || m.date));
                    start = new Date(Math.min(...dates));
                    end = new Date(Math.max(...dates));
                } else {
                    // No matches found yet - assume ongoing
                    start = now;
                    end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
                }

            } else if (c.competitionType === 'round' && c.selectedRounds) {
                // Round-based competition - filter by rounds (includes both completed and upcoming)
                competitionMatches = uniqueMatches.filter(match => {
                    if (!match.round) return false;

                    // Get league as string (handle both ID and name)
                    const matchLeague = typeof match.league === 'string'
                        ? match.league
                        : (LEAGUE_NAMES_SIMPLE[match.league] || '');

                    // Check PL rounds
                    if (c.selectedRounds?.premierLeague && matchLeague.includes('Premier League')) {
                        const roundMatch = match.round.match(/(\d+)/);
                        if (roundMatch) {
                            const roundNumber = parseInt(roundMatch[1]);
                            return c.selectedRounds.premierLeague.includes(roundNumber);
                        }
                    }

                    // Check CL rounds
                    if (c.selectedRounds?.championsLeague && matchLeague.includes('Champions League')) {
                        return c.selectedRounds.championsLeague.includes(match.round);
                    }

                    return false;
                });

                // Determine start/end from matches
                if (competitionMatches.length > 0) {
                    const dates = competitionMatches.map(m => new Date(m.commence_time || m.date));
                    start = new Date(Math.min(...dates));
                    end = new Date(Math.max(...dates));
                } else {
                    start = now;
                    end = now;
                }

            } else {
                // Date-based competition (or round-based without selectedRounds)
                if (c.startDate && c.endDate) {
                    start = new Date(c.startDate.toDate());
                    start.setHours(0, 0, 0, 0);

                    end = new Date(c.endDate.toDate());
                    end.setHours(23, 59, 59, 999);

                    competitionMatches = uniqueMatches.filter(match => {
                        const matchDate = new Date(match.commence_time || match.date);
                        if (matchDate < start || matchDate > end) return false;

                        return leagues.some(leagueId => {
                            const leagueName = LEAGUE_NAMES_SIMPLE[leagueId];
                            return match.league && match.league.includes(leagueName);
                        });
                    });
                } else {
                    // No date range - use all matches in selected leagues
                    start = now;
                    end = now;
                    competitionMatches = uniqueMatches.filter(match => {
                        return leagues.some(leagueId => {
                            const leagueName = LEAGUE_NAMES_SIMPLE[leagueId];
                            return match.league && match.league.includes(leagueName);
                        });
                    });
                }
            }

            // Log match data for debugging
            console.log(`📊 Competition "${c.name}":`);
            console.log(`  - Fresh matches found: ${competitionMatches.length}`);
            console.log(`  - Has cachedMatches: ${c.cachedMatches ? 'YES (' + c.cachedMatches.length + ')' : 'NO'}`);

            // If no fresh matches found, use cached matches
            if (competitionMatches.length === 0 && c.cachedMatches && c.cachedMatches.length > 0) {
                console.log(`ℹ️ Using cachedMatches for "${c.name}" (no fresh data - matches likely old)`);
                competitionMatches = c.cachedMatches;

                // Determine start/end from cached matches
                const dates = competitionMatches.map(m => new Date(m.commence_time || m.date));
                start = new Date(Math.min(...dates));
                end = new Date(Math.max(...dates));
            }

            if (competitionMatches.length > 0) {
                console.log(`  - Completed: ${competitionMatches.filter(m => m.completed).length}/${competitionMatches.length}`);
            }

            // Categorize competition based on match completion status
            const allMatchesCompleted = competitionMatches.length > 0 &&
                competitionMatches.every(match => match.completed);

            // Check if any match has started (is in the past or currently playing)
            const anyMatchStarted = competitionMatches.some(match => {
                const matchDate = new Date(match.commence_time || match.date);
                return matchDate <= now;
            });

            if (allMatchesCompleted) {
                // All matches are completed
                completed.push(c);
            } else if (!anyMatchStarted) {
                // No matches have started yet - all are in the future
                upcoming.push(c);
            } else {
                // Some matches have started but not all are completed
                active.push(c);

                // Debug logging for active competitions
                console.log(`⚠️ Competition "${c.name}" marked as ACTIVE:`);
                console.log(`  - Total matches: ${competitionMatches.length}`);
                console.log(`  - Completed: ${competitionMatches.filter(m => m.completed).length}`);
                console.log(`  - Has cachedMatches: ${c.cachedMatches ? 'YES' : 'NO'}`);
                const incomplete = competitionMatches.filter(m => !m.completed);
                if (incomplete.length > 0 && incomplete.length <= 3) {
                    incomplete.forEach(m => {
                        console.log(`  - Incomplete: ${m.homeTeam} vs ${m.awayTeam} (status: ${m.statusShort})`);
                    });
                }
            }
        });
        console.log(`⏱️ Categorize competitions: ${((performance.now() - t3) / 1000).toFixed(2)}s`);

        const t4 = performance.now();
        renderCompetitions(active, 'activeCompetitionsList');
        renderCompetitions(upcoming, 'upcomingCompetitionsList');
        renderCompetitions(completed, 'completedCompetitionsList');
        console.log(`⏱️ Render competitions: ${((performance.now() - t4) / 1000).toFixed(2)}s`);

        // Log total page load time
        const pageLoadEnd = performance.now();
        const totalTime = ((pageLoadEnd - pageLoadStart) / 1000).toFixed(2);
        console.log(`⏱️ Total page load time: ${totalTime}s`);

    } catch (error) {
        console.error('Failed to load competitions:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste konkurranser. Prøv igjen senere.';
        errorMessage.style.display = 'block';
    }
}

// Render competitions list
function renderCompetitions(competitions, elementId) {
    competitionsRenderer.renderCompetitions(competitions, elementId);
}

// Create competition card
function createCompetitionCard(competition) {
    return competitionsRenderer.createCompetitionCard(competition);
}

// Show create competition modal
async function showCreateCompetitionModal() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Du må være innlogget for å opprette en konkurranse');
        return;
    }

    const modal = document.getElementById('createCompetitionModal');
    modal.style.display = 'block';

    // Fetch next rounds and display them
    await loadNextRounds();
}

// Load next rounds from API and display them
async function loadNextRounds() {
    try {
        console.log('🔍 Loading next rounds...');
        availableRounds = await footballApi.fetchAvailableRounds();

        // Display next Premier League round
        const plNextRound = document.getElementById('plNextRound');
        if (availableRounds.premierLeague.length > 0) {
            const nextRound = availableRounds.premierLeague[0];
            plNextRound.innerHTML = `${nextRound.label}<br><span class="round-date">${nextRound.dateRange}</span>`;
        } else {
            plNextRound.textContent = 'Ingen kommende runder';
        }

        // Display next Champions League round
        const clNextRound = document.getElementById('clNextRound');
        if (availableRounds.championsLeague.length > 0) {
            const nextRound = availableRounds.championsLeague[0];
            clNextRound.innerHTML = `${nextRound.label}<br><span class="round-date">${nextRound.dateRange}</span>`;
        } else {
            clNextRound.textContent = 'Ingen kommende runder';
        }

        console.log('✅ Next rounds loaded');
    } catch (error) {
        console.error('Failed to load next rounds:', error);
        document.getElementById('plNextRound').textContent = 'Feil ved lasting';
        document.getElementById('clNextRound').textContent = 'Feil ved lasting';
    }
}

// Update selected rounds
function updateSelectedRounds(league) {
    if (league === 'pl') {
        selectedPLRounds.clear();
        document.querySelectorAll('#plRoundsContainer input[type="checkbox"]:checked').forEach(cb => {
            selectedPLRounds.add(parseInt(cb.value));
        });
        console.log('Selected PL rounds:', Array.from(selectedPLRounds));
    } else {
        selectedCLRounds.clear();
        document.querySelectorAll('#clRoundsContainer input[type="checkbox"]:checked').forEach(cb => {
            selectedCLRounds.add(cb.value);
        });
        console.log('Selected CL rounds:', Array.from(selectedCLRounds));
    }
}

// Close create competition modal
function closeCreateCompetitionModal() {
    const modal = document.getElementById('createCompetitionModal');
    modal.style.display = 'none';
    document.getElementById('createCompetitionForm').reset();
}

// Update competition name based on selected round
function updateCompetitionName() {
    const selectedRound = document.querySelector('input[name="selectedRound"]:checked');
    const nameInput = document.getElementById('competitionName');

    if (!selectedRound || !availableRounds) return;

    const roundType = selectedRound.value;

    if (roundType === 'pl' && availableRounds.premierLeague.length > 0) {
        const nextRound = availableRounds.premierLeague[0];
        nameInput.value = `Premier League ${nextRound.label}`;
    } else if (roundType === 'cl' && availableRounds.championsLeague.length > 0) {
        const nextRound = availableRounds.championsLeague[0];
        nameInput.value = `Champions League ${nextRound.label}`;
    }
}

// Create competition form submission
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createCompetitionForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createCompetition();
        });
    }
});

// Create competition
async function createCompetition() {
    const errorDiv = document.getElementById('createCompetitionError');
    errorDiv.style.display = 'none';

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Du må være innlogget');
        }

        const name = document.getElementById('competitionName').value.trim();
        const description = document.getElementById('competitionDescription').value.trim();
        const selectedRound = document.querySelector('input[name="selectedRound"]:checked');

        // Validation
        if (!name) {
            throw new Error('Navn på konkurranse er påkrevd');
        }

        if (!selectedRound) {
            throw new Error('Du må velge en runde');
        }

        const roundType = selectedRound.value; // 'pl' or 'cl'
        const leagues = [];
        const rounds = {};

        if (roundType === 'pl') {
            // Premier League next round
            if (!availableRounds || !availableRounds.premierLeague.length) {
                throw new Error('Ingen Premier League runder tilgjengelig');
            }
            const nextRound = availableRounds.premierLeague[0];
            leagues.push(39);
            rounds.premierLeague = [nextRound.value];
        } else {
            // Champions League next round
            if (!availableRounds || !availableRounds.championsLeague.length) {
                throw new Error('Ingen Champions League runder tilgjengelig');
            }
            const nextRound = availableRounds.championsLeague[0];
            leagues.push(2);
            rounds.championsLeague = [nextRound.value];
        }

        let competitionData = {
            name,
            description,
            creatorId: user.uid,
            creatorName: user.displayName || user.email,
            participants: [user.uid], // Creator automatically joins
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            competitionType: 'round',
            leagues: leagues,
            selectedRounds: rounds
        };

        const db = firebase.firestore();
        const docRef = await db.collection('competitions').add(competitionData);
        console.log('✅ Competition created:', docRef.id);

        // Create participant entry for creator
        await db.collection('competitionParticipants').doc(`${docRef.id}_${user.uid}`).set({
            competitionId: docRef.id,
            userId: user.uid,
            userName: user.email,
            totalPoints: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeCreateCompetitionModal();
        loadCompetitions();

        alert('Konkurranse opprettet! Del linken med venner så de kan bli med.');

    } catch (error) {
        console.error('Failed to create competition:', error);
        errorDiv.textContent = error.message || 'Kunne ikke opprette konkurranse';
        errorDiv.style.display = 'block';
    }
}

// View competition details
function viewCompetition(competitionId) {
    window.location.href = `competition-detail.html?id=${competitionId}`;
}

// Export functions to window object for onclick handlers
window.viewCompetition = viewCompetition;
window.showCreateCompetitionModal = showCreateCompetitionModal;
window.closeCreateCompetitionModal = closeCreateCompetitionModal;
window.updateCompetitionName = updateCompetitionName;
window.signOut = signOut;

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('createCompetitionModal');
    if (event.target === modal) {
        closeCreateCompetitionModal();
    }
};

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    init();
});
