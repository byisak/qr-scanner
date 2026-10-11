// screens/GeneratorScreen.js - Enhanced QR/Barcode generator screen
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Platform,
  PixelRatio,
  Animated,
  Image,
  Modal,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import haptics from '../utils/haptics';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';

// 네이티브 모듈 안전한 import (빌드 문제 대응)
let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker not available:', e.message);
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import { useTabBarOverlap } from '../hooks/useTabBarOverlap';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import LockIcon, { HOT_PINK, LIGHT_PINK } from '../components/LockIcon';
import { FREE_BARCODE_TYPES, FREE_QR_TYPES } from '../config/lockedFeatures';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StyledQRCode, { DOT_TYPES, CORNER_SQUARE_TYPES, CORNER_DOT_TYPES } from '../components/StyledQRCode';
import QRFrameRenderer from '../components/QRFrameRenderer';
import MaterialPressable from '../components/MaterialPressable';

// Material 3 (Android 전용) 스타일 조정에 쓰는 플랫폼 플래그
const IS_ANDROID = Platform.OS === 'android';
import { QR_STYLE_PRESETS, QR_FRAMES, COLOR_PRESETS, GRADIENT_PRESETS } from '../components/QRStylePicker';
import NativeColorPicker from '../components/NativeColorPicker';
import Svg, { Circle, Path } from 'react-native-svg';
import BarcodeSvg, { BARCODE_FORMATS, validateBarcode, calculateChecksum, formatCodabar, ALL_BWIP_BARCODES, BARCODE_CATEGORIES, generateHighResBarcode, BARCODE_OPTIMAL_SETTINGS, checkScaleWarning } from '../components/BarcodeSvg';
import AdBanner from '../components/AdBanner';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import { trackScreenView, trackQRGenerated, trackBarcodeGenerated, trackQRSaved, trackQRShared } from '../utils/analytics';
import PresetSaveModal from '../components/PresetSaveModal';
import { getPresets, savePreset, deletePreset } from '../utils/presetStorage';
import { saveGeneratedCodeToHistory } from '../utils/generatedHistoryStorage';

// 기본 표시되는 바코드 타입 bcid 목록 (1개)
const DEFAULT_BARCODE_BCIDS = [
  'code128',
];

// 카테고리 순서 (2D 바코드 제외 - QR코드는 별도 탭에서 생성)
const CATEGORY_ORDER = ['industrial', 'retail', 'gs1', 'medical', 'special', 'postal', 'stacked', 'automotive', 'other'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// QR 유형 3열 격자: 화면 좌우 여백과 칸 사이 간격을 뺀 너비를 3등분 (내림해서 줄바꿈 방지)
const TYPE_GRID_ITEM_WIDTH = Math.floor((SCREEN_WIDTH - SPACE.screen * 2 - SPACE.gap * 2) / 3);

const QR_TYPES = [
  { id: 'text', icon: 'text-outline', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'website', icon: 'globe-outline', gradient: ['#667eea', '#764ba2'] },
  { id: 'contact', icon: 'person-outline', gradient: ['#f093fb', '#f5576c'] },
  { id: 'wifi', icon: 'wifi-outline', gradient: ['#4facfe', '#00f2fe'] },
  { id: 'clipboard', icon: 'clipboard-outline', gradient: ['#fa709a', '#fee140'] },
  { id: 'email', icon: 'mail-outline', gradient: ['#30cfd0', '#330867'] },
  { id: 'sms', icon: 'chatbubble-outline', gradient: ['#a8edea', '#fed6e3'] },
  { id: 'phone', icon: 'call-outline', gradient: ['#ff9a9e', '#fecfef'] },
  { id: 'event', icon: 'calendar-outline', gradient: ['#ffecd2', '#fcb69f'] },
  { id: 'location', icon: 'location-outline', gradient: ['#ff6e7f', '#bfe9ff'] },
];

export default function GeneratorScreen() {
  const { t, fonts, language } = useLanguage();
  const { isDark } = useTheme();
  const { isLocked, showUnlockAlert, isBarcodeTypeLocked, getBarcodeFeatureId, isQrTypeLocked, getQrTypeFeatureId, getAdProgress } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarOverlap = useTabBarOverlap(); // 탭바에 가려지는 높이 (목록 끝 여백)
  const params = useLocalSearchParams();

  // 노치 없는 SE(inset 20)부터 Dynamic Island(59)까지 대응하도록 insets 기준으로 계산
  const statusBarHeight = insets.top + (Platform.OS === 'ios' ? 23 : 20);

  // 세그먼트 탭: 'qr' 또는 'barcode'
  const [codeMode, setCodeMode] = useState(params.initialMode || 'qr');

  const [selectedType, setSelectedType] = useState(params.initialType || 'text');
  // bcid 형태로 저장 (예: 'code128', 'ean13')
  const [selectedBarcodeFormat, setSelectedBarcodeFormat] = useState(params.initialBarcodeFormat || 'code128');
  const [barcodeValue, setBarcodeValue] = useState(params.initialBarcodeValue || '');
  const [barcodeError, setBarcodeError] = useState(null);

  // 바코드 스타일 설정 (기본값 개선: 스캔 가능성 향상)
  const [barcodeSettings, setBarcodeSettings] = useState({
    scale: 3,        // 바코드 너비 스케일 (1-6) - 기본값 상향
    height: 100,     // 바코드 높이 (50-150) - 기본값 상향
    fontSize: 14,    // 텍스트 크기 (10-24)
    showText: true,  // 텍스트 표시 여부
    rotate: 'N',     // 회전: N(0°), R(90°), I(180°), L(270°)
    customText: '',  // 바코드 아래 커스텀 텍스트
  });
  const [barcodeSettingsExpanded, setBarcodeSettingsExpanded] = useState(false);
  const [barcodeSettingsTab, setBarcodeSettingsTab] = useState('size'); // 'size', 'display', 'save'

  // 고해상도 저장 설정 (0: 빠른저장, 1-4: 고해상도 레벨)
  const [highResLevel, setHighResLevel] = useState(0);
  const [saveProgress, setSaveProgress] = useState({ visible: false, progress: 0, message: '', type: 'qr' });

  // 고해상도 레벨별 설정
  const HIGH_RES_LEVELS = [
    { level: 0, label: t('generator.qualityLevels.fast') || '빠름', scale: 0, description: t('generator.qualityDescriptions.screenCapture') || '화면 캡처', time: t('generator.qualityTime.instant') || '즉시' },
    { level: 1, label: t('generator.qualityLevels.normal') || '보통', scale: 4, description: t('generator.qualityDescriptions.generalPrint') || '일반 인쇄', time: t('generator.qualityTime.second1') || '~1초' },
    { level: 2, label: t('generator.qualityLevels.high') || '고급', scale: 6, description: t('generator.qualityDescriptions.highQuality') || '고품질', time: t('generator.qualityTime.second2') || '~2초' },
    { level: 3, label: t('generator.qualityLevels.best') || '최고', scale: 8, description: t('generator.qualityDescriptions.bestQuality') || '최고 품질', time: t('generator.qualityTime.second3') || '~3초' },
    { level: 4, label: t('generator.qualityLevels.print') || '인쇄', scale: 12, description: t('generator.qualityDescriptions.largePrint') || '대형 인쇄', time: t('generator.qualityTime.second5') || '~5초' },
  ];

  // 바코드 타입 즐겨찾기 및 모달
  const [favoriteBarcodes, setFavoriteBarcodes] = useState([]); // bcid 목록
  const [hiddenDefaults, setHiddenDefaults] = useState([]); // 숨긴 기본 바코드
  const [barcodePickerVisible, setBarcodePickerVisible] = useState(false);
  const [barcodeSearchQuery, setBarcodeSearchQuery] = useState('');

  // QR 타입 순서 관리
  const [qrTypeOrder, setQrTypeOrder] = useState(QR_TYPES.map(t => t.id));
  const [qrTypeReorderVisible, setQrTypeReorderVisible] = useState(false);

  // 바코드 타입 순서 관리
  const [barcodeTypeOrder, setBarcodeTypeOrder] = useState([]);
  const [barcodeReorderVisible, setBarcodeReorderVisible] = useState(false);

  // 즐겨찾기 및 숨긴 기본 바코드 로드
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const saved = await AsyncStorage.getItem('favoriteBarcodesBcid');
        if (saved) {
          setFavoriteBarcodes(JSON.parse(saved));
        }
        const hidden = await AsyncStorage.getItem('hiddenDefaultBarcodes');
        if (hidden) {
          setHiddenDefaults(JSON.parse(hidden));
        }
      } catch (error) {
        console.error('Error loading favorite barcodes:', error);
      }
    };
    loadFavorites();
  }, []);

  // QR 타입 순서 로드
  useEffect(() => {
    const loadQrTypeOrder = async () => {
      try {
        const savedOrder = await AsyncStorage.getItem('qrTypeOrder');
        if (savedOrder) {
          const order = JSON.parse(savedOrder);
          // 저장된 순서에 새로 추가된 타입이 있으면 뒤에 추가
          const allTypeIds = QR_TYPES.map(t => t.id);
          const validOrder = order.filter(id => allTypeIds.includes(id));
          const missingTypes = allTypeIds.filter(id => !validOrder.includes(id));
          setQrTypeOrder([...validOrder, ...missingTypes]);
        }
      } catch (error) {
        console.error('Error loading QR type order:', error);
      }
    };
    loadQrTypeOrder();
  }, []);

  // 순서대로 정렬된 QR 타입 목록
  const orderedQrTypes = useMemo(() => {
    return qrTypeOrder
      .map(id => QR_TYPES.find(t => t.id === id))
      .filter(Boolean);
  }, [qrTypeOrder]);

  // QR 타입 순서 저장
  const saveQrTypeOrder = async (newOrder) => {
    try {
      await AsyncStorage.setItem('qrTypeOrder', JSON.stringify(newOrder));
    } catch (error) {
      console.error('Error saving QR type order:', error);
    }
  };

  // QR 타입 순서 변경 핸들러
  const handleQrTypeReorder = async ({ data }) => {
    const newOrder = data.map(item => item.id);
    setQrTypeOrder(newOrder);
    await saveQrTypeOrder(newOrder);
  };

  // 바코드 타입 순서 로드
  useEffect(() => {
    const loadBarcodeOrder = async () => {
      try {
        const savedOrder = await AsyncStorage.getItem('barcodeTypeOrder');
        if (savedOrder) {
          setBarcodeTypeOrder(JSON.parse(savedOrder));
        }
      } catch (error) {
        console.error('Error loading barcode type order:', error);
      }
    };
    loadBarcodeOrder();
  }, []);

  // 바코드 타입 순서 저장
  const saveBarcodeTypeOrder = async (newOrder) => {
    try {
      await AsyncStorage.setItem('barcodeTypeOrder', JSON.stringify(newOrder));
    } catch (error) {
      console.error('Error saving barcode type order:', error);
    }
  };

  // 바코드 타입 순서 변경 핸들러
  const handleBarcodeTypeReorder = async ({ data }) => {
    const newOrder = data.map(item => item.bcid);
    setBarcodeTypeOrder(newOrder);
    await saveBarcodeTypeOrder(newOrder);
  };

  // 현재 선택된 바코드 정보 조회
  const selectedBarcodeInfo = useMemo(() => {
    return ALL_BWIP_BARCODES.find(b => b.bcid === selectedBarcodeFormat) || ALL_BWIP_BARCODES[0];
  }, [selectedBarcodeFormat]);

  // 표시할 바코드 타입 목록 계산 (숨기지 않은 기본 + 즐겨찾기, 저장된 순서 반영)
  const displayedBarcodeTypes = useMemo(() => {
    const defaultTypes = ALL_BWIP_BARCODES.filter(
      b => DEFAULT_BARCODE_BCIDS.includes(b.bcid) && !hiddenDefaults.includes(b.bcid)
    );
    const favoriteTypes = ALL_BWIP_BARCODES.filter(
      b => favoriteBarcodes.includes(b.bcid) && !DEFAULT_BARCODE_BCIDS.includes(b.bcid)
    );
    const allTypes = [...defaultTypes, ...favoriteTypes];

    // 저장된 순서가 있으면 적용
    if (barcodeTypeOrder.length > 0) {
      const ordered = [];
      // 저장된 순서대로 먼저 추가
      barcodeTypeOrder.forEach(bcid => {
        const type = allTypes.find(t => t.bcid === bcid);
        if (type) ordered.push(type);
      });
      // 저장된 순서에 없는 타입들은 뒤에 추가
      allTypes.forEach(type => {
        if (!barcodeTypeOrder.includes(type.bcid)) {
          ordered.push(type);
        }
      });
      return ordered;
    }

    return allTypes;
  }, [favoriteBarcodes, hiddenDefaults, barcodeTypeOrder]);

  // 모달에서 검색 필터링된 바코드 목록
  const filteredBarcodes = useMemo(() => {
    if (!barcodeSearchQuery.trim()) return ALL_BWIP_BARCODES;
    const query = barcodeSearchQuery.toLowerCase().trim();
    return ALL_BWIP_BARCODES.filter(b =>
      b.name.toLowerCase().includes(query) ||
      b.bcid.toLowerCase().includes(query) ||
      b.description.toLowerCase().includes(query)
    );
  }, [barcodeSearchQuery]);

  // 카테고리별로 그룹화된 바코드 목록 (검색 결과 기준)
  const groupedBarcodes = useMemo(() => {
    const groups = {};
    CATEGORY_ORDER.forEach(cat => {
      const items = filteredBarcodes.filter(b => b.category === cat);
      if (items.length > 0) {
        groups[cat] = items;
      }
    });
    return groups;
  }, [filteredBarcodes]);

  // 즐겨찾기 토글 (기본 바코드와 일반 즐겨찾기 모두 처리)
  const toggleFavoriteBarcode = async (bcid) => {
    if (hapticEnabled) {
      await haptics.tap();
    }

    const isDefault = DEFAULT_BARCODE_BCIDS.includes(bcid);

    try {
      if (isDefault) {
        // 기본 바코드인 경우: hiddenDefaults 토글
        let newHidden;
        if (hiddenDefaults.includes(bcid)) {
          newHidden = hiddenDefaults.filter(id => id !== bcid);
        } else {
          newHidden = [...hiddenDefaults, bcid];
        }
        setHiddenDefaults(newHidden);
        await AsyncStorage.setItem('hiddenDefaultBarcodes', JSON.stringify(newHidden));
      } else {
        // 일반 바코드인 경우: favoriteBarcodes 토글
        let newFavorites;
        if (favoriteBarcodes.includes(bcid)) {
          newFavorites = favoriteBarcodes.filter(id => id !== bcid);
        } else {
          newFavorites = [...favoriteBarcodes, bcid];
        }
        setFavoriteBarcodes(newFavorites);
        await AsyncStorage.setItem('favoriteBarcodesBcid', JSON.stringify(newFavorites));
      }
    } catch (error) {
      console.error('Error saving barcode preferences:', error);
    }
  };

  // 모달에서 바코드 선택
  const handleSelectBarcodeFromModal = async (bcid) => {
    if (hapticEnabled) {
      await haptics.impact();
    }
    setSelectedBarcodeFormat(bcid);
    setBarcodeValue('');
    setBarcodeError(null);
    setBarcodeSearchQuery('');
    setBarcodePickerVisible(false);
  };

  const [hapticEnabled, setHapticEnabled] = useState(false);
  const qrSize = useRef(new Animated.Value(0)).current;
  const barcodeSize = useRef(new Animated.Value(0)).current;
  const qrRef = useRef(null);
  const barcodeRef = useRef(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // 저장 중 스핀 애니메이션
  useEffect(() => {
    if (saveProgress.visible) {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [saveProgress.visible]);

  // QR 스타일 관련 상태 (다크 모드일 때 흰색 기본값)
  const [useStyledQR, setUseStyledQR] = useState(true);
  const [qrStyle, setQrStyle] = useState(() => {
    if (isDark) {
      return {
        ...QR_STYLE_PRESETS[0].style,
        dotColor: '#FFFFFF',
        cornerSquareColor: '#FFFFFF',
        cornerDotColor: '#FFFFFF',
        backgroundColor: '#000000',
      };
    }
    return QR_STYLE_PRESETS[0].style;
  });
  const [capturedQRBase64, setCapturedQRBase64] = useState(null);
  const [fullSizeQRBase64, setFullSizeQRBase64] = useState(null); // 저장용 전체 크기
  const [logoImage, setLogoImage] = useState(null); // 로고 이미지 base64
  const [frameIndex, setFrameIndex] = useState(0); // 현재 프레임 캐러셀 인덱스
  const [frameTextColor, setFrameTextColor] = useState(null); // 프레임 텍스트 색상 (null이면 자동)
  const [qrSettingsExpanded, setQrSettingsExpanded] = useState(false); // QR 스타일 설정 펼침/접힘
  const [qrSettingsTab, setQrSettingsTab] = useState('presets'); // 활성 탭
  const [qrResLevel, setQrResLevel] = useState(0); // QR 저장 품질 레벨 (0-4)
  const [activeColorPicker, setActiveColorPicker] = useState(null); // 활성 컬러 피커 (dotColor, cornerSquareColor, cornerDotColor, backgroundColor, frameTextColor)
  const [customPresets, setCustomPresets] = useState([]); // 사용자 커스텀 프리셋
  const [presetSaveModalVisible, setPresetSaveModalVisible] = useState(false); // 프리셋 저장 모달
  const highResQrRef = useRef(null); // 오프스크린 고해상도 캡처용 ref
  // 오프스크린 저장용 스타일 QR이 이미지로 준비됐는지 (WebView는 그리는 데 시간이 걸린다)
  const offscreenReadyRef = useRef(false);
  const waitForOffscreenQr = useCallback(async (timeoutMs = 4000) => {
    const start = Date.now();
    while (!offscreenReadyRef.current && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // 이미지로 바뀐 직후 한 프레임 기다려 화면에 반영되게 한다
    await new Promise(resolve => setTimeout(resolve, 150));
  }, []);
  const frameCarouselRef = useRef(null); // 프레임 캐러셀 ref

  // 현재 선택된 프레임 (인덱스 기반)
  const selectedFrame = useMemo(() => {
    const frame = QR_FRAMES[frameIndex];
    return frame?.id === 'none' ? null : frame;
  }, [frameIndex]);

  // QR 고해상도 레벨별 설정
  const QR_RES_LEVELS = [
    { level: 0, label: t('generator.qualityLevels.fast') || '빠름', scale: 1, description: t('generator.qualityDescriptions.screenCapture') || '화면 캡처', time: t('generator.qualityTime.instant') || '즉시', size: 300 },
    { level: 1, label: t('generator.qualityLevels.normal') || '보통', scale: 2, description: t('generator.qualityDescriptions.generalUse') || '일반 용도', time: t('generator.qualityTime.second1') || '~1초', size: 600 },
    { level: 2, label: t('generator.qualityLevels.high') || '고급', scale: 3, description: t('generator.qualityDescriptions.highQuality') || '고품질', time: t('generator.qualityTime.second2') || '~2초', size: 900 },
    { level: 3, label: t('generator.qualityLevels.best') || '최고', scale: 4, description: t('generator.qualityDescriptions.bestQuality') || '최고 품질', time: t('generator.qualityTime.second3') || '~3초', size: 1200 },
    { level: 4, label: t('generator.qualityLevels.print') || '인쇄', scale: 6, description: t('generator.qualityDescriptions.largePrint') || '대형 인쇄', time: t('generator.qualityTime.second5') || '~5초', size: 1800 },
  ];

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
      // 저장된 바코드 설정 적용 (편집 모드)
      if (params.initialBarcodeSettings) {
        try {
          const savedSettings = JSON.parse(params.initialBarcodeSettings);
          setBarcodeSettings(prev => ({ ...prev, ...savedSettings }));
        } catch (e) {
          console.warn('Failed to parse barcode settings:', e);
        }
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

    // 저장된 QR 스타일 적용 (편집 모드)
    if (params.initialQrStyle) {
      try {
        const savedStyle = JSON.parse(params.initialQrStyle);
        setQrStyle(prev => ({ ...prev, ...savedStyle }));
      } catch (e) {
        console.warn('Failed to parse QR style:', e);
      }
    }

    // 저장된 프레임 적용 (편집 모드)
    if (params.initialFrameId) {
      const frameIdx = QR_FRAMES.findIndex(f => f.id === params.initialFrameId);
      if (frameIdx !== -1) {
        setFrameIndex(frameIdx);
      }
    }
  }, [params.initialMode, params.initialType, params.initialData, params.initialBarcodeFormat, params.initialBarcodeValue, params.initialQrStyle, params.initialFrameId, params.initialBarcodeSettings]);

  // Load selected location from map picker when screen gets focus
  useFocusEffect(
    useCallback(() => {
      // 화면 조회 추적
      trackScreenView('Generator', 'GeneratorScreen');

      const loadSelectedLocation = async () => {
        try {
          const locationData = await AsyncStorage.getItem('@selected_map_location');
          console.log('[LOCATION DEBUG] 저장된 위치 데이터:', locationData);
          if (locationData) {
            const { latitude, longitude, timestamp } = JSON.parse(locationData);
            // Only use location data if it's recent (within 60 seconds)
            if (timestamp && Date.now() - timestamp < 60000) {
              console.log('[LOCATION DEBUG] 위치 업데이트:', { latitude, longitude });
              setFormData((prev) => ({
                ...prev,
                location: { latitude, longitude },
              }));
            }
            // Clear the stored location
            await AsyncStorage.removeItem('@selected_map_location');
          }
        } catch (error) {
          console.error('Error loading selected location:', error);
        }
      };

      loadSelectedLocation();

      // 커스텀 프리셋 로드
      const loadCustomPresets = async () => {
        try {
          const presets = await getPresets();
          setCustomPresets(presets);
        } catch (error) {
          console.error('Error loading custom presets:', error);
        }
      };
      loadCustomPresets();
    }, [])
  );

  // 커스텀 프리셋 저장 핸들러
  const handleSavePreset = async (presetData) => {
    try {
      const newPreset = await savePreset(presetData);
      setCustomPresets(prev => [newPreset, ...prev]);
    } catch (error) {
      console.error('Error saving preset:', error);
      Alert.alert(t('common.error') || '오류', t('generator.presetSaveError') || '프리셋 저장에 실패했습니다.');
    }
  };

  // 커스텀 프리셋 삭제 핸들러
  const handleDeletePreset = async (presetId) => {
    Alert.alert(
      t('generator.deletePreset') || '프리셋 삭제',
      t('generator.deletePresetConfirm') || '이 프리셋을 삭제하시겠습니까?',
      [
        { text: t('common.cancel') || '취소', style: 'cancel' },
        {
          text: t('common.delete') || '삭제',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePreset(presetId);
            if (success) {
              setCustomPresets(prev => prev.filter(p => p.id !== presetId));
            }
          },
        },
      ]
    );
  };

  // 커스텀 프리셋 선택 핸들러
  const handleSelectPreset = (preset) => {
    setQrStyle(prev => ({ ...prev, ...preset.style }));
    if (preset.frameIndex !== undefined) {
      setFrameIndex(preset.frameIndex);
    }
    if (preset.logoImage) {
      setLogoImage(preset.logoImage);
    }
  };

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
  // 스타일 QR(WebView)을 캡처해야 하는 저장 경로: 프레임이 있거나, 프레임 없이 고해상도로 저장할 때
  const needsOffscreenQr = hasData && (!!selectedFrame || (qrResLevel > 0 && useStyledQR));
  // 내용·스타일이 바뀌면 오프스크린 이미지를 새로 기다린다
  const qrStyleKey = JSON.stringify(qrStyle);
  useEffect(() => {
    offscreenReadyRef.current = false;
  }, [qrData, qrStyleKey, selectedFrame, qrResLevel, frameTextColor]);

  // 바코드 유효성 검사 (간소화 - bwip-js가 실제 검증 수행)
  const hasBarcodeData = barcodeValue.length > 0;

  // 바코드 값은 그대로 사용 (bwip-js가 체크섬 자동 계산)
  const finalBarcodeValue = barcodeValue;

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
      await haptics.tap();
    }

    // QR 타입 잠금 체크 (text는 무료)
    if (isQrTypeLocked(typeId)) {
      const featureId = getQrTypeFeatureId(typeId);
      if (featureId) {
        showUnlockAlert(featureId, () => {
          setSelectedType(typeId);
          // 해제 후 clipboard 타입이면 클립보드 내용 로드
          if (typeId === 'clipboard') {
            loadClipboardContent();
          }
        });
      }
      return;
    }

    setSelectedType(typeId);

    // Load clipboard content if clipboard type is selected
    if (typeId === 'clipboard') {
      loadClipboardContent();
    }
  };

  // 클립보드 내용 로드 헬퍼 함수
  const loadClipboardContent = async () => {
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

  // 바코드 포맷 선택 (bcid 형식)
  const handleBarcodeFormatSelect = async (bcid) => {
    if (hapticEnabled) {
      await haptics.tap();
    }
    setSelectedBarcodeFormat(bcid);
    setBarcodeValue('');  // 값 초기화
    setBarcodeError(null);
  };

  // 바코드 값 변경 (bwip-js가 유효성 검사 담당)
  const handleBarcodeValueChange = (value) => {
    setBarcodeValue(value);
    // 에러는 bwip-js 렌더링 시 onError 콜백으로 설정됨
  };

  // bwip-js 에러 메시지를 번역 키로 변환 (바코드별 상세 매칭)
  const getBwipErrorTranslationKey = useCallback((errorMessage) => {
    if (!errorMessage) return null;

    const msg = errorMessage.toLowerCase();

    // EAN 계열
    if (msg.includes('ean-13') || msg.includes('ean13')) {
      if (msg.includes('check digit')) return 'ean13_checkdigit';
      if (msg.includes('12 or 13') || msg.includes('length')) return 'ean13_length';
      return 'ean13_digits';
    }
    if (msg.includes('ean-8') || msg.includes('ean8')) {
      if (msg.includes('check digit')) return 'ean8_checkdigit';
      if (msg.includes('7 or 8') || msg.includes('length')) return 'ean8_length';
      return 'ean8_digits';
    }
    if (msg.includes('ean-5') || msg.includes('ean5')) {
      if (msg.includes('length')) return 'ean5_length';
      return 'ean5_digits';
    }
    if (msg.includes('ean-2') || msg.includes('ean2')) {
      if (msg.includes('length')) return 'ean2_length';
      return 'ean2_digits';
    }

    // UPC 계열
    if (msg.includes('upc-a') || msg.includes('upca')) {
      if (msg.includes('check digit')) return 'upca_checkdigit';
      if (msg.includes('11 or 12') || msg.includes('length')) return 'upca_length';
      return 'upca_digits';
    }
    if (msg.includes('upc-e') || msg.includes('upce')) {
      if (msg.includes('check digit')) return 'upce_checkdigit';
      if (msg.includes('7 or 8') || msg.includes('length')) return 'upce_length';
      if (msg.includes('cannot be converted') || msg.includes('not compressible')) return 'upce_notcompressible';
      return 'upce_digits';
    }

    // Code 계열
    if (msg.includes('code 93 extended') || msg.includes('code93ext')) {
      return 'code93ext_chars';
    }
    if (msg.includes('code 93') || msg.includes('code93')) {
      return 'code93_chars';
    }
    if (msg.includes('code 39 extended') || msg.includes('code39ext')) {
      return 'code39ext_chars';
    }
    if (msg.includes('code 39') || msg.includes('code39')) {
      return 'code39_chars';
    }
    if (msg.includes('code 128') || msg.includes('code128')) {
      return 'code128_chars';
    }
    if (msg.includes('code 11') || msg.includes('code11')) {
      return 'code11_chars';
    }
    if (msg.includes('code 49') || msg.includes('code49')) {
      if (msg.includes('maximum length') || msg.includes('no valid')) return 'code49_length';
      return 'code49_chars';
    }

    // ITF 계열
    if (msg.includes('itf-14') || msg.includes('itf14')) {
      if (msg.includes('check digit')) return 'itf14_checkdigit';
      if (msg.includes('13 or 14') || msg.includes('length')) return 'itf14_length';
      return 'itf14_digits';
    }
    if (msg.includes('interleaved 2 of 5') || msg.includes('interleaved2of5')) {
      if (msg.includes('even')) return 'itf_even';
      return 'itf_digits';
    }
    if (msg.includes('code 25') || msg.includes('code2of5') || msg.includes('2 of 5')) {
      return 'code2of5_digits';
    }

    // EAN-14
    if (msg.includes('ean-14') || msg.includes('ean14')) {
      if (msg.includes('(01)') || msg.includes('application identifier')) return 'ean14_ai';
      if (msg.includes('13 or 14') || msg.includes('length')) return 'ean14_length';
      return 'ean14_digits';
    }

    // GS1 DataBar 계열
    if (msg.includes('databar limited') || msg.includes('databarlimited')) {
      if (msg.includes('13 or 14') || msg.includes('length')) return 'databarlimited_length';
      return 'databarlimited_digits';
    }
    if (msg.includes('databar omni') || msg.includes('databaromni')) {
      if (msg.includes('13 or 14') || msg.includes('length')) return 'databaromni_length';
      return 'databaromni_digits';
    }
    if (msg.includes('databar stacked omni') || msg.includes('databarstackedomni')) {
      if (msg.includes('(01)') || msg.includes('application identifier')) return 'databarstackedomni_ai';
      return 'databarstackedomni_length';
    }
    if (msg.includes('databar stacked') || msg.includes('databarstacked')) {
      if (msg.includes('13 or 14') || msg.includes('length')) return 'databarstacked_length';
      return 'databarstacked_digits';
    }
    if (msg.includes('databar truncated') || msg.includes('databartruncated')) {
      if (msg.includes('13 or 14') || msg.includes('length')) return 'databartruncated_length';
      return 'databartruncated_digits';
    }
    if (msg.includes('databar expanded') || msg.includes('databarexpanded')) {
      if (msg.includes('(') || msg.includes('ai')) return 'databarexpanded_ai';
      return 'databarexpanded_format';
    }
    if (msg.includes('composite') && msg.includes('pipe')) {
      return 'composite_missing';
    }

    // SSCC-18
    if (msg.includes('sscc-18') || msg.includes('sscc18')) {
      if (msg.includes('17 or 18') || msg.includes('length')) return 'sscc18_length';
      return 'sscc18_digits';
    }

    // Australian Post
    if (msg.includes('auspost')) {
      if (msg.includes('fcc') || msg.includes('11, 45, 59') || msg.includes('62')) return 'auspost_fcc';
      if (msg.includes('too long')) return 'auspost_toolong';
      if (msg.includes('at least 10') || msg.includes('too short')) return 'auspost_tooshort';
      return 'auspost_format';
    }

    // Aztec Rune
    if (msg.includes('aztec rune') || msg.includes('aztecrune')) {
      if (msg.includes('0 to 255') || msg.includes('invalid')) return 'aztecrune_range';
      if (msg.includes('numeric')) return 'aztecrune_numeric';
      return 'aztecrune_format';
    }

    // BC412
    if (msg.includes('bc412')) {
      return 'bc412_chars';
    }

    // Channel Code
    if (msg.includes('channel code') || msg.includes('channelcode')) {
      if (msg.includes('2 to 7') || msg.includes('length')) return 'channelcode_length';
      if (msg.includes('too big') || msg.includes('value')) return 'channelcode_toobig';
      return 'channelcode_digits';
    }

    // Codabar
    if (msg.includes('codabar')) {
      if (msg.includes('at least 2') || msg.includes('length')) return 'codabar_length';
      if (msg.includes('start') && msg.includes('stop')) return 'codabar_startstop';
      if (msg.includes('body')) return 'codabar_body';
      return 'codabar_chars';
    }

    // MSI
    if (msg.includes('msi')) {
      return 'msi_digits';
    }

    // Plessey
    if (msg.includes('plessey')) {
      return 'plessey_chars';
    }

    // Telepen
    if (msg.includes('telepen numeric') || msg.includes('telepennumeric')) {
      if (msg.includes('even length') || msg.includes('odd')) return 'telepennumeric_even';
      return 'telepennumeric_chars';
    }
    if (msg.includes('telepen')) {
      return 'telepen_chars';
    }

    // Pharmacode
    if (msg.includes('two-track pharmacode') || msg.includes('pharmacode2')) {
      if (msg.includes('4') && msg.includes('64570080')) return 'pharmacode2_range';
      if (msg.includes('1 to 6') || msg.includes('length')) return 'pharmacode2_length';
      return 'pharmacode2_digits';
    }
    if (msg.includes('italian pharmacode') || msg.includes('code32') || msg.includes('code 32')) {
      if (msg.includes('check digit')) return 'code32_checkdigit';
      if (msg.includes('8 or 9') || msg.includes('length')) return 'code32_length';
      return 'code32_digits';
    }
    if (msg.includes('pharmacode')) {
      if (msg.includes('3') && msg.includes('131070')) return 'pharmacode_range';
      if (msg.includes('1 to 6') || msg.includes('length')) return 'pharmacode_length';
      return 'pharmacode_digits';
    }

    // PZN
    if (msg.includes('pzn')) {
      if (msg.includes('check digit')) return 'pzn_checkdigit';
      if (msg.includes('6 or 7') || msg.includes('length')) return 'pzn_length';
      return 'pzn_digits';
    }

    // 우편 바코드
    if (msg.includes('postnet')) {
      if (msg.includes('5, 9') || msg.includes('11') || msg.includes('length')) return 'postnet_length';
      return 'postnet_digits';
    }
    if (msg.includes('planet')) {
      if (msg.includes('11') || msg.includes('13') || msg.includes('length')) return 'planet_length';
      return 'planet_digits';
    }
    if (msg.includes('daft')) {
      return 'daft_chars';
    }
    if (msg.includes('identcode')) {
      if (msg.includes('check digit')) return 'identcode_checkdigit';
      if (msg.includes('11 or 12') || msg.includes('length')) return 'identcode_length';
      return 'identcode_digits';
    }
    if (msg.includes('leitcode')) {
      if (msg.includes('check digit')) return 'leitcode_checkdigit';
      if (msg.includes('13 or 14') || msg.includes('length')) return 'leitcode_length';
      return 'leitcode_digits';
    }
    if (msg.includes('japan post') || msg.includes('japanpost')) {
      if (msg.includes('too long')) return 'japanpost_toolong';
      return 'japanpost_chars';
    }
    if (msg.includes('kix')) {
      return 'kix_chars';
    }
    if (msg.includes('royal mail') || msg.includes('royalmail') || msg.includes('rm4scc')) {
      return 'royalmail_chars';
    }
    if (msg.includes('onecode') || msg.includes('usps intelligent mail') || msg.includes('intelligent mail')) {
      if (msg.includes('20, 25, 29') || msg.includes('31') || msg.includes('length')) return 'onecode_length';
      return 'onecode_digits';
    }
    if (msg.includes('mailmark')) {
      if (msg.includes('7, 9') || msg.includes('29') || msg.includes('type')) return 'mailmark_type';
      return 'mailmark_format';
    }

    // ISBN/ISSN/ISMN
    if (msg.includes('isbn')) {
      if (msg.includes('check digit')) return 'isbn_checkdigit';
      if (msg.includes('dashes') || msg.includes('format')) return 'isbn_format';
      return 'isbn_length';
    }
    if (msg.includes('ismn')) {
      if (msg.includes('m-') || msg.includes('prefix')) return 'ismn_prefix';
      return 'ismn_length';
    }
    if (msg.includes('issn')) {
      if (msg.includes('dash') || msg.includes('fifth')) return 'issn_format';
      if (msg.includes('first') || msg.includes('numeral')) return 'issn_numeric';
      return 'issn_length';
    }

    // M&S
    if (msg.includes('m&s') || msg.includes('mands')) {
      return 'mands_length';
    }

    // HIBC 계열
    if (msg.includes('hibc')) {
      return 'hibc_chars';
    }

    // 2D 바코드
    if (msg.includes('datamatrix')) {
      if (msg.includes('maximum length') || msg.includes('no valid') || msg.includes('invalid size')) return 'datamatrix_toolong';
      return 'datamatrix_format';
    }
    if (msg.includes('qrcode') || msg.includes('qr code')) {
      if (msg.includes('maximum length') || msg.includes('no valid')) return 'qrcode_toolong';
      return 'qrcode_format';
    }
    if (msg.includes('micropdf417')) {
      if (msg.includes('maximum length') || msg.includes('no valid')) return 'micropdf417_toolong';
      return 'micropdf417_format';
    }
    if (msg.includes('rmqr') || msg.includes('rectangular micro qr')) {
      if (msg.includes('version')) return 'rmqr_version';
      return 'rmqr_format';
    }

    // Raw
    if (msg.includes('raw')) {
      return 'raw_chars';
    }

    // Symbol
    if (msg.includes('unknown symbol')) {
      return 'symbol_unknown';
    }

    // 공통 에러 패턴
    if (msg.includes('check digit')) {
      return 'badCheckDigit';
    }
    if (msg.includes('too long') || msg.includes('exceeds') || msg.includes('maximum length')) {
      return 'dataTooLong';
    }
    if (msg.includes('too short')) {
      return 'dataTooShort';
    }
    if (msg.includes('even number') || msg.includes('must be even')) {
      return 'mustBeEven';
    }
    if (msg.includes('only digits') || msg.includes('contain only digits')) {
      return 'onlyDigits';
    }
    if (msg.includes('invalid') || msg.includes('bad character')) {
      return 'invalidChar';
    }

    return null; // 매칭되는 패턴 없음
  }, []);

  // bwip-js 바코드 생성 에러 핸들러
  const handleBarcodeError = useCallback((errorMessage) => {
    if (!errorMessage) {
      setBarcodeError(null);
      return;
    }

    // 번역 키 찾기
    const translationKey = getBwipErrorTranslationKey(errorMessage);

    if (translationKey) {
      // 번역된 메시지 사용
      const translatedMsg = t(`generator.barcodeErrors.${translationKey}`);
      setBarcodeError(translatedMsg);
    } else {
      // 번역 키를 찾지 못한 경우, 원본 메시지에서 설명 부분만 추출
      const colonIndex = errorMessage.indexOf(':');
      if (colonIndex > -1) {
        setBarcodeError(errorMessage.substring(colonIndex + 1).trim());
      } else {
        setBarcodeError(errorMessage);
      }
    }
  }, [getBwipErrorTranslationKey, t]);

  // 세그먼트 탭 변경
  const handleCodeModeChange = async (mode) => {
    if (hapticEnabled) {
      await haptics.tap();
    }
    setCodeMode(mode);

    // 탭 변경 시 첫 번째 타입 선택
    if (mode === 'qr' && orderedQrTypes.length > 0) {
      setSelectedType(orderedQrTypes[0].id);
    } else if (mode === 'barcode' && displayedBarcodeTypes.length > 0) {
      setSelectedBarcodeFormat(displayedBarcodeTypes[0].bcid);
    }
  };

  const handleShare = async () => {
    const isBarcode = codeMode === 'barcode';
    const currentHasData = isBarcode ? hasBarcodeData : hasData;

    if (!currentHasData) {
      Alert.alert(t('common.error'), t('generator.emptyText'));
      return;
    }

    if (hapticEnabled) {
      await haptics.impact();
    }

    try {
      let uri;

      if (isBarcode) {
        // 고해상도 바코드 생성 시도
        try {
          const highResData = await generateHighResBarcode({
            bcid: selectedBarcodeFormat,
            text: finalBarcodeValue,
            scale: barcodeSettings.scale,
            height: barcodeSettings.height,
            includetext: barcodeSettings.showText,
            textsize: barcodeSettings.fontSize,
            rotate: barcodeSettings.rotate,
            alttext: barcodeSettings.customText || undefined,
            backgroundcolor: 'ffffff',
            barcolor: '000000',
          });

          // highResData가 이미 file URI인 경우
          if (highResData.startsWith('file:')) {
            uri = highResData;
          } else if (highResData.startsWith('data:')) {
            // base64를 파일로 저장
            const base64Data = highResData.replace(/^data:image\/\w+;base64,/, '');
            const cacheDir = FileSystem.cacheDirectory.endsWith('/')
              ? FileSystem.cacheDirectory
              : FileSystem.cacheDirectory + '/';
            const fileUri = cacheDir + `barcode-share-${Date.now()}.png`;
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            uri = fileUri;
          } else {
            throw new Error('Invalid highResData format');
          }
        } catch (highResError) {
          console.warn('High-res barcode generation failed, falling back to captureRef:', highResError.message);
          if (barcodeRef.current) {
            uri = await captureRef(barcodeRef, {
              format: 'png',
              quality: 1,
            });
          } else {
            throw new Error('Both high-res generation and captureRef failed');
          }
        }
      } else {
        // QR 코드 캡처
        if (needsOffscreenQr) {
          // 프레임 또는 고해상도 스타일 QR: 오프스크린 뷰가 이미지로 바뀐 뒤 캡처
          await waitForOffscreenQr();
          uri = await captureRef(highResQrRef, {
            format: 'png',
            quality: 1,
          });
        } else if (qrResLevel > 0) {
          // 프레임 없이 고해상도
          uri = await captureRef(qrRef, {
            format: 'png',
            quality: 1,
            pixelRatio: QR_RES_LEVELS[qrResLevel].scale,
          });
        } else {
          // 프레임이 없고 빠른 저장 - 기존 방식
          const qrBase64 = fullSizeQRBase64 || capturedQRBase64;
          if (useStyledQR && qrBase64) {
            const base64Data = qrBase64.replace(/^data:image\/\w+;base64,/, '');
            const cacheDir = FileSystem.cacheDirectory.endsWith('/')
              ? FileSystem.cacheDirectory
              : FileSystem.cacheDirectory + '/';
            const fileUri = cacheDir + 'qr-styled-' + Date.now() + '.png';
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            uri = fileUri;
          } else {
            uri = await captureRef(qrRef, {
              format: 'png',
              quality: 1,
            });
          }
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

    // 저장 모달 즉시 표시 (바코드/QR 구분)
    setSaveProgress({ visible: true, progress: 0, message: '', type: isBarcode ? 'barcode' : 'qr' });

    if (hapticEnabled) {
      await haptics.impact();
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        setSaveProgress({ visible: false, progress: 0, message: '' });
        Alert.alert(t('common.error'), 'Permission to access media library is required');
        return;
      }

      let uri;

      if (isBarcode) {
        // 고해상도 레벨에 따라 처리
        if (highResLevel > 0) {
          try {
            const levelConfig = HIGH_RES_LEVELS[highResLevel];
            const highResData = await generateHighResBarcode({
              bcid: selectedBarcodeFormat,
              text: finalBarcodeValue,
              scale: levelConfig.scale,
              height: barcodeSettings.height,
              includetext: barcodeSettings.showText,
              textsize: barcodeSettings.fontSize,
              rotate: barcodeSettings.rotate,
              alttext: barcodeSettings.customText || undefined,
              backgroundcolor: 'ffffff',
              barcolor: '000000',
            });

            if (highResData.startsWith('file:')) {
              uri = highResData;
            } else if (highResData.startsWith('data:')) {
              const base64Data = highResData.replace(/^data:image\/\w+;base64,/, '');
              const cacheDir = FileSystem.cacheDirectory.endsWith('/')
                ? FileSystem.cacheDirectory
                : FileSystem.cacheDirectory + '/';
              const fileUri = cacheDir + `barcode-hires-${Date.now()}.png`;

              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              uri = fileUri;
            } else {
              throw new Error('Invalid highResData format');
            }
          } catch (highResError) {
            setSaveProgress({ visible: false, progress: 0, message: '' });
            throw highResError;
          }
        } else {
          // 빠른 저장 (captureRef 사용)
          if (barcodeRef.current) {
            uri = await captureRef(barcodeRef, {
              format: 'png',
              quality: 1,
            });
          } else {
            throw new Error('Barcode save failed');
          }
        }
      } else {
        // QR 코드 캡처
        if (needsOffscreenQr) {
          // 프레임 또는 고해상도 스타일 QR: 오프스크린 뷰가 이미지로 바뀐 뒤 캡처
          await waitForOffscreenQr();
          uri = await captureRef(highResQrRef, {
            format: 'png',
            quality: 1,
          });
        } else if (qrResLevel > 0) {
          // 프레임 없이 고해상도 - pixelRatio 사용
          uri = await captureRef(qrRef, {
            format: 'png',
            quality: 1,
            pixelRatio: QR_RES_LEVELS[qrResLevel].scale,
          });
        } else {
          // 프레임이 없고 빠른 저장 - 기존 방식
          const qrBase64 = fullSizeQRBase64 || capturedQRBase64;
          if (useStyledQR && qrBase64) {
            const base64Data = qrBase64.replace(/^data:image\/\w+;base64,/, '');
            const cacheDir = FileSystem.cacheDirectory.endsWith('/')
              ? FileSystem.cacheDirectory
              : FileSystem.cacheDirectory + '/';
            const fileUri = cacheDir + 'qr-styled-' + Date.now() + '.png';
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            uri = fileUri;
          } else {
            uri = await captureRef(qrRef, {
              format: 'png',
              quality: 1,
            });
          }
        }
      }

      await MediaLibrary.saveToLibraryAsync(uri);

      // 생성 히스토리에 저장 (썸네일 포함)
      try {
        const codeToSave = isBarcode ? finalBarcodeValue : qrData;
        const result = await saveGeneratedCodeToHistory({
          code: codeToSave,
          type: isBarcode ? selectedBarcodeFormat : 'qr',
          imageUri: uri,
          qrStyle: !isBarcode ? qrStyle : null,
          barcodeSettings: isBarcode ? barcodeSettings : null,
          frameId: !isBarcode && selectedFrame ? selectedFrame.id : null,
        });
        if (!result.success) {
          console.warn('Failed to save to generated history:', result.error);
        }
      } catch (historyError) {
        console.warn('Failed to save to generated history:', historyError);
      }

      // 프로그레스 모달 닫기
      setSaveProgress({ visible: false, progress: 0, message: '' });

      Alert.alert(
        '✓ ' + t('generator.saveSuccess'),
        t('generator.saveSuccessMessage')
      );
    } catch (error) {
      console.error('Error saving code:', error);
      setSaveProgress({ visible: false, progress: 0, message: '' });
      Alert.alert(
        t('generator.saveError'),
        t('generator.saveErrorMessage')
      );
    }
  };

  // 로고 이미지 선택
  const handlePickLogo = async () => {
    if (!ImagePicker) {
      Alert.alert(
        t('generator.featureUnavailable') || '기능 사용 불가',
        t('generator.imagePickerUnavailable') || '이미지 선택 기능을 사용할 수 없습니다. 앱을 다시 빌드해주세요.'
      );
      return;
    }
    try {
      // 이미지 선택
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
        t('common.error'),
        t('generator.logoPickError'),
        [{ text: t('common.confirm') }]
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
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  <MaterialPressable
                    key={sec}
                    style={[
                      s.securityButton,
                      {
                        backgroundColor: data.security === sec ? colors.primarySoft : colors.background,
                        borderColor: data.security === sec ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateFormData('security', sec)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t(`generator.securityTypes.${sec}`)}
                    accessibilityState={{ selected: data.security === sec }}
                  >
                    <Text style={[s.securityText, { color: data.security === sec ? colors.primaryText : colors.textSecondary }]}>
                      {t(`generator.securityTypes.${sec}`)}
                    </Text>
                  </MaterialPressable>
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
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder={t('generator.fields.textPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={data.text}
              onChangeText={(text) => updateFormData('text', text)}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
            <MaterialPressable
              style={[s.mapPickerButton, { backgroundColor: colors.primary }]}
              onPress={async () => {
                if (hapticEnabled) {
                  await haptics.tap();
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
              accessibilityRole="button"
              accessibilityLabel={t('generator.selectFromMap') || 'Select from Map'}
            >
              <Ionicons name="map-outline" size={22} color="#fff" />
              <Text style={s.mapPickerButtonText}>
                {t('generator.selectFromMap') || 'Select from Map'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </MaterialPressable>

            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                {t('generator.fields.latitudeLabel')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
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

  // 미리보기 카드 아래 저장(주) · 공유(보조) 버튼 — QR/바코드 공통
  const actionButtons = (
    <View style={s.buttonRow}>
      <MaterialPressable
        style={[s.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleSaveImage}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('generator.save')}
      >
        <Ionicons name="download-outline" size={18} color="#fff" />
        <Text style={[s.actionButtonText, { color: '#fff', fontWeight: '600' }]} numberOfLines={1}>
          {t('generator.save')}
        </Text>
      </MaterialPressable>

      <MaterialPressable
        style={[s.actionButton, s.actionButtonSecondary, { backgroundColor: colors.raised, borderColor: colors.border }]}
        onPress={handleShare}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('generator.share')}
      >
        <Ionicons name="share-outline" size={18} color={colors.text} />
        <Text style={[s.actionButtonText, { color: colors.text }]} numberOfLines={1}>
          {t('generator.share')}
        </Text>
      </MaterialPressable>
    </View>
  );

  // 미리보기 아래 코드 값 한 줄 (사람이 읽는 값만. WiFi 비밀번호·연락처/일정 원문은 보이지 않게)
  const showQrValueLine = ['website', 'text', 'clipboard', 'phone', 'email', 'location'].includes(selectedType);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 상단 그라데이션 */}
      <LinearGradient
        colors={[
          colors.background,
          colors.background + 'F2',
          colors.background + 'B3',
          colors.background + '4D',
          colors.background + '00',
        ]}
        locations={[0, 0.3, 0.6, 0.85, 1]}
        style={[s.statusBarGradient, { height: statusBarHeight }]}
      />

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: tabBarOverlap + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
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
        <View style={[s.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialPressable
            style={[
              s.segmentButton,
              codeMode === 'qr' && { backgroundColor: colors.text },
            ]}
            onPress={() => handleCodeModeChange('qr')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel={t('generator.qrCode') || 'QR 코드'}
            accessibilityState={{ selected: codeMode === 'qr' }}
          >
            <Ionicons
              name="qr-code-outline"
              size={18}
              color={codeMode === 'qr' ? colors.background : colors.textSecondary}
            />
            <Text style={[
              s.segmentText,
              { color: codeMode === 'qr' ? colors.background : colors.textSecondary, fontWeight: codeMode === 'qr' ? '600' : '500' }
            ]}>
              {t('generator.qrCode') || 'QR 코드'}
            </Text>
          </MaterialPressable>
          <MaterialPressable
            style={[
              s.segmentButton,
              codeMode === 'barcode' && { backgroundColor: colors.text },
            ]}
            onPress={() => {
              if (isLocked('barcodeTab')) {
                showUnlockAlert('barcodeTab', () => handleCodeModeChange('barcode'));
              } else {
                handleCodeModeChange('barcode');
              }
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel={t('generator.barcode') || '바코드'}
            accessibilityState={{ selected: codeMode === 'barcode' }}
          >
            <Ionicons
              name="barcode-outline"
              size={18}
              color={codeMode === 'barcode' ? colors.background : colors.textSecondary}
            />
            <Text style={[
              s.segmentText,
              { color: codeMode === 'barcode' ? colors.background : colors.textSecondary, fontWeight: codeMode === 'barcode' ? '600' : '500' }
            ]}>
              {t('generator.barcode') || '바코드'}
            </Text>
            <LockIcon
              featureId="barcodeTab"
              size={14}
              color={codeMode === 'barcode' ? colors.background : colors.textTertiary}
              style={{ marginLeft: 4 }}
            />
          </MaterialPressable>
        </View>

        {/* QR 코드 모드 */}
        {codeMode === 'qr' && (
          <>
            {/* Type Selector: 3열 격자 (선택 = 연한 파랑 바탕 + 파랑 테두리) */}
            <View style={s.typeGrid}>
              {orderedQrTypes.map((type) => {
                const isTypeLocked = isQrTypeLocked(type.id);
                const qrFeatureId = getQrTypeFeatureId(type.id);
                const hasQrProgress = qrFeatureId ? getAdProgress(qrFeatureId).current > 0 : false;
                const qrLockColor = hasQrProgress ? LIGHT_PINK : HOT_PINK;
                const isTypeSelected = selectedType === type.id;
                return (
                  <MaterialPressable
                    key={type.id}
                    style={[
                      s.typeGridButton,
                      {
                        backgroundColor: isTypeSelected ? colors.primarySoft : colors.surface,
                        borderColor: isTypeSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleTypeSelect(type.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t(`generator.types.${type.id}`)}
                    accessibilityState={{ selected: isTypeSelected }}
                  >
                    <Ionicons
                      name={type.icon}
                      size={16}
                      color={isTypeSelected ? colors.primaryText : colors.textSecondary}
                    />
                    <Text
                      style={[
                        s.typeGridText,
                        { color: isTypeSelected ? colors.primaryText : colors.textSecondary, fontWeight: isTypeSelected ? '600' : '500' },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {t(`generator.types.${type.id}`)}
                    </Text>
                    {isTypeLocked && (
                      <View style={s.typeLockIcon}>
                        <Ionicons name="lock-closed" size={11} color={qrLockColor} />
                      </View>
                    )}
                  </MaterialPressable>
                );
              })}
              {/* 순서 변경 버튼 */}
              <MaterialPressable
                style={[
                  s.typeGridButton,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
                onPress={() => setQrTypeReorderVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('generator.reorder') || '순서'}
              >
                <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
                <Text
                  style={[s.typeGridText, { color: colors.textSecondary, fontWeight: '500' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t('generator.reorder') || '순서'}
                </Text>
              </MaterialPressable>
            </View>

            {/* 배너 광고 - 타입 선택과 정보 입력 사이 */}
            <AdBanner
              wrapperStyle={{
                marginTop: 8,
                marginBottom: 8,
              }}
            />

            {/* Form Section */}
            <View style={[s.formSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.formHeader}>
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.textSecondary}
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
            <View style={s.typeSelectorSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.typesContainerInSection}
              >
              {displayedBarcodeTypes.map((format) => {
                const isSelected = selectedBarcodeFormat === format.bcid;
                return (
                  <MaterialPressable
                    key={format.bcid}
                    style={[
                      s.typeButton,
                      {
                        backgroundColor: isSelected ? colors.primarySoft : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleBarcodeFormatSelect(format.bcid)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={format.name}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[
                      s.typeTextMain,
                      { color: isSelected ? colors.primaryText : colors.text, fontFamily: fonts.semiBold }
                    ]}>
                      {format.name}
                    </Text>
                    <Text style={[
                      s.typeDesc,
                      { color: isSelected ? colors.primaryText : colors.textTertiary, fontFamily: fonts.regular }
                    ]} numberOfLines={1}>
                      {(() => { const desc = t(`barcodeSelection.${format.bcid}Desc`); return desc.includes('.') ? format.description : desc; })()}
                    </Text>
                  </MaterialPressable>
                );
              })}

              {/* 바코드 추가 버튼 */}
              <MaterialPressable
                style={[
                  s.typeButton,
                  s.typeButtonInline,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderStyle: 'dashed',
                  },
                ]}
                onPress={() => setBarcodePickerVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('generator.addBarcode') || '더보기'}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={colors.primaryText}
                />
                <Text style={[s.typeText, { color: colors.primaryText }]}>
                  {t('generator.addBarcode') || '더보기'}
                </Text>
              </MaterialPressable>

              {/* 바코드 순서 변경 버튼 */}
              <MaterialPressable
                style={[
                  s.typeButton,
                  s.typeButtonInline,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
                onPress={() => setBarcodeReorderVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('generator.reorder') || '순서'}
              >
                <Ionicons name="swap-vertical" size={18} color={colors.textSecondary} />
                <Text style={[s.typeText, { color: colors.textSecondary }]}>
                  {t('generator.reorder') || '순서'}
                </Text>
              </MaterialPressable>
              </ScrollView>
            </View>

            {/* 배너 광고 - 바코드 선택과 입력 폼 사이 */}
            <AdBanner
              wrapperStyle={{
                marginTop: 8,
                marginBottom: 8,
              }}
            />

            {/* 바코드 입력 폼 */}
            <View style={[s.formSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.formHeader}>
                <Ionicons
                  name="barcode-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={[s.formTitle, { color: colors.text }]}>
                  {selectedBarcodeInfo.name} - {t('generator.barcodeInput') || '바코드 값 입력'}
                </Text>
              </View>
              <View style={s.formContainer}>
                <View style={s.fieldContainer}>
                  <TextInput
                    key={selectedBarcodeFormat}
                    style={[
                      s.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: barcodeError ? colors.error : colors.border,
                        color: colors.text
                      }
                    ]}
                    placeholder={selectedBarcodeInfo.placeholder || '값을 입력하세요'}
                    placeholderTextColor={colors.textTertiary}
                    value={barcodeValue}
                    onChangeText={handleBarcodeValueChange}
                    keyboardType={['ean13', 'ean8', 'upca', 'itf14', 'msi', 'pharmacode', 'postnet', 'planet'].includes(selectedBarcodeFormat) ? 'numeric' : 'default'}
                    autoCapitalize={['code39', 'code39ext'].includes(selectedBarcodeFormat) ? 'characters' : 'none'}
                    maxLength={selectedBarcodeInfo.fixedLength ? selectedBarcodeInfo.fixedLength + 1 : undefined}
                  />
                  {barcodeError && (
                    <View style={[s.errorContainer, { backgroundColor: colors.errorSoft }]}>
                      <Ionicons name="alert-circle" size={14} color={colors.error} />
                      <Text style={[s.errorTextRed, { color: colors.error }]}>
                        {barcodeError}
                      </Text>
                    </View>
                  )}
                  {/* 바코드 포맷 힌트 */}
                  <View style={s.barcodeHint}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.barcodeHintText, { color: colors.textSecondary }]}>
                      {t(`barcodeSelection.${selectedBarcodeInfo.bcid}Desc`) || selectedBarcodeInfo.description}
                      {selectedBarcodeInfo.fixedLength ? ` (${selectedBarcodeInfo.fixedLength}${t('generator.digits') || '자리'})` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 바코드 스타일 설정 */}
            <View style={[s.formSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialPressable
                style={s.formHeaderCollapsible}
                onPress={() => setBarcodeSettingsExpanded(!barcodeSettingsExpanded)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('generator.barcodeSettings') || '바코드 설정'}
                accessibilityState={{ expanded: barcodeSettingsExpanded }}
              >
                <View style={s.formHeaderLeft}>
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={[s.formTitle, { color: colors.text }]}>
                    {t('generator.barcodeSettings') || '바코드 설정'}
                  </Text>
                </View>
                <Ionicons
                  name={barcodeSettingsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </MaterialPressable>
              {barcodeSettingsExpanded && (
              <View style={s.settingsContainer}>
                {/* 탭 버튼 */}
                <View style={[s.settingsTabContainer, { backgroundColor: colors.background }]}>
                  {[
                    { id: 'size', icon: 'resize-outline', label: t('generator.barcodeSettingsTabs.size') || '크기' },
                    { id: 'display', icon: 'text-outline', label: t('generator.barcodeSettingsTabs.display') || '표시' },
                    { id: 'save', icon: 'save-outline', label: t('generator.barcodeSettingsTabs.save') || '저장' },
                  ].map((tab) => (
                    <MaterialPressable
                      key={tab.id}
                      style={[
                        s.settingsTab,
                        barcodeSettingsTab === tab.id && { backgroundColor: colors.text },
                      ]}
                      onPress={() => setBarcodeSettingsTab(tab.id)}
                      accessibilityRole="tab"
                      accessibilityLabel={tab.label}
                      accessibilityState={{ selected: barcodeSettingsTab === tab.id }}
                    >
                      <Ionicons
                        name={tab.icon}
                        size={16}
                        color={barcodeSettingsTab === tab.id ? colors.background : colors.textSecondary}
                      />
                      <Text style={[
                        s.settingsTabText,
                        { color: barcodeSettingsTab === tab.id ? colors.background : colors.textSecondary }
                      ]}>
                        {tab.label}
                      </Text>
                    </MaterialPressable>
                  ))}
                </View>

                {/* 탭 내용 */}
                <View style={[s.settingGroup, { backgroundColor: colors.background }]}>
                  {/* 크기 탭 */}
                  {barcodeSettingsTab === 'size' && (
                    <>
                      <View style={s.settingItemVertical}>
                        <View style={s.settingLabelRowSpaced}>
                          <View style={s.settingLabelRow}>
                            <Ionicons name="resize-outline" size={18} color={colors.textSecondary} />
                            <Text style={[s.settingLabel, { color: colors.text }]}>
                              {t('generator.barcodeWidth') || '너비'}
                            </Text>
                          </View>
                          <Text style={[s.sliderValue, { color: colors.primaryText }]}>{barcodeSettings.scale}x</Text>
                        </View>
                        <Slider
                          style={s.slider}
                          minimumValue={1}
                          maximumValue={6}
                          step={1}
                          value={barcodeSettings.scale}
                          onValueChange={(val) => setBarcodeSettings((prev) => ({ ...prev, scale: val }))}
                          minimumTrackTintColor={colors.primary}
                          maximumTrackTintColor={colors.border}
                          thumbTintColor={colors.primary}
                        />
                      </View>

                      <View style={[s.settingDivider, { backgroundColor: colors.border }]} />

                      <View style={s.settingItemVertical}>
                        <View style={s.settingLabelRowSpaced}>
                          <View style={s.settingLabelRow}>
                            <Ionicons name="swap-vertical-outline" size={18} color={colors.textSecondary} />
                            <Text style={[s.settingLabel, { color: colors.text }]}>
                              {t('generator.barcodeHeight') || '높이'}
                            </Text>
                          </View>
                          <Text style={[s.sliderValue, { color: colors.primaryText }]}>{barcodeSettings.height}</Text>
                        </View>
                        <Slider
                          style={s.slider}
                          minimumValue={50}
                          maximumValue={150}
                          step={10}
                          value={barcodeSettings.height}
                          onValueChange={(val) => setBarcodeSettings((prev) => ({ ...prev, height: val }))}
                          minimumTrackTintColor={colors.primary}
                          maximumTrackTintColor={colors.border}
                          thumbTintColor={colors.primary}
                        />
                      </View>

                      <View style={[s.settingDivider, { backgroundColor: colors.border }]} />

                      <View style={s.settingItem}>
                        <View style={s.settingLabelRow}>
                          <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                          <Text style={[s.settingLabel, { color: colors.text }]}>
                            {t('generator.barcodeRotate') || '회전'}
                          </Text>
                        </View>
                        <View style={[s.barcodeOptionControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {[
                            { value: 'N', label: '0°' },
                            { value: 'R', label: '90°' },
                            { value: 'I', label: '180°' },
                            { value: 'L', label: '270°' },
                          ].map((item) => (
                            <MaterialPressable
                              key={`rotate-${item.value}`}
                              style={[
                                s.barcodeOptionBtn,
                                barcodeSettings.rotate === item.value && { backgroundColor: colors.text },
                              ]}
                              onPress={() => setBarcodeSettings((prev) => ({ ...prev, rotate: item.value }))}
                              accessibilityRole="button"
                              accessibilityLabel={`${t('generator.barcodeRotate') || '회전'} ${item.label}`}
                              accessibilityState={{ selected: barcodeSettings.rotate === item.value }}
                            >
                              <Text style={[s.barcodeOptionText, { color: barcodeSettings.rotate === item.value ? colors.background : colors.text }]}>
                                {item.label}
                              </Text>
                            </MaterialPressable>
                          ))}
                        </View>
                      </View>
                    </>
                  )}

                  {/* 표시 탭 */}
                  {barcodeSettingsTab === 'display' && (
                    <>
                      <View style={s.settingItem}>
                        <View style={s.settingLabelRow}>
                          <Ionicons name="text-outline" size={18} color={colors.textSecondary} />
                          <Text style={[s.settingLabel, { color: colors.text }]}>
                            {t('generator.barcodeShowText') || '숫자 표시'}
                          </Text>
                        </View>
                        <View style={[s.toggleControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <MaterialPressable
                            style={[
                              s.toggleButton,
                              barcodeSettings.showText && { backgroundColor: colors.text },
                            ]}
                            onPress={() => setBarcodeSettings((prev) => ({ ...prev, showText: true }))}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('generator.barcodeShowText') || '숫자 표시'} ON`}
                            accessibilityState={{ selected: !!barcodeSettings.showText }}
                          >
                            <Text style={[s.toggleText, { color: barcodeSettings.showText ? colors.background : colors.text }]}>ON</Text>
                          </MaterialPressable>
                          <MaterialPressable
                            style={[
                              s.toggleButton,
                              !barcodeSettings.showText && { backgroundColor: colors.text },
                            ]}
                            onPress={() => setBarcodeSettings((prev) => ({ ...prev, showText: false }))}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('generator.barcodeShowText') || '숫자 표시'} OFF`}
                            accessibilityState={{ selected: !barcodeSettings.showText }}
                          >
                            <Text style={[s.toggleText, { color: !barcodeSettings.showText ? colors.background : colors.text }]}>OFF</Text>
                          </MaterialPressable>
                        </View>
                      </View>

                      <View style={[s.settingDivider, { backgroundColor: colors.border }]} />

                      <View style={s.settingItemVertical}>
                        <View style={s.settingLabelRowSpaced}>
                          <View style={s.settingLabelRow}>
                            <Ionicons name="text" size={18} color={colors.textSecondary} />
                            <Text style={[s.settingLabel, { color: colors.text }]}>
                              {t('generator.barcodeFontSize') || '글자 크기'}
                            </Text>
                          </View>
                          <Text style={[s.sliderValue, { color: colors.primaryText }]}>{barcodeSettings.fontSize}</Text>
                        </View>
                        <Slider
                          style={s.slider}
                          minimumValue={10}
                          maximumValue={20}
                          step={1}
                          value={barcodeSettings.fontSize}
                          onValueChange={(val) => setBarcodeSettings((prev) => ({ ...prev, fontSize: val }))}
                          minimumTrackTintColor={colors.primary}
                          maximumTrackTintColor={colors.border}
                          thumbTintColor={colors.primary}
                        />
                      </View>

                      {/* 숫자 표시 OFF일 때만 표시 텍스트 입력 표시 */}
                      {!barcodeSettings.showText && (
                        <>
                          <View style={[s.settingDivider, { backgroundColor: colors.border }]} />
                          <View style={s.settingItemVertical}>
                          <View style={s.settingLabelRow}>
                            <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                            <Text style={[s.settingLabel, { color: colors.text }]}>
                              {t('generator.barcodeCustomText') || '표시 텍스트'}
                            </Text>
                          </View>
                          <TextInput
                            style={[
                              s.customTextInput,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.text,
                                marginTop: 8,
                              }
                            ]}
                            placeholder={t('generator.barcodeCustomTextPlaceholder') || '비워두면 바코드 값 표시'}
                            placeholderTextColor={colors.textTertiary}
                            value={barcodeSettings.customText}
                            onChangeText={(text) => setBarcodeSettings((prev) => ({ ...prev, customText: text }))}
                          />
                        </View>
                        </>
                      )}
                    </>
                  )}

                  {/* 저장 탭 */}
                  {barcodeSettingsTab === 'save' && (
                    <View style={s.settingItemVertical}>
                      <View style={s.settingLabelRowSpaced}>
                        <View style={s.settingLabelRow}>
                          <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                          <Text style={[s.settingLabel, { color: colors.text }]}>
                            {t('generator.saveQuality') || '저장 품질'}
                          </Text>
                        </View>
                        <Text style={[s.sliderValue, { color: colors.primaryText }]}>
                          {HIGH_RES_LEVELS[highResLevel].label}
                        </Text>
                      </View>

                      <View style={[s.qualityLevelContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {HIGH_RES_LEVELS.map((item) => (
                          <MaterialPressable
                            key={`quality-${item.level}`}
                            style={[
                              s.qualityLevelBtn,
                              highResLevel === item.level && { backgroundColor: colors.text },
                            ]}
                            onPress={() => setHighResLevel(item.level)}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('generator.saveQuality') || '저장 품질'} ${item.label}`}
                            accessibilityState={{ selected: highResLevel === item.level }}
                          >
                            <Text style={[
                              s.qualityLevelText,
                              { color: highResLevel === item.level ? colors.background : colors.text }
                            ]}>
                              {item.level === 0 ? (t('generator.qualityLevels.fast') || '빠름') : item.level}
                            </Text>
                          </MaterialPressable>
                        ))}
                      </View>

                      <View style={[s.qualityInfoRow, { backgroundColor: colors.background }]}>
                        <View style={s.qualityInfoItem}>
                          <Ionicons name="document-outline" size={14} color={colors.textSecondary} />
                          <Text style={[s.qualityInfoText, { color: colors.textSecondary }]}>
                            {HIGH_RES_LEVELS[highResLevel].description}
                          </Text>
                        </View>
                        <View style={s.qualityInfoItem}>
                          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                          <Text style={[s.qualityInfoText, { color: colors.textSecondary }]}>
                            {HIGH_RES_LEVELS[highResLevel].time}
                          </Text>
                        </View>
                        {highResLevel > 0 && (
                          <View style={s.qualityInfoItem}>
                            <Ionicons name="resize-outline" size={14} color={colors.textSecondary} />
                            <Text style={[s.qualityInfoText, { color: colors.textSecondary }]}>
                              ~{HIGH_RES_LEVELS[highResLevel].scale * 100}px
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>
              )}
            </View>
          </>
        )}

        {/* QR 스타일 설정 - QR 모드일 때만 */}
        {codeMode === 'qr' && (
          <View style={[s.formSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialPressable
              style={s.formHeaderCollapsible}
              onPress={() => setQrSettingsExpanded(!qrSettingsExpanded)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('generator.qrStyle.title') || 'QR 스타일'}
              accessibilityState={{ expanded: qrSettingsExpanded }}
            >
              <View style={s.formHeaderLeft}>
                <Ionicons
                  name="color-palette-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={[s.formTitle, { color: colors.text }]}>
                  {t('generator.qrStyle.title') || 'QR 스타일'}
                </Text>
              </View>
              <Ionicons
                name={qrSettingsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </MaterialPressable>
            {qrSettingsExpanded && (
            <View style={s.settingsContainer}>
              {/* 탭 버튼 */}
              <View style={[s.qrSettingsTabWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.qrSettingsTabScroll}
                  contentContainerStyle={s.qrSettingsTabScrollContent}
                >
                  {[
                    { id: 'presets', icon: 'color-palette-outline', label: t('generator.qrStyle.presets') || '프리셋' },
                    { id: 'dots', icon: 'grid-outline', label: t('generator.qrStyle.dots') || '도트' },
                    { id: 'corners', icon: 'scan-outline', label: t('generator.qrStyle.corners') || '코너' },
                    { id: 'background', icon: 'image-outline', label: t('generator.qrStyle.background') || '배경' },
                    { id: 'textColor', icon: 'text-outline', label: t('generator.qrStyle.textColor') || '글자' },
                    { id: 'settings', icon: 'settings-outline', label: t('generator.qrStyle.settings') || '설정' },
                  ].map((tab) => (
                    <MaterialPressable
                      key={tab.id}
                      style={[
                        s.qrSettingsTab,
                        qrSettingsTab === tab.id && { backgroundColor: colors.text },
                      ]}
                      onPress={() => setQrSettingsTab(tab.id)}
                      accessibilityRole="tab"
                      accessibilityLabel={tab.label}
                      accessibilityState={{ selected: qrSettingsTab === tab.id }}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={16}
                      color={qrSettingsTab === tab.id ? colors.background : colors.textSecondary}
                    />
                    <Text style={[
                      s.settingsTabText,
                      { color: qrSettingsTab === tab.id ? colors.background : colors.textSecondary }
                    ]}>
                      {tab.label}
                    </Text>
                    </MaterialPressable>
                  ))}
                </ScrollView>
              </View>

              {/* 프리셋 탭 - 커스텀 프리셋 */}
              {qrSettingsTab === 'presets' && (
                <View style={s.customPresetContainer}>
                  {/* 프리셋 저장 버튼 */}
                  <MaterialPressable
                    style={[s.savePresetButton, { backgroundColor: colors.primary }]}
                    onPress={() => setPresetSaveModalVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('generator.saveCurrentAsPreset') || '현재 스타일을 프리셋으로 저장'}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={[s.savePresetButtonText, { fontFamily: fonts.semiBold }]}>
                      {t('generator.saveCurrentAsPreset') || '현재 스타일을 프리셋으로 저장'}
                    </Text>
                  </MaterialPressable>

                  {/* 기본값 + 저장된 프리셋 목록 */}
                  <View style={s.qrStyleGrid}>
                    {/* 기본값 초기화 버튼 */}
                    <MaterialPressable
                      style={[
                        s.qrStyleItem,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                        },
                      ]}
                      onPress={() => setQrStyle(isDark ? {
                        ...QR_STYLE_PRESETS[0].style,
                        dotColor: '#FFFFFF',
                        cornerSquareColor: '#FFFFFF',
                        cornerDotColor: '#FFFFFF',
                        backgroundColor: '#000000',
                      } : QR_STYLE_PRESETS[0].style)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t('generator.a11y.resetStyle')}
                    >
                      <View style={[s.qrStylePreview, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="refresh-outline" size={32} color={colors.textTertiary} />
                      </View>
                      <Text style={[s.qrStyleName, { color: colors.textSecondary }]}>
                        {language === 'ko' ? '기본값' : 'Default'}
                      </Text>
                    </MaterialPressable>

                    {/* 커스텀 프리셋 */}
                    {customPresets.map((preset) => (
                        <MaterialPressable
                          key={preset.id}
                          style={[
                            s.qrStyleItem,
                            {
                              backgroundColor: colors.inputBackground,
                              borderColor: colors.border,
                              borderWidth: 1,
                            },
                          ]}
                          onPress={() => handleSelectPreset(preset)}
                          onLongPress={() => handleDeletePreset(preset.id)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={preset.name}
                          accessibilityHint={t('generator.longPressToDelete') || '길게 누르면 삭제할 수 있습니다'}
                        >
                          <View style={[s.qrStylePreview, { backgroundColor: preset.style?.backgroundColor || '#fff' }]}>
                            <View style={s.presetDotsContainer}>
                              {[...Array(9)].map((_, i) => (
                                <View
                                  key={i}
                                  style={[
                                    s.presetDot,
                                    {
                                      backgroundColor: preset.style?.dotGradient
                                        ? preset.style.dotGradient.colorStops[0].color
                                        : preset.style?.dotColor || '#000',
                                      borderRadius: preset.style?.dotType === 'dots' || preset.style?.dotType === 'rounded' ? 3 : 0,
                                    },
                                  ]}
                                />
                              ))}
                            </View>
                          </View>
                          <Text style={[s.qrStyleName, { color: colors.text }]} numberOfLines={1}>
                            {preset.name}
                          </Text>
                        </MaterialPressable>
                    ))}
                  </View>

                  {customPresets.length > 0 && (
                    <Text style={[s.presetHintText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                      {t('generator.longPressToDelete') || '길게 누르면 삭제할 수 있습니다'}
                    </Text>
                  )}
                </View>
              )}

              {/* 도트 탭 */}
              {qrSettingsTab === 'dots' && (
                <View style={s.qrOptionSection}>
                  <Text style={[s.qrOptionTitle, { color: colors.text }]}>
                    {t('generator.qrStyle.dotType') || '도트 타입'}
                  </Text>
                  <View style={s.qrOptionRow}>
                    {DOT_TYPES.map((type) => (
                      <MaterialPressable
                        key={type}
                        style={[
                          s.qrOptionButton,
                          {
                            backgroundColor: qrStyle.dotType === type ? colors.primarySoft : colors.inputBackground,
                            borderColor: qrStyle.dotType === type ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, dotType: type }))}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.dotType') || '도트 타입'} ${type}`}
                        accessibilityState={{ selected: qrStyle.dotType === type }}
                      >
                        <Text style={[s.qrOptionText, { color: qrStyle.dotType === type ? colors.primaryText : colors.text }]}>
                          {type}
                        </Text>
                      </MaterialPressable>
                    ))}
                  </View>

                  <Text style={[s.qrOptionTitle, { color: colors.text, marginTop: 16 }]}>
                    {t('generator.qrStyle.dotColor') || '도트 색상'}
                  </Text>
                  <View style={s.colorGrid}>
                    {/* 컬러 피커 버튼 */}
                    <MaterialPressable
                      style={[s.colorPickerButton, { backgroundColor: qrStyle.dotColor || '#000000', borderColor: colors.border }]}
                      onPress={() => setActiveColorPicker('dotColor')}
                      activeOpacity={0.7}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('generator.qrStyle.dotColor') || '도트 색상'} - ${t('generator.a11y.customColor')}`}
                    >
                      <Ionicons name="color-palette" size={20} color={(qrStyle.dotColor === '#FFFFFF' || qrStyle.dotColor === '#ffffff') ? '#333' : '#fff'} />
                    </MaterialPressable>
                    {COLOR_PRESETS.map((presetColor) => (
                      <MaterialPressable
                        key={presetColor}
                        style={[
                          s.colorButton,
                          {
                            backgroundColor: presetColor,
                            borderColor: qrStyle.dotColor === presetColor ? colors.primary : colors.border,
                            borderWidth: qrStyle.dotColor === presetColor ? 3 : 1,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, dotColor: presetColor, dotGradient: null }))}
                        activeOpacity={0.7}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.dotColor') || '도트 색상'} ${presetColor}`}
                        accessibilityState={{ selected: qrStyle.dotColor === presetColor }}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 코너 탭 */}
              {qrSettingsTab === 'corners' && (
                <View style={s.qrOptionSection}>
                  <Text style={[s.qrOptionTitle, { color: colors.text }]}>
                    {t('generator.qrStyle.cornerSquareType') || '코너 스퀘어 타입'}
                  </Text>
                  <View style={s.qrOptionRow}>
                    {CORNER_SQUARE_TYPES.map((type) => (
                      <MaterialPressable
                        key={type}
                        style={[
                          s.qrOptionButton,
                          {
                            backgroundColor: qrStyle.cornerSquareType === type ? colors.primarySoft : colors.inputBackground,
                            borderColor: qrStyle.cornerSquareType === type ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, cornerSquareType: type }))}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.cornerSquareType') || '코너 스퀘어 타입'} ${type}`}
                        accessibilityState={{ selected: qrStyle.cornerSquareType === type }}
                      >
                        <Text style={[s.qrOptionText, { color: qrStyle.cornerSquareType === type ? colors.primaryText : colors.text }]}>
                          {type}
                        </Text>
                      </MaterialPressable>
                    ))}
                  </View>

                  <Text style={[s.qrOptionTitle, { color: colors.text, marginTop: 16 }]}>
                    {t('generator.qrStyle.cornerSquareColor') || '코너 스퀘어 색상'}
                  </Text>
                  <View style={s.colorGrid}>
                    {/* 컬러 피커 버튼 */}
                    <MaterialPressable
                      style={[s.colorPickerButton, { backgroundColor: qrStyle.cornerSquareColor || '#000000', borderColor: colors.border }]}
                      onPress={() => setActiveColorPicker('cornerSquareColor')}
                      activeOpacity={0.7}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('generator.qrStyle.cornerSquareColor') || '코너 스퀘어 색상'} - ${t('generator.a11y.customColor')}`}
                    >
                      <Ionicons name="color-palette" size={20} color={(qrStyle.cornerSquareColor === '#FFFFFF' || qrStyle.cornerSquareColor === '#ffffff') ? '#333' : '#fff'} />
                    </MaterialPressable>
                    {COLOR_PRESETS.slice(0, 10).map((presetColor) => (
                      <MaterialPressable
                        key={`cs-${presetColor}`}
                        style={[
                          s.colorButton,
                          {
                            backgroundColor: presetColor,
                            borderColor: qrStyle.cornerSquareColor === presetColor ? colors.primary : colors.border,
                            borderWidth: qrStyle.cornerSquareColor === presetColor ? 3 : 1,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, cornerSquareColor: presetColor }))}
                        activeOpacity={0.7}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.cornerSquareColor') || '코너 스퀘어 색상'} ${presetColor}`}
                        accessibilityState={{ selected: qrStyle.cornerSquareColor === presetColor }}
                      />
                    ))}
                  </View>

                  <Text style={[s.qrOptionTitle, { color: colors.text, marginTop: 16 }]}>
                    {t('generator.qrStyle.cornerDotType') || '코너 도트 타입'}
                  </Text>
                  <View style={s.qrOptionRow}>
                    {CORNER_DOT_TYPES.map((type) => (
                      <MaterialPressable
                        key={type}
                        style={[
                          s.qrOptionButton,
                          {
                            backgroundColor: qrStyle.cornerDotType === type ? colors.primarySoft : colors.inputBackground,
                            borderColor: qrStyle.cornerDotType === type ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, cornerDotType: type }))}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.cornerDotType') || '코너 도트 타입'} ${type}`}
                        accessibilityState={{ selected: qrStyle.cornerDotType === type }}
                      >
                        <Text style={[s.qrOptionText, { color: qrStyle.cornerDotType === type ? colors.primaryText : colors.text }]}>
                          {type}
                        </Text>
                      </MaterialPressable>
                    ))}
                  </View>

                  <Text style={[s.qrOptionTitle, { color: colors.text, marginTop: 16 }]}>
                    {t('generator.qrStyle.cornerDotColor') || '코너 도트 색상'}
                  </Text>
                  <View style={s.colorGrid}>
                    {/* 컬러 피커 버튼 */}
                    <MaterialPressable
                      style={[s.colorPickerButton, { backgroundColor: qrStyle.cornerDotColor || '#000000', borderColor: colors.border }]}
                      onPress={() => setActiveColorPicker('cornerDotColor')}
                      activeOpacity={0.7}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('generator.qrStyle.cornerDotColor') || '코너 도트 색상'} - ${t('generator.a11y.customColor')}`}
                    >
                      <Ionicons name="color-palette" size={20} color={(qrStyle.cornerDotColor === '#FFFFFF' || qrStyle.cornerDotColor === '#ffffff') ? '#333' : '#fff'} />
                    </MaterialPressable>
                    {COLOR_PRESETS.slice(0, 10).map((presetColor) => (
                      <MaterialPressable
                        key={`cd-${presetColor}`}
                        style={[
                          s.colorButton,
                          {
                            backgroundColor: presetColor,
                            borderColor: qrStyle.cornerDotColor === presetColor ? colors.primary : colors.border,
                            borderWidth: qrStyle.cornerDotColor === presetColor ? 3 : 1,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, cornerDotColor: presetColor }))}
                        activeOpacity={0.7}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.cornerDotColor') || '코너 도트 색상'} ${presetColor}`}
                        accessibilityState={{ selected: qrStyle.cornerDotColor === presetColor }}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 배경 탭 */}
              {qrSettingsTab === 'background' && (
                <View style={s.qrOptionSection}>
                  <Text style={[s.qrOptionTitle, { color: colors.text }]}>
                    {t('generator.qrStyle.backgroundColor') || '배경 색상'}
                  </Text>
                  <View style={s.colorGrid}>
                    {/* 컬러 피커 버튼 */}
                    <MaterialPressable
                      style={[s.colorPickerButton, { backgroundColor: qrStyle.backgroundColor || '#ffffff', borderColor: colors.border }]}
                      onPress={() => setActiveColorPicker('backgroundColor')}
                      activeOpacity={0.7}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('generator.qrStyle.backgroundColor') || '배경 색상'} - ${t('generator.a11y.customColor')}`}
                    >
                      <Ionicons name="color-palette" size={20} color={(qrStyle.backgroundColor === '#FFFFFF' || qrStyle.backgroundColor === '#ffffff' || !qrStyle.backgroundColor) ? '#333' : '#fff'} />
                    </MaterialPressable>
                    {COLOR_PRESETS.map((presetColor) => (
                      <MaterialPressable
                        key={presetColor}
                        style={[
                          s.colorButton,
                          {
                            backgroundColor: presetColor,
                            borderColor: qrStyle.backgroundColor === presetColor ? colors.primary : colors.border,
                            borderWidth: qrStyle.backgroundColor === presetColor ? 3 : 1,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, backgroundColor: presetColor }))}
                        activeOpacity={0.7}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.backgroundColor') || '배경 색상'} ${presetColor}`}
                        accessibilityState={{ selected: qrStyle.backgroundColor === presetColor }}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 글자 색상 탭 */}
              {qrSettingsTab === 'textColor' && (
                <View style={s.qrOptionSection}>
                  <Text style={[s.qrOptionTitle, { color: colors.text }]}>
                    {t('generator.qrStyle.frameTextColor') || '프레임 글자 색상'}
                  </Text>
                  <Text style={[s.qrOptionSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
                    {t('generator.qrStyle.frameTextColorDesc') || '프레임의 "Scan me!" 텍스트 색상을 설정합니다'}
                  </Text>
                  <View style={s.colorGrid}>
                    {/* 자동 버튼 */}
                    <MaterialPressable
                      style={[
                        s.colorButton,
                        {
                          backgroundColor: colors.surface,
                          borderColor: frameTextColor === null ? colors.primary : colors.border,
                          borderWidth: frameTextColor === null ? 3 : 1,
                          justifyContent: 'center',
                          alignItems: 'center',
                        },
                      ]}
                      onPress={() => setFrameTextColor(null)}
                      activeOpacity={0.7}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('generator.qrStyle.frameTextColor') || '프레임 글자 색상'} ${t('generator.a11y.autoColor')}`}
                      accessibilityState={{ selected: frameTextColor === null }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>AUTO</Text>
                    </MaterialPressable>
                    {/* 컬러 피커 버튼 */}
                    <MaterialPressable
                      style={[s.colorPickerButton, { backgroundColor: frameTextColor || '#000000', borderColor: colors.border }]}
                      onPress={() => setActiveColorPicker('frameTextColor')}
                      activeOpacity={0.7}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('generator.qrStyle.frameTextColor') || '프레임 글자 색상'} - ${t('generator.a11y.customColor')}`}
                    >
                      <Ionicons name="color-palette" size={20} color={frameTextColor === '#ffffff' || frameTextColor === '#FFFFFF' ? '#333' : '#fff'} />
                    </MaterialPressable>
                    {/* 프리셋 색상 */}
                    {['#000000', '#ffffff', '#333333', '#666666', '#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff', '#9900ff'].map((presetColor) => (
                      <MaterialPressable
                        key={presetColor}
                        style={[
                          s.colorButton,
                          {
                            backgroundColor: presetColor,
                            borderColor: frameTextColor === presetColor ? colors.primary : colors.border,
                            borderWidth: frameTextColor === presetColor ? 3 : 1,
                          },
                        ]}
                        onPress={() => setFrameTextColor(presetColor)}
                        activeOpacity={0.7}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.frameTextColor') || '프레임 글자 색상'} ${presetColor}`}
                        accessibilityState={{ selected: frameTextColor === presetColor }}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 설정 탭 */}
              {qrSettingsTab === 'settings' && (
                <View style={s.qrOptionSection}>
                  <Text style={[s.qrOptionTitle, { color: colors.text }]}>
                    {t('generator.qrStyle.errorCorrection') || '오류 수정'}
                  </Text>
                  <View style={s.qrOptionRow}>
                    {['L', 'M', 'Q', 'H'].map((level) => (
                      <MaterialPressable
                        key={level}
                        style={[
                          s.qrOptionButton,
                          {
                            backgroundColor: (qrStyle.errorCorrectionLevel || 'M') === level ? colors.primarySoft : colors.inputBackground,
                            borderColor: (qrStyle.errorCorrectionLevel || 'M') === level ? colors.primary : colors.border,
                            flex: 1,
                          },
                        ]}
                        onPress={() => setQrStyle(prev => ({ ...prev, errorCorrectionLevel: level }))}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.qrStyle.errorCorrection') || '오류 수정'} ${level}`}
                        accessibilityState={{ selected: (qrStyle.errorCorrectionLevel || 'M') === level }}
                      >
                        <Text style={[s.qrOptionText, { color: (qrStyle.errorCorrectionLevel || 'M') === level ? colors.primaryText : colors.text }]}>
                          {level}
                        </Text>
                        <Text style={[s.qrOptionSubtext, { color: (qrStyle.errorCorrectionLevel || 'M') === level ? colors.primaryText : colors.textTertiary }]}>
                          {level === 'L' ? '7%' : level === 'M' ? '15%' : level === 'Q' ? '25%' : '30%'}
                        </Text>
                      </MaterialPressable>
                    ))}
                  </View>

                  {/* 저장 품질 설정 */}
                  <Text style={[s.qrOptionTitle, { color: colors.text, marginTop: 16 }]}>
                    {t('generator.saveQuality') || '저장 품질'}
                  </Text>
                  <View style={s.qrOptionRow}>
                    {QR_RES_LEVELS.map((item) => (
                      <MaterialPressable
                        key={item.level}
                        style={[
                          s.qrOptionButton,
                          {
                            backgroundColor: qrResLevel === item.level ? colors.primarySoft : colors.inputBackground,
                            borderColor: qrResLevel === item.level ? colors.primary : colors.border,
                            flex: 1,
                          },
                        ]}
                        onPress={() => setQrResLevel(item.level)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('generator.saveQuality') || '저장 품질'} ${item.label}`}
                        accessibilityState={{ selected: qrResLevel === item.level }}
                      >
                        <Text style={[s.qrOptionText, { color: qrResLevel === item.level ? colors.primaryText : colors.text }]}>
                          {item.label}
                        </Text>
                        <Text style={[s.qrOptionSubtext, { color: qrResLevel === item.level ? colors.primaryText : colors.textTertiary }]}>
                          {item.time}
                        </Text>
                      </MaterialPressable>
                    ))}
                  </View>
                  <Text style={[s.qrSettingHint, { color: colors.textTertiary }]}>
                    {QR_RES_LEVELS[qrResLevel].description} (~{QR_RES_LEVELS[qrResLevel].size}px)
                  </Text>
                </View>
              )}
            </View>
            )}
          </View>
        )}

        {/* QR Code Preview - QR 모드일 때만 */}
        {codeMode === 'qr' && (
          <View style={[s.qrSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.qrTitle, { color: colors.textSecondary }]}>
              {t('generator.qrPreview')}
            </Text>

            <View style={s.qrContainer}>
              {hasData ? (
                <>
                  <FlatList
                    ref={frameCarouselRef}
                    data={QR_FRAMES}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    onMomentumScrollEnd={(e) => {
                      const itemWidth = SCREEN_WIDTH - 96;
                      const newIndex = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
                      setFrameIndex(newIndex);
                    }}
                    renderItem={({ item: frame, index }) => {
                      const isCurrentFrame = index === frameIndex;
                      const frameObj = frame.id === 'none' ? null : frame;
                      const itemWidth = SCREEN_WIDTH - 96;
                      return (
                        <View style={[s.carouselItem, { width: itemWidth }]}>
                          <Animated.View
                            ref={isCurrentFrame ? qrRef : null}
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
                            {frameObj ? (
                              <View style={s.frameContainer}>
                                <QRFrameRenderer
                                  frame={frameObj}
                                  qrValue={qrData}
                                  qrStyle={qrStyle}
                                  size={220}
                                  frameTextColor={frameTextColor}
                                  isDark={isDark}
                                  onCapture={isCurrentFrame ? (base64) => setCapturedQRBase64(base64) : undefined}
                                />
                              </View>
                            ) : (
                              <View style={[s.qrBackgroundPlain, { backgroundColor: useStyledQR ? (qrStyle.backgroundColor || '#fff') : '#fff' }]}>
                                {useStyledQR ? (
                                  <StyledQRCode
                                    value={qrData}
                                    size={200}
                                    qrStyle={{ ...qrStyle, width: undefined, height: undefined }}
                                    onCapture={isCurrentFrame ? (base64) => setCapturedQRBase64(base64) : undefined}
                                  />
                                ) : (
                                  <QRCode
                                    value={qrData}
                                    size={200}
                                    backgroundColor="white"
                                    color="black"
                                  />
                                )}
                              </View>
                            )}
                          </Animated.View>
                        </View>
                      );
                    }}
                  />
                  {/* 프레임 이름 및 도트 인디케이터 */}
                  <View style={s.carouselIndicator}>
                    <Text style={[s.carouselFrameName, { color: colors.text }]}>
                      {language === 'ko' ? QR_FRAMES[frameIndex]?.nameKo : QR_FRAMES[frameIndex]?.name}
                    </Text>
                    <View style={s.dotContainer}>
                      {QR_FRAMES.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            s.dot,
                            {
                              backgroundColor: index === frameIndex ? colors.primary : colors.border,
                              width: index === frameIndex ? 16 : 6,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </>
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

            {hasData && showQrValueLine && (
              <Text style={[s.valueLine, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">
                {qrData}
              </Text>
            )}
            {hasData && actionButtons}

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
          </View>
        )}

        {/* Barcode Preview - 바코드 모드일 때만 */}
        {codeMode === 'barcode' && (
          <View style={[s.qrSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.qrTitle, { color: colors.textSecondary }]}>
              {t('generator.barcodePreview') || '바코드 미리보기'}
            </Text>

            <View style={[s.qrContainer, s.barcodePreviewContainer]}>
              {hasBarcodeData ? (
                <Animated.View
                  ref={barcodeRef}
                  style={[
                    s.barcodePreviewWrapper,
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
                      width={barcodeSettings.scale}
                      height={barcodeSettings.height}
                      displayValue={barcodeSettings.showText}
                      fontSize={barcodeSettings.fontSize}
                      background="#ffffff"
                      lineColor="#000000"
                      margin={4}
                      maxWidth={280}
                      rotate={barcodeSettings.rotate}
                      alttext={barcodeSettings.customText}
                      onError={handleBarcodeError}
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
            {hasBarcodeData && actionButtons}
          </View>
        )}
      </ScrollView>

      {/* 고해상도 저장 프로그레스 모달 */}
      <Modal
        visible={saveProgress.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}} // 저장 중에는 뒤로가기로 닫지 않는다 (Android 필수 prop)
      >
        <View style={s.progressModalOverlay}>
          <View style={[s.progressModalContent, { backgroundColor: colors.surface }]}>
            {/* 스핀 애니메이션 바코드 아이콘 */}
            <Animated.View
              style={[
                s.progressIconContainer,
                {
                  backgroundColor: colors.primarySoft,
                  transform: [{
                    rotate: spinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  }],
                },
              ]}
            >
              <Ionicons name={saveProgress.type === 'barcode' ? 'barcode-outline' : 'qr-code-outline'} size={40} color={colors.primaryText} />
            </Animated.View>
            <Text style={[s.progressTitle, { color: colors.text }]}>
              {saveProgress.type === 'barcode' ? t('generator.savingBarcode') : t('generator.savingQRCode')}
            </Text>
            <Text style={[s.progressMessage, { color: colors.textSecondary }]}>
              {saveProgress.message || t('generator.pleaseWait')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* QR 타입 순서 변경 모달 */}
      <Modal
        visible={qrTypeReorderVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQrTypeReorderVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, maxHeight: '80%', paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : insets.bottom + 24 }]}>
            {IS_ANDROID && <View style={[s.sheetHandle, { backgroundColor: colors.textTertiary }]} />}
            {/* 모달 헤더 */}
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  {t('generator.reorderTypes') || 'QR 타입 순서 변경'}
                </Text>
                <Text style={[s.modalSubtitle, { color: colors.textSecondary }]}>
                  {t('generator.reorderTypesDesc') || '드래그하여 순서를 변경하세요'}
                </Text>
              </View>
              <MaterialPressable
                style={[s.modalCloseButton, { backgroundColor: colors.background }]}
                onPress={() => setQrTypeReorderVisible(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </MaterialPressable>
            </View>

            {/* 드래그 리스트 */}
            <GestureHandlerRootView style={{ flex: 1 }}>
              <DraggableFlatList
                data={orderedQrTypes}
                onDragEnd={handleQrTypeReorder}
                keyExtractor={(item) => item.id}
                renderItem={({ item, drag, isActive }) => (
                  <ScaleDecorator>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onLongPress={drag}
                      disabled={isActive}
                      accessibilityRole="button"
                      accessibilityLabel={t(`generator.types.${item.id}`)}
                      accessibilityHint={t('generator.reorderTypesDesc') || '드래그하여 순서를 변경하세요'}
                      style={[
                        s.reorderItem,
                        { backgroundColor: isActive ? colors.primarySoft : colors.background },
                        isActive && { shadowOpacity: 0.3, elevation: 8 }
                      ]}
                    >
                      <TouchableOpacity
                        onPressIn={drag}
                        style={s.dragHandle}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t(`generator.types.${item.id}`)} - ${t('generator.reorder') || '순서'}`}
                      >
                        <Ionicons name="menu" size={22} color={colors.textTertiary} />
                      </TouchableOpacity>
                      <View style={[s.reorderItemIcon, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name={item.icon} size={20} color={colors.primaryText} />
                      </View>
                      <Text style={[s.reorderItemText, { color: colors.text }]}>
                        {t(`generator.types.${item.id}`)}
                      </Text>
                    </TouchableOpacity>
                  </ScaleDecorator>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            </GestureHandlerRootView>
          </View>
        </View>
      </Modal>

      {/* 바코드 타입 순서 변경 모달 */}
      <Modal
        visible={barcodeReorderVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBarcodeReorderVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, maxHeight: '80%', paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : insets.bottom + 24 }]}>
            {IS_ANDROID && <View style={[s.sheetHandle, { backgroundColor: colors.textTertiary }]} />}
            {/* 모달 헤더 */}
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  {t('generator.reorderBarcodeTypes') || '바코드 타입 순서 변경'}
                </Text>
                <Text style={[s.modalSubtitle, { color: colors.textSecondary }]}>
                  {t('generator.reorderTypesDesc') || '드래그하여 순서를 변경하세요'}
                </Text>
              </View>
              <MaterialPressable
                style={[s.modalCloseButton, { backgroundColor: colors.background }]}
                onPress={() => setBarcodeReorderVisible(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </MaterialPressable>
            </View>

            {/* 드래그 리스트 */}
            <GestureHandlerRootView style={{ flex: 1 }}>
              <DraggableFlatList
                data={displayedBarcodeTypes}
                onDragEnd={handleBarcodeTypeReorder}
                keyExtractor={(item) => item.bcid}
                renderItem={({ item, drag, isActive }) => {
                  const catInfo = BARCODE_CATEGORIES[item.category] || {};
                  return (
                    <ScaleDecorator>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={drag}
                        disabled={isActive}
                        accessibilityRole="button"
                        accessibilityLabel={item.name}
                        accessibilityHint={t('generator.reorderTypesDesc') || '드래그하여 순서를 변경하세요'}
                        style={[
                          s.reorderItem,
                          { backgroundColor: isActive ? colors.primarySoft : colors.background },
                          isActive && { shadowOpacity: 0.3, elevation: 8 }
                        ]}
                      >
                        <TouchableOpacity
                          onPressIn={drag}
                          style={s.dragHandle}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} - ${t('generator.reorder') || '순서'}`}
                        >
                          <Ionicons name="menu" size={22} color={colors.textTertiary} />
                        </TouchableOpacity>
                        <LinearGradient
                          colors={catInfo.gradient || ['#667eea', '#764ba2']}
                          style={s.reorderItemIcon}
                        >
                          <Ionicons name={catInfo.icon || 'barcode-outline'} size={18} color="#fff" />
                        </LinearGradient>
                        <Text style={[s.reorderItemText, { color: colors.text }]}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    </ScaleDecorator>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            </GestureHandlerRootView>
          </View>
        </View>
      </Modal>

      {/* 바코드 타입 선택 모달 (110종 전체) */}
      <Modal
        visible={barcodePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setBarcodeSearchQuery('');
          setBarcodePickerVisible(false);
        }}
        onShow={() => {
          console.log('Modal opened - ALL_BWIP_BARCODES count:', ALL_BWIP_BARCODES?.length);
          console.log('Modal opened - groupedBarcodes keys:', Object.keys(groupedBarcodes));
          console.log('Modal opened - filteredBarcodes count:', filteredBarcodes?.length);
        }}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : insets.bottom + 24 }]}>
            {IS_ANDROID && <View style={[s.sheetHandle, { backgroundColor: colors.textTertiary }]} />}
            {/* 모달 헤더 */}
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalTitle, { color: colors.text }]}>
                  {t('generator.selectBarcodeType') || '바코드 타입 선택'}
                </Text>
                <Text style={[s.modalSubtitle, { color: colors.textSecondary }]}>
                  {t('generator.barcodeCount', { count: ALL_BWIP_BARCODES.length }) || `${ALL_BWIP_BARCODES.length}종 지원`}
                </Text>
              </View>
              <MaterialPressable
                style={[s.modalCloseButton, { backgroundColor: colors.background }]}
                onPress={() => {
                  setBarcodeSearchQuery('');
                  setBarcodePickerVisible(false);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </MaterialPressable>
            </View>

            {/* 검색 인풋 */}
            <View style={s.searchContainer}>
              <View style={[s.searchInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  placeholder={t('generator.searchBarcode') || '바코드 검색 (이름, 설명)'}
                  placeholderTextColor={colors.textTertiary}
                  value={barcodeSearchQuery}
                  onChangeText={setBarcodeSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {barcodeSearchQuery.length > 0 && (
                  <MaterialPressable
                    onPress={() => setBarcodeSearchQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel={t('history.clearSearch')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </MaterialPressable>
                )}
              </View>
              {barcodeSearchQuery && (
                <Text style={[s.searchResultCount, { color: colors.textSecondary }]}>
                  {t('generator.searchResults', { count: filteredBarcodes.length }) || `${filteredBarcodes.length}개 결과`}
                </Text>
              )}
            </View>

            {/* 설명 텍스트 */}
            <Text style={[s.modalDescription, { color: colors.textSecondary }]}>
              {t('generator.barcodePickerDescription') || '체크하면 바코드 목록에 추가됩니다'}
            </Text>

            {/* 바코드 타입 목록 */}
            <ScrollView
              style={s.modalScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* 카테고리별 그룹화 */}
              {Object.keys(groupedBarcodes).length === 0 ? (
                <View style={s.emptySearchResult}>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                  <Text style={[s.emptySearchText, { color: colors.textSecondary }]}>
                    {t('generator.noSearchResults') || '검색 결과가 없습니다'}
                  </Text>
                </View>
              ) : (
                Object.entries(groupedBarcodes).map(([category, barcodes]) => {
                  const catInfo = BARCODE_CATEGORIES[category] || {};
                  return (
                    <View key={category} style={s.categorySection}>
                      <View style={s.categoryHeaderNoIcon}>
                        <Text style={[s.categoryTitleMain, { color: colors.text, fontFamily: fonts.semiBold }]}>
                          {t(`generator.barcodeCategories.${category}`) || catInfo.name || category}
                        </Text>
                        <Text style={[s.categoryCount, { color: colors.textSecondary }]}>
                          {barcodes.length}
                        </Text>
                      </View>
                      <View style={s.categoryGrid}>
                        {barcodes.map((format) => {
                          const isDefault = DEFAULT_BARCODE_BCIDS.includes(format.bcid);
                          const isFavorite = favoriteBarcodes.includes(format.bcid);
                          const isHiddenDefault = hiddenDefaults.includes(format.bcid);
                          const isChecked = (isDefault && !isHiddenDefault) || isFavorite;
                          const isSelected = selectedBarcodeFormat === format.bcid;
                          const isBarcodeLocked = isBarcodeTypeLocked(format.bcid);
                          const barcodeFeatureId = getBarcodeFeatureId(format.bcid);
                          const hasBarcodeProgress = barcodeFeatureId ? getAdProgress(barcodeFeatureId).current > 0 : false;
                          const barcodeLockColor = hasBarcodeProgress ? LIGHT_PINK : HOT_PINK;

                          return (
                            <MaterialPressable
                              key={format.bcid}
                              style={[
                                s.modalBarcodeItem,
                                {
                                  backgroundColor: isSelected ? colors.primary : colors.background,
                                  borderColor: isSelected ? colors.primary : isChecked ? colors.success : colors.border,
                                },
                              ]}
                              onPress={() => {
                                if (isBarcodeLocked) {
                                  const featureId = getBarcodeFeatureId(format.bcid);
                                  if (featureId) {
                                    showUnlockAlert(featureId, () => handleSelectBarcodeFromModal(format.bcid));
                                  }
                                } else {
                                  handleSelectBarcodeFromModal(format.bcid);
                                }
                              }}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityLabel={format.name}
                              accessibilityState={{ selected: isSelected }}
                            >
                              {/* 잠금 아이콘 또는 체크박스 - 오른쪽 상단 (둘 중 하나만 표시) */}
                              {isBarcodeLocked ? (
                                <View style={s.barcodeLockIcon}>
                                  <Ionicons name="lock-closed" size={12} color={barcodeLockColor} />
                                </View>
                              ) : (
                                <MaterialPressable
                                  style={s.barcodeCheckbox}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    toggleFavoriteBarcode(format.bcid);
                                  }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  accessibilityRole="switch"
                                  accessibilityLabel={`${format.name} - ${t('generator.a11y.showInList')}`}
                                  accessibilityState={{ checked: isChecked }}
                                >
                                  <Ionicons
                                    name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={isChecked ? colors.success : colors.textTertiary}
                                  />
                                </MaterialPressable>
                              )}

                              <View style={s.modalBarcodeTextContainer}>
                                <Text style={[
                                  s.modalBarcodeTitleMain,
                                  { color: isSelected ? '#fff' : isBarcodeLocked ? colors.textTertiary : colors.text, fontFamily: fonts.semiBold }
                                ]} numberOfLines={1}>
                                  {format.name}
                                </Text>
                                <Text style={[
                                  s.modalBarcodeDescSmall,
                                  { color: isSelected ? 'rgba(255,255,255,0.7)' : colors.textSecondary, fontFamily: fonts.regular }
                                ]} numberOfLines={2}>
                                  {(() => { const desc = t(`barcodeSelection.${format.bcid}Desc`); return desc.includes('.') ? format.description : desc; })()}
                                </Text>
                              </View>
                            </MaterialPressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 오프스크린 저장용 뷰 (isDark=false로 저장).
          스타일 QR은 WebView라 실기기 Android에서 캡처에 안 잡혀(프레임만 저장됐다) 결과 이미지를 덮어 그린다 */}
      {needsOffscreenQr && (
        <View
          ref={highResQrRef}
          collapsable={false}
          style={s.offscreenContainer}
        >
          <QRFrameRenderer
            frame={selectedFrame || null}
            qrValue={qrData}
            qrStyle={qrStyle}
            size={qrResLevel > 0 ? QR_RES_LEVELS[qrResLevel].size : 280}
            frameTextColor={frameTextColor}
            isDark={false}
            // 캡처 결과(크기 × 화면 밀도)와 같은 해상도로 그리되, WebView 캔버스 한도(약 4096px)를 넘지 않게
            renderScale={Math.min(PixelRatio.get(), 4096 / (qrResLevel > 0 ? QR_RES_LEVELS[qrResLevel].size : 280))}
            snapshotAsImage
            onCapture={() => { offscreenReadyRef.current = true; }}
          />
        </View>
      )}

      {/* 컬러 피커 모달 */}
      <NativeColorPicker
        visible={!!activeColorPicker}
        onClose={() => setActiveColorPicker(null)}
        color={activeColorPicker === 'frameTextColor'
          ? (frameTextColor || '#000000')
          : activeColorPicker === 'backgroundColor'
            ? (qrStyle.backgroundColor || '#ffffff')
            : (activeColorPicker ? (qrStyle[activeColorPicker] || '#000000') : '#000000')
        }
        onColorChange={(newColor) => {
          if (activeColorPicker === 'frameTextColor') {
            setFrameTextColor(newColor);
          } else if (activeColorPicker) {
            setQrStyle(prev => ({ ...prev, [activeColorPicker]: newColor }));
          }
        }}
        colors={colors}
      />

      {/* 프리셋 저장 모달 */}
      <PresetSaveModal
        visible={presetSaveModalVisible}
        onClose={() => setPresetSaveModalVisible(false)}
        onSave={handleSavePreset}
        qrStyle={qrStyle}
        frameIndex={frameIndex}
        logoImage={logoImage}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  offscreenContainer: {
    position: 'absolute',
    left: -10000,
    top: 0,
    backgroundColor: 'white',
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
    paddingBottom: 120, // 실제 값은 탭바 높이 기준으로 인라인에서 덮어쓴다
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: SPACE.section,
  },
  title: {
    ...TYPE.tabTitle,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  // 세그먼트 탭: 표면 + 1px 테두리, 선택 칸은 글자색으로 채움
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACE.screen,
    marginBottom: SPACE.section,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control - 4,
    gap: 6,
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 14,
  },
  // 바코드 관련 스타일
  barcodeContainer: {
    minHeight: 160,
  },
  barcodePreviewContainer: {
    minHeight: 80,
    overflow: 'hidden',
    padding: 8,
  },
  barcodePreviewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  barcodeBackground: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.badge,
  },
  errorTextRed: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  // 바코드 설정 스타일
  settingsContainer: {
    gap: 12,
    marginTop: 16,
  },
  settingGroup: {
    borderRadius: RADIUS.control,
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingItemVertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  settingLabelRowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingHint: {
    fontSize: 11,
    marginTop: 2,
  },
  qualityLevelContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    borderWidth: 1,
    padding: 3,
    gap: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  qualityLevelBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.control - 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityLevelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  qualityInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.badge,
    marginTop: 8,
  },
  qualityInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qualityInfoText: {
    fontSize: 12,
  },
  settingsTabContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  settingsTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: RADIUS.control - 4,
    overflow: 'hidden',
  },
  settingsTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  settingDivider: {
    height: 1,
    marginVertical: 14,
    opacity: 0.5,
  },
  barcodeOptionScroll: {
    flexGrow: 0,
  },
  barcodeOptionScrollFull: {
    marginHorizontal: -4,
  },
  barcodeOptionScrollContent: {
    paddingHorizontal: 4,
  },
  barcodeOptionControl: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  barcodeOptionControlCompact: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  barcodeOptionBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control - 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  barcodeOptionBtnCompact: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  barcodeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleControl: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  toggleButton: {
    minHeight: 40,
    paddingHorizontal: 20,
    borderRadius: RADIUS.control - 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  customTextInput: {
    borderWidth: 1,
    borderRadius: RADIUS.control,
    height: SIZE.input,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 15,
    marginTop: 10,
  },
  typesScroll: {
    maxHeight: 110,
    marginBottom: 20,
  },
  reorderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: RADIUS.control,
  },
  reorderItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reorderItemText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  dragHandle: {
    padding: 8,
    marginRight: 8,
  },
  typesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 10,
  },
  // 바코드 포맷 가로 목록의 칩 (이름 + 짧은 설명)
  typeButton: {
    minHeight: SIZE.rowWithDesc - 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 88,
    overflow: 'hidden',
  },
  // 바코드 목록의 더보기·순서 버튼: 아이콘 + 글자 한 줄
  typeButtonInline: {
    flexDirection: 'row',
    gap: 6,
  },
  // QR 유형 3열 격자
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.gap,
    marginHorizontal: SPACE.screen,
    marginBottom: SPACE.section,
  },
  typeGridButton: {
    width: TYPE_GRID_ITEM_WIDTH,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  typeGridText: {
    fontSize: 14,
    flexShrink: 1,
  },
  typeLockIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  barcodeLockIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
  barcodeCheckbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeDesc: {
    fontSize: 11,
  },
  typeTextMain: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  typeSelectorSection: {
    marginBottom: SPACE.section,
  },
  typesContainerInSection: {
    paddingHorizontal: SPACE.screen,
    gap: SPACE.gap,
  },
  // 카드: 표면 + 1px 테두리, 그림자 없음
  formSection: {
    marginHorizontal: SPACE.screen,
    borderRadius: RADIUS.group,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: SPACE.section,
    overflow: 'hidden',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  formHeaderCollapsible: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: SIZE.touch,
  },
  formHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  formContainer: {
    gap: 12,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    ...TYPE.sectionHeader,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.control,
    height: SIZE.input,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    minHeight: 112,
  },
  securityContainer: {
    flexDirection: 'row',
    gap: SPACE.gap,
  },
  securityButton: {
    flex: 1,
    height: SIZE.input,
    paddingHorizontal: 8,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  securityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 미리보기 카드 (가로 여백 16 + 안쪽 20 + qrContainer 12 = 양쪽 48 → 캐러셀 칸 너비 SCREEN_WIDTH - 96)
  qrSection: {
    marginHorizontal: SPACE.screen,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACE.card,
    marginBottom: SPACE.section,
  },
  qrTitle: {
    ...TYPE.sectionHeader,
    marginBottom: 8,
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
  // QR 스타일 설정 인라인 스타일
  qrSettingsTabScroll: {
  },
  qrSettingsTabScrollContent: {
    gap: 8,
  },
  qrSettingsTabWrapper: {
    borderRadius: RADIUS.control,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
  },
  qrSettingsTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control - 4,
    overflow: 'hidden',
  },
  qrSettingHint: {
    fontSize: 12,
    marginTop: 8,
  },
  qrStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  qrStyleItem: {
    width: '30%',
    borderRadius: RADIUS.control,
    padding: 10,
    alignItems: 'center',
    position: 'relative',
  },
  qrStylePreview: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.badge,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  // 커스텀 프리셋 스타일
  customPresetContainer: {
    paddingBottom: 8,
  },
  savePresetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: SIZE.button,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.control,
    marginBottom: 16,
    overflow: 'hidden',
  },
  savePresetButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  emptyPresetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyPresetText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyPresetSubText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  presetHintText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  // 프레임 가로 스크롤 스타일
  frameScrollContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  frameSelectItem: {
    width: 72,
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    position: 'relative',
  },
  frameSelectPreview: {
    width: 60,
    height: 78,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  frameSelectName: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  frameWithQrPreview: {
    position: 'relative',
  },
  framePreviewSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  frameQrIcon: {
    position: 'absolute',
  },
  qrStyleName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  qrStyleCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  framePlaceholder: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetDotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  presetDot: {
    width: 10,
    height: 10,
  },
  qrOptionSection: {
    gap: 8,
  },
  qrOptionTitle: {
    ...TYPE.sectionHeader,
    marginBottom: 4,
  },
  qrOptionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  qrOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qrOptionButton: {
    minHeight: SIZE.touch,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  qrOptionSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    ...(IS_ANDROID && { overflow: 'hidden' }),
  },
  colorPickerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...(IS_ANDROID && { overflow: 'hidden' }),
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...(IS_ANDROID && { overflow: 'hidden' }),
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  qrContainer: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    overflow: 'visible',
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  carouselIndicator: {
    alignItems: 'center',
    paddingBottom: 8,
    gap: 8,
  },
  carouselFrameName: {
    fontSize: 14,
    fontWeight: '600',
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  frameContainer: {
    padding: 4,
    backgroundColor: 'transparent',
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
    position: 'relative',
  },
  qrBackgroundPlain: {
    backgroundColor: 'white',
    padding: 16,
  },
  frameIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frameIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
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
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    ...TYPE.screenTitle,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  // 미리보기 아래 코드 값 (고정폭)
  valueLine: {
    fontFamily: MONO,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.gap,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: SIZE.button,
    paddingHorizontal: 16,
    borderRadius: RADIUS.control,
    gap: 10,
    marginBottom: 4,
    overflow: 'hidden',
  },
  mapPickerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  // 바코드 타입 선택 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    marginTop: 12,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '80%',
    ...(IS_ANDROID && { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }),
  },
  // 프로그레스 모달 스타일
  progressModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressModalContent: {
    borderRadius: RADIUS.group,
    padding: 30,
    alignItems: 'center',
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  modalCloseButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_ANDROID && { overflow: 'hidden' }),
  },
  // 검색 관련 스타일
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.control,
    minHeight: SIZE.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchResultCount: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
  emptySearchResult: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptySearchText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalDescription: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  categoryHeaderNoIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryTitleMain: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalBarcodeItem: {
    width: (SCREEN_WIDTH - 64) / 2,
    padding: 16,
    borderRadius: RADIUS.control,
    borderWidth: 1.5,
    alignItems: 'center',
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  modalIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalBarcodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalBarcodeDesc: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  modalBarcodeTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  modalBarcodeTitleMain: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalBarcodeDescSmall: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
});
