/**
 * Error Handler
 * Centralized error handling with consistent logging and user feedback
 */

import { ERROR_MESSAGES, TIMEOUTS } from '../constants/appConstants.js';

/**
 * Error types
 */
export const ErrorType = {
    NETWORK: 'NETWORK',
    AUTH: 'AUTH',
    FIRESTORE: 'FIRESTORE',
    VALIDATION: 'VALIDATION',
    API: 'API',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Custom application error
 */
export class AppError extends Error {
    constructor(message, type = ErrorType.UNKNOWN, originalError = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.originalError = originalError;
        this.timestamp = new Date();
    }
}

/**
 * Error Handler class
 */
export class ErrorHandler {
    /**
     * Handle an error with logging and optional user notification
     * @param {Error|AppError} error - The error to handle
     * @param {Object} options - Options for error handling
     * @param {boolean} options.showUser - Show alert to user (default: false)
     * @param {string} options.userMessage - Custom message for user
     * @param {string} options.context - Context where error occurred
     * @param {boolean} options.logToConsole - Log to console (default: true)
     * @returns {AppError} Processed error
     */
    static handle(error, options = {}) {
        const {
            showUser = false,
            userMessage = null,
            context = 'Unknown',
            logToConsole = true
        } = options;

        // Convert to AppError if not already
        const appError = error instanceof AppError
            ? error
            : this.categorizeError(error);

        // Log to console
        if (logToConsole) {
            console.error(`[${context}] ${appError.type}:`, appError.message);
            if (appError.originalError) {
                console.error('Original error:', appError.originalError);
            }
        }

        // Show to user if requested
        if (showUser) {
            const message = userMessage || this.getUserFriendlyMessage(appError);
            this.displayErrorToUser(message);
        }

        return appError;
    }

    /**
     * Categorize an error based on its properties
     * @param {Error} error - Error to categorize
     * @returns {AppError}
     */
    static categorizeError(error) {
        // Network errors
        if (error.message.includes('fetch') ||
            error.message.includes('network') ||
            error instanceof TypeError && error.message.includes('Failed to fetch')) {
            return new AppError(
                'Nettverksfeil. Sjekk internettforbindelsen din.',
                ErrorType.NETWORK,
                error
            );
        }

        // Firebase Auth errors
        if (error.code && error.code.startsWith('auth/')) {
            return new AppError(
                this.getFirebaseAuthMessage(error.code),
                ErrorType.AUTH,
                error
            );
        }

        // Firestore errors
        if (error.code && (error.code.startsWith('firestore/') ||
                          error.code === 'permission-denied' ||
                          error.message.includes('Firestore'))) {
            return new AppError(
                'Database-feil. Prøv igjen senere.',
                ErrorType.FIRESTORE,
                error
            );
        }

        // API errors
        if (error.message.includes('API') || error.message.includes('429')) {
            return new AppError(
                'API-feil. Prøv igjen senere.',
                ErrorType.API,
                error
            );
        }

        // Generic error
        return new AppError(
            error.message || 'En ukjent feil oppstod',
            ErrorType.UNKNOWN,
            error
        );
    }

    /**
     * Get user-friendly message for an error
     * @param {AppError} error
     * @returns {string}
     */
    static getUserFriendlyMessage(error) {
        switch (error.type) {
            case ErrorType.NETWORK:
                return 'Nettverksfeil. Sjekk internettforbindelsen din og prøv igjen.';
            case ErrorType.AUTH:
                return error.message; // Auth errors already have user-friendly messages
            case ErrorType.FIRESTORE:
                return 'Kunne ikke hente data fra databasen. Prøv igjen senere.';
            case ErrorType.VALIDATION:
                return error.message; // Validation errors are already user-friendly
            case ErrorType.API:
                return 'Kunne ikke hente data fra API. Prøv igjen senere.';
            default:
                return 'En feil oppstod. Prøv igjen eller kontakt support hvis problemet vedvarer.';
        }
    }

    /**
     * Get user-friendly message for Firebase Auth errors
     * @param {string} code - Firebase error code
     * @returns {string}
     */
    static getFirebaseAuthMessage(code) {
        const messages = {
            'auth/invalid-email': 'Ugyldig e-postadresse',
            'auth/user-disabled': 'Denne brukerkontoen er deaktivert',
            'auth/user-not-found': 'Ingen bruker funnet med denne e-postadressen',
            'auth/wrong-password': 'Feil passord',
            'auth/email-already-in-use': 'E-postadressen er allerede i bruk',
            'auth/weak-password': 'Passordet er for svakt. Bruk minst 6 tegn.',
            'auth/network-request-failed': 'Nettverksfeil. Sjekk internettforbindelsen.',
            'auth/too-many-requests': 'For mange mislykkede forsøk. Prøv igjen senere.'
        };

        return messages[code] || 'Autentiseringsfeil. Prøv igjen.';
    }

    /**
     * Log info message
     * @param {string} message
     * @param {string} context
     */
    static info(message, context = '') {
        console.log(`ℹ️ ${context ? `[${context}]` : ''} ${message}`);
    }

    /**
     * Log warning message
     * @param {string} message
     * @param {string} context
     */
    static warn(message, context = '') {
        console.warn(`⚠️ ${context ? `[${context}]` : ''} ${message}`);
    }

    /**
     * Log success message
     * @param {string} message
     * @param {string} context
     */
    static success(message, context = '') {
        console.log(`✅ ${context ? `[${context}]` : ''} ${message}`);
    }

    /**
     * Display error message to user in DOM
     * @param {string} message - Message to display
     */
    static displayErrorToUser(message) {
        // Try to find error message element
        const errorElement = document.getElementById('errorMessage') ||
                            document.querySelector('.error-message');

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';

            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (errorElement.textContent === message) {
                    errorElement.style.display = 'none';
                }
            }, 10000);
        } else {
            // Fallback to alert if no error element found
            alert(message);
        }
    }
}

/**
 * Async error wrapper
 * Wraps an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, options = {}) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            ErrorHandler.handle(error, options);
            throw error; // Re-throw for caller to handle if needed
        }
    };
}

/**
 * Sjekk om bruker er online
 * @returns {boolean}
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Vent på at bruker er online
 * @param {number} timeout - Max tid å vente (ms)
 * @returns {Promise<boolean>} True hvis online, false hvis timeout
 */
export function waitForOnline(timeout = 30000) {
    return new Promise((resolve) => {
        if (navigator.onLine) {
            resolve(true);
            return;
        }

        const timeoutId = setTimeout(() => {
            window.removeEventListener('online', onlineHandler);
            resolve(false);
        }, timeout);

        const onlineHandler = () => {
            clearTimeout(timeoutId);
            window.removeEventListener('online', onlineHandler);
            resolve(true);
        };

        window.addEventListener('online', onlineHandler);
    });
}

/**
 * Retry en operasjon ved feil
 * @param {Function} fn - Funksjon å prøve på nytt
 * @param {number} maxRetries - Max antall forsøk
 * @param {number} delay - Delay mellom forsøk (ms)
 * @returns {Promise} Resultat fra funksjonen
 */
export async function retryOperation(fn, maxRetries = 3, delay = TIMEOUTS.API_RETRY_DELAY || 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            ErrorHandler.warn(`Attempt ${i + 1}/${maxRetries} failed: ${error.message}`, 'retryOperation');

            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
