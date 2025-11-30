// screens/GeneratorScreen.js - QR Code generator screen
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function GeneratorScreen() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [inputText, setInputText] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const haptic = await AsyncStorage.getItem('hapticEnabled');
        setHapticEnabled(haptic === 'true');
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleShare = async () => {
    if (!inputText.trim()) {
      Alert.alert(t('common.error'), t('generator.emptyText'));
      return;
    }

    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 1,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(t('common.error'), 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert(t('common.error'), 'Failed to share QR code');
    }
  };

  const handleSaveImage = async () => {
    if (!inputText.trim()) {
      Alert.alert(t('common.error'), t('generator.emptyText'));
      return;
    }

    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), 'Permission to access media library is required');
        return;
      }

      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 1,
      });

      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert(
        t('generator.saveSuccess'),
        t('generator.saveSuccessMessage')
      );
    } catch (error) {
      console.error('Error saving QR code:', error);
      Alert.alert(
        t('generator.saveError'),
        t('generator.saveErrorMessage')
      );
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.content}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Input Section */}
        <View style={s.section}>
          <Text style={[s.label, { color: colors.text }]}>
            {t('generator.inputLabel')}
          </Text>
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder={t('generator.inputPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* QR Code Preview Section */}
        <View style={s.section}>
          <Text style={[s.label, { color: colors.text }]}>
            {t('generator.qrPreview')}
          </Text>
          <View
            style={[
              s.qrContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {inputText.trim() ? (
              <View ref={qrRef} style={s.qrWrapper}>
                <View style={s.qrBackground}>
                  <QRCode
                    value={inputText}
                    size={240}
                    backgroundColor="white"
                    color="black"
                  />
                </View>
              </View>
            ) : (
              <View style={s.emptyState}>
                <Ionicons
                  name="qr-code-outline"
                  size={80}
                  color={colors.textTertiary}
                />
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                  {t('generator.emptyText')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        {inputText.trim() && (
          <View style={s.buttonContainer}>
            <TouchableOpacity
              style={[s.button, s.shareButton, { backgroundColor: colors.primary }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={s.buttonText}>{t('generator.share')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.button,
                s.saveButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={handleSaveImage}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={20} color={colors.primary} />
              <Text style={[s.buttonText, { color: colors.primary }]}>
                {t('generator.saveImage')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
  },
  qrContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBackground: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    maxWidth: 240,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareButton: {
    // backgroundColor set dynamically
  },
  saveButton: {
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
