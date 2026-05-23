const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const { normalizePbxprojFile } = require('../scripts/iosProjectCompat');

/**
 * Keeps Xcode 26 generated project files readable by the CocoaPods xcodeproj gem.
 */
module.exports = function withXcodeProjectCompat(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const pbxprojPath = path.join(
        config.modRequest.platformProjectRoot,
        'RadarScout.xcodeproj',
        'project.pbxproj'
      );
      normalizePbxprojFile(pbxprojPath);
      return config;
    },
  ]);
};
