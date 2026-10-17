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

const STORAGE_KEY = '@orbitor_user_profile_v1';

const detectedModel =
  Device.modelName ||
  Device.deviceName ||
  (Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Phone');

const DEFAULT_USER: UserProfile = {
  id: 'usr_local_me_01',
  displayName: '',
  publicKey: 'orb_pubkey_ed25519_9d428bf1e320aa',
  deviceModel: detectedModel,
  deviceName: detectedModel,
  visibility: 'everyone',
  isInitialSetupDone: false,
  joinedAt: Date.now(),
};

let currentProfile: UserProfile = { ...DEFAULT_USER };

export function getLocalProfile(): UserProfile {
  return currentProfile;
}

export async function loadPersistedProfile(): Promise<UserProfile> {
  try {
    if (AsyncStorageModule && typeof AsyncStorageModule.getItem === 'function') {
      const raw = await AsyncStorageModule.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserProfile;
        currentProfile = {
          ...currentProfile,
          ...parsed,
          deviceModel: detectedModel,
          deviceName: parsed.deviceName || detectedModel,
        };
        return currentProfile;
      }
    }
  } catch (err) {
    // If native module is null or unlinked in current APK build, gracefully continue with in-memory profile
  }
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
