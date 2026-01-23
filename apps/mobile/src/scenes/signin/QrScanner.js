import React, { useState, useEffect } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'

export default function QrScanner() {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const navigation = useNavigation()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return
    setScanned(true)

    try {
      const qrData = JSON.parse(data)

      if (qrData.server && qrData.email) {
        // Navigate back to SignIn with QR data
        navigation.navigate('SignIn', {
          qrServerUrl: qrData.server,
          qrEmail: qrData.email,
        })
      } else {
        Alert.alert(
          'Invalid QR Code',
          'This QR code does not contain valid FeedOwn login data.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        )
      }
    } catch (e) {
      Alert.alert(
        'Invalid QR Code',
        'Could not parse QR code data. Please scan a valid FeedOwn QR code.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      )
    }
  }

  if (!permission) {
    return (
      <ScreenTemplate>
        <View style={styles.container}>
          <Text style={[styles.message, { color: theme.text }]}>
            Requesting camera permission...
          </Text>
        </View>
      </ScreenTemplate>
    )
  }

  if (!permission.granted) {
    return (
      <ScreenTemplate>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.container}>
          <Text style={[styles.message, { color: theme.text }]}>
            Camera permission is required to scan QR codes.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </ScreenTemplate>
    )
  }

  return (
    <ScreenTemplate>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay with scanning frame */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>
              Point your camera at the QR code{'\n'}on the FeedOwn Settings page
            </Text>
          </View>
        </View>
      </View>
    </ScreenTemplate>
  )
}

const SCAN_FRAME_SIZE = 250

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: fontSize.xLarge,
    fontWeight: 'bold',
    color: colors.primary,
  },
  backButton: {
    fontSize: fontSize.normal,
    color: colors.primary,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: fontSize.normal,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 30,
  },
  instructionText: {
    color: colors.white,
    fontSize: fontSize.normal,
    textAlign: 'center',
    lineHeight: 24,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
})
