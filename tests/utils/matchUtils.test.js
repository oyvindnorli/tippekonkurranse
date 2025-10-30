/**
 * Tests for matchUtils.js
 */

import { describe, it, expect } from 'vitest';
import {
    getOutcome,
    calculatePoints,
    formatMatchTime,
    hasMatchStarted,
    isMatchLive,
    isMatchFinished,
    getMatchStatusText,
    sortMatchesByDate
} from '../../js/utils/matchUtils.js';

describe('matchUtils', () => {
    describe('getOutcome', () => {
        it('should return H for home win', () => {
            expect(getOutcome(3, 1)).toBe('H');
            expect(getOutcome(2, 0)).toBe('H');
        });

        it('should return B for away win', () => {
            expect(getOutcome(1, 3)).toBe('B');
            expect(getOutcome(0, 2)).toBe('B');
        });

        it('should return U for draw', () => {
            expect(getOutcome(1, 1)).toBe('U');
            expect(getOutcome(0, 0)).toBe('U');
            expect(getOutcome(2, 2)).toBe('U');
        });
    });

    describe('calculatePoints', () => {
        it('should return 0 if no match result', () => {
            const tip = { homeScore: 2, awayScore: 1, odds: { H: 2.0, U: 3.0, B: 3.5 } };
            const match = {};
            expect(calculatePoints(tip, match)).toBe(0);
        });

        it('should return 0 if no odds', () => {
            const tip = { homeScore: 2, awayScore: 1 };
            const match = { result: { home: 2, away: 1 } };
            expect(calculatePoints(tip, match)).toBe(0);
        });

        it('should award odds points for correct outcome', () => {
            const tip = { homeScore: 2, awayScore: 1, odds: { H: 2.5, U: 3.0, B: 3.5 } };
            const match = { result: { home: 3, away: 0 } }; // Home win
            expect(calculatePoints(tip, match)).toBe(2.5);
        });

        it('should award odds + 3 bonus for exact score', () => {
            const tip = { homeScore: 2, awayScore: 1, odds: { H: 2.5, U: 3.0, B: 3.5 } };
            const match = { result: { home: 2, away: 1 } };
            expect(calculatePoints(tip, match)).toBe(5.5); // 2.5 + 3
        });

        it('should handle draw outcomes', () => {
            const tip = { homeScore: 1, awayScore: 1, odds: { H: 2.0, U: 3.2, B: 3.5 } };
            const match = { result: { home: 2, away: 2 } }; // Draw
            expect(calculatePoints(tip, match)).toBe(3.2);
        });

        it('should handle exact draw score', () => {
            const tip = { homeScore: 1, awayScore: 1, odds: { H: 2.0, U: 3.2, B: 3.5 } };
            const match = { result: { home: 1, away: 1 } };
            expect(calculatePoints(tip, match)).toBe(6.2); // 3.2 + 3
        });

        it('should return 0 for wrong outcome', () => {
            const tip = { homeScore: 2, awayScore: 1, odds: { H: 2.0, U: 3.0, B: 3.5 } };
            const match = { result: { home: 0, away: 2 } }; // Away win (wrong)
            expect(calculatePoints(tip, match)).toBe(0);
        });
    });

    describe('formatMatchTime', () => {
        it('should format Date object', () => {
            const date = new Date('2025-10-15T14:30:00');
            const result = formatMatchTime(date);
            expect(result).toMatch(/14:30/);
        });

        it('should format ISO string', () => {
            const result = formatMatchTime('2025-10-15T14:30:00');
            expect(result).toMatch(/14:30/);
        });

        it('should format timestamp (seconds)', () => {
            const timestamp = Math.floor(new Date('2025-10-15T14:30:00').getTime() / 1000);
            const result = formatMatchTime(timestamp);
            expect(result).toMatch(/14:30/);
        });

        it('should return --:-- for invalid date', () => {
            expect(formatMatchTime('invalid')).toBe('--:--');
            expect(formatMatchTime(null)).toBe('--:--');
        });
    });

    describe('hasMatchStarted', () => {
        it('should return true for past dates', () => {
            const pastDate = new Date('2020-01-01');
            expect(hasMatchStarted(pastDate)).toBe(true);
        });

        it('should return false for future dates', () => {
            const futureDate = new Date('2030-01-01');
            expect(hasMatchStarted(futureDate)).toBe(false);
        });

        it('should handle string dates', () => {
            const pastDate = '2020-01-01T12:00:00';
            expect(hasMatchStarted(pastDate)).toBe(true);
        });

        it('should return false for invalid dates', () => {
            expect(hasMatchStarted('invalid')).toBe(false);
            expect(hasMatchStarted(null)).toBe(false);
        });
    });

    describe('isMatchLive', () => {
        it('should return true for live statuses', () => {
            expect(isMatchLive('1H')).toBe(true);
            expect(isMatchLive('2H')).toBe(true);
            expect(isMatchLive('HT')).toBe(true);
            expect(isMatchLive('LIVE')).toBe(true);
            expect(isMatchLive('IN PLAY')).toBe(true);
        });

        it('should return false for non-live statuses', () => {
            expect(isMatchLive('FT')).toBe(false);
            expect(isMatchLive('NS')).toBe(false);
            expect(isMatchLive('TBD')).toBe(false);
        });
    });

    describe('isMatchFinished', () => {
        it('should return true for finished statuses', () => {
            expect(isMatchFinished('FT')).toBe(true);
            expect(isMatchFinished('AET')).toBe(true);
            expect(isMatchFinished('PEN')).toBe(true);
            expect(isMatchFinished('FT_PEN')).toBe(true);
        });

        it('should return false for non-finished statuses', () => {
            expect(isMatchFinished('1H')).toBe(false);
            expect(isMatchFinished('NS')).toBe(false);
        });
    });

    describe('getMatchStatusText', () => {
        it('should return Norwegian text for known statuses', () => {
            expect(getMatchStatusText('NS')).toBe('Ikke startet');
            expect(getMatchStatusText('1H')).toBe('1. omgang');
            expect(getMatchStatusText('HT')).toBe('Pause');
            expect(getMatchStatusText('FT')).toBe('Fullført');
            expect(getMatchStatusText('LIVE')).toBe('Pågår');
        });

        it('should return original status for unknown statuses', () => {
            expect(getMatchStatusText('UNKNOWN')).toBe('UNKNOWN');
        });
    });

    describe('sortMatchesByDate', () => {
        it('should sort matches by commence_time', () => {
            const matches = [
                { id: 1, commence_time: '2025-10-15T14:00:00' },
                { id: 2, commence_time: '2025-10-15T12:00:00' },
                { id: 3, commence_time: '2025-10-15T16:00:00' }
            ];
            const sorted = sortMatchesByDate(matches);
            expect(sorted[0].id).toBe(2);
            expect(sorted[1].id).toBe(1);
            expect(sorted[2].id).toBe(3);
        });

        it('should not modify original array', () => {
            const matches = [
                { id: 1, commence_time: '2025-10-15T14:00:00' },
                { id: 2, commence_time: '2025-10-15T12:00:00' }
            ];
            const originalFirst = matches[0].id;
            sortMatchesByDate(matches);
            expect(matches[0].id).toBe(originalFirst);
        });

        it('should handle date field fallback', () => {
            const matches = [
                { id: 1, date: '2025-10-15T14:00:00' },
                { id: 2, date: '2025-10-15T12:00:00' }
            ];
            const sorted = sortMatchesByDate(matches);
            expect(sorted[0].id).toBe(2);
        });
    });
});
