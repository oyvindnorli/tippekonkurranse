/**
 * Firebase Service Layer
 * Centralized Firestore operations for all collections
 */

/**
 * Get a reference to a Firestore collection
 * @param {string} collectionName - Name of the collection
 * @returns {firebase.firestore.CollectionReference}
 */
function getCollection(collectionName) {
    return firebase.firestore().collection(collectionName);
}

/**
 * Get a document from a collection
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document data or null if not found
 */
export async function getDocument(collectionName, docId) {
    try {
        const doc = await getCollection(collectionName).doc(docId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error(`Error getting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Get multiple documents by IDs
 * @param {string} collectionName - Name of the collection
 * @param {Array<string>} docIds - Array of document IDs
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocuments(collectionName, docIds) {
    try {
        const docs = [];
        // Firestore 'in' has limit of 10, so batch requests
        for (let i = 0; i < docIds.length; i += 10) {
            const batch = docIds.slice(i, i + 10);
            const snapshot = await getCollection(collectionName)
                .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
                .get();

            snapshot.forEach(doc => {
                docs.push({ id: doc.id, ...doc.data() });
            });
        }
        return docs;
    } catch (error) {
        console.error(`Error getting documents from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Query documents with a where clause
 * @param {string} collectionName - Name of the collection
 * @param {string} field - Field to query
 * @param {string} operator - Firestore operator (==, !=, <, <=, >, >=, array-contains, in, array-contains-any)
 * @param {any} value - Value to compare
 * @returns {Promise<Array>} Array of matching documents
 */
export async function queryDocuments(collectionName, field, operator, value) {
    try {
        const snapshot = await getCollection(collectionName)
            .where(field, operator, value)
            .get();

        const docs = [];
        snapshot.forEach(doc => {
            docs.push({ id: doc.id, ...doc.data() });
        });
        return docs;
    } catch (error) {
        console.error(`Error querying ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Create a new document
 * @param {string} collectionName - Name of the collection
 * @param {Object} data - Document data
 * @param {string} [docId] - Optional document ID (auto-generated if not provided)
 * @returns {Promise<string>} Document ID
 */
export async function createDocument(collectionName, data, docId = null) {
    try {
        if (docId) {
            await getCollection(collectionName).doc(docId).set(data);
            return docId;
        } else {
            const docRef = await getCollection(collectionName).add(data);
            return docRef.id;
        }
    } catch (error) {
        console.error(`Error creating document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Update a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {Object} data - Data to update
 * @param {boolean} merge - Whether to merge with existing data (default: true)
 * @returns {Promise<void>}
 */
export async function updateDocument(collectionName, docId, data, merge = true) {
    try {
        if (merge) {
            await getCollection(collectionName).doc(docId).set(data, { merge: true });
        } else {
            await getCollection(collectionName).doc(docId).update(data);
        }
    } catch (error) {
        console.error(`Error updating document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Delete a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(collectionName, docId) {
    try {
        await getCollection(collectionName).doc(docId).delete();
    } catch (error) {
        console.error(`Error deleting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Batch write operations
 * @param {Array<Object>} operations - Array of operations {type: 'set'|'update'|'delete', collection, docId, data}
 * @returns {Promise<void>}
 */
export async function batchWrite(operations) {
    try {
        const batch = firebase.firestore().batch();

        operations.forEach(op => {
            const docRef = getCollection(op.collection).doc(op.docId);

            switch (op.type) {
                case 'set':
                    batch.set(docRef, op.data, op.options || {});
                    break;
                case 'update':
                    batch.update(docRef, op.data);
                    break;
                case 'delete':
                    batch.delete(docRef);
                    break;
                default:
                    console.warn(`Unknown batch operation type: ${op.type}`);
            }
        });

        await batch.commit();
    } catch (error) {
        console.error('Error in batch write:', error);
        throw error;
    }
}

/**
 * Listen to real-time updates on a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {Function} callback - Callback function that receives the document data
 * @returns {Function} Unsubscribe function
 */
export function listenToDocument(collectionName, docId, callback) {
    return getCollection(collectionName).doc(docId).onSnapshot(
        (doc) => {
            if (doc.exists) {
                callback({ id: doc.id, ...doc.data() });
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error(`Error listening to ${collectionName}/${docId}:`, error);
        }
    );
}

/**
 * Listen to real-time updates on a query
 * @param {string} collectionName - Name of the collection
 * @param {string} field - Field to query
 * @param {string} operator - Firestore operator
 * @param {any} value - Value to compare
 * @param {Function} callback - Callback function that receives array of documents
 * @returns {Function} Unsubscribe function
 */
export function listenToQuery(collectionName, field, operator, value, callback) {
    return getCollection(collectionName)
        .where(field, operator, value)
        .onSnapshot(
            (snapshot) => {
                const docs = [];
                snapshot.forEach(doc => {
                    docs.push({ id: doc.id, ...doc.data() });
                });
                callback(docs);
            },
            (error) => {
                console.error(`Error listening to ${collectionName} query:`, error);
            }
        );
}

// Collection-specific helpers

/**
 * User-related operations
 */
export const Users = {
    get: (userId) => getDocument('users', userId),
    create: (userId, data) => createDocument('users', data, userId),
    update: (userId, data) => updateDocument('users', userId, data),
    delete: (userId) => deleteDocument('users', userId)
};

/**
 * Tips-related operations
 */
export const Tips = {
    get: (tipId) => getDocument('tips', tipId),
    getByUser: (userId) => queryDocuments('tips', 'userId', '==', userId),
    getByMatch: (matchId) => queryDocuments('tips', 'matchId', '==', matchId),
    create: (data) => createDocument('tips', data),
    update: (tipId, data) => updateDocument('tips', tipId, data),
    delete: (tipId) => deleteDocument('tips', tipId)
};

/**
 * Competitions-related operations
 */
export const Competitions = {
    get: (competitionId) => getDocument('competitions', competitionId),
    getByParticipant: (userId) => queryDocuments('competitions', 'participants', 'array-contains', userId),
    create: (data) => createDocument('competitions', data),
    update: (competitionId, data) => updateDocument('competitions', competitionId, data),
    delete: (competitionId) => deleteDocument('competitions', competitionId),
    listen: (competitionId, callback) => listenToDocument('competitions', competitionId, callback)
};

/**
 * Competition Participants-related operations
 */
export const CompetitionParticipants = {
    get: (participantId) => getDocument('competitionParticipants', participantId),
    getByCompetition: (competitionId) => queryDocuments('competitionParticipants', 'competitionId', '==', competitionId),
    create: (participantId, data) => createDocument('competitionParticipants', data, participantId),
    update: (participantId, data) => updateDocument('competitionParticipants', participantId, data),
    delete: (participantId) => deleteDocument('competitionParticipants', participantId)
};

/**
 * Matches cache-related operations
 */
export const Matches = {
    get: (matchId) => getDocument('matches', matchId),
    getMultiple: (matchIds) => getDocuments('matches', matchIds.map(id => String(id))),
    create: (matchId, data) => createDocument('matches', data, String(matchId)),
    update: (matchId, data) => updateDocument('matches', String(matchId), data),
    delete: (matchId) => deleteDocument('matches', String(matchId))
};

/**
 * User preferences-related operations
 */
export const UserPreferences = {
    get: (userId) => getDocument('userPreferences', userId),
    create: (userId, data) => createDocument('userPreferences', data, userId),
    update: (userId, data) => updateDocument('userPreferences', userId, data),
    delete: (userId) => deleteDocument('userPreferences', userId)
};
