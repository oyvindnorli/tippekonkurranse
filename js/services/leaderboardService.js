/**
 * Leaderboard Service
 * Handles points calculation and leaderboard logic
 */

import { LEAGUE_NAMES_SIMPLE } from '../utils/leagueConfig.js';
import { calculatePoints } from '../utils/matchUtils.js';

/**
 * Load leaderboard for a competition
 * @param {string} competitionId
 * @param {Object} competition - Competition object
 * @param {Object} footballApi - Football API service instance
 * @returns {Promise<Array>} Array of participants with points
 */
export async function loadLeaderboard(competitionId, competition, footballApi) {
    console.log('🔍 [leaderboardService] Loading leaderboard for competition:', competitionId);
    const db = firebase.firestore();

    try {
        // Get all participants for this competition
        const participantsSnapshot = await db.collection('competitionParticipants')
            .where('competitionId', '==', competitionId)
            .get();

        console.log('✅ [leaderboardService] Loaded', participantsSnapshot.size, 'participants');

        // Fetch match results ONCE for all participants (instead of per participant)
        const matchResults = await fetchMatchResultsForCompetition(competition, footballApi);

        // Process all participants in parallel
        const participantPromises = participantsSnapshot.docs.map(async (doc) => {
            const participant = doc.data();

            // Run points calculation and username fetch in parallel
            const [points, userName] = await Promise.all([
                calculateParticipantPointsOptimized(participant.userId, matchResults),
                fetchUserDisplayName(db, participant.userId, participant.userName)
            ]);

            return {
                userId: participant.userId,
                userName: userName,
                totalPoints: points
            };
        });

        // Wait for all participants to be processed
        const participants = await Promise.all(participantPromises);

        // Sort by points (descending)
        participants.sort((a, b) => b.totalPoints - a.totalPoints);

        return participants;
    } catch (error) {
        console.error('❌ [leaderboardService] Error loading leaderboard:', error);
        throw error;
    }
}

/**
 * Fetch user display name from Firestore
 * @param {Object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {string} fallbackName - Fallback name if displayName not found
 * @returns {Promise<string>} Display name
 */
async function fetchUserDisplayName(db, userId, fallbackName) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists && userDoc.data().displayName) {
            return userDoc.data().displayName;
        }
    } catch (error) {
        console.error('❌ [leaderboardService] Error fetching displayName for user', userId, ':', error);
    }
    return fallbackName;
}

/**
 * Calculate points for a participant (optimized - uses pre-fetched match results)
 * @param {string} userId
 * @param {Object} matchResults - Pre-fetched match results
 * @returns {Promise<number>} Total points
 */
async function calculateParticipantPointsOptimized(userId, matchResults) {
    const db = firebase.firestore();

    try {
        // Get user's tips
        const tipsSnapshot = await db.collection('tips')
            .where('userId', '==', userId)
            .get();

        const tips = [];
        tipsSnapshot.forEach(doc => {
            tips.push({ id: doc.id, ...doc.data() });
        });

        // Calculate points
        let totalPoints = 0;

        Object.keys(matchResults).forEach(matchId => {
            const tip = tips.find(t => String(t.matchId) === String(matchId));
            const result = matchResults[matchId];

            // Count points for both completed and live matches (if they have a score)
            if (tip && result && result.result && result.result.home !== null && result.result.away !== null) {
                const points = calculatePoints(tip, result);
                totalPoints += points;
            }
        });

        return Math.round(totalPoints * 10) / 10; // Round to 1 decimal
    } catch (error) {
        console.error('❌ [leaderboardService] Error calculating points for user', userId, ':', error);
        throw error;
    }
}

/**
 * Calculate points for a participant in a competition
 * @param {string} userId
 * @param {Object} competition - Competition object
 * @param {Object} footballApi - Football API service instance
 * @returns {Promise<number>} Total points
 */
export async function calculateParticipantPoints(userId, competition, footballApi) {
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
    const matchResults = await fetchMatchResultsForCompetition(competition, footballApi);

    // Calculate points
    let totalPoints = 0;

    Object.keys(matchResults).forEach(matchId => {
        const tip = tips.find(t => String(t.matchId) === String(matchId));
        const result = matchResults[matchId];

        // Count points for both completed and live matches (if they have a score)
        if (tip && result && result.result && result.result.home !== null && result.result.away !== null) {
            const points = calculatePoints(tip, result);
            totalPoints += points;
        }
    });

    return Math.round(totalPoints * 10) / 10; // Round to 1 decimal
}

/**
 * Fetch match results for a competition
 * @param {Object} competition - Competition object
 * @param {Object} footballApi - Football API service instance
 * @returns {Promise<Object>} Object with matchId as key and match as value
 */
async function fetchMatchResultsForCompetition(competition, footballApi) {
    const results = {};

    // Use cached matches if available, otherwise fetch from API
    let scores;
    if (competition.cachedMatches && competition.cachedMatches.length > 0) {
        scores = competition.cachedMatches;
    } else {
        scores = await footballApi.fetchScores();
    }

    const leagues = competition.leagues || [];

    // SIMPLIFIED LOGIC: Same as loadCompetitionMatches
    scores.forEach(match => {
        // If competition has specific matchIds, only process those
        if (competition.matchIds && competition.matchIds.length > 0) {
            if (!competition.matchIds.includes(match.id) || !match.result) {
                return;
            }
        } else {
            // Must be in one of the competition leagues
            const isInLeague = leagues.some(leagueId => {
                // Support both new format (league as number) and old format (league as string)
                if (typeof match.league === 'number') {
                    return match.league === leagueId;
                } else if (typeof match.league === 'string') {
                    const leagueName = LEAGUE_NAMES_SIMPLE[leagueId];
                    return match.league.includes(leagueName);
                }
                return false;
            });

            if (!isInLeague || !match.result) {
                return;
            }
        }

        let includeMatch = false;

        // Check league type for filtering
        const isPremierLeague = (typeof match.league === 'number' && match.league === 39) ||
                               (typeof match.league === 'string' && match.league.includes('Premier League'));
        const isChampionsLeague = (typeof match.league === 'number' && match.league === 2) ||
                                 (typeof match.league === 'string' && match.league.includes('Champions League'));
        const isEuropaLeague = (typeof match.league === 'number' && match.league === 3) ||
                              (typeof match.league === 'string' && match.league.includes('Europa League'));

        // If we have selected rounds, filter by them
        if (competition.selectedRounds) {
            // Premier League round filtering
            if (competition.selectedRounds.premierLeague && competition.selectedRounds.premierLeague.length > 0 && isPremierLeague) {
                if (match.round) {
                    const roundMatch = match.round.match(/(\d+)/);
                    if (roundMatch) {
                        const roundNumber = parseInt(roundMatch[1]);
                        includeMatch = competition.selectedRounds.premierLeague.includes(roundNumber);
                    }
                }
            }
            // Champions League round filtering
            else if (competition.selectedRounds.championsLeague && competition.selectedRounds.championsLeague.length > 0 && isChampionsLeague) {
                if (match.round) {
                    includeMatch = competition.selectedRounds.championsLeague.includes(match.round);
                }
            }
            // Europa League round filtering
            else if (competition.selectedRounds.europaLeague && competition.selectedRounds.europaLeague.length > 0 && isEuropaLeague) {
                if (match.round) {
                    includeMatch = competition.selectedRounds.europaLeague.includes(match.round);
                }
            }
        }
        // If competitionType is 'round' but no selectedRounds, assume PL Round 9
        else if (competition.competitionType === 'round' && isPremierLeague && match.round) {
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

    return results;
}
