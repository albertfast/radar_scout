const { withPodfile } = require('expo/config-plugins');

module.exports = function withLottieNewArchDisable(config) {
  return withPodfile(config, async (config) => {
    let contents = config.modResults.contents;

    // Disable new architecture for lottie-react-native by setting the flag
    // This prevents codegen from trying to generate files for lottie
    const providerPatchCall =
      "system('node', File.join(__dir__, '..', 'scripts', 'patch-ios-third-party-components-provider.js'))";
    const reactCodegenProviderPatch = `    react_codegen_target = installer.pods_project.targets.find { |target| target.name == 'ReactCodegen' }
    if react_codegen_target
      phase_name = '[RadarScout] Patch Fabric component provider'
      phase = react_codegen_target.shell_script_build_phases.find { |build_phase| build_phase.name == phase_name }
      phase ||= react_codegen_target.new_shell_script_build_phase(phase_name)
      phase.shell_script = 'set -e; if [[ -f "$PODS_ROOT/../.xcode.env" ]]; then source "$PODS_ROOT/../.xcode.env"; fi; if [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then source "$PODS_ROOT/../.xcode.env.local"; fi; export NODE_BINARY=\${NODE_BINARY:-node}; SCRIPT="\${PODS_ROOT}/../../scripts/patch-ios-third-party-components-provider.js"; if [ -f "$SCRIPT" ]; then "$NODE_BINARY" "$SCRIPT"; fi'
      phase.always_out_of_date = '1' if phase.respond_to?(:always_out_of_date=)

      react_codegen_target.build_phases.delete(phase)
      source_phase_index = react_codegen_target.build_phases.index(react_codegen_target.source_build_phase) || react_codegen_target.build_phases.length
      react_codegen_target.build_phases.insert(source_phase_index, phase)
    end`;

    // Check if we already have this patch
    if (!contents.includes('Disable new architecture for lottie-react-native')) {
      // Find the post_install block and add our patch before the end
      const postInstallMatch = contents.match(/post_install do \|installer\|[\s\S]*?^  end$/m);
      
      if (postInstallMatch) {
        // Insert our code before the final 'end' of post_install
        const postInstallBlock = postInstallMatch[0];
        const modifiedBlock = postInstallBlock.replace(
          /^  end$/m,
          `    # Disable new architecture for lottie-react-native due to incomplete codegen support
    installer.pods_project.targets.each do |target|
      if target.name == 'lottie-react-native'
        target.build_configurations.each do |config|
          config.build_settings['RCT_NEW_ARCH_ENABLED'] = 'NO'
        end
      end
    end

  end`
        );
        contents = contents.replace(postInstallBlock, modifiedBlock);
      }
    }

    if (!contents.includes('[RadarScout] Patch Fabric component provider')) {
      const postInstallMatch = contents.match(/post_install do \|installer\|[\s\S]*?^  end$/m);
      if (postInstallMatch) {
        const postInstallBlock = postInstallMatch[0];
        const directPatchCall = contents.includes('patch-ios-third-party-components-provider.js')
          ? ''
          : `\n\n    ${providerPatchCall}`;
        const modifiedBlock = postInstallBlock.replace(
          /^  end$/m,
          `${reactCodegenProviderPatch}${directPatchCall}

  end`
        );
        contents = contents.replace(postInstallBlock, modifiedBlock);
      }
    }

    config.modResults.contents = contents;
    return config;
  });
};
