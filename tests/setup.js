/**
 * Vitest Setup File
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock Firebase globally
global.firebase = {
    auth: vi.fn(() => ({
        currentUser: { uid: 'test-user-123', email: 'test@example.com' },
        onAuthStateChanged: vi.fn()
    })),
    firestore: vi.fn(() => ({
        collection: vi.fn()
    }))
};

// Mock console methods to reduce test output noise
global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};
