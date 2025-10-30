/**
 * Tests for leagueConfig.js
 */

import { describe, it, expect } from 'vitest';
import {
    LEAGUE_NAMES,
    LEAGUE_NAMES_SIMPLE,
    getLeagueDisplayName
} from '../../js/utils/leagueConfig.js';

describe('leagueConfig', () => {
    describe('LEAGUE_NAMES', () => {
        it('should contain all expected leagues with emojis', () => {
            expect(LEAGUE_NAMES[39]).toContain('Premier League');
            expect(LEAGUE_NAMES[39]).toMatch(/[⚽🏆]/); // Has emoji
            expect(LEAGUE_NAMES[2]).toContain('Champions League');
            expect(LEAGUE_NAMES[135]).toContain('Serie A');
        });

        it('should have consistent keys between LEAGUE_NAMES and LEAGUE_NAMES_SIMPLE', () => {
            const namesKeys = Object.keys(LEAGUE_NAMES).map(Number);
            const simpleKeys = Object.keys(LEAGUE_NAMES_SIMPLE).map(Number);
            expect(namesKeys.sort()).toEqual(simpleKeys.sort());
        });
    });

    describe('LEAGUE_NAMES_SIMPLE', () => {
        it('should contain league names without emojis', () => {
            expect(LEAGUE_NAMES_SIMPLE[39]).toBe('Premier League');
            expect(LEAGUE_NAMES_SIMPLE[2]).toBe('UEFA Champions League');
            expect(LEAGUE_NAMES_SIMPLE[135]).toBe('Serie A');
            expect(LEAGUE_NAMES_SIMPLE[48]).toBe('EFL Cup');
        });

        it('should not contain emoji characters', () => {
            const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
            Object.values(LEAGUE_NAMES_SIMPLE).forEach(name => {
                expect(name).not.toMatch(emojiRegex);
            });
        });
    });

    describe('getLeagueDisplayName', () => {
        it('should return league name for known IDs', () => {
            expect(getLeagueDisplayName(39)).toBe('Premier League');
            expect(getLeagueDisplayName(2)).toBe('UEFA Champions League');
        });

        it('should return fallback for unknown IDs', () => {
            expect(getLeagueDisplayName(999)).toBe('Liga 999');
        });

        it('should handle string IDs by converting to number', () => {
            // JavaScript object keys are strings, so '39' gets converted to 39
            expect(getLeagueDisplayName('39')).toBe('Premier League');
        });
    });
});
