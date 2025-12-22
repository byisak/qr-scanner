const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withColorPickerIOS(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // Add the pod if not already present
      if (!podfileContent.includes('react-native-color-picker-ios')) {
        // Find the target block and add the pod
        podfileContent = podfileContent.replace(
          /use_expo_modules!/,
          `use_expo_modules!\n  pod 'react-native-color-picker-ios', :path => '../node_modules/react-native-color-picker-ios'`
        );
        fs.writeFileSync(podfilePath, podfileContent);
      }

      return config;
    },
  ]);
}

module.exports = withColorPickerIOS;
