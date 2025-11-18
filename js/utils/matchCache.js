/**
 * Match Cache Service - Supabase as single source of truth
 *
 * This ensures all users see the same odds for the same match,
 * regardless of when they load the page.
 */

/**
 * Get Supabase instance
 */
function getSupabase() {
    if (typeof window.supabase !== 'undefined') {
        return window.supabase;
    }
    throw new Error('Supabase is not available. Make sure Supabase is initialized before using matchCache.');
}

/**
 * Map league name to league ID
 */
const LEAGUE_NAME_TO_ID = {
    'Premier League': 39,
    'UEFA Champions League': 2,
    'Champions League': 2,
    'UEFA Europa League': 3,
    'Europa League': 3,
    'Serie A': 135,
    'EFL Cup': 48,
    'Carabao Cup': 48
};

/**
 * Convert Supabase match format to internal format
 */
function convertSupabaseMatch(match) {
    return {
        id: match.id,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeLogo: match.home_logo,
        awayLogo: match.away_logo,
        commence_time: match.commence_time,
        league: match.league_id,
        leagueName: match.league_name,
        season: match.season,
        status: match.status,
        result: match.home_score !== null && match.away_score !== null
            ? { home: match.home_score, away: match.away_score }
            : null,
        completed: match.completed,
        odds: match.odds,
        elapsed: match.elapsed
    };
}

/**
 * Convert old format matches to new format (deprecated for Supabase)
 * @returns {Promise<number>} Number of matches converted
 */
export async function convertOldFormatMatches() {
    console.log('⚠️ convertOldFormatMatches is deprecated with Supabase (schema enforces INTEGER league_id)');
    return 0;
}

/**
 * Clean up old format matches (deprecated for Supabase)
 * @returns {Promise<number>} Number of matches deleted
 */
export async function cleanupOldFormatMatches() {
    console.log('⚠️ cleanupOldFormatMatches is deprecated with Supabase');
    return 0;
}

/**
 * Clean up ALL outdated matches from Supabase
 * Deletes matches older than today
 * @returns {Promise<number>} Number of matches deleted
 */
export async function cleanupAllOutdatedMatches() {
    try {
        const supabase = getSupabase();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('matches')
            .delete()
            .lt('commence_time', today.toISOString())
            .select();

        if (error) {
            if (error.code === '42501') { // Insufficient permissions
                console.log('ℹ️ Cleanup skipped (insufficient permissions - this is normal for regular users)');
            } else {
                console.warn('⚠️ Could not clean up outdated matches:', error.message);
            }
            return 0;
        }

        const deletedCount = data?.length || 0;
        if (deletedCount > 0) {
            console.log(`✅ Deleted ${deletedCount} outdated matches from Supabase`);
        } else {
            console.log('✅ No outdated matches found - Supabase is clean!');
        }

        return deletedCount;
    } catch (error) {
        console.warn('⚠️ Could not clean up outdated matches:', error.message || error);
        return 0;
    }
}

/**
 * Get matches from Supabase cache
 * @param {Array} matchIds - Array of match IDs to fetch
 * @returns {Promise<Object>} Object with cached matches and missing IDs
 */
export async function getCachedMatches(matchIds) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .in('id', matchIds);

        if (error) {
            console.error('Error fetching matches from Supabase:', error);
            return { cached: [], missing: matchIds };
        }

        const cached = (data || [])
            .filter(m => m.odds) // Only return matches with odds
            .map(convertSupabaseMatch);

        const cachedIds = new Set(cached.map(m => m.id));
        const missing = matchIds.filter(id => !cachedIds.has(id));

        return { cached, missing };
    } catch (error) {
        console.error('Error fetching matches from Supabase:', error);
        return { cached: [], missing: matchIds };
    }
}

/**
 * Get all upcoming matches from Supabase (within date range)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Array} leagueIds - Array of league IDs to filter by
 * @returns {Promise<Array>}
 */
export async function getUpcomingMatchesFromCache(startDate, endDate, leagueIds) {
    console.log('🔧 getUpcomingMatchesFromCache called');
    console.log('   startDate:', startDate);
    console.log('   endDate:', endDate);
    console.log('   leagueIds:', leagueIds);

    let supabase;
    try {
        supabase = getSupabase();
        console.log('   ✅ Supabase instance obtained');
    } catch (error) {
        console.error('   ❌ Failed to get Supabase instance:', error);
        return [];
    }

    try {
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        console.log(`🔍 Supabase query: ${startISO.split('T')[0]} to ${endISO.split('T')[0]} for leagues ${leagueIds.join(',')}`);

        // Query matches in date range and filter by league IDs
        console.log('   🔄 Executing Supabase query...');
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('commence_time', startISO)
            .lte('commence_time', endISO)
            .in('league_id', leagueIds)
            .order('commence_time', { ascending: true });

        console.log('   ✅ Query completed');
        console.log('   error:', error);
        console.log('   data length:', data?.length);

        if (error) {
            console.error('❌ Supabase error:', error);
            return [];
        }

        console.log(`📦 Supabase cache: ${data?.length || 0} matches matched leagues ${leagueIds.join(',')}`);

        const matches = (data || []).map(convertSupabaseMatch);
        console.log(`   ✅ Converted ${matches.length} matches`);
        return matches;
    } catch (error) {
        console.error('❌ Error fetching upcoming matches from Supabase:', error);
        console.error('   Stack:', error.stack);
        return [];
    }
}

/**
 * Save matches to Supabase (freeze odds at this moment)
 * @param {Array} matches - Array of match objects from API
 * @returns {Promise<number>} Number of matches saved
 */
export async function saveMatchesToCache(matches) {
    const supabase = getSupabase();
    let totalSaved = 0;

    console.log(`💾 Attempting to save ${matches.length} matches to Supabase...`);

    try {
        for (const match of matches) {
            try {
                // Check if match already exists (use maybeSingle to avoid error on not found)
                const { data: existing, error: selectError } = await supabase
                    .from('matches')
                    .select('id, odds, home_score, away_score')
                    .eq('id', match.id)
                    .maybeSingle();

                if (selectError) {
                    console.error(`Error checking match ${match.id}:`, selectError);
                    continue;
                }

                if (existing) {
                    // Update only if result changed or odds were missing
                    const needsUpdate = match.result || match.completed ||
                                       (existing.odds === null && match.odds !== null);

                    if (needsUpdate) {
                        const updates = {
                            updated_at: new Date().toISOString()
                        };

                        if (match.result) {
                            updates.home_score = match.result.home;
                            updates.away_score = match.result.away;
                        }

                        if (match.completed) {
                            updates.completed = true;
                            updates.status = match.status || 'FT';
                        }

                        // Only update odds if they were missing
                        if (existing.odds === null && match.odds !== null) {
                            updates.odds = match.odds;
                            console.log(`📈 Adding odds to match ${match.id} (${match.homeTeam} - ${match.awayTeam})`);
                        }

                        const { error } = await supabase
                            .from('matches')
                            .update(updates)
                            .eq('id', match.id);

                        if (error) {
                            console.error(`Error updating match ${match.id}:`, error);
                        } else {
                            totalSaved++;
                        }
                    }
                } else {
                    // Insert new match
                    console.log(`➕ Inserting new match ${match.id}: ${match.homeTeam} - ${match.awayTeam}`);
                    const { error } = await supabase
                        .from('matches')
                        .insert({
                            id: match.id,
                            home_team: match.homeTeam,
                            away_team: match.awayTeam,
                            home_logo: match.homeLogo || null,
                            away_logo: match.awayLogo || null,
                            commence_time: match.commence_time,
                            league_id: match.league,
                            league_name: match.leagueName || null,
                            season: match.season || new Date().getFullYear(),
                            status: match.status || 'NS',
                            home_score: match.result?.home || null,
                            away_score: match.result?.away || null,
                            odds: match.odds || null,
                            completed: match.completed || false,
                            elapsed: match.elapsed || null
                        });

                    if (error) {
                        console.error(`❌ Error inserting match ${match.id}:`, error);
                    } else {
                        console.log(`✅ Successfully inserted match ${match.id}`);
                        totalSaved++;
                    }
                }
            } catch (error) {
                console.error(`❌ Error saving match ${match.id}:`, error);
            }
        }

        if (totalSaved > 0) {
            console.log(`✅ Successfully saved ${totalSaved}/${matches.length} matches to Supabase`);
        } else {
            console.log(`ℹ️ No matches were saved (0/${matches.length})`);
        }

        return totalSaved;
    } catch (error) {
        console.error('❌ Fatal error saving matches to Supabase:', error);
        return totalSaved;
    }
}

/**
 * Update match results (called periodically to update scores)
 * @param {Array} matches - Matches with updated results
 * @returns {Promise<number>} Number of matches updated
 */
export async function updateMatchResults(matches) {
    const supabase = getSupabase();
    let count = 0;

    for (const match of matches) {
        if (match.result && match.completed) {
            try {
                const { error } = await supabase
                    .from('matches')
                    .update({
                        home_score: match.result.home,
                        away_score: match.result.away,
                        completed: true,
                        status: match.status || 'FT',
                        elapsed: match.elapsed || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', match.id);

                if (error) {
                    console.error(`Error updating match ${match.id}:`, error);
                } else {
                    count++;
                }
            } catch (error) {
                console.error(`Error updating match ${match.id}:`, error);
            }
        }
    }

    if (count > 0) {
        console.log(`✅ Updated ${count} match results in Supabase`);
    }

    return count;
}

/**
 * Delete Europa League matches from Supabase
 * @returns {Promise<number>} Number of matches deleted
 */
export async function deleteEuropaLeagueMatches() {
    try {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('matches')
            .delete()
            .eq('league_id', 3) // Europa League ID
            .select();

        if (error) {
            console.error('❌ Error deleting Europa League matches:', error);
            return 0;
        }

        const deletedCount = data?.length || 0;
        console.log(`🎉 Successfully deleted ${deletedCount} Europa League matches`);
        return deletedCount;
    } catch (error) {
        console.error('❌ Error deleting Europa League matches:', error);
        return 0;
    }
}

/**
 * Delete ALL matches from Supabase (fresh start)
 * @returns {Promise<number>} Number of matches deleted
 */
export async function deleteAllMatches() {
    try {
        const supabase = getSupabase();

        console.log('🗑️ Deleting all matches from Supabase...');

        // Supabase doesn't have a delete all without filter, so we need to select first
        const { data: allMatches, error: selectError } = await supabase
            .from('matches')
            .select('id');

        if (selectError) {
            console.error('❌ Error fetching matches:', selectError);
            return 0;
        }

        if (!allMatches || allMatches.length === 0) {
            console.log('ℹ️ No matches to delete');
            return 0;
        }

        const ids = allMatches.map(m => m.id);
        const { data, error } = await supabase
            .from('matches')
            .delete()
            .in('id', ids)
            .select();

        if (error) {
            console.error('❌ Error deleting matches:', error);
            return 0;
        }

        const deletedCount = data?.length || 0;
        console.log(`✅ All matches deleted from Supabase! Total: ${deletedCount}`);
        return deletedCount;
    } catch (error) {
        console.error('❌ Error deleting all matches:', error);
        return 0;
    }
}

/**
 * Clean up old matches (older than 30 days)
 */
export async function cleanupOldMatches() {
    const supabase = getSupabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const { data, error } = await supabase
            .from('matches')
            .delete()
            .lt('commence_time', thirtyDaysAgo.toISOString())
            .select();

        if (error) {
            console.error('Error cleaning up old matches:', error);
            return 0;
        }

        const deletedCount = data?.length || 0;
        if (deletedCount > 0) {
            console.log(`🗑️ Deleted ${deletedCount} old matches from Supabase`);
        }
        return deletedCount;
    } catch (error) {
        console.error('Error cleaning up old matches:', error);
        return 0;
    }
}

// Backward compatibility alias
export const saveMatchesToFirestore = saveMatchesToCache;
