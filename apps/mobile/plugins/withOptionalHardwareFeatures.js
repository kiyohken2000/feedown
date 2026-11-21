// Mark hardware features that Play infers from the manifest as optional.
// - android.hardware.screen.portrait: implied by screenOrientation="portrait"
// - android.hardware.wifi: implied by ACCESS_WIFI_STATE (pulled in by a library)
// Without this, Play blocks installs on devices lacking them (XR, desktop, etc.).
const { withAndroidManifest } = require('expo/config-plugins')

const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.wifi']

module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    const features = manifest['uses-feature'] || []
    OPTIONAL_FEATURES.forEach((name) => {
      const existing = features.find((f) => f.$['android:name'] === name)
      if (existing) {
        existing.$['android:required'] = 'false'
      } else {
        features.push({ $: { 'android:name': name, 'android:required': 'false' } })
      }
    })
    manifest['uses-feature'] = features
    return cfg
  })
}
