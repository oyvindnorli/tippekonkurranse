// Import utility modules
import { LEAGUE_NAMES_SIMPLE } from './js/utils/leagueConfig.js';
import { calculatePoints } from './js/utils/matchUtils.js';
import { formatDate } from './js/utils/dateUtils.js';

// Import services
import * as competitionService from './js/services/competitionService.js';
import * as leaderboardService from './js/services/leaderboardService.js';

// Import renderers
import * as competitionRenderer from './js/renderers/competitionRenderer.js';

// Competition detail page
let competitionId = null;
let competition = null;
let userTips = [];
let competitionMatches = []; // Store competition matches globally
let isLoading = false; // Prevent multiple simultaneous loads
let hasLoaded = false; // Track if we've already loaded the competition

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
        if (user && !isLoading && !hasLoaded) {
            loadCompetition();
        } else if (!user) {
            // Redirect to home page if not logged in
            window.location.href = 'index.html';
        }
    });
}

// Load competition details
async function loadCompetition() {
    // Prevent multiple simultaneous loads
    if (isLoading) {
        console.log('⚠️ Already loading competition, skipping duplicate call');
        return;
    }
    isLoading = true;

    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const detailsSection = document.getElementById('competitionDetails');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        detailsSection.style.display = 'none';

        // Get competition data using service
        competition = await competitionService.loadCompetition(competitionId);

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
        hasLoaded = true; // Mark as loaded to prevent duplicate loads

    } catch (error) {
        console.error('Failed to load competition:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = error.message || 'Kunne ikke laste konkurranse';
        errorMessage.style.display = 'block';
    } finally {
        isLoading = false;
    }
}

// Load user's tips
async function loadUserTips() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        userTips = await competitionService.loadUserTips(user.uid);

    } catch (error) {
        console.error('Failed to load user tips:', error);
    }
}

// Render competition details
function renderCompetitionDetails(allMatchesCompleted = false) {
    // Use the renderer module
    competitionRenderer.renderCompetitionDetails(competition, allMatchesCompleted, competitionMatches);
}


// Join competition
async function joinCompetition() {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Du må være innlogget for å bli med');
        return;
    }

    try {
        await competitionService.joinCompetition(competitionId, user);
        alert('Du er nå med i konkurransen!');
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
        await competitionService.deleteCompetition(competitionId);
        alert('Konkurransen er slettet');
        window.location.href = 'competitions.html';
    } catch (error) {
        console.error('Failed to delete competition:', error);
        alert('Kunne ikke slette konkurransen. Prøv igjen.');
    }
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const participants = await leaderboardService.loadLeaderboard(competitionId, competition, footballApi);
        renderLeaderboard(participants);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

// Calculate points for a participant (wrapper for service)
async function calculateParticipantPoints(userId) {
    return await leaderboardService.calculateParticipantPoints(userId, competition, footballApi);
}

// Calculate points for a single match (wrapper for imported function)
function calculateMatchPoints(tip, result) {
    // Use the imported calculatePoints function from matchUtils
    // Note: calculatePoints expects { odds, homeScore, awayScore } as tip
    // and result object with { result: { home, away } }
    return calculatePoints(tip, result);
}

// getOutcome is now imported from matchUtils

// Render leaderboard
function renderLeaderboard(participants) {
    // Use the renderer module
    competitionRenderer.renderLeaderboard(participants, competitionMatches);
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

        const db = firebase.firestore();
        competitionMatches = []; // Reset global variable

        // Check if competition has cached matches
        if (competition.cachedMatches && competition.cachedMatches.length > 0) {
            competitionMatches = competition.cachedMatches;
        } else {
            // Fetch both scores (completed/live) and upcoming fixtures
            const scores = await footballApi.fetchScores();
            const upcoming = await footballApi.getUpcomingFixtures();

            // Combine both arrays and deduplicate by match ID
            const allMatches = [...scores, ...upcoming];
            const uniqueMatches = [];
            const seenIds = new Set();

            allMatches.forEach(match => {
                if (!seenIds.has(match.id)) {
                    seenIds.add(match.id);
                    uniqueMatches.push(match);
                }
            });

            const competitionLeagues = competition.leagues || [];

            // SIMPLIFIED LOGIC: Just filter by league and optionally by round or matchIds
            competitionMatches = uniqueMatches.filter(match => {
                // If competition has specific matchIds (custom competition), only include those
                if (competition.matchIds && competition.matchIds.length > 0) {
                    return competition.matchIds.includes(match.id);
                }

                // Must be in one of the competition leagues
                const matchInLeague = competitionLeagues.some(leagueId => {
                    // Support both new format (league as number) and old format (league as string)
                    if (typeof match.league === 'number') {
                        return match.league === leagueId;
                    } else if (typeof match.league === 'string') {
                        const leagueName = LEAGUE_NAMES_SIMPLE[leagueId];
                        return match.league.includes(leagueName);
                    }
                    return false;
                });

                if (!matchInLeague) {
                    return false;
                }

                // If we have selected rounds, filter by them
                if (competition.selectedRounds) {
                    let roundMatches = false;

                    // Premier League round filtering (league ID 39)
                    const isPremierLeague = (typeof match.league === 'number' && match.league === 39) ||
                                           (typeof match.league === 'string' && match.league.includes('Premier League'));
                    if (competition.selectedRounds.premierLeague && competition.selectedRounds.premierLeague.length > 0 && isPremierLeague) {
                        if (match.round) {
                            const roundMatch = match.round.match(/(\d+)/);
                            if (roundMatch) {
                                const roundNumber = parseInt(roundMatch[1]);
                                roundMatches = competition.selectedRounds.premierLeague.includes(roundNumber);
                            }
                        }
                        return roundMatches; // Return immediately for PL matches
                    }

                    // Champions League round filtering (league ID 2)
                    const isChampionsLeague = (typeof match.league === 'number' && match.league === 2) ||
                                             (typeof match.league === 'string' && match.league.includes('Champions League'));
                    if (competition.selectedRounds.championsLeague && competition.selectedRounds.championsLeague.length > 0 && isChampionsLeague) {
                        if (match.round) {
                            roundMatches = competition.selectedRounds.championsLeague.includes(match.round);
                        }
                        return roundMatches; // Return immediately for CL matches
                    }

                    // If we have selectedRounds but this match doesn't match any, exclude it
                    return false;
                }

                // If competitionType is 'round' but no selectedRounds, assume PL Round 9 for backward compatibility
                const isPremierLeagueBackCompat = (typeof match.league === 'number' && match.league === 39) ||
                                                  (typeof match.league === 'string' && match.league.includes('Premier League'));
                if (competition.competitionType === 'round' && !competition.selectedRounds && isPremierLeagueBackCompat && match.round) {
                    const roundMatch = match.round.match(/(\d+)/);
                    if (roundMatch) {
                        const roundNumber = parseInt(roundMatch[1]);
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

        }

        if (competitionMatches.length === 0) {
            matchesList.innerHTML = '<div class="no-matches">Ingen kamper funnet i denne perioden for valgte ligaer</div>';
            return null; // No matches found - status indeterminate
        }

        renderCompetitionMatches(competitionMatches);

        // Check if all matches are completed
        const allCompleted = competitionMatches.every(match => match.completed);

        // If all matches are completed and we haven't cached yet, save to Firestore
        if (allCompleted && !competition.cachedMatches) {
            try {
                await competitionService.cacheCompetitionMatches(competitionId, competitionMatches);
            } catch (error) {
                console.warn('Failed to cache matches:', error);
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
    competitionRenderer.renderCompetitionMatches(matches, userTips, calculateMatchPoints, footballApi);
}

// Create competition match card
function createCompetitionMatchCard(match) {
    return competitionRenderer.createCompetitionMatchCard(match, userTips, calculateMatchPoints, footballApi);
}

// Export functions to window for onclick handlers
window.joinCompetition = joinCompetition;
window.shareCompetition = shareCompetition;
window.closeUserTipsModal = closeUserTipsModal;

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
