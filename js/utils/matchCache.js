/**
 * Match Cache Service - Firestore as single source of truth
 *
 * This ensures all users see the same odds for the same match,
 * regardless of when they load the page.
 */

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
 * Convert old format matches to new format (update league string to ID)
 * @returns {Promise<number>} Number of matches converted
 */
export async function convertOldFormatMatches() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('matches').get();

        console.log(`🔄 Checking ${snapshot.size} matches for conversion...`);

        let convertedCount = 0;
        const batch = db.batch();
        let batchCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

            // Convert if league is a string (old format)
            if (typeof data.league === 'string') {
                const leagueId = LEAGUE_NAME_TO_ID[data.league];

                if (leagueId) {
                    batch.update(doc.ref, {
                        league: leagueId,
                        leagueName: data.league, // Keep original name for display
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    batchCount++;
                    convertedCount++;

                    // Firestore batch limit is 500
                    if (batchCount >= 500) {
                        console.warn('⚠️ Batch limit reached. Some matches may remain unconverted.');
                    }
                }
            }
        });

        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Converted ${convertedCount} matches from old format to new format`);
        } else {
            console.log('✅ No old format matches to convert');
        }

        return convertedCount;
    } catch (error) {
        console.error('❌ Error converting old format matches:', error);
        return 0;
    }
}

/**
 * Clean up old format matches from Firestore (league as string)
 * @returns {Promise<number>} Number of matches deleted
 */
export async function cleanupOldFormatMatches() {
    try {
        const db = firebase.firestore();

        // Get all matches
        const snapshot = await db.collection('matches').get();

        console.log(`🧹 Checking ${snapshot.size} matches for cleanup...`);

        let deletedCount = 0;
        const batch = db.batch();
        let batchCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

            // Delete if league is a string (old format)
            if (typeof data.league === 'string') {
                batch.delete(doc.ref);
                batchCount++;
                deletedCount++;

                // Firestore batch limit is 500
                if (batchCount >= 500) {
                    console.warn('⚠️ Batch limit reached. Some old matches may remain.');
                }
            }
        });

        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Deleted ${deletedCount} old format matches from Firestore`);
        } else {
            console.log('✅ No old format matches found');
        }

        return deletedCount;
    } catch (error) {
        console.error('❌ Error cleaning up old matches:', error);
        return 0;
    }
}

/**
 * Clean up ALL outdated matches from Firestore
 * Deletes: old format (league: string) + matches older than today
 * @returns {Promise<number>} Number of matches deleted
 */
export async function cleanupAllOutdatedMatches() {
    try {
        const db = firebase.firestore();

        // Get all matches
        const snapshot = await db.collection('matches').get();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log(`🧹 Checking ${snapshot.size} matches for complete cleanup...`);

        let deletedCount = 0;
        const batch = db.batch();
        let batchCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            let shouldDelete = false;

            // Delete if league is a string (old format)
            if (typeof data.league === 'string') {
                console.log(`  ❌ Deleting old format: ${data.homeTeam} vs ${data.awayTeam} (league: "${data.league}")`);
                shouldDelete = true;
            }

            // Delete if match date is before today (outdated)
            if (data.commence_time) {
                const matchDate = new Date(data.commence_time);
                matchDate.setHours(0, 0, 0, 0);
                if (matchDate < today) {
                    console.log(`  ❌ Deleting outdated: ${data.homeTeam} vs ${data.awayTeam} (${matchDate.toISOString().split('T')[0]})`);
                    shouldDelete = true;
                }
            }

            if (shouldDelete) {
                batch.delete(doc.ref);
                batchCount++;
                deletedCount++;

                // Firestore batch limit is 500
                if (batchCount >= 500) {
                    console.warn('⚠️ Batch limit reached (500). Some matches may remain.');
                }
            }
        });

        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Deleted ${deletedCount} outdated matches from Firestore`);
            console.log(`✅ Remaining: ${snapshot.size - deletedCount} valid matches`);
        } else {
            console.log('✅ No outdated matches found - Firestore is clean!');
        }

        return deletedCount;
    } catch (error) {
        // Silent fail - user likely doesn't have delete permissions
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            console.log('ℹ️ Cleanup skipped (insufficient permissions - this is normal for regular users)');
        } else {
            console.warn('⚠️ Could not clean up outdated matches:', error.message || error);
        }
        return 0;
    }
}

/**
 * Get matches from Firestore cache or fetch from API
 * @param {Array} matchIds - Array of match IDs to fetch
 * @returns {Promise<Array>} Array of matches with odds frozen
 */
export async function getCachedMatches(matchIds) {
    const db = firebase.firestore();
    const matches = [];
    const missingIds = [];

    // Check Firestore for each match
    for (const matchId of matchIds) {
        try {
            const docRef = db.collection('matches').doc(String(matchId));
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                // Only use cached match if it has odds (we want frozen odds)
                if (data.odds) {
                    matches.push(data);
                } else {
                    missingIds.push(matchId);
                }
            } else {
                missingIds.push(matchId);
            }
        } catch (error) {
            console.error(`Error fetching match ${matchId} from Firestore:`, error);
            missingIds.push(matchId);
        }
    }

    return { cached: matches, missing: missingIds };
}

/**
 * Get all upcoming matches from Firestore (within date range)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Array} leagueIds - Array of league IDs to filter by
 * @returns {Promise<Array>}
 */
export async function getUpcomingMatchesFromCache(startDate, endDate, leagueIds) {
    const db = firebase.firestore();

    try {
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        console.log(`🔍 Firestore query: ${startISO.split('T')[0]} to ${endISO.split('T')[0]} for leagues ${leagueIds.join(',')}`);

        // Fetch all matches in date range, then filter by league in JS
        // (Firestore 'in' has limit of 10, and we want flexibility)
        const snapshot = await db.collection('matches')
            .where('commence_time', '>=', startISO)
            .where('commence_time', '<=', endISO)
            .orderBy('commence_time')
            .get();

        console.log(`📊 Firestore returned ${snapshot.size} total documents`);

        const matches = [];
        const leagueSet = new Set(leagueIds);

        let oldFormatCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

            // Skip old format matches (league as string) - they will be cleaned up
            if (typeof data.league === 'string') {
                oldFormatCount++;
                return;
            }

            // Filter by league IDs (only accept numbers now)
            const docLeague = data.league;
            if (typeof docLeague === 'number' && leagueSet.has(docLeague)) {
                matches.push(data);
            }
        });

        if (oldFormatCount > 0) {
            console.log(`⚠️ Found ${oldFormatCount} old format matches - will fetch fresh data from API`);
            console.log(`📦 Firestore cache: ${matches.length}/${snapshot.size} matches matched leagues ${leagueIds.join(',')}`);
            console.log(`🔄 Forcing API refresh due to old format matches...`);

            // Always fetch fresh data if old format matches exist
            // This ensures we get all matches with correct format
            return [];
        }

        console.log(`📦 Firestore cache: ${matches.length}/${snapshot.size} matches matched leagues ${leagueIds.join(',')}`);
        return matches;
    } catch (error) {
        console.error('❌ Error fetching upcoming matches from Firestore:', error);
        return [];
    }
}

/**
 * Save matches to Firestore (freeze odds at this moment)
 * @param {Array} matches - Array of match objects from API
 * @returns {Promise<number>} Number of matches saved
 */
export async function saveMatchesToFirestore(matches) {
    const db = firebase.firestore();
    let totalSaved = 0;

    // First, check which matches already exist
    const matchIds = matches.map(m => String(m.id));
    const existingMatches = new Map();

    try {
        // Fetch existing matches in batches of 10 (Firestore 'in' limit)
        for (let i = 0; i < matchIds.length; i += 10) {
            const batch = matchIds.slice(i, i + 10);
            const snapshot = await db.collection('matches')
                .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
                .get();

            snapshot.forEach(doc => {
                existingMatches.set(doc.id, doc.data());
            });
        }
    } catch (error) {
        console.warn('⚠️ Error checking existing matches:', error);
    }

    // Now save in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchMatches = matches.slice(i, i + BATCH_SIZE);
        let batchCount = 0;

        for (const match of batchMatches) {
            try {
                const docRef = db.collection('matches').doc(String(match.id));
                const existing = existingMatches.get(String(match.id));

                if (existing) {
                    // Update result and completed status
                    // ALSO update odds if they were null before but are now available (e.g. Europa League fix)
                    const needsUpdate = match.result || match.completed ||
                                       (existing.odds === null && match.odds !== null);

                    if (needsUpdate) {
                        const updates = {
                            result: match.result || null,
                            completed: match.completed || false,
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        };

                        // Only update odds if they were missing before and are now available
                        if (existing.odds === null && match.odds !== null) {
                            updates.odds = match.odds;
                            updates.oddsLockedAt = firebase.firestore.FieldValue.serverTimestamp();
                            console.log(`📈 Adding odds to match ${match.id} (${match.homeTeam} - ${match.awayTeam})`);
                        }

                        batch.update(docRef, updates);
                        batchCount++;
                    }
                } else {
                    // New match - save everything including frozen odds
                    batch.set(docRef, {
                        id: match.id,
                        homeTeam: match.homeTeam,
                        awayTeam: match.awayTeam,
                        homeLogo: match.homeLogo || null,
                        awayLogo: match.awayLogo || null,
                        commence_time: match.commence_time,
                        time: match.time || null, // Keep time for display
                        league: match.league, // This is now ID (number)
                        leagueName: match.leagueName || null, // For display
                        leagueLogo: match.leagueLogo || null,
                        round: match.round || null,
                        odds: match.odds || null,
                        result: match.result || null,
                        completed: match.completed || false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                        oddsLockedAt: match.odds ? firebase.firestore.FieldValue.serverTimestamp() : null
                    }, { merge: false }); // Overwrite completely, don't merge
                    batchCount++;
                }
            } catch (error) {
                console.error(`Error preparing match ${match.id}:`, error);
            }
        }

        if (batchCount > 0) {
            try {
                await batch.commit();
                totalSaved += batchCount;
            } catch (error) {
                console.error('Error committing batch:', error);
            }
        }
    }

    if (totalSaved > 0) {
        console.log(`💾 Saved ${totalSaved} matches to Firestore`);
    }

    return totalSaved;
}

/**
 * Update match results (called periodically to update scores)
 * @param {Array} matches - Matches with updated results
 * @returns {Promise<number>} Number of matches updated
 */
export async function updateMatchResults(matches) {
    const db = firebase.firestore();
    const batch = db.batch();
    let count = 0;

    for (const match of matches) {
        if (match.result && match.completed) {
            try {
                const docRef = db.collection('matches').doc(String(match.id));
                batch.update(docRef, {
                    result: match.result,
                    completed: true,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
                count++;
            } catch (error) {
                console.error(`Error updating match ${match.id}:`, error);
            }
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`✅ Updated ${count} match results in Firestore`);
    }

    return count;
}

/**
 * Delete ALL matches from Firestore (fresh start)
 * @returns {Promise<number>} Number of matches deleted
 */
/**
 * Delete Europa League matches from Firestore (to refetch with odds)
 * @returns {Promise<number>} Number of matches deleted
 */
export async function deleteEuropaLeagueMatches() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('matches')
            .where('league', '==', 3) // Europa League ID
            .get();

        console.log(`🗑️ Deleting ${snapshot.size} Europa League matches from Firestore...`);

        if (snapshot.empty) {
            console.log('ℹ️ No Europa League matches to delete');
            return 0;
        }

        let deletedCount = 0;
        const BATCH_SIZE = 500;

        // Delete in batches (Firestore limit is 500 per batch)
        for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const batchDocs = snapshot.docs.slice(i, i + BATCH_SIZE);

            console.log(`  ⏳ Deleting batch ${Math.floor(i/BATCH_SIZE) + 1}...`);

            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });

            try {
                await batch.commit();
                deletedCount += batchDocs.length;
                console.log(`  ✅ Deleted ${deletedCount}/${snapshot.size} Europa League matches`);
            } catch (batchError) {
                console.error('  ❌ Batch delete failed:', batchError);
            }
        }

        console.log(`🎉 Successfully deleted ${deletedCount} Europa League matches`);
        return deletedCount;
    } catch (error) {
        console.error('❌ Error deleting Europa League matches:', error);
        return 0;
    }
}

export async function deleteAllMatches() {
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('matches').get();

        console.log(`🗑️ Deleting all ${snapshot.size} matches from Firestore...`);

        if (snapshot.empty) {
            console.log('ℹ️ No matches to delete');
            return 0;
        }

        let deletedCount = 0;
        const BATCH_SIZE = 500;

        // Delete in batches (Firestore limit is 500 per batch)
        for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const batchDocs = snapshot.docs.slice(i, i + BATCH_SIZE);

            console.log(`  ⏳ Preparing to delete ${batchDocs.length} matches (batch ${Math.floor(i/BATCH_SIZE) + 1})...`);

            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });

            try {
                await batch.commit();
                deletedCount += batchDocs.length;
                console.log(`  ✅ Deleted ${deletedCount}/${snapshot.size} matches`);
            } catch (batchError) {
                console.error(`  ❌ Error deleting batch:`, batchError);
                throw batchError;
            }
        }

        console.log(`✅ All matches deleted from Firestore! Total: ${deletedCount}`);
        return deletedCount;
    } catch (error) {
        console.error('❌ Error deleting all matches:', error);
        console.error('Error details:', error.message, error.code);
        return 0;
    }
}

/**
 * Clean up old matches (older than 30 days)
 * Should be called periodically by admin
 */
export async function cleanupOldMatches() {
    const db = firebase.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const snapshot = await db.collection('matches')
            .where('commence_time', '<', thirtyDaysAgo.toISOString())
            .limit(500) // Batch delete
            .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`🗑️ Deleted ${snapshot.size} old matches from Firestore`);
        return snapshot.size;
    } catch (error) {
        console.error('Error cleaning up old matches:', error);
        return 0;
    }
}
