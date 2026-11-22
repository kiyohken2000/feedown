/**
 * Bell at the right end of the home header (BRUSHUP #27e).
 *
 * - Icon: a bell when new-article notifications would reach the user, a
 *   slashed bell when not (notifications off, background refresh off, or the
 *   OS permission missing).
 * - Tap: turns notifications off, or on (asking to turn on background refresh
 *   and for the OS permission as needed).
 * - Long press: opens the Background Refresh settings.
 *
 * The settings live in AsyncStorage and are shared with the settings screen,
 * so they are re-read whenever Home gets focus or the app comes back.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, AppState, Linking, StyleSheet, TouchableOpacity } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import FontIcon from '@expo/vector-icons/FontAwesome'
import { colors } from '../../theme'
import { showToast } from '../../utils/showToast'
import {
  getNotificationPermission,
  isDelivering,
  loadBgSettings,
  requestNotificationPermission,
  updateBgSettings,
} from '../../utils/backgroundRefresh'

function confirm(title, message, okText) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}

export default function NotificationBell({ color }) {
  const navigation = useNavigation()
  const [delivering, setDelivering] = useState(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const [settings, permission] = await Promise.all([
      loadBgSettings(),
      getNotificationPermission(),
    ])
    setDelivering(isDelivering(settings, permission))
  }, [])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )

  // The OS permission may change in the system settings
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') reload()
    })
    return () => sub.remove()
  }, [reload])

  const turnOn = useCallback(async () => {
    const settings = await loadBgSettings()
    if (!settings.enabled) {
      const ok = await confirm(
        'Turn on Background Refresh?',
        'Notifications need Background Refresh, which checks your feeds while the app is closed.',
        'Turn On'
      )
      if (!ok) return
    }
    const permission = await getNotificationPermission()
    const granted =
      permission === 'granted' ||
      (permission === 'undetermined' && (await requestNotificationPermission()))
    if (!granted) {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for FeedOwn in the system settings to get new article alerts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      )
      return
    }
    await updateBgSettings({ enabled: true, notify: true })
    showToast({ title: 'Notifications on' })
  }, [])

  const handlePress = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (delivering) {
        await updateBgSettings({ notify: false })
        showToast({ title: 'Notifications off' })
      } else {
        await turnOn()
      }
    } finally {
      await reload()
      setBusy(false)
    }
  }, [busy, delivering, turnOn, reload])

  const handleLongPress = useCallback(() => {
    navigation.navigate('ProfileTab', {
      screen: 'BackgroundRefreshSettings',
      initial: false,
    })
  }, [navigation])

  return (
    <TouchableOpacity
      testID="home-notification-bell"
      accessibilityRole="button"
      accessibilityLabel={delivering ? 'Notifications on' : 'Notifications off'}
      accessibilityHint="Long press for notification settings"
      onPress={handlePress}
      onLongPress={handleLongPress}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
      style={styles.button}
    >
      <FontIcon
        name={delivering ? 'bell' : 'bell-slash-o'}
        size={18}
        color={delivering ? colors.primary : color}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // Fixed width so swapping the bell / slashed bell does not shift the header
  button: { width: 22, alignItems: 'center' },
})
