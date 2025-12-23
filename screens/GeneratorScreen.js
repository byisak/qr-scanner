// screens/GeneratorScreen.js - Enhanced QR/Barcode generator screen
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
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StyledQRCode from '../components/StyledQRCode';
import QRStylePicker, { QR_STYLE_PRESETS } from '../components/QRStylePicker';
import BarcodeSvg, { BARCODE_FORMATS, validateBarcode, calculateChecksum, formatCodabar } from '../components/BarcodeSvg';

// 바코드 타입 목록 (카테고리별 그룹화)
const BARCODE_TYPES = [
  // 물류/산업용
  { id: 'CODE128', icon: 'cube-outline', gradient: ['#667eea', '#764ba2'], category: 'industrial' },
  { id: 'CODE39', icon: 'construct-outline', gradient: ['#fa709a', '#fee140'], category: 'industrial' },
  { id: 'ITF', icon: 'swap-horizontal-outline', gradient: ['#a8edea', '#fed6e3'], category: 'industrial' },
  { id: 'ITF14', icon: 'archive-outline', gradient: ['#30cfd0', '#330867'], category: 'industrial' },
  // 상품 바코드
  { id: 'EAN13', icon: 'cart-outline', gradient: ['#f093fb', '#f5576c'], category: 'retail' },
  { id: 'EAN8', icon: 'pricetag-outline', gradient: ['#4facfe', '#00f2fe'], category: 'retail' },
  { id: 'UPC', icon: 'storefront-outline', gradient: ['#43e97b', '#38f9d7'], category: 'retail' },
  { id: 'UPCE', icon: 'pricetag-outline', gradient: ['#ff9a9e', '#fecfef'], category: 'retail' },
  // 특수 용도
  { id: 'codabar', icon: 'library-outline', gradient: ['#ffecd2', '#fcb69f'], category: 'special' },
  { id: 'pharmacode', icon: 'medkit-outline', gradient: ['#ff6e7f', '#bfe9ff'], category: 'special' },
  { id: 'MSI', icon: 'file-tray-stacked-outline', gradient: ['#c471f5', '#fa71cd'], category: 'special' },
];

const QR_TYPES = [
  { id: 'website', icon: 'globe-outline', gradient: ['#667eea', '#764ba2'] },
  { id: 'contact', icon: 'person-outline', gradient: ['#f093fb', '#f5576c'] },
  { id: 'wifi', icon: 'wifi-outline', gradient: ['#4facfe', '#00f2fe'] },
  { id: 'text', icon: 'text-outline', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'clipboard', icon: 'clipboard-outline', gradient: ['#fa709a', '#fee140'] },
  { id: 'email', icon: 'mail-outline', gradient: ['#30cfd0', '#330867'] },
  { id: 'sms', icon: 'chatbubble-outline', gradient: ['#a8edea', '#fed6e3'] },
  { id: 'phone', icon: 'call-outline', gradient: ['#ff9a9e', '#fecfef'] },
  { id: 'event', icon: 'calendar-outline', gradient: ['#ffecd2', '#fcb69f'] },
  { id: 'location', icon: 'location-outline', gradient: ['#ff6e7f', '#bfe9ff'] },
];

export default function GeneratorScreen() {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // iOS는 기존 값 유지, Android는 SafeArea insets 사용
  const statusBarHeight = Platform.OS === 'ios' ? 70 : insets.top + 20;

  // 세그먼트 탭: 'qr' 또는 'barcode'
  const [codeMode, setCodeMode] = useState(params.initialMode || 'qr');

  const [selectedType, setSelectedType] = useState(params.initialType || 'website');
  const [selectedBarcodeFormat, setSelectedBarcodeFormat] = useState(params.initialBarcodeFormat || 'CODE128');
  const [barcodeValue, setBarcodeValue] = useState(params.initialBarcodeValue || '');
  const [barcodeError, setBarcodeError] = useState(null);

  const [hapticEnabled, setHapticEnabled] = useState(false);
  const qrSize = useRef(new Animated.Value(0)).current;
  const barcodeSize = useRef(new Animated.Value(0)).current;
  const qrRef = useRef(null);
  const barcodeRef = useRef(null);

  // QR 스타일 관련 상태
  const [useStyledQR, setUseStyledQR] = useState(true);
  const [qrStyle, setQrStyle] = useState(QR_STYLE_PRESETS[0].style);
  const [stylePickerVisible, setStylePickerVisible] = useState(false);
  const [capturedQRBase64, setCapturedQRBase64] = useState(null);
  const [fullSizeQRBase64, setFullSizeQRBase64] = useState(null); // 저장용 전체 크기
  const [logoImage, setLogoImage] = useState(null); // 로고 이미지 base64

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

  // params에서 초기 데이터 로드 (코드 재생성 기능)
  useEffect(() => {
    // 모드 설정 (QR 또는 바코드)
    if (params.initialMode) {
      setCodeMode(params.initialMode);
    }

    // 바코드 모드인 경우
    if (params.initialMode === 'barcode') {
      if (params.initialBarcodeFormat) {
        setSelectedBarcodeFormat(params.initialBarcodeFormat);
      }
      if (params.initialBarcodeValue) {
        setBarcodeValue(params.initialBarcodeValue);
      }
    }

    // QR 모드인 경우
    if (params.initialType && params.initialData) {
      try {
        const parsedData = JSON.parse(params.initialData);
        setSelectedType(params.initialType);
        setFormData((prev) => ({
          ...prev,
          [params.initialType]: {
            ...prev[params.initialType],
            ...parsedData,
          },
        }));
      } catch (error) {
        console.error('Error parsing initial data:', error);
      }
    }
  }, [params.initialMode, params.initialType, params.initialData, params.initialBarcodeFormat, params.initialBarcodeValue]);

  // Load selected location from map picker
  useEffect(() => {
    const loadSelectedLocation = async () => {
      try {
        const locationData = await AsyncStorage.getItem('selectedLocation');
        if (locationData) {
          const { latitude, longitude } = JSON.parse(locationData);
          setFormData((prev) => ({
            ...prev,
            location: { latitude, longitude },
          }));
          // Clear the stored location
          await AsyncStorage.removeItem('selectedLocation');
        }
      } catch (error) {
        console.error('Error loading selected location:', error);
      }
    };

    // Check for location updates when screen comes into focus
    const unsubscribe = router.addListener?.('focus', () => {
      loadSelectedLocation();
    });

    loadSelectedLocation();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const generateQRData = () => {
    const data = formData[selectedType];

    switch (selectedType) {
      case 'website':
        return data.url.trim();

      case 'contact':
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

  // 바코드 유효성 검사
  const barcodeValidation = validateBarcode(selectedBarcodeFormat, barcodeValue);
  const hasBarcodeData = barcodeValue.length > 0 && barcodeValidation.valid;

  // 체크섬 자동 계산 (EAN/UPC 계열)
  const finalBarcodeValue = ['EAN13', 'EAN8', 'UPC', 'ITF14'].includes(selectedBarcodeFormat)
    ? calculateChecksum(selectedBarcodeFormat, barcodeValue)
    : barcodeValue;

  useEffect(() => {
    // Animate QR code appearance
    Animated.spring(qrSize, {
      toValue: hasData ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [hasData]);

  useEffect(() => {
    // Animate barcode appearance
    Animated.spring(barcodeSize, {
      toValue: hasBarcodeData ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [hasBarcodeData]);

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
          Alert.alert('✓', t('generator.clipboardPasted'));
        } else {
          Alert.alert('ℹ️', t('generator.clipboardEmpty'));
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

  // 바코드 포맷 선택
  const handleBarcodeFormatSelect = async (formatId) => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedBarcodeFormat(formatId);
    setBarcodeValue('');
    setBarcodeError(null);
  };

  // 바코드 값 변경
  const handleBarcodeValueChange = (value) => {
    setBarcodeValue(value);
    const validation = validateBarcode(selectedBarcodeFormat, value);
    if (!validation.valid && value.length > 0) {
      setBarcodeError(validation.message);
    } else {
      setBarcodeError(null);
    }
  };

  // 세그먼트 탭 변경
  const handleCodeModeChange = async (mode) => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCodeMode(mode);
  };

  const handleShare = async () => {
    const isBarcode = codeMode === 'barcode';
    const currentHasData = isBarcode ? hasBarcodeData : hasData;

    if (!currentHasData) {
      Alert.alert(t('common.error'), t('generator.emptyText'));
      return;
    }

    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      let uri;

      if (isBarcode) {
        // 바코드 캡처
        uri = await captureRef(barcodeRef, {
          format: 'png',
          quality: 1,
        });
      } else {
        // QR 코드 캡처
        const qrBase64 = fullSizeQRBase64 || capturedQRBase64;
        if (useStyledQR && qrBase64) {
          const base64Data = qrBase64.replace(/^data:image\/\w+;base64,/, '');
          const fileUri = FileSystem.cacheDirectory + 'qr-styled-' + Date.now() + '.png';
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64',
          });
          uri = fileUri;
        } else {
          uri = await captureRef(qrRef, {
            format: 'png',
            quality: 1,
          });
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(t('common.error'), 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing code:', error);
      Alert.alert(t('common.error'), t('generator.shareError') || 'Failed to share');
    }
  };

  const handleSaveImage = async () => {
    const isBarcode = codeMode === 'barcode';
    const currentHasData = isBarcode ? hasBarcodeData : hasData;

    if (!currentHasData) {
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

      let uri;

      if (isBarcode) {
        // 바코드 캡처
        uri = await captureRef(barcodeRef, {
          format: 'png',
          quality: 1,
        });
      } else {
        // QR 코드 캡처
        const qrBase64 = fullSizeQRBase64 || capturedQRBase64;
        if (useStyledQR && qrBase64) {
          const base64Data = qrBase64.replace(/^data:image\/\w+;base64,/, '');
          const fileUri = FileSystem.cacheDirectory + 'qr-styled-' + Date.now() + '.png';
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64',
          });
          uri = fileUri;
        } else {
          uri = await captureRef(qrRef, {
            format: 'png',
            quality: 1,
          });
        }
      }

      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert(
        '✓ ' + t('generator.saveSuccess'),
        t('generator.saveSuccessMessage')
      );
    } catch (error) {
      console.error('Error saving code:', error);
      Alert.alert(
        t('generator.saveError'),
        t('generator.saveErrorMessage')
      );
    }
  };

  // 로고 이미지 선택
  const handlePickLogo = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), '갤러리 접근 권한이 필요합니다.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64Image = `data:image/png;base64,${asset.base64}`;
        setLogoImage(base64Image);

        // qrStyle에 로고 추가
        setQrStyle(prev => ({
          ...prev,
          logo: base64Image,
        }));
      }
    } catch (error) {
      console.error('Error picking logo:', error);
      Alert.alert(
        '앱 재빌드 필요',
        '이미지 피커를 사용하려면 Xcode에서 앱을 다시 빌드해야 합니다.\n\n1. Xcode에서 Clean Build (Cmd+Shift+K)\n2. Build (Cmd+B)\n3. Run (Cmd+R)',
        [{ text: '확인' }]
      );
    }
  };

  // 로고 제거
  const handleRemoveLogo = () => {
    setLogoImage(null);
    setQrStyle(prev => ({
      ...prev,
      logo: null,
    }));
  };

  const renderFormFields = () => {
    const data = formData[selectedType];

    switch (selectedType) {
      case 'website':
        return (
          <View style={s.fieldContainer}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              {t('generator.fields.urlLabel')}
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.urlPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.url}
              onChangeText={(text) => updateFormData('url', text)}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        );

      case 'contact':
        return (
          <>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.nameLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.namePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.name}
                onChangeText={(text) => updateFormData('name', text)}
              />
            </View>
            <View style={s.fieldRow}>
              <View style={[s.fieldContainer, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                  {t('generator.fields.phoneLabel')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('generator.fields.phonePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={data.phone}
                  onChangeText={(text) => updateFormData('phone', text)}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={[s.fieldContainer, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                  {t('generator.fields.emailLabel')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('generator.fields.emailPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={data.email}
                  onChangeText={(text) => updateFormData('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={s.fieldRow}>
              <View style={[s.fieldContainer, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                  {t('generator.fields.companyLabel')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('generator.fields.companyPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={data.company}
                  onChangeText={(text) => updateFormData('company', text)}
                />
              </View>
              <View style={[s.fieldContainer, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                  {t('generator.fields.titleLabel')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('generator.fields.titlePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={data.title}
                  onChangeText={(text) => updateFormData('title', text)}
                />
              </View>
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.addressLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.addressPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.address}
                onChangeText={(text) => updateFormData('address', text)}
              />
            </View>
          </>
        );

      case 'wifi':
        return (
          <>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.ssidLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.ssidPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.ssid}
                onChangeText={(text) => updateFormData('ssid', text)}
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.passwordLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.passwordPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.password}
                onChangeText={(text) => updateFormData('password', text)}
                secureTextEntry
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.securityLabel')}
              </Text>
              <View style={s.securityContainer}>
                {['WPA', 'WEP', 'nopass'].map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[
                      s.securityButton,
                      { 
                        backgroundColor: data.security === sec ? colors.primary : colors.surface,
                        borderColor: data.security === sec ? colors.primary : colors.border 
                      },
                    ]}
                    onPress={() => updateFormData('security', sec)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.securityText, { color: data.security === sec ? '#fff' : colors.text }]}>
                      {t(`generator.securityTypes.${sec}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 'text':
      case 'clipboard':
        return (
          <View style={s.fieldContainer}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              {t('generator.fields.textLabel')}
            </Text>
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
          </View>
        );

      case 'email':
        return (
          <>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.recipientLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.recipientPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.recipient}
                onChangeText={(text) => updateFormData('recipient', text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.subjectLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.subjectPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.subject}
                onChangeText={(text) => updateFormData('subject', text)}
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.messageLabel')}
              </Text>
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
            </View>
          </>
        );

      case 'sms':
        return (
          <>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.phoneLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.phonePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.phone}
                onChangeText={(text) => updateFormData('phone', text)}
                keyboardType="phone-pad"
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.messageLabel')}
              </Text>
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
            </View>
          </>
        );

      case 'phone':
        return (
          <View style={s.fieldContainer}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              {t('generator.fields.phoneLabel')}
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.phonePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.phone}
              onChangeText={(text) => updateFormData('phone', text)}
              keyboardType="phone-pad"
            />
          </View>
        );

      case 'event':
        return (
          <>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.eventTitleLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.eventTitlePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.title}
                onChangeText={(text) => updateFormData('title', text)}
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.eventLocationLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.eventLocationPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.location}
                onChangeText={(text) => updateFormData('location', text)}
              />
            </View>
            <View style={s.fieldRow}>
              <View style={[s.fieldContainer, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                  {t('generator.fields.startDateLabel')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('generator.fields.startDate')}
                  placeholderTextColor={colors.textTertiary}
                  value={data.startDate}
                  onChangeText={(text) => updateFormData('startDate', text)}
                />
              </View>
              <View style={[s.fieldContainer, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                  {t('generator.fields.endDateLabel')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('generator.fields.endDate')}
                  placeholderTextColor={colors.textTertiary}
                  value={data.endDate}
                  onChangeText={(text) => updateFormData('endDate', text)}
                />
              </View>
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.descriptionLabel')}
              </Text>
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
            </View>
          </>
        );

      case 'location':
        return (
          <>
            <TouchableOpacity
              style={[s.mapPickerButton, { backgroundColor: colors.primary }]}
              onPress={async () => {
                if (hapticEnabled) {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.push({
                  pathname: '/map-location-picker',
                  params: {
                    latitude: data.latitude || '',
                    longitude: data.longitude || '',
                  },
                });
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={22} color="#fff" />
              <Text style={s.mapPickerButtonText}>
                {t('generator.selectFromMap') || 'Select from Map'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.latitudeLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.latitudePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.latitude}
                onChangeText={(text) => updateFormData('latitude', text)}
                keyboardType="numeric"
              />
            </View>
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.longitudeLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder={t('generator.fields.longitudePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={data.longitude}
                onChangeText={(text) => updateFormData('longitude', text)}
                keyboardType="numeric"
              />
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 상단 그라데이션 */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(0,0,0,1)', 'rgba(0,0,0,0.95)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']
            : ['rgba(249,249,249,1)', 'rgba(249,249,249,0.95)', 'rgba(249,249,249,0.7)', 'rgba(249,249,249,0.3)', 'rgba(249,249,249,0)']
        }
        locations={[0, 0.3, 0.6, 0.85, 1]}
        style={[s.statusBarGradient, { height: statusBarHeight }]}
      />

      <ScrollView
        style={s.content}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>
            {t('generator.title')}
          </Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {t('generator.subtitle')}
          </Text>
        </View>

        {/* 세그먼트 탭: QR 코드 / 바코드 */}
        <View style={[s.segmentContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[
              s.segmentButton,
              codeMode === 'qr' && { backgroundColor: colors.primary },
            ]}
            onPress={() => handleCodeModeChange('qr')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="qr-code-outline"
              size={20}
              color={codeMode === 'qr' ? '#fff' : colors.text}
            />
            <Text style={[
              s.segmentText,
              { color: codeMode === 'qr' ? '#fff' : colors.text }
            ]}>
              {t('generator.qrCode') || 'QR 코드'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.segmentButton,
              codeMode === 'barcode' && { backgroundColor: colors.primary },
            ]}
            onPress={() => handleCodeModeChange('barcode')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="barcode-outline"
              size={20}
              color={codeMode === 'barcode' ? '#fff' : colors.text}
            />
            <Text style={[
              s.segmentText,
              { color: codeMode === 'barcode' ? '#fff' : colors.text }
            ]}>
              {t('generator.barcode') || '바코드'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR 코드 모드 */}
        {codeMode === 'qr' && (
          <>
            {/* Type Selector */}
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
                    {
                      backgroundColor: selectedType === type.id ? colors.primary : colors.surface,
                      borderColor: selectedType === type.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleTypeSelect(type.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    s.typeIconContainer,
                    { backgroundColor: selectedType === type.id ? 'rgba(255,255,255,0.2)' : colors.background }
                  ]}>
                    <Ionicons
                      name={type.icon}
                      size={22}
                      color={selectedType === type.id ? '#fff' : colors.text}
                    />
                  </View>
                  <Text style={[
                    s.typeText,
                    { color: selectedType === type.id ? '#fff' : colors.text }
                  ]}>
                    {t(`generator.types.${type.id}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Form Section */}
            <View style={[s.formSection, { backgroundColor: colors.surface }]}>
              <View style={s.formHeader}>
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[s.formTitle, { color: colors.text }]}>
                  {t('generator.formTitle')}
                </Text>
              </View>
              <View style={s.formContainer}>
                {renderFormFields()}
              </View>
            </View>
          </>
        )}

        {/* 바코드 모드 */}
        {codeMode === 'barcode' && (
          <>
            {/* 바코드 포맷 선택 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typesContainer}
              style={s.typesScroll}
            >
              {BARCODE_TYPES.map((format) => (
                <TouchableOpacity
                  key={format.id}
                  style={[
                    s.typeButton,
                    {
                      backgroundColor: selectedBarcodeFormat === format.id ? colors.primary : colors.surface,
                      borderColor: selectedBarcodeFormat === format.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleBarcodeFormatSelect(format.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    s.typeIconContainer,
                    { backgroundColor: selectedBarcodeFormat === format.id ? 'rgba(255,255,255,0.2)' : colors.background }
                  ]}>
                    <Ionicons
                      name={format.icon}
                      size={22}
                      color={selectedBarcodeFormat === format.id ? '#fff' : colors.text}
                    />
                  </View>
                  <Text style={[
                    s.typeText,
                    { color: selectedBarcodeFormat === format.id ? '#fff' : colors.text }
                  ]}>
                    {BARCODE_FORMATS[format.id]?.name || format.id}
                  </Text>
                  <Text style={[
                    s.typeDesc,
                    { color: selectedBarcodeFormat === format.id ? 'rgba(255,255,255,0.7)' : colors.textSecondary }
                  ]}>
                    {t(`generator.barcodeTypes.${format.id}`) || BARCODE_FORMATS[format.id]?.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 바코드 입력 폼 */}
            <View style={[s.formSection, { backgroundColor: colors.surface }]}>
              <View style={s.formHeader}>
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[s.formTitle, { color: colors.text }]}>
                  {t('generator.barcodeInput') || '바코드 값 입력'}
                </Text>
              </View>
              <View style={s.formContainer}>
                <View style={s.fieldContainer}>
                  <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                    {t('generator.barcodeValue') || '값'}
                  </Text>
                  <TextInput
                    style={[
                      s.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: barcodeError ? colors.error : colors.border,
                        color: colors.text
                      }
                    ]}
                    placeholder={BARCODE_FORMATS[selectedBarcodeFormat]?.placeholder || '값을 입력하세요'}
                    placeholderTextColor={colors.textTertiary}
                    value={barcodeValue}
                    onChangeText={handleBarcodeValueChange}
                    keyboardType={['EAN13', 'EAN8', 'UPC', 'ITF14', 'MSI', 'pharmacode'].includes(selectedBarcodeFormat) ? 'numeric' : 'default'}
                    autoCapitalize={selectedBarcodeFormat === 'CODE39' ? 'characters' : 'none'}
                    maxLength={BARCODE_FORMATS[selectedBarcodeFormat]?.maxLength || undefined}
                  />
                  {barcodeError && (
                    <Text style={[s.errorText, { color: colors.error }]}>
                      {t(`generator.barcodeErrors.${barcodeError}`) || barcodeError}
                    </Text>
                  )}
                  {/* 바코드 포맷 힌트 */}
                  <View style={s.barcodeHint}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.barcodeHintText, { color: colors.textSecondary }]}>
                      {t(`generator.barcodeHints.${selectedBarcodeFormat}`) ||
                       `${BARCODE_FORMATS[selectedBarcodeFormat]?.description} - ${
                         BARCODE_FORMATS[selectedBarcodeFormat]?.maxLength
                           ? `${BARCODE_FORMATS[selectedBarcodeFormat].maxLength}자리`
                           : '길이 제한 없음'
                       }`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {/* QR Code Preview - QR 모드일 때만 */}
        {codeMode === 'qr' && (
          <View style={[s.qrSection, { backgroundColor: colors.surface }]}>
            <View style={s.qrHeader}>
              <View style={s.qrHeaderLeft}>
                <Ionicons
                  name="qr-code-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[s.qrTitle, { color: colors.text }]}>
                  {t('generator.qrPreview')}
                </Text>
              </View>
              {hasData && (
                <TouchableOpacity
                  style={[s.styleButton, { backgroundColor: colors.primary }]}
                  onPress={() => setStylePickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="color-palette-outline" size={16} color="#fff" />
                  <Text style={s.styleButtonText}>
                    {t('generator.qrStyle.customize') || '스타일'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[s.qrContainer, { borderColor: colors.border }]}>
              {hasData ? (
                <Animated.View
                  ref={qrRef}
                  style={[
                    s.qrWrapper,
                    {
                      transform: [
                        { scale: qrSize },
                        {
                          rotateZ: qrSize.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['180deg', '0deg'],
                          }),
                        },
                      ],
                      opacity: qrSize,
                    },
                  ]}
                  collapsable={false}
                >
                  <View style={[s.qrBackground, { backgroundColor: qrStyle.backgroundColor || '#fff' }]}>
                    {useStyledQR ? (
                      <StyledQRCode
                        value={qrData}
                        size={240}
                        qrStyle={{ ...qrStyle, width: undefined, height: undefined }}
                        onCapture={(base64) => setCapturedQRBase64(base64)}
                      />
                    ) : (
                      <QRCode
                        value={qrData}
                        size={240}
                        backgroundColor="white"
                        color="black"
                      />
                    )}
                  </View>
                </Animated.View>
              ) : (
                <View style={s.emptyState}>
                  <View style={[s.emptyIconContainer, { backgroundColor: colors.background }]}>
                    <Ionicons
                      name="qr-code-outline"
                      size={48}
                      color={colors.textTertiary}
                    />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>
                    {t('generator.emptyTitle')}
                  </Text>
                  <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                    {t('generator.emptyText')}
                  </Text>
                </View>
              )}
            </View>

            {/* 저장용 전체 크기 QR 코드 (hidden) */}
            {useStyledQR && qrData && (qrStyle.width || qrStyle.height) && (
              <View style={{ position: 'absolute', left: -9999, opacity: 0 }}>
                <StyledQRCode
                  value={qrData}
                  size={qrStyle.width || qrStyle.height || 300}
                  qrStyle={qrStyle}
                  onCapture={(base64) => setFullSizeQRBase64(base64)}
                />
              </View>
            )}

            {/* Style Mode Toggle */}
            {hasData && (
              <View style={s.styleModeContainer}>
                <TouchableOpacity
                  style={[
                    s.styleModeButton,
                    !useStyledQR && { backgroundColor: colors.primary },
                    useStyledQR && { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setUseStyledQR(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.styleModeText, { color: !useStyledQR ? '#fff' : colors.text }]}>
                    {t('generator.qrStyle.basic') || '기본'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.styleModeButton,
                    useStyledQR && { backgroundColor: colors.primary },
                    !useStyledQR && { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setUseStyledQR(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.styleModeText, { color: useStyledQR ? '#fff' : colors.text }]}>
                    {t('generator.qrStyle.styled') || '스타일'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Barcode Preview - 바코드 모드일 때만 */}
        {codeMode === 'barcode' && (
          <View style={[s.qrSection, { backgroundColor: colors.surface }]}>
            <View style={s.qrHeader}>
              <View style={s.qrHeaderLeft}>
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[s.qrTitle, { color: colors.text }]}>
                  {t('generator.barcodePreview') || '바코드 미리보기'}
                </Text>
              </View>
            </View>

            <View style={[s.qrContainer, s.barcodeContainer, { borderColor: colors.border }]}>
              {hasBarcodeData ? (
                <Animated.View
                  ref={barcodeRef}
                  style={[
                    s.qrWrapper,
                    {
                      transform: [
                        { scale: barcodeSize },
                      ],
                      opacity: barcodeSize,
                    },
                  ]}
                  collapsable={false}
                >
                  <View style={[s.barcodeBackground, { backgroundColor: '#fff' }]}>
                    <BarcodeSvg
                      value={finalBarcodeValue}
                      format={selectedBarcodeFormat}
                      width={2}
                      height={80}
                      displayValue={true}
                      fontSize={16}
                      background="#ffffff"
                      lineColor="#000000"
                      margin={20}
                    />
                  </View>
                </Animated.View>
              ) : (
                <View style={s.emptyState}>
                  <View style={[s.emptyIconContainer, { backgroundColor: colors.background }]}>
                    <Ionicons
                      name="barcode-outline"
                      size={48}
                      color={colors.textTertiary}
                    />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>
                    {t('generator.emptyBarcodeTitle') || '바코드를 생성하세요'}
                  </Text>
                  <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                    {t('generator.emptyBarcodeText') || '값을 입력하면 바코드가 생성됩니다'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {((codeMode === 'qr' && hasData) || (codeMode === 'barcode' && hasBarcodeData)) && (
          <View style={s.actionsContainer}>
            <View style={s.buttonRow}>
              <TouchableOpacity
                style={[s.actionButton, s.primaryButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleSaveImage}
                activeOpacity={0.8}
              >
                <View style={s.buttonIconContainer}>
                  <Ionicons name="download-outline" size={22} color="#fff" />
                </View>
                <View style={s.buttonContent}>
                  <Text style={s.buttonTitle}>{t('generator.save')}</Text>
                  <Text style={s.buttonSubtitle}>{t('generator.saveSubtitle')}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.shareIconButton, { backgroundColor: colors.primary }]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* QR Style Picker Modal */}
      <QRStylePicker
        visible={stylePickerVisible}
        onClose={() => setStylePickerVisible(false)}
        currentStyle={qrStyle}
        onStyleChange={setQrStyle}
        previewValue={qrData || 'QR PREVIEW'}
        logoImage={logoImage}
        onPickLogo={handlePickLogo}
        onRemoveLogo={handleRemoveLogo}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // height는 인라인 스타일로 동적 설정
    zIndex: 100,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  // 세그먼트 탭 스타일
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // 바코드 관련 스타일
  typeDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  barcodeContainer: {
    minHeight: 160,
  },
  barcodeBackground: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  barcodeHintText: {
    fontSize: 12,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  typesScroll: {
    maxHeight: 110,
    marginBottom: 20,
  },
  typesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 10,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  formSection: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  formContainer: {
    gap: 16,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginLeft: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontWeight: '500',
  },
  textArea: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 120,
  },
  securityContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  securityButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  qrSection: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  qrHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  styleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  styleButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  styleModeContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  styleModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  styleModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  qrContainer: {
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 340,
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBackground: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  shareIconButton: {
    width: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButton: {
    // Primary button specific styles
  },
  secondaryButton: {
    borderWidth: 2,
  },
  buttonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  buttonContent: {
    flex: 1,
    gap: 2,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPickerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
