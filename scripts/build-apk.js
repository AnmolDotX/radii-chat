#!/usr/bin/env node

/**
 * Builds the Android release APK locally using your Mac's fast hardware
 * and copies the output binaries into android/release/.
 *
 * Usage:
 *   pnpm run build:apk              (uses package.json version)
 *   pnpm run build:apk 1.0.1        (builds with version 1.0.1)
 *   pnpm run build:apk 1.0.1 2      (builds with version 1.0.1, code 2)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const args = process.argv.slice(2);
const versionName = args[0] || pkg.version || '1.0.0';
const versionCode = args[1] || Math.floor(Date.now() / 1000); // Unique timestamp code or specified

console.log('\n🚀 [Radii Fast Local Build]');
console.log(`Version Name : ${versionName}`);
console.log(`Version Code : ${versionCode}\n`);

try {
  const androidDir = path.join(rootDir, 'android');
  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

  execSync(`${gradlewCmd} assembleRelease -PversionName="${versionName}" -PversionCode="${versionCode}"`, {
    cwd: androidDir,
    stdio: 'inherit',
  });

  // Run the copy script to sync to android/release/
  execSync(`node "${path.join(__dirname, 'copy-release-apk.js')}"`, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  console.log(`\n✨ Done! Release APKs generated with version ${versionName} (code ${versionCode}).\n`);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
