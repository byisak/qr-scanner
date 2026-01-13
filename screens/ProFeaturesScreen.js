// screens/ProFeaturesScreen.js - 기능별 광고 해제 페이지
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { LOCKED_FEATURES } from '../config/lockedFeatures';

// 기능 카테고리별 정리
const FEATURE_CATEGORIES = {
  settings: {
    titleKey: 'proFeatures.settingsFeatures',
    features: [
      { id: 'batchScan', icon: 'layers-outline', color: '#007AFF' },
      { id: 'realtimeSync', icon: 'sync-outline', color: '#34C759' },
      { id: 'scanUrlIntegration', icon: 'link-outline', color: '#FF9500' },
      { id: 'productSearch', icon: 'search-outline', color: '#5856D6' },
      { id: 'photoSave', icon: 'camera-outline', color: '#FF3B30' },
      { id: 'lotteryScan', icon: 'ticket-outline', color: '#f39c12' },
    ],
  },
  generator: {
    titleKey: 'proFeatures.generatorFeatures',
    features: [],
  },
  qrTypes: {
    titleKey: 'proFeatures.qrTypes',
    features: [
      { id: 'qrTypeWebsite', icon: 'globe-outline', color: '#667eea', typeName: '웹사이트' },
      { id: 'qrTypeContact', icon: 'person-outline', color: '#f5576c', typeName: '연락처' },
      { id: 'qrTypeWifi', icon: 'wifi-outline', color: '#4facfe', typeName: 'WiFi' },
      { id: 'qrTypeClipboard', icon: 'clipboard-outline', color: '#fa709a', typeName: '클립보드' },
      { id: 'qrTypeEmail', icon: 'mail-outline', color: '#30cfd0', typeName: '이메일' },
      { id: 'qrTypeSms', icon: 'chatbubble-outline', color: '#a8edea', typeName: 'SMS' },
      { id: 'qrTypePhone', icon: 'call-outline', color: '#ff9a9e', typeName: '전화' },
      { id: 'qrTypeEvent', icon: 'calendar-outline', color: '#fcb69f', typeName: '일정' },
      { id: 'qrTypeLocation', icon: 'location-outline', color: '#ff6e7f', typeName: '위치' },
    ],
  },
  barcodeTypes: {
    titleKey: 'proFeatures.barcodeTypes',
    features: [
      // 1D Industrial/Logistics
      { id: 'barcodeCode39', icon: 'barcode-outline', color: '#667eea', barcodeName: 'Code 39' },
      { id: 'barcodeCode39ext', icon: 'barcode-outline', color: '#764ba2', barcodeName: 'Code 39 Ext' },
      { id: 'barcodeCode93', icon: 'barcode-outline', color: '#5856D6', barcodeName: 'Code 93' },
      { id: 'barcodeCode93ext', icon: 'barcode-outline', color: '#AF52DE', barcodeName: 'Code 93 Ext' },
      { id: 'barcodeCode11', icon: 'barcode-outline', color: '#007AFF', barcodeName: 'Code 11' },
      { id: 'barcodeIndustrial2of5', icon: 'barcode-outline', color: '#34C759', barcodeName: 'Industrial 2/5' },
      { id: 'barcodeInterleaved2of5', icon: 'barcode-outline', color: '#30D158', barcodeName: 'Interleaved 2/5' },
      { id: 'barcodeItf14', icon: 'barcode-outline', color: '#FF9500', barcodeName: 'ITF-14' },
      { id: 'barcodeMatrix2of5', icon: 'barcode-outline', color: '#FF9F0A', barcodeName: 'Matrix 2/5' },
      { id: 'barcodeCoop2of5', icon: 'barcode-outline', color: '#FFD60A', barcodeName: 'COOP 2/5' },
      { id: 'barcodeIata2of5', icon: 'barcode-outline', color: '#BF5AF2', barcodeName: 'IATA 2/5' },
      { id: 'barcodeDatalogic2of5', icon: 'barcode-outline', color: '#FF375F', barcodeName: 'Datalogic 2/5' },
      // Retail
      { id: 'barcodeEan13', icon: 'barcode-outline', color: '#FF3B30', barcodeName: 'EAN-13' },
      { id: 'barcodeEan8', icon: 'barcode-outline', color: '#FF6B6B', barcodeName: 'EAN-8' },
      { id: 'barcodeEan5', icon: 'barcode-outline', color: '#FF8C69', barcodeName: 'EAN-5' },
      { id: 'barcodeEan2', icon: 'barcode-outline', color: '#FFA07A', barcodeName: 'EAN-2' },
      { id: 'barcodeUpca', icon: 'barcode-outline', color: '#FF7F50', barcodeName: 'UPC-A' },
      { id: 'barcodeUpce', icon: 'barcode-outline', color: '#FF6347', barcodeName: 'UPC-E' },
      { id: 'barcodeIsbn', icon: 'barcode-outline', color: '#32CD32', barcodeName: 'ISBN' },
      { id: 'barcodeIsmn', icon: 'barcode-outline', color: '#3CB371', barcodeName: 'ISMN' },
      { id: 'barcodeIssn', icon: 'barcode-outline', color: '#2E8B57', barcodeName: 'ISSN' },
      { id: 'barcodeEan13composite', icon: 'barcode-outline', color: '#228B22', barcodeName: 'EAN-13 Comp' },
      { id: 'barcodeEan8composite', icon: 'barcode-outline', color: '#006400', barcodeName: 'EAN-8 Comp' },
      { id: 'barcodeUpcacomposite', icon: 'barcode-outline', color: '#008B8B', barcodeName: 'UPC-A Comp' },
      { id: 'barcodeUpcecomposite', icon: 'barcode-outline', color: '#20B2AA', barcodeName: 'UPC-E Comp' },
      // GS1/Logistics
      { id: 'barcodeGs1128', icon: 'barcode-outline', color: '#4169E1', barcodeName: 'GS1-128' },
      { id: 'barcodeGs1cc', icon: 'barcode-outline', color: '#6495ED', barcodeName: 'GS1 Composite' },
      { id: 'barcodeGs1databar', icon: 'barcode-outline', color: '#87CEEB', barcodeName: 'GS1 DataBar' },
      { id: 'barcodeGs1databarstacked', icon: 'barcode-outline', color: '#00CED1', barcodeName: 'GS1 DB Stack' },
      { id: 'barcodeGs1databarstackedomni', icon: 'barcode-outline', color: '#40E0D0', barcodeName: 'GS1 DB Omni' },
      { id: 'barcodeGs1databartruncated', icon: 'barcode-outline', color: '#48D1CC', barcodeName: 'GS1 DB Trunc' },
      { id: 'barcodeGs1databarlimited', icon: 'barcode-outline', color: '#00FFFF', barcodeName: 'GS1 DB Limit' },
      { id: 'barcodeGs1databarexpanded', icon: 'barcode-outline', color: '#00BFFF', barcodeName: 'GS1 DB Exp' },
      { id: 'barcodeGs1databarexpandedstacked', icon: 'barcode-outline', color: '#1E90FF', barcodeName: 'GS1 DB Exp St' },
      { id: 'barcodeGs1northamericancoupon', icon: 'barcode-outline', color: '#4682B4', barcodeName: 'GS1 Coupon' },
      { id: 'barcodeGs1qrcode', icon: 'qr-code-outline', color: '#5F9EA0', barcodeName: 'GS1 QR' },
      { id: 'barcodeGs1dotcode', icon: 'ellipsis-horizontal', color: '#708090', barcodeName: 'GS1 DotCode' },
      { id: 'barcodeSscc18', icon: 'barcode-outline', color: '#778899', barcodeName: 'SSCC-18' },
      { id: 'barcodeEan14', icon: 'barcode-outline', color: '#B0C4DE', barcodeName: 'EAN-14' },
      // Medical/Pharmaceutical
      { id: 'barcodePharmacode', icon: 'medkit-outline', color: '#DC143C', barcodeName: 'Pharmacode' },
      { id: 'barcodePharmacode2', icon: 'medkit-outline', color: '#B22222', barcodeName: 'Pharmacode 2' },
      { id: 'barcodeCode32', icon: 'medkit-outline', color: '#CD5C5C', barcodeName: 'Code 32' },
      { id: 'barcodePzn', icon: 'medkit-outline', color: '#F08080', barcodeName: 'PZN' },
      { id: 'barcodeHibc39', icon: 'medkit-outline', color: '#E9967A', barcodeName: 'HIBC 39' },
      { id: 'barcodeHibc128', icon: 'medkit-outline', color: '#FA8072', barcodeName: 'HIBC 128' },
      { id: 'barcodeHibcdatamatrix', icon: 'grid-outline', color: '#FFA500', barcodeName: 'HIBC DM' },
      { id: 'barcodeHibcpdf417', icon: 'list-outline', color: '#FF8C00', barcodeName: 'HIBC PDF417' },
      { id: 'barcodeHibcqrcode', icon: 'qr-code-outline', color: '#FF7F00', barcodeName: 'HIBC QR' },
      { id: 'barcodeHibcazteccode', icon: 'apps-outline', color: '#FF6600', barcodeName: 'HIBC Aztec' },
      { id: 'barcodeHibccodablockf', icon: 'reorder-four-outline', color: '#FF4500', barcodeName: 'HIBC CodaBlk' },
      { id: 'barcodeHibcmicropdf417', icon: 'list-outline', color: '#FF0000', barcodeName: 'HIBC MicroPDF' },
      // Library/Special
      { id: 'barcodeCodabar', icon: 'barcode-outline', color: '#8B0000', barcodeName: 'Codabar' },
      { id: 'barcodeBc412', icon: 'barcode-outline', color: '#A52A2A', barcodeName: 'BC412' },
      { id: 'barcodeMsi', icon: 'barcode-outline', color: '#D2691E', barcodeName: 'MSI' },
      { id: 'barcodePlessey', icon: 'barcode-outline', color: '#CD853F', barcodeName: 'Plessey' },
      { id: 'barcodeTelepen', icon: 'barcode-outline', color: '#DEB887', barcodeName: 'Telepen' },
      { id: 'barcodeTelepennumeric', icon: 'barcode-outline', color: '#F5DEB3', barcodeName: 'Telepen Num' },
      { id: 'barcodeChannelcode', icon: 'barcode-outline', color: '#FFE4B5', barcodeName: 'Channel' },
      { id: 'barcodePosicode', icon: 'barcode-outline', color: '#FFDAB9', barcodeName: 'PosiCode' },
      // Postal
      { id: 'barcodePostnet', icon: 'mail-outline', color: '#9370DB', barcodeName: 'POSTNET' },
      { id: 'barcodePlanet', icon: 'mail-outline', color: '#8A2BE2', barcodeName: 'PLANET' },
      { id: 'barcodeUspsintellligentmail', icon: 'mail-outline', color: '#9932CC', barcodeName: 'USPS IM' },
      { id: 'barcodeOnecode', icon: 'mail-outline', color: '#BA55D3', barcodeName: 'OneCode' },
      { id: 'barcodeRoyalmail', icon: 'mail-outline', color: '#DA70D6', barcodeName: 'Royal Mail' },
      { id: 'barcodeKix', icon: 'mail-outline', color: '#EE82EE', barcodeName: 'KIX' },
      { id: 'barcodeJapanpost', icon: 'mail-outline', color: '#FF00FF', barcodeName: 'Japan Post' },
      { id: 'barcodeAuspost', icon: 'mail-outline', color: '#FF69B4', barcodeName: 'Australia Post' },
      { id: 'barcodeDeutschepost', icon: 'mail-outline', color: '#FF1493', barcodeName: 'Deutsche Post' },
      { id: 'barcodeDeutschepostidentcode', icon: 'mail-outline', color: '#C71585', barcodeName: 'DP Identcode' },
      { id: 'barcodeCepnet', icon: 'mail-outline', color: '#DB7093', barcodeName: 'CEPNet' },
      { id: 'barcodeFlattermarken', icon: 'mail-outline', color: '#FFC0CB', barcodeName: 'Flattermarken' },
      { id: 'barcodeLeitcode', icon: 'mail-outline', color: '#FFB6C1', barcodeName: 'Leitcode' },
      { id: 'barcodeIdentcode', icon: 'mail-outline', color: '#FF69B4', barcodeName: 'Identcode' },
      // 2D Barcodes
      { id: 'barcodeQrcode', icon: 'qr-code-outline', color: '#2F4F4F', barcodeName: 'QR Code' },
      { id: 'barcodeMicroqrcode', icon: 'qr-code-outline', color: '#696969', barcodeName: 'Micro QR' },
      { id: 'barcodeRectangularmicroqrcode', icon: 'qr-code-outline', color: '#808080', barcodeName: 'Rect Micro QR' },
      { id: 'barcodeDatamatrix', icon: 'grid-outline', color: '#00C7BE', barcodeName: 'Data Matrix' },
      { id: 'barcodeDatamatrixrectangular', icon: 'grid-outline', color: '#00B4AB', barcodeName: 'DM Rect' },
      { id: 'barcodeDatamatrixrectangularextension', icon: 'grid-outline', color: '#00A198', barcodeName: 'DM Rect Ext' },
      { id: 'barcodePdf417', icon: 'list-outline', color: '#191970', barcodeName: 'PDF417' },
      { id: 'barcodePdf417compact', icon: 'list-outline', color: '#000080', barcodeName: 'PDF417 Compact' },
      { id: 'barcodeMicropdf417', icon: 'list-outline', color: '#00008B', barcodeName: 'MicroPDF417' },
      { id: 'barcodeAzteccode', icon: 'apps-outline', color: '#0000CD', barcodeName: 'Aztec Code' },
      { id: 'barcodeAzteccodecompact', icon: 'apps-outline', color: '#0000FF', barcodeName: 'Aztec Compact' },
      { id: 'barcodeAztecrune', icon: 'apps-outline', color: '#4169E1', barcodeName: 'Aztec Runes' },
      { id: 'barcodeMaxicode', icon: 'hexagon-outline', color: '#6A5ACD', barcodeName: 'MaxiCode' },
      { id: 'barcodeDotcode', icon: 'ellipsis-horizontal', color: '#7B68EE', barcodeName: 'DotCode' },
      { id: 'barcodeHanxin', icon: 'qr-code-outline', color: '#9400D3', barcodeName: 'Han Xin' },
      { id: 'barcodeCodeone', icon: 'grid-outline', color: '#8B008B', barcodeName: 'Code One' },
      { id: 'barcodeUltracode', icon: 'qr-code-outline', color: '#800080', barcodeName: 'Ultracode' },
      // Stacked
      { id: 'barcodeCodablockf', icon: 'reorder-four-outline', color: '#556B2F', barcodeName: 'Codablock F' },
      { id: 'barcodeCode16k', icon: 'reorder-four-outline', color: '#6B8E23', barcodeName: 'Code 16K' },
      { id: 'barcodeCode49', icon: 'reorder-four-outline', color: '#808000', barcodeName: 'Code 49' },
      // Automotive
      { id: 'barcodeVin', icon: 'car-outline', color: '#8B4513', barcodeName: 'VIN' },
    ],
  },
  backup: {
    titleKey: 'proFeatures.backupFeatures',
    features: [
      { id: 'icloudBackup', icon: 'cloud-outline', color: '#007AFF' },
      { id: 'googleDriveBackup', icon: 'logo-google', color: '#4285F4' },
    ],
  },
};

export default function ProFeaturesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const {
    isLocked,
    getAdProgress,
    showUnlockAlert,
    showQrStyleUnlockAlert,
    isAdLoaded,
    isAdLoading,
  } = useFeatureLock();

  // 개별 기능 클릭 처리
  const handleFeaturePress = (featureId) => {
    if (!isLocked(featureId)) {
      Alert.alert(
        t('common.notice') || '알림',
        t('proFeatures.alreadyUnlocked') || '이미 해제된 기능입니다.'
      );
      return;
    }
    showUnlockAlert(featureId);
  };

  // QR 스타일 클릭 처리 (모든 스타일 한번에 해제)
  const handleQrStylePress = (featureId) => {
    if (!isLocked(featureId)) {
      Alert.alert(
        t('common.notice') || '알림',
        t('proFeatures.alreadyUnlocked') || '이미 해제된 기능입니다.'
      );
      return;
    }
    showQrStyleUnlockAlert();
  };

  // 진행률 뱃지 렌더링
  const renderProgressBadge = (featureId, isUnlocked) => {
    if (isUnlocked) {
      return (
        <View style={[s.checkBadge, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      );
    }

    const { current, required } = getAdProgress(featureId);
    const hasProgress = current > 0;

    return (
      <View style={[
        s.progressBadge,
        { backgroundColor: hasProgress ? colors.primary : (isDark ? '#333' : '#E5E5EA') }
      ]}>
        <Text style={[
          s.progressText,
          { color: hasProgress ? '#fff' : colors.text, fontFamily: fonts.semiBold }
        ]}>
          {hasProgress ? `${current}/${required}` : required}
        </Text>
      </View>
    );
  };

  // 기능 아이템 렌더링
  const renderFeatureItem = (feature, onPress) => {
    const featureConfig = LOCKED_FEATURES[feature.id];
    if (!featureConfig) return null;

    const unlocked = !isLocked(feature.id);

    return (
      <TouchableOpacity
        key={feature.id}
        style={[
          s.featureItem,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
          unlocked && { borderColor: colors.success, borderWidth: 2 }
        ]}
        onPress={() => onPress(feature.id)}
        activeOpacity={0.7}
      >
        <View style={[s.featureIconContainer, { backgroundColor: `${feature.color}15` }]}>
          <Ionicons name={feature.icon} size={24} color={feature.color} />
        </View>
        <Text style={[s.featureName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={2}>
          {feature.barcodeName || feature.styleName || feature.typeName || t(`proFeatures.features.${feature.id}`) || feature.id}
        </Text>
        {renderProgressBadge(feature.id, unlocked)}
      </TouchableOpacity>
    );
  };

  const handleRemoveAds = () => {
    Alert.alert(
      t('proFeatures.removeAds'),
      t('proFeatures.removeAdsDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proVersion.upgrade'),
          onPress: () => {
            router.push('/pro-version');
          }
        },
      ]
    );
  };

  // 전체 잠금 상태 계산
  const getTotalProgress = () => {
    const allFeatures = Object.keys(LOCKED_FEATURES);
    const unlockedCount = allFeatures.filter(id => !isLocked(id)).length;
    return { unlocked: unlockedCount, total: allFeatures.length };
  };

  const progress = getTotalProgress();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('proFeatures.title') || '기능 잠금 해제'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* 전체 진행률 표시 */}
        <View style={[s.progressCard, { backgroundColor: colors.surface }]}>
          <View style={s.progressHeader}>
            <Ionicons name="lock-open-outline" size={24} color={colors.primary} />
            <Text style={[s.progressTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('proFeatures.unlockProgress') || '해제 진행률'}
            </Text>
          </View>
          <View style={s.progressBarContainer}>
            <View
              style={[
                s.progressBar,
                {
                  backgroundColor: colors.primary,
                  width: `${(progress.unlocked / progress.total) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[s.progressText2, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
            {progress.unlocked} / {progress.total} {t('proFeatures.featuresUnlocked') || '기능 해제됨'}
          </Text>
          {/* 광고 로딩 상태 표시 */}
          <View style={s.adStatusRow}>
            <Ionicons
              name={isAdLoaded ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={isAdLoaded ? colors.success : colors.textSecondary}
            />
            <Text style={[s.adStatusText, { color: isAdLoaded ? colors.success : colors.textSecondary, fontFamily: fonts.regular }]}>
              {isAdLoaded
                ? (t('proFeatures.adReady') || '광고 준비됨')
                : isAdLoading
                  ? (t('proFeatures.adLoading') || '광고 로딩 중...')
                  : (t('proFeatures.adNotLoaded') || '광고 로딩 대기')}
            </Text>
          </View>
        </View>

        {/* 설정 기능 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.settingsFeatures') || '설정 기능'}
          </Text>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.settings.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* QR 타입 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('proFeatures.qrTypes') || 'QR 타입'}
            </Text>
            <Text style={[s.sectionSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('proFeatures.qrTypesDesc') || '텍스트 타입은 무료'}
            </Text>
          </View>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.qrTypes.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* 바코드 타입 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('proFeatures.barcodeTypes') || '바코드 타입'}
            </Text>
            <Text style={[s.sectionSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('proFeatures.barcodeTypesDesc') || 'Code 128은 무료'}
            </Text>
          </View>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.barcodeTypes.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* 백업/내보내기 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.backupFeatures') || '백업/내보내기'}
          </Text>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.backup.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* 광고 제거 버튼 - TODO: 추후 프로버전 출시 시 주석 해제 */}
        {/* <TouchableOpacity
          style={s.removeAdsButton}
          onPress={handleRemoveAds}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.removeAdsGradient}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={[s.removeAdsText, { fontFamily: fonts.bold }]}>
              {t('proFeatures.removeAds') || '광고 제거하기'}
            </Text>
          </LinearGradient>
        </TouchableOpacity> */}

        {/* 하단 여백 */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  // 진행률 카드
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText2: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  adStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  adStatusText: {
    fontSize: 13,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  featureItem: {
    width: '31%',
    marginHorizontal: '1.16%',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureName: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  adCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  themeItem: {
    width: '31%',
    marginHorizontal: '1.16%',
    marginBottom: 12,
    alignItems: 'center',
  },
  themePreviewContainer: {
    width: '100%',
    position: 'relative',
  },
  themePreview: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: 12,
  },
  themeAdBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeName: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  barcodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  barcodeItem: {
    width: '23%',
    marginHorizontal: '1%',
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  barcodeName: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAdsButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  removeAdsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  removeAdsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
