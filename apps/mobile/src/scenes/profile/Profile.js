import React, { useContext, useState, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native'
import { colors, fontSize } from '../../theme'
import { UserContext } from '../../contexts/UserContext'
import { FeedsContext } from '../../contexts/FeedsContext'
import { createApiClient } from '../../utils/api'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import Spinner from 'react-native-loading-spinner-overlay'

export default function Profile() {
  const { user, signOut, getAccessToken } = useContext(UserContext)
  const { feeds, articles, getUnreadCount, resetAll } = useContext(FeedsContext)
  const [isLoading, setIsLoading] = useState(false)

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email || 'Not signed in'}</Text>
            <Text style={styles.passwordHint}>
              If you didn't set a custom password, the default password is 111111
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{feeds.length}</Text>
              <Text style={styles.statLabel}>Feeds</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{articles.length}</Text>
              <Text style={styles.statLabel}>Articles</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{unreadCount}</Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSignOut}
          >
            <Text style={styles.actionButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonWarning]}
            onPress={handleClearData}
          >
            <Text style={styles.actionButtonTextWarning}>Clear All Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.actionButtonTextDanger}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.appName}>FeedOwn</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              Your personal RSS feed reader
            </Text>
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
})
