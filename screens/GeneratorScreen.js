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
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

const QR_TYPES = [
  { id: 'website', icon: 'globe-outline' },
  { id: 'contact', icon: 'person-outline' },
  { id: 'wifi', icon: 'wifi-outline' },
  { id: 'text', icon: 'text-outline' },
  { id: 'clipboard', icon: 'clipboard-outline' },
  { id: 'email', icon: 'mail-outline' },
  { id: 'sms', icon: 'chatbubble-outline' },
  { id: 'phone', icon: 'call-outline' },
  { id: 'event', icon: 'calendar-outline' },
  { id: 'location', icon: 'location-outline' },
];

export default function GeneratorScreen() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [selectedType, setSelectedType] = useState('website');
  const [hapticEnabled, setHapticEnabled] = useState(false);
  const qrRef = useRef(null);

  // Form data for each type
  const [formData, setFormData] = useState({
    website: { url: '' },
    contact: { name: '', phone: '', email: '', company: '', title: '', address: '' },
    wifi: { ssid: '', password: '', security: 'WPA' },
    text: { text: '' },
    clipboard: { text: '' },
    email: { recipient: '', subject: '', message: '' },
    sms: { phone: '', message: '' },
    phone: { phone: '' },
    event: { title: '', location: '', startDate: '', endDate: '', description: '' },
    location: { latitude: '', longitude: '' },
  });

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

  const handleTypeSelect = async (typeId) => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedType(typeId);

    // Load clipboard content if clipboard type is selected
    if (typeId === 'clipboard') {
      try {
        const clipboardText = await Clipboard.getStringAsync();
        if (clipboardText) {
          setFormData((prev) => ({
            ...prev,
            clipboard: { text: clipboardText },
          }));
          Alert.alert('', t('generator.clipboardPasted'));
        } else {
          Alert.alert('', t('generator.clipboardEmpty'));
        }
      } catch (error) {
        console.error('Error reading clipboard:', error);
      }
    }
  };

  const updateFormData = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        [field]: value,
      },
    }));
  };

  const generateQRData = () => {
    const data = formData[selectedType];

    switch (selectedType) {
      case 'website':
        return data.url.trim();

      case 'contact':
        // vCard format
        const vcard = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          data.name && `FN:${data.name}`,
          data.phone && `TEL:${data.phone}`,
          data.email && `EMAIL:${data.email}`,
          data.company && `ORG:${data.company}`,
          data.title && `TITLE:${data.title}`,
          data.address && `ADR:;;${data.address};;;;`,
          'END:VCARD',
        ].filter(Boolean).join('\n');
        return vcard;

      case 'wifi':
        // WIFI:T:WPA;S:mynetwork;P:mypass;;
        return `WIFI:T:${data.security};S:${data.ssid};P:${data.password};;`;

      case 'text':
      case 'clipboard':
        return data.text.trim();

      case 'email':
        const emailParts = [`mailto:${data.recipient}`];
        const params = [];
        if (data.subject) params.push(`subject=${encodeURIComponent(data.subject)}`);
        if (data.message) params.push(`body=${encodeURIComponent(data.message)}`);
        if (params.length > 0) emailParts.push('?' + params.join('&'));
        return emailParts.join('');

      case 'sms':
        return `sms:${data.phone}${data.message ? `?body=${encodeURIComponent(data.message)}` : ''}`;

      case 'phone':
        return `tel:${data.phone}`;

      case 'event':
        // iCal format (simplified)
        const event = [
          'BEGIN:VEVENT',
          data.title && `SUMMARY:${data.title}`,
          data.location && `LOCATION:${data.location}`,
          data.startDate && `DTSTART:${data.startDate}`,
          data.endDate && `DTEND:${data.endDate}`,
          data.description && `DESCRIPTION:${data.description}`,
          'END:VEVENT',
        ].filter(Boolean).join('\n');
        return event;

      case 'location':
        return `geo:${data.latitude},${data.longitude}`;

      default:
        return '';
    }
  };

  const qrData = generateQRData();
  const hasData = qrData.length > 0;

  const handleShare = async () => {
    if (!hasData) {
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
    if (!hasData) {
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

  const renderFormFields = () => {
    const data = formData[selectedType];

    switch (selectedType) {
      case 'website':
        return (
          <TextInput
            style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder={t('generator.fields.urlPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={data.url}
            onChangeText={(text) => updateFormData('url', text)}
            keyboardType="url"
            autoCapitalize="none"
          />
        );

      case 'contact':
        return (
          <>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.namePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.name}
              onChangeText={(text) => updateFormData('name', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.phonePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.phone}
              onChangeText={(text) => updateFormData('phone', text)}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.emailPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.email}
              onChangeText={(text) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.companyPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.company}
              onChangeText={(text) => updateFormData('company', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.titlePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.title}
              onChangeText={(text) => updateFormData('title', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.addressPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.address}
              onChangeText={(text) => updateFormData('address', text)}
            />
          </>
        );

      case 'wifi':
        return (
          <>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.ssidPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.ssid}
              onChangeText={(text) => updateFormData('ssid', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.passwordPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.password}
              onChangeText={(text) => updateFormData('password', text)}
              secureTextEntry
            />
            <View style={s.securityContainer}>
              {['WPA', 'WEP', 'nopass'].map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    s.securityButton,
                    { borderColor: colors.border },
                    data.security === sec && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => updateFormData('security', sec)}
                >
                  <Text style={[s.securityText, { color: data.security === sec ? '#fff' : colors.text }]}>
                    {t(`generator.securityTypes.${sec}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 'text':
      case 'clipboard':
        return (
          <TextInput
            style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder={t('generator.fields.textPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={data.text}
            onChangeText={(text) => updateFormData('text', text)}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        );

      case 'email':
        return (
          <>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.recipientPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.recipient}
              onChangeText={(text) => updateFormData('recipient', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.subjectPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.subject}
              onChangeText={(text) => updateFormData('subject', text)}
            />
            <TextInput
              style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.messagePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.message}
              onChangeText={(text) => updateFormData('message', text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </>
        );

      case 'sms':
        return (
          <>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.phonePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.phone}
              onChangeText={(text) => updateFormData('phone', text)}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.messagePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.message}
              onChangeText={(text) => updateFormData('message', text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </>
        );

      case 'phone':
        return (
          <TextInput
            style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder={t('generator.fields.phonePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={data.phone}
            onChangeText={(text) => updateFormData('phone', text)}
            keyboardType="phone-pad"
          />
        );

      case 'event':
        return (
          <>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.eventTitlePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.title}
              onChangeText={(text) => updateFormData('title', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.eventLocationPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.location}
              onChangeText={(text) => updateFormData('location', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.startDate')}
              placeholderTextColor={colors.textTertiary}
              value={data.startDate}
              onChangeText={(text) => updateFormData('startDate', text)}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.endDate')}
              placeholderTextColor={colors.textTertiary}
              value={data.endDate}
              onChangeText={(text) => updateFormData('endDate', text)}
            />
            <TextInput
              style={[s.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.descriptionPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.description}
              onChangeText={(text) => updateFormData('description', text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </>
        );

      case 'location':
        return (
          <>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.latitudePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.latitude}
              onChangeText={(text) => updateFormData('latitude', text)}
              keyboardType="numeric"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.longitudePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.longitude}
              onChangeText={(text) => updateFormData('longitude', text)}
              keyboardType="numeric"
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.content}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={[s.title, { color: colors.text }]}>{t('generator.title')}</Text>

        {/* Type Selector - Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.typesContainer}
          style={s.typesScroll}
        >
          {QR_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                s.typeButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedType === type.id && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => handleTypeSelect(type.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={type.icon}
                size={24}
                color={selectedType === type.id ? '#fff' : colors.text}
              />
              <Text style={[s.typeText, { color: selectedType === type.id ? '#fff' : colors.text }]}>
                {t(`generator.types.${type.id}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Form Fields */}
        <View style={s.formContainer}>
          {renderFormFields()}
        </View>

        {/* QR Code Preview */}
        <View style={[s.qrContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {hasData ? (
            <View ref={qrRef} style={s.qrWrapper} collapsable={false}>
              <View style={s.qrBackground}>
                <QRCode
                  value={qrData}
                  size={220}
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

        {/* Action Buttons */}
        {hasData && (
          <View style={s.buttonContainer}>
            <TouchableOpacity
              style={[s.button, { backgroundColor: colors.primary }]}
              onPress={handleSaveImage}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={s.buttonText}>{t('generator.save')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.button, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 2 }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={20} color={colors.primary} />
              <Text style={[s.buttonText, { color: colors.primary }]}>
                {t('generator.share')}
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  typesScroll: {
    maxHeight: 100,
  },
  typesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  typeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 90,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
  },
  securityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  securityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  securityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  qrContainer: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBackground: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
