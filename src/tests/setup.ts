import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// No Java/Firestore emulator is available in this environment, so every
// test runs against an in-memory fake of the handful of Firebase functions
// this app uses (see src/tests/mocks/).
vi.mock('firebase/app', () => import('./mocks/fakeApp'));
vi.mock('firebase/auth', () => import('./mocks/fakeAuth'));
vi.mock('firebase/firestore', () => import('./mocks/fakeFirestore'));
