#!/usr/bin/env node

/**
 * Copies freshly generated release APKs from Android build outputs:
 *   android/app/build/outputs/apk/release/
 * to the outer repository release directory:
 *   android/release/
 *
 * This ensures that the GitHub README download links always point
 * to the latest compiled binaries.
 */

const fs = require('fs');
const path = require('path');

// Locate project root whether run from repo root or inside android/ or scripts/
function findProjectRoot(startDir) {
  let curr = startDir;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'package.json')) && fs.existsSync(path.join(curr, 'android'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

const rootDir = findProjectRoot(__dirname);
const sourceDir = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const targetDir = path.join(rootDir, 'android', 'release');

console.log('\n📦 [Radii Release Sync]');
console.log(`Source : ${sourceDir}`);
console.log(`Target : ${targetDir}\n`);

if (!fs.existsSync(sourceDir)) {
  console.error(`❌ Build output directory does not exist:`);
  console.error(`   ${sourceDir}`);
  console.error(`\nPlease run "cd android && ./gradlew assembleRelease" or "pnpm run build:apk" first.`);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

const files = fs.readdirSync(sourceDir);
// Skip the universal 100MB+ radii.apk to comply with GitHub's 100MB file size limit.
// We keep the architecture-specific splits (arm64-v8a at ~46MB and armeabi-v7a at ~39MB).
const apkFiles = files.filter((f) => f.endsWith('.apk') && f !== 'radii.apk');

if (apkFiles.length === 0) {
  console.error(`❌ No .apk files found in ${sourceDir}`);
  process.exit(1);
}

let copiedCount = 0;

for (const file of apkFiles) {
  const srcPath = path.join(sourceDir, file);
  const destPath = path.join(targetDir, file);

  fs.copyFileSync(srcPath, destPath);
  const stat = fs.statSync(destPath);
  console.log(` ✅ Copied ${file.padEnd(24)} -> android/release/${file} (${formatBytes(stat.size)})`);
  copiedCount++;

  // If this is the arm64-v8a build, also update radii-release.apk
  // (the primary download link referenced in README.md)
  if (file === 'radii-arm64-v8a.apk') {
    const mainReleasePath = path.join(targetDir, 'radii-release.apk');
    fs.copyFileSync(srcPath, mainReleasePath);
    console.log(` ⭐ Updated radii-release.apk    -> android/release/radii-release.apk (${formatBytes(stat.size)}) [Main README link]`);
    copiedCount++;
  }
}

console.log(`\n🎉 Successfully synced ${copiedCount} APK artifacts to android/release/\n`);
