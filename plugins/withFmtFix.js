const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Fixes clang consteval errors when building the 'fmt' pod by forcing c++17
 * and disabling fmt's consteval path in the generated CocoaPods settings.
 */
module.exports = function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(file, 'utf8');

      const fmtHelper = `
# @generated begin RadarScout fmt workaround - expo prebuild (DO NOT MODIFY)
def radar_scout_add_build_setting_token(settings, key, token)
  current = settings[key]
  if current.nil?
    settings[key] = ['$(inherited)', token]
  elsif current.is_a?(Array)
    settings[key] = current.include?(token) ? current : current + [token]
  else
    settings[key] = current.to_s.include?(token) ? current : "#{current} #{token}"
  end
end

def radar_scout_patch_xcconfig_setting(path, key, value)
  return unless File.exist?(path)

  content = File.read(path)
  escaped_key = Regexp.escape(key)
  patched =
    if content.match?(/^#{escaped_key}\\s*=/)
      content.gsub(/^#{escaped_key}\\s*=.*$/, "#{key} = #{value}")
    else
      content.end_with?("\\n") ? "#{content}#{key} = #{value}\\n" : "#{content}\\n#{key} = #{value}\\n"
    end
  File.write(path, patched) if patched != content
end

def radar_scout_apply_fmt_workaround(installer)
  # Patch fmt/base.h directly to disable consteval which breaks Apple Clang 16
  fmt_base_h = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base_h)
    require 'fileutils'
    FileUtils.chmod('+w', fmt_base_h)
    content = File.read(fmt_base_h)
    content = content.gsub(/#\\s*define FMT_CONSTEVAL consteval/, '# define FMT_CONSTEVAL')
    File.write(fmt_base_h, content)
  end

  fmt_target = installer.pods_project.targets.find { |target| target.name == 'fmt' }
  if fmt_target
    fmt_target.build_configurations.each do |build_config|
      build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      radar_scout_add_build_setting_token(build_config.build_settings, 'OTHER_CPLUSPLUSFLAGS', '-DFMT_USE_CONSTEVAL=0')
      radar_scout_add_build_setting_token(build_config.build_settings, 'GCC_PREPROCESSOR_DEFINITIONS', 'FMT_USE_CONSTEVAL=0')
    end
  end

  fmt_xcconfigs = [
    File.join(__dir__, 'Pods', 'Target Support Files', 'fmt', 'fmt.debug.xcconfig'),
    File.join(__dir__, 'Pods', 'Target Support Files', 'fmt', 'fmt.release.xcconfig'),
  ]
  fmt_xcconfigs.each do |xcconfig_path|
    radar_scout_patch_xcconfig_setting(xcconfig_path, 'CLANG_CXX_LANGUAGE_STANDARD', 'c++17')
    radar_scout_patch_xcconfig_setting(xcconfig_path, 'OTHER_CPLUSPLUSFLAGS', '$(inherited) -DFMT_USE_CONSTEVAL=0')
    radar_scout_patch_xcconfig_setting(xcconfig_path, 'GCC_PREPROCESSOR_DEFINITIONS', '$(inherited) COCOAPODS=1 FMT_USE_CONSTEVAL=0')
  end
end
# @generated end RadarScout fmt workaround
`;

      const helperPattern =
        /# @generated begin RadarScout fmt workaround[\s\S]*?# @generated end RadarScout fmt workaround\n?/;
      if (helperPattern.test(contents)) {
        contents = contents.replace(helperPattern, `${fmtHelper}\n`);
      } else {
        contents = contents.replace(
          /prepare_react_native_project!\n/,
          `prepare_react_native_project!\n${fmtHelper}\n`
        );
      }

      const callString = '    radar_scout_apply_fmt_workaround(installer)';
      if (!contents.includes(callString)) {
        const postInstallCallPattern =
          /(react_native_post_install\(\s*installer,\s*config\[:reactNativePath\],[\s\S]*?\n\s+\)\n)/;
        if (postInstallCallPattern.test(contents)) {
          contents = contents.replace(
            postInstallCallPattern,
            `$1${callString}\n`
          );
        } else {
          contents = contents.replace(
            /post_install do \|installer\|\n/,
            `post_install do |installer|\n${callString}\n`
          );
        }
      }

      fs.writeFileSync(file, contents);
      return config;
    },
  ]);
};
