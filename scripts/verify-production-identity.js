#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXPECTED_APP_ID = 'com.radarscout.app';

const errors = [];

const readIfExists = (relativePath) => {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return fs.readFileSync(absolutePath, 'utf8');
};

const checkIosPlist = (relativePath) => {
  const content = readIfExists(relativePath);
  if (!content) return;

  const bundleIdMatch = content.match(
    /<key>BUNDLE_ID<\/key>\s*<string>([^<]+)<\/string>/
  );
  const bundleId = bundleIdMatch?.[1]?.trim();
  if (bundleId !== EXPECTED_APP_ID) {
    errors.push(`${relativePath}: expected BUNDLE_ID ${EXPECTED_APP_ID}, found ${bundleId || 'missing'}`);
  }
};

const checkAndroidGoogleServices = (relativePath) => {
  const content = readIfExists(relativePath);
  if (!content) return;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON (${error.message})`);
    return;
  }

  const clients = Array.isArray(parsed.client) ? parsed.client : [];
  const packageNames = clients
    .map((client) => client?.client_info?.android_client_info?.package_name)
    .filter(Boolean);

  if (!packageNames.includes(EXPECTED_APP_ID)) {
    errors.push(
      `${relativePath}: expected an Android client for ${EXPECTED_APP_ID}, found ${packageNames.join(', ') || 'none'}`
    );
  }
};

checkIosPlist('GoogleService-Info.plist');
checkIosPlist('ios/RadarScout/GoogleService-Info.plist');
checkAndroidGoogleServices('google-services.json');
checkAndroidGoogleServices('android/app/google-services.json');

if (errors.length > 0) {
  console.error('[ERROR] Production app identity check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  console.error('\nReplace Firebase config files with the Radar Scout app files before production submission.');
  process.exit(1);
}

console.log(`[OK] Firebase config files target ${EXPECTED_APP_ID}.`);
