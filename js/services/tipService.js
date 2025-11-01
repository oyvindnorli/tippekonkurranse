/**
 * Tip Service
 * Håndterer lasting, lagring og validering av tips
 */

import { ERROR_MESSAGES } from '../constants/appConstants.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * Load user tips from Firestore
 * @returns {Promise<Array>} Array of user tips
 */
export async function loadUserTips() {
    try {
        // getCurrentUserTips is defined in firebase-auth.js
        if (typeof getCurrentUserTips === 'undefined') {
            throw new Error('getCurrentUserTips is not defined');
        }

        const tips = await getCurrentUserTips();
        return tips || [];
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'tipService.loadUserTips',
            showUser: false,
            logToConsole: true
        });
        return [];
    }
}

/**
 * Submit a tip for a match
 * @param {string|number} matchId - Match ID
 * @param {number} homeScore - Home team score
 * @param {number} awayScore - Away team score
 * @param {Object} match - Match object with team names and odds
 * @returns {Promise<boolean>} Success status
 */
export async function submitTip(matchId, homeScore, awayScore, match) {
    // Validate input
    if (!validateTipInput(homeScore, awayScore)) {
        return false;
    }

    if (!match) {
        ErrorHandler.warn('Match not found for tip submission', 'tipService.submitTip');
        return false;
    }

    try {
        // Create tip object
        const tip = {
            matchId: matchId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            homeScore: parseInt(homeScore),
            awayScore: parseInt(awayScore),
            timestamp: new Date().toISOString()
        };

        // Only include odds if they exist
        if (match.odds) {
            tip.odds = match.odds;
        }

        // Save tip to Firestore (function from firebase-auth.js)
        if (typeof saveTipToFirestore === 'undefined') {
            throw new Error('saveTipToFirestore is not defined');
        }

        const saved = await saveTipToFirestore(tip);

        if (saved) {
            ErrorHandler.success(`Tip saved: ${homeScore}-${awayScore}`, 'tipService.submitTip');
        }

        return saved;
    } catch (error) {
        ErrorHandler.handle(error, {
            context: 'tipService.submitTip',
            showUser: true,
            userMessage: ERROR_MESSAGES.SAVE_TIP_FAILED,
            logToConsole: true
        });
        return false;
    }
}

/**
 * Validate tip input
 * @param {number} homeScore - Home score
 * @param {number} awayScore - Away score
 * @returns {boolean} Valid or not
 */
function validateTipInput(homeScore, awayScore) {
    // Check if values are numbers
    if (isNaN(homeScore) || isNaN(awayScore)) {
        ErrorHandler.warn('Invalid tip: scores must be numbers', 'tipService.validateTipInput');
        return false;
    }

    // Check if values are positive
    if (homeScore < 0 || awayScore < 0) {
        ErrorHandler.warn('Invalid tip: scores must be positive', 'tipService.validateTipInput');
        return false;
    }

    // Check if values are integers
    if (!Number.isInteger(parseFloat(homeScore)) || !Number.isInteger(parseFloat(awayScore))) {
        ErrorHandler.warn('Invalid tip: scores must be integers', 'tipService.validateTipInput');
        return false;
    }

    return true;
}

/**
 * Find a tip for a specific match
 * @param {Array} tips - Array of tips
 * @param {string|number} matchId - Match ID to find
 * @returns {Object|null} Tip object or null
 */
export function findTipForMatch(tips, matchId) {
    if (!tips || !Array.isArray(tips)) {
        return null;
    }

    return tips.find(tip => String(tip.matchId) === String(matchId)) || null;
}

/**
 * Check if user has tip for match
 * @param {Array} tips - Array of tips
 * @param {string|number} matchId - Match ID
 * @returns {boolean}
 */
export function hasTipForMatch(tips, matchId) {
    return findTipForMatch(tips, matchId) !== null;
}

/**
 * Get score display for a match
 * @param {Array} tips - Array of tips
 * @param {string|number} matchId - Match ID
 * @returns {Object} { homeScore, awayScore } or { homeScore: '?', awayScore: '?' }
 */
export function getScoreDisplay(tips, matchId) {
    const tip = findTipForMatch(tips, matchId);

    if (tip) {
        return {
            homeScore: tip.homeScore,
            awayScore: tip.awayScore
        };
    }

    return {
        homeScore: '?',
        awayScore: '?'
    };
}
