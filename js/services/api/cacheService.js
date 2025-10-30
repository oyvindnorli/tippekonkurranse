/**
 * Cache Service
 * Handles localStorage caching for API responses
 */

/**
 * Load cached API data from localStorage
 * @returns {Array|null} Cached matches or null if expired/missing
 */
export function loadCache() {
    try {
        const cached = localStorage.getItem('apiFootballCache');
        if (cached) {
            const data = JSON.parse(cached);
            // Check if cache is still valid (30 minutes)
            if (data.timestamp && (Date.now() - data.timestamp) < 30 * 60 * 1000) {
                const hoursRemaining = Math.round((30 * 60 * 1000 - (Date.now() - data.timestamp)) / 1000 / 60 / 60);
                console.log(`✅ Using cached data (expires in ${hoursRemaining} hours)`);
                return data;
            }
        }
    } catch (error) {
        console.error('Error loading cache:', error);
    }
    return null;
}

/**
 * Save API data to localStorage cache
 * @param {Array} data - Data to cache
 */
export function saveCache(data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem('apiFootballCache', JSON.stringify(cacheData));
        console.log('💾 Data cached for 30 minutes');
    } catch (error) {
        console.error('Error saving cache:', error);
    }
}

/**
 * Clear cache (useful for manual refresh)
 */
export function clearCache() {
    localStorage.removeItem('apiFootballCache');
    console.log('🗑️ Cache cleared');
}
