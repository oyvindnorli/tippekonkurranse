/**
 * Tests for dateUtils.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    formatDate,
    formatDateRange,
    getDateLabel,
    toISODate,
    getStartOfDay,
    getEndOfDay,
    isSameDay,
    addDays,
    daysBetween
} from '../../js/utils/dateUtils.js';

describe('dateUtils', () => {
    let testDate;

    beforeEach(() => {
        // Use a fixed date for consistent testing
        testDate = new Date('2025-10-15T14:30:00');
    });

    describe('formatDate', () => {
        it('should format date in Norwegian locale', () => {
            const result = formatDate(testDate);
            expect(result).toMatch(/15\. okt\.? 2025/);
        });
    });

    describe('formatDateRange', () => {
        it('should return single date for same day', () => {
            const start = new Date('2025-10-15T10:00:00');
            const end = new Date('2025-10-15T18:00:00');
            const result = formatDateRange(start, end);
            expect(result).toMatch(/15\. okt\.?/);
        });

        it('should format range in same month', () => {
            const start = new Date('2025-10-15');
            const end = new Date('2025-10-20');
            const result = formatDateRange(start, end);
            // Should be "15.-20. okt." or similar format
            expect(result).toMatch(/15\.?-.*20\. okt\.?/);
        });

        it('should format range across different months', () => {
            const start = new Date('2025-10-28');
            const end = new Date('2025-11-02');
            const result = formatDateRange(start, end);
            expect(result).toContain('-');
        });
    });

    describe('getDateLabel', () => {
        it('should return "I dag" for today', () => {
            const today = new Date();
            const result = getDateLabel(today);
            expect(result).toBe('I dag');
        });

        it('should return "I morgen" for tomorrow', () => {
            const tomorrow = addDays(new Date(), 1);
            const result = getDateLabel(tomorrow);
            expect(result).toBe('I morgen');
        });

        it('should return "I går" for yesterday', () => {
            const yesterday = addDays(new Date(), -1);
            const result = getDateLabel(yesterday);
            expect(result).toBe('I går');
        });

        it('should return formatted date for other days', () => {
            const futureDate = addDays(new Date(), 7);
            const result = getDateLabel(futureDate);
            expect(result).toMatch(/\w+,? \d+\. \w+/);
        });

        it('should return "Alle dager" for null date', () => {
            const result = getDateLabel(null);
            expect(result).toBe('Alle dager');
        });
    });

    describe('toISODate', () => {
        it('should format date as YYYY-MM-DD', () => {
            const result = toISODate(testDate);
            expect(result).toBe('2025-10-15');
        });
    });

    describe('getStartOfDay', () => {
        it('should set time to 00:00:00.000', () => {
            const result = getStartOfDay(testDate);
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
        });

        it('should not modify original date', () => {
            const original = new Date(testDate);
            getStartOfDay(testDate);
            expect(testDate.getTime()).toBe(original.getTime());
        });
    });

    describe('getEndOfDay', () => {
        it('should set time to 23:59:59.999', () => {
            const result = getEndOfDay(testDate);
            expect(result.getHours()).toBe(23);
            expect(result.getMinutes()).toBe(59);
            expect(result.getSeconds()).toBe(59);
            expect(result.getMilliseconds()).toBe(999);
        });
    });

    describe('isSameDay', () => {
        it('should return true for same day', () => {
            const date1 = new Date('2025-10-15T10:00:00');
            const date2 = new Date('2025-10-15T18:00:00');
            expect(isSameDay(date1, date2)).toBe(true);
        });

        it('should return false for different days', () => {
            const date1 = new Date('2025-10-15');
            const date2 = new Date('2025-10-16');
            expect(isSameDay(date1, date2)).toBe(false);
        });
    });

    describe('addDays', () => {
        it('should add positive days', () => {
            const result = addDays(testDate, 5);
            expect(result.getDate()).toBe(20);
        });

        it('should subtract with negative days', () => {
            const result = addDays(testDate, -5);
            expect(result.getDate()).toBe(10);
        });

        it('should not modify original date', () => {
            const original = new Date(testDate);
            addDays(testDate, 5);
            expect(testDate.getTime()).toBe(original.getTime());
        });
    });

    describe('daysBetween', () => {
        it('should calculate days between dates', () => {
            const start = new Date('2025-10-15');
            const end = new Date('2025-10-20');
            expect(daysBetween(start, end)).toBe(5);
        });

        it('should return negative for reversed dates', () => {
            const start = new Date('2025-10-20');
            const end = new Date('2025-10-15');
            expect(daysBetween(start, end)).toBe(-5);
        });

        it('should return 0 for same day', () => {
            const date = new Date('2025-10-15');
            expect(daysBetween(date, date)).toBe(0);
        });
    });
});
