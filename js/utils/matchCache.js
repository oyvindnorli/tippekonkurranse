/**
 * Match Cache Service - Firestore as single source of truth
 *
 * This ensures all users see the same odds for the same match,
 * regardless of when they load the page.
 */

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

        snapshot.forEach(doc => {
            const data = doc.data();

            // Debug first document to see what league type we have
            if (matches.length === 0 && snapshot.size > 0) {
                console.log(`🔍 First doc league type: ${typeof data.league}, value: ${data.league}`);
                console.log(`🔍 Looking for leagues: ${JSON.stringify(Array.from(leagueSet))}`);
            }

            // Filter by league IDs - handle both string and number
            const docLeague = typeof data.league === 'string' ? parseInt(data.league) : data.league;
            if (leagueSet.has(docLeague)) {
                matches.push(data);
            }
        });

        console.log(`📦 Firestore cache: Found ${matches.length} matches (after league filter)`);
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

                // Check if existing document has wrong format (league as string name)
                const needsRewrite = existing && typeof existing.league === 'string';

                if (needsRewrite) {
                    console.log(`⚠️ Skipping match ${match.id} - old format detected (league: "${existing.league}"). Will be cleaned up later.`);
                    continue; // Skip old format matches - don't try to rewrite them
                }

                if (existing) {
                    // Only update result and completed status, NEVER update odds
                    if (match.result || match.completed) {
                        batch.update(docRef, {
                            result: match.result || null,
                            completed: match.completed || false,
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        });
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
