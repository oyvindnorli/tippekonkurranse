/**
 * String utility functions
 */

/**
 * Clean up competition name by formatting round information
 * - "League Stage - 4" becomes "(Runde 4)"
 * - "Matchday 3" becomes "(MD 3)"
 *
 * @param {string} name - Competition name to clean
 * @returns {string} - Cleaned competition name
 *
 * @example
 * cleanCompetitionName("Europa League League Stage - 4")
 * // Returns: "Europa League (Runde 4)"
 */
export function cleanCompetitionName(name) {
    if (!name) return '';

    let cleanName = name;
    cleanName = cleanName.replace(/League Stage - (\d+)/g, '(Runde $1)');
    cleanName = cleanName.replace(/Matchday (\d+)/g, '(MD $1)');

    return cleanName;
}
