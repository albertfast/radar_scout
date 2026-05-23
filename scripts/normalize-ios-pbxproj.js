#!/usr/bin/env node

const path = require('path');
const { normalizePbxprojFile } = require('./iosProjectCompat');

const rootDir = path.resolve(__dirname, '..');
const pbxprojPath =
  process.argv[2] || path.join(rootDir, 'ios', 'RadarScout.xcodeproj', 'project.pbxproj');

const result = normalizePbxprojFile(pbxprojPath);

if (result.shellScriptChanges > 0) {
  console.log(`[INFO] Normalized ${result.shellScriptChanges} shellScript build phase(s).`);
}
if (result.versionChanges > 0) {
  console.log('[INFO] Downgraded Xcode project object version for CocoaPods compatibility.');
}
if (result.shellScriptChanges === 0 && result.versionChanges === 0) {
  console.log('[OK] Xcode project is already CocoaPods-compatible.');
}
