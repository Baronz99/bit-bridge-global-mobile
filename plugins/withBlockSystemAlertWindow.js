const { withAndroidManifest } = require('@expo/config-plugins')

const SYSTEM_ALERT_WINDOW = 'android.permission.SYSTEM_ALERT_WINDOW'

module.exports = function withBlockSystemAlertWindow(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults?.manifest
    const usesPermission = manifest?.['uses-permission'] || []

    manifest['uses-permission'] = usesPermission.filter(
      (entry) => entry?.$?.['android:name'] !== SYSTEM_ALERT_WINDOW
    )

    return config
  })
}
