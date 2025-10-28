/**
 * Date Utilities
 * Funksjoner for dato-formatering og håndtering
 */

/**
 * Formater et dato-intervall på norsk
 * @param {Date} startDate - Startdato
 * @param {Date} endDate - Sluttdato
 * @returns {string} Formatert dato-intervall (f.eks. "5. nov", "5-6. nov", "30. okt - 2. nov")
 */
export function formatDateRange(startDate, endDate) {
    const options = { day: 'numeric', month: 'short' };
    const start = startDate.toLocaleDateString('no-NO', options);
    const end = endDate.toLocaleDateString('no-NO', options);

    // Same day
    if (startDate.toDateString() === endDate.toDateString()) {
        return start;
    }

    // Same month
    if (startDate.getMonth() === endDate.getMonth()) {
        const dayOptions = { day: 'numeric' };
        const startDay = startDate.toLocaleDateString('no-NO', dayOptions);
        return `${startDay}-${end}`;
    }

    // Different months
    return `${start} - ${end}`;
}

/**
 * Hent en lesbar dato-label på norsk
 * @param {Date} date - Datoen
 * @returns {string} Label (f.eks. "I dag", "I morgen", "Fredag 1. nov")
 */
export function getDateLabel(date) {
    if (!date) {
        return 'Alle dager';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    // Check if it's today, tomorrow, or yesterday
    if (compareDate.getTime() === today.getTime()) {
        return 'I dag';
    } else if (compareDate.getTime() === tomorrow.getTime()) {
        return 'I morgen';
    } else if (compareDate.getTime() === yesterday.getTime()) {
        return 'I går';
    } else {
        // Format: "Fredag 1. nov"
        const options = { weekday: 'long', day: 'numeric', month: 'short' };
        const formatted = compareDate.toLocaleDateString('no-NO', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
}

/**
 * Formater en dato som YYYY-MM-DD (ISO format uten tid)
 * @param {Date} date - Datoen
 * @returns {string} ISO date string (f.eks. "2025-10-27")
 */
export function toISODate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Sett dato til start av dag (00:00:00.000)
 * @param {Date} date - Datoen
 * @returns {Date} Dato satt til start av dag
 */
export function getStartOfDay(date) {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
}

/**
 * Sett dato til slutt av dag (23:59:59.999)
 * @param {Date} date - Datoen
 * @returns {Date} Dato satt til slutt av dag
 */
export function getEndOfDay(date) {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
}

/**
 * Sjekk om to datoer er samme dag
 * @param {Date} date1 - Første dato
 * @param {Date} date2 - Andre dato
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
}

/**
 * Legg til dager til en dato
 * @param {Date} date - Startdato
 * @param {number} days - Antall dager å legge til (kan være negativt)
 * @returns {Date} Ny dato
 */
export function addDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

/**
 * Hent antall dager mellom to datoer
 * @param {Date} startDate - Startdato
 * @param {Date} endDate - Sluttdato
 * @returns {number} Antall dager
 */
export function daysBetween(startDate, endDate) {
    const start = getStartOfDay(startDate);
    const end = getStartOfDay(endDate);
    const diffMs = end - start;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Grupper kamper etter dato
 * @param {Array} matches - Array av kamper
 * @returns {Object} Object med dato-label som key og array av kamper som value
 */
export function groupMatchesByDate(matches) {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    matches.forEach(match => {
        let matchDate;

        // Try to use commence_time first, fallback to timestamp
        if (match.commence_time) {
            matchDate = new Date(match.commence_time);
        } else if (match.timestamp) {
            // timestamp is in seconds, convert to milliseconds
            matchDate = new Date(match.timestamp * 1000);
        } else {
            console.warn('Match missing both commence_time and timestamp:', match);
            return;
        }

        // Check if date is valid
        if (isNaN(matchDate.getTime())) {
            console.warn('Invalid date for match:', match);
            return;
        }

        matchDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((matchDate - today) / (1000 * 60 * 60 * 24));

        let dateLabel;
        if (daysDiff === 0) {
            dateLabel = 'I dag';
        } else if (daysDiff === 1) {
            dateLabel = 'I morgen';
        } else {
            // Format: "Fredag, 17. oktober"
            const weekday = matchDate.toLocaleDateString('nb-NO', { weekday: 'long' });
            const day = matchDate.getDate();
            const month = matchDate.toLocaleDateString('nb-NO', { month: 'long' });
            dateLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}. ${month}`;
        }

        if (!groups[dateLabel]) {
            groups[dateLabel] = [];
        }
        groups[dateLabel].push(match);
    });

    return groups;
}

/**
 * Sjekk om en dato er i et gitt intervall
 * @param {Date} date - Datoen som skal sjekkes
 * @param {Date} startDate - Start av intervallet
 * @param {Date} endDate - Slutt av intervallet
 * @returns {boolean}
 */
export function isDateInRange(date, startDate, endDate) {
    const checkDate = getStartOfDay(date);
    const start = getStartOfDay(startDate);
    const end = getStartOfDay(endDate);
    return checkDate >= start && checkDate <= end;
}
