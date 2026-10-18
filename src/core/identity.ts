import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { UserProfile } from './types';

// Safe dynamic access to AsyncStorage that does not crash if native binary lacks the module
let AsyncStorageModule: any = null;
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorageModule = null;
}

const STORAGE_KEY = '@radii_user_profile_v2';

const detectedModel =
  Device.modelName ||
  Device.deviceName ||
  (Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Phone');

export function generateUniquePeerId(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = (Date.now() % 100000).toString(36);
  return `usr_${rand}${time}`;
}

// IMPORTANT: Do NOT call generateUniquePeerId() at module load!
// Use a stable sentinel that loadPersistedProfile() will replace.
// This prevents the race where native module gets ID_A and JS checks ID_B.
const UNINITIALIZED_ID = '__radii_uninitialized__';

const DEFAULT_USER: UserProfile = {
  id: UNINITIALIZED_ID,
  displayName: detectedModel,
  publicKey: 'radii_pubkey_ed25519_9d428bf1e320aa',
  deviceModel: detectedModel,
  deviceName: detectedModel,
  visibility: 'everyone',
  isInitialSetupDone: false,
  joinedAt: Date.now(),
};

let currentProfile: UserProfile = { ...DEFAULT_USER };
let _profileReady = false;

export function getLocalProfile(): UserProfile {
  return currentProfile;
}

/** Returns true once loadPersistedProfile() has completed at least once */
export function isProfileReady(): boolean {
  return _profileReady;
}

export async function loadPersistedProfile(): Promise<UserProfile> {
  try {
    if (AsyncStorageModule && typeof AsyncStorageModule.getItem === 'function') {
      const raw = await AsyncStorageModule.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserProfile;
        // Migrate legacy hardcoded ID or uninitialized sentinel
        const validId =
          !parsed.id || parsed.id === 'usr_local_me_01' || parsed.id === UNINITIALIZED_ID
            ? generateUniquePeerId()
            : parsed.id;

        currentProfile = {
          ...currentProfile,
          ...parsed,
          id: validId,
          displayName: parsed.displayName || detectedModel,
          deviceModel: detectedModel,
          deviceName: parsed.deviceName || detectedModel,
        };

        // Save migrated profile
        if (validId !== parsed.id) {
          AsyncStorageModule.setItem(STORAGE_KEY, JSON.stringify(currentProfile)).catch(() => {});
        }

        _profileReady = true;
        return currentProfile;
      }
    }
  } catch (err) {
    // If native module is null or unlinked, continue with in-memory profile
  }

  // No persisted profile found — generate a fresh stable ID now and persist it
  if (currentProfile.id === UNINITIALIZED_ID) {
    currentProfile.id = generateUniquePeerId();
    try {
      if (AsyncStorageModule && typeof AsyncStorageModule.setItem === 'function') {
        await AsyncStorageModule.setItem(STORAGE_KEY, JSON.stringify(currentProfile));
      }
    } catch {
      // Graceful fallback
    }
  }

  _profileReady = true;
  return currentProfile;
}

export function updateProfile(updates: Partial<UserProfile>): UserProfile {
  currentProfile = {
    ...currentProfile,
    ...updates,
  };

  try {
    if (AsyncStorageModule && typeof AsyncStorageModule.setItem === 'function') {
      AsyncStorageModule.setItem(STORAGE_KEY, JSON.stringify(currentProfile)).catch(() => {});
    }
  } catch {
    // Graceful fallback
  }

  return currentProfile;
}

export function updateDisplayName(name: string): UserProfile {
  return updateProfile({ displayName: name.trim() });
}
