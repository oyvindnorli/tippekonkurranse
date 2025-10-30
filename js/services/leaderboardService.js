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
    const db = firebase.firestore();

    // Get all participants for this competition
    const participantsSnapshot = await db.collection('competitionParticipants')
        .where('competitionId', '==', competitionId)
        .get();

    const participants = [];
    for (const doc of participantsSnapshot.docs) {
        const participant = doc.data();

        // Calculate points for this participant
        const points = await calculateParticipantPoints(participant.userId, competition, footballApi);

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

    return participants;
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

    return Math.round(totalPoints * 100) / 100; // Round to 2 decimals
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
                const leagueName = LEAGUE_NAMES_SIMPLE[leagueId];
                return match.league && match.league.includes(leagueName);
            });

            if (!isInLeague || !match.result) {
                return;
            }
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

    return results;
}
