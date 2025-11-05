/**
 * Competition Service
 * Handles Firestore operations for competitions
 */

/**
 * Load competition from Firestore
 * @param {string} competitionId
 * @returns {Promise<Object>} Competition object
 */
export async function loadCompetition(competitionId) {
    const db = firebase.firestore();
    const competitionDoc = await db.collection('competitions').doc(competitionId).get();

    if (!competitionDoc.exists) {
        throw new Error('Konkurranse finnes ikke');
    }

    return { id: competitionDoc.id, ...competitionDoc.data() };
}

/**
 * Load user's tips from Firestore
 * @param {string} userId
 * @returns {Promise<Array>} Array of tips
 */
export async function loadUserTips(userId) {
    const db = firebase.firestore();
    const tipsSnapshot = await db.collection('tips')
        .where('userId', '==', userId)
        .get();

    const tips = [];
    tipsSnapshot.forEach(doc => {
        tips.push({ id: doc.id, ...doc.data() });
    });

    return tips;
}

/**
 * Join a competition
 * @param {string} competitionId
 * @param {Object} user - Firebase user object
 */
export async function joinCompetition(competitionId, user) {
    const db = firebase.firestore();

    // Add user to participants array
    await db.collection('competitions').doc(competitionId).update({
        participants: firebase.firestore.FieldValue.arrayUnion(user.uid)
    });

    // Create participant entry
    await db.collection('competitionParticipants').doc(`${competitionId}_${user.uid}`).set({
        competitionId: competitionId,
        userId: user.uid,
        userName: user.displayName || user.email,
        totalPoints: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Delete a competition
 * @param {string} competitionId
 */
export async function deleteCompetition(competitionId) {
    const db = firebase.firestore();

    // Delete all competition participants first
    const participantsSnapshot = await db.collection('competitionParticipants')
        .where('competitionId', '==', competitionId)
        .get();

    // Delete participants sequentially to avoid issues with security rules
    for (const doc of participantsSnapshot.docs) {
        await doc.ref.delete();
    }

    // Then delete the competition itself
    await db.collection('competitions').doc(competitionId).delete();
}

/**
 * Cache competition matches when all are completed
 * @param {string} competitionId
 * @param {Array} matches
 */
export async function cacheCompetitionMatches(competitionId, matches) {
    const db = firebase.firestore();
    await db.collection('competitions').doc(competitionId).update({
        cachedMatches: matches,
        cachedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}
