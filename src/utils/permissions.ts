import { Platform, PermissionsAndroid, Permission } from 'react-native';

export interface PermissionRequestResult {
  granted: boolean;
  statuses: Record<string, string>;
}

/**
 * Robust Android runtime permission requester for Radii.
 * Handles API 31+ (Bluetooth Scan, Connect, Advertise),
 * API 33+ (Nearby Wi-Fi Devices), and Fine/Coarse Location.
 */
export async function requestRadioAndNearbyPermissions(): Promise<PermissionRequestResult> {
  if (Platform.OS !== 'android') {
    return { granted: true, statuses: {} };
  }

  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10) || 30;

  const permsToRequest: Permission[] = [];

  // Bluetooth runtime permissions for Android 12+ (API 31+)
  if (apiLevel >= 31) {
    if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
      permsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    }
    if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
      permsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    }
    if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
      permsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
    }
  }

  // Nearby Wi-Fi Devices for Android 13+ (API 33+)
  if (apiLevel >= 33) {
    const nearbyWifi =
      PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES ||
      ('android.permission.NEARBY_WIFI_DEVICES' as Permission);
    permsToRequest.push(nearbyWifi);
  }

  // Fine & Coarse location (required for BLE beacon scanning and Online proximity mode)
  permsToRequest.push(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );

  try {
    const statuses = await PermissionsAndroid.requestMultiple(permsToRequest);
    const anyGranted = Object.values(statuses).some(
      (status) => status === PermissionsAndroid.RESULTS.GRANTED
    );

    // Prompt user to enable physical Bluetooth radio if currently turned off
    try {
      const { NativeModules } = require('react-native');
      if (NativeModules.RadiiNativeRadio?.enableHardwareRadios) {
        await NativeModules.RadiiNativeRadio.enableHardwareRadios();
      }
    } catch {}

    return { granted: anyGranted, statuses };
  } catch (err) {
    console.warn('[Permissions] Failed to request permissions:', err);
    return { granted: false, statuses: {} };
  }
}

/**
 * Check whether radio/nearby permissions have already been granted.
 */
export async function checkRadioPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10) || 30;

    if (apiLevel >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
      const hasBtScan = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
      if (!hasBtScan) return false;
    }

    const hasFineLoc = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return hasFineLoc;
  } catch {
    return false;
  }
}
