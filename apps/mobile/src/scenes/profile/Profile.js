import React, { useContext, useState, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Image,
  Linking,
} from 'react-native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { UserContext } from '../../contexts/UserContext'
import { FeedsContext } from '../../contexts/FeedsContext'
import { useTheme } from '../../contexts/ThemeContext'
import { createApiClient } from '../../utils/api'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import Spinner from 'react-native-loading-spinner-overlay'

// Check if email is a test account (test-{number}@test.com)
const isTestAccount = (email) => {
  if (!email) return false
  return /^test-\d+@test\.com$/i.test(email)
}

export default function Profile() {
  const { user, signOut, getAccessToken } = useContext(UserContext)
  const { feeds, articles, getUnreadCount, resetAll } = useContext(FeedsContext)
  const { isDarkMode, toggleDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const [isLoading, setIsLoading] = useState(false)
  const isTestUser = isTestAccount(user?.email)

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              setIsLoading(true)
              await signOut()
              showToast({ title: 'Signed Out', body: 'See you next time!' })
            } catch (err) {
              showErrorToast({ title: 'Error', body: err.message })
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }, [signOut])

  // Handle delete account
  const handleDeleteAccount = useCallback(async () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true)
              const api = createApiClient(getAccessToken)
              const response = await api.user.deleteAccount()

              if (response.success) {
                await signOut()
                showToast({ title: 'Account Deleted', body: 'Your account has been deleted' })
              } else {
                showErrorToast({ title: 'Error', body: response.error || 'Failed to delete account' })
              }
            } catch (err) {
              showErrorToast({ title: 'Error', body: err.message })
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }, [getAccessToken, signOut])

  // Handle clear all data
  const handleClearData = useCallback(async () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your feeds, articles, and favorites. Your account will remain active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true)
              const api = createApiClient(getAccessToken)
              const response = await api.user.clearAllData()

              if (response.success) {
                // Reset local state
                resetAll()
                showToast({ title: 'Data Cleared', body: 'All your data has been deleted' })
              } else {
                showErrorToast({ title: 'Error', body: response.error || 'Failed to clear data' })
              }
            } catch (err) {
              showErrorToast({ title: 'Error', body: err.message })
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }, [getAccessToken, resetAll])

  const unreadCount = getUnreadCount()

  return (
    <ScreenTemplate>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* User Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Email</Text>
            <Text style={[styles.value, { color: theme.text }]}>{user?.email || 'Not signed in'}</Text>
            <Text style={[styles.passwordHint, { color: theme.textMuted }]}>
              If you didn't set a custom password, the default password is 111111
            </Text>
            {isTestUser && (
              <View style={[styles.testAccountNotice, { backgroundColor: isDarkMode ? '#3a3a2a' : '#fff3cd', borderColor: isDarkMode ? '#666633' : '#ffc107' }]}>
                <Text style={[styles.testAccountNoticeText, { color: isDarkMode ? '#e0e0a0' : '#856404' }]}>
                  This is a test account with limited features: max 3 feeds and 10 favorites.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.toggleRow}>
              <View>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Dark Mode</Text>
                <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>
                  Use dark theme for the app
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor={isDarkMode ? colors.white : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Statistics</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Text style={styles.statValue}>{feeds.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Feeds</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Text style={styles.statValue}>{articles.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Articles</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Text style={styles.statValue}>{unreadCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Unread</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Actions</Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.card }]}
            onPress={handleSignOut}
          >
            <Text style={styles.actionButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonWarning, { backgroundColor: theme.card }]}
            onPress={handleClearData}
          >
            <Text style={styles.actionButtonTextWarning}>Clear All Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger, { backgroundColor: theme.card }]}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.actionButtonTextDanger}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>About</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Image
              source={require('../../../assets/images/logo-lg.png')}
              style={styles.appIcon}
            />
            <Text style={styles.appName}>FeedOwn</Text>
            <Text style={[styles.appVersion, { color: theme.textMuted }]}>Version 1.0.0</Text>
            <Text style={[styles.appDescription, { color: theme.textSecondary }]}>
              Your personal RSS feed reader
            </Text>
            <TouchableOpacity
              style={styles.websiteLink}
              onPress={() => Linking.openURL('https://feedown.pages.dev')}
            >
              <Text style={styles.websiteLinkText}>https://feedown.pages.dev</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Spinner
        visible={isLoading}
        overlayColor={colors.loadingSpinnerColor}
      />
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  headerTitle: {
    fontSize: fontSize.xxLarge,
    fontWeight: 'bold',
    color: colors.primary,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: fontSize.small,
    color: colors.gray,
    marginBottom: 4,
  },
  value: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.black,
  },
  passwordHint: {
    fontSize: fontSize.small,
    color: colors.gray,
    marginTop: 12,
    fontStyle: 'italic',
  },
  testAccountNotice: {
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  testAccountNoticeText: {
    fontSize: fontSize.small,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: fontSize.xxLarge,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.small,
    color: colors.gray,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtonWarning: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.yellowSecondary,
  },
  actionButtonTextWarning: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.yellowSecondary,
  },
  actionButtonDanger: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.redSecondary,
  },
  actionButtonTextDanger: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.redSecondary,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
  },
  appVersion: {
    fontSize: fontSize.small,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 4,
  },
  appDescription: {
    fontSize: fontSize.normal,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  websiteLink: {
    marginTop: 12,
    paddingVertical: 8,
  },
  websiteLinkText: {
    fontSize: fontSize.normal,
    color: colors.bluePrimary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.black,
  },
  toggleDescription: {
    fontSize: fontSize.small,
    color: colors.gray,
    marginTop: 4,
  },
})
