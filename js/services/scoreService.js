/**
 * Score Service
 * Håndterer poeng-beregning for tips
 */

import { calculatePoints } from '../utils/matchUtils.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * Calculate total score for a user's tips
 * @param {Array} tips - User's tips
 * @param {Array} matches - All matches
 * @returns {Object} Score statistics
 */
export function calculateTotalScore(tips, matches) {
    if (!tips || !Array.isArray(tips) || !matches || !Array.isArray(matches)) {
        return {
            totalScore: 0,
            tipsWithPoints: 0,
            tipsWithoutPoints: 0,
            oldTipsCount: 0
        };
    }

    let totalScore = 0;
    let tipsWithPoints = 0;
    let tipsWithoutPoints = 0;
    let oldTipsCount = 0;

    tips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));

        if (match) {
            const points = calculatePoints(tip, match);

            if (points > 0) {
                tipsWithPoints++;
                totalScore += points;
            } else if (match.result) {
                // Match has result but no points scored
                tipsWithoutPoints++;
            }
        } else {
            // Match not found - likely an old match no longer in API response
            oldTipsCount++;
        }
    });

    return {
        totalScore,
        tipsWithPoints,
        tipsWithoutPoints,
        oldTipsCount
    };
}

/**
 * Update total score display in DOM
 * @param {Array} tips - User's tips
 * @param {Array} matches - All matches
 */
export function updateTotalScoreDisplay(tips, matches) {
    const stats = calculateTotalScore(tips, matches);

    // Log to console
    if (stats.tipsWithPoints > 0 || stats.tipsWithoutPoints > 0) {
        const oldText = stats.oldTipsCount > 0 ? `, ${stats.oldTipsCount} gamle` : '';
        ErrorHandler.info(
            `💰 ${stats.totalScore.toFixed(1)} poeng (${stats.tipsWithPoints} riktige${oldText})`,
            'scoreService'
        );
    }

    // Update DOM element
    const scoreElement = document.getElementById('totalScore');
    if (scoreElement) {
        scoreElement.textContent = stats.totalScore.toFixed(1);
    }

    return stats;
}

/**
 * Calculate score for a single match/tip combination
 * @param {Object} tip - User's tip
 * @param {Object} match - Match with result
 * @returns {number} Points scored
 */
export function calculateMatchScore(tip, match) {
    if (!tip || !match) {
        return 0;
    }

    return calculatePoints(tip, match);
}

/**
 * Calculate score for a player (used in leaderboards)
 * @param {Array} tips - Player's tips
 * @param {Array} matches - All matches
 * @returns {number} Total score
 */
export function calculatePlayerScore(tips, matches) {
    if (!tips || !Array.isArray(tips) || !matches || !Array.isArray(matches)) {
        return 0;
    }

    let totalScore = 0;

    tips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        if (!match) return;

        // Skip if odds are missing (backward compatibility)
        if (!tip.odds && !match.odds) {
            return;
        }

        // Use tip's odds if available, otherwise use match odds
        const oddsToUse = tip.odds || match.odds;

        // Create tip object with odds for calculation
        const tipWithOdds = {
            ...tip,
            odds: oddsToUse
        };

        totalScore += calculatePoints(tipWithOdds, match);
    });

    return totalScore;
}
