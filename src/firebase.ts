import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const supplied = Object.values(config).filter(Boolean).length;
export const configurationError =
  supplied > 0 && supplied < 4
    ? 'Firebase configuration is incomplete. Check the four values in .env.local and restart the app.'
    : null;
export const firebase =
  supplied === 4
    ? (() => {
        const app = initializeApp(config);
        const auth = getAuth(app);
        // Keep schedule data in memory so signing out does not leave a disk cache.
        const db = initializeFirestore(app, { localCache: memoryLocalCache() });
        if (env.VITE_USE_FIREBASE_EMULATORS === 'true') {
          if (!env.DEV || config.projectId !== 'demo-timeblocker') {
            throw new Error(
              'Emulators are only allowed in development with the demo-timeblocker project.',
            );
          }
          const host = env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
          connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
          connectFirestoreEmulator(db, host, 8080);
        }
        return { auth, db };
      })()
    : null;
