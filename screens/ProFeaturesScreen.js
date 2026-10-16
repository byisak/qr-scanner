// screens/ProFeaturesScreen.js - 기능별 광고 해제 페이지
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { LOCKED_FEATURES } from '../config/lockedFeatures';
import { LOTTERY_FEATURE_ENABLED } from '../config/features';
import MaterialPressable from '../components/MaterialPressable';

// 기능 카테고리별 정리
const FEATURE_CATEGORIES = {
  settings: {
    titleKey: 'proFeatures.settingsFeatures',
    features: [
      { id: 'batchScan', icon: 'layers-outline' },
      { id: 'realtimeSync', icon: 'sync-outline' },
      { id: 'scanUrlIntegration', icon: 'link-outline' },
      { id: 'productSearch', icon: 'search-outline' },
      { id: 'photoSave', icon: 'camera-outline' },
      // 복권 인식은 기능 플래그가 켜졌을 때만 목록에 보인다
      ...(LOTTERY_FEATURE_ENABLED ? [{ id: 'lotteryScan', icon: 'ticket-outline' }] : []),
    ],
  },
  generator: {
    titleKey: 'proFeatures.generatorFeatures',
    features: [],
  },
  qrTypes: {
    titleKey: 'proFeatures.qrTypes',
    features: [
      { id: 'qrTypeWebsite', icon: 'globe-outline', typeName: '웹사이트' },
      { id: 'qrTypeContact', icon: 'person-outline', typeName: '연락처' },
      { id: 'qrTypeWifi', icon: 'wifi-outline', typeName: 'WiFi' },
      { id: 'qrTypeClipboard', icon: 'clipboard-outline', typeName: '클립보드' },
      { id: 'qrTypeEmail', icon: 'mail-outline', typeName: '이메일' },
      { id: 'qrTypeSms', icon: 'chatbubble-outline', typeName: 'SMS' },
      { id: 'qrTypePhone', icon: 'call-outline', typeName: '전화' },
      { id: 'qrTypeEvent', icon: 'calendar-outline', typeName: '일정' },
      { id: 'qrTypeLocation', icon: 'location-outline', typeName: '위치' },
    ],
  },
  barcodeTypes: {
    titleKey: 'proFeatures.barcodeTypes',
    features: [
      // 1D Industrial/Logistics
      { id: 'barcodeCode39', icon: 'barcode-outline', barcodeName: 'Code 39' },
      { id: 'barcodeCode39ext', icon: 'barcode-outline', barcodeName: 'Code 39 Ext' },
      { id: 'barcodeCode93', icon: 'barcode-outline', barcodeName: 'Code 93' },
      { id: 'barcodeCode93ext', icon: 'barcode-outline', barcodeName: 'Code 93 Ext' },
      { id: 'barcodeCode11', icon: 'barcode-outline', barcodeName: 'Code 11' },
      { id: 'barcodeIndustrial2of5', icon: 'barcode-outline', barcodeName: 'Industrial 2/5' },
      { id: 'barcodeInterleaved2of5', icon: 'barcode-outline', barcodeName: 'Interleaved 2/5' },
      { id: 'barcodeItf14', icon: 'barcode-outline', barcodeName: 'ITF-14' },
      { id: 'barcodeMatrix2of5', icon: 'barcode-outline', barcodeName: 'Matrix 2/5' },
      { id: 'barcodeCoop2of5', icon: 'barcode-outline', barcodeName: 'COOP 2/5' },
      { id: 'barcodeIata2of5', icon: 'barcode-outline', barcodeName: 'IATA 2/5' },
      { id: 'barcodeDatalogic2of5', icon: 'barcode-outline', barcodeName: 'Datalogic 2/5' },
      // Retail
      { id: 'barcodeEan13', icon: 'barcode-outline', barcodeName: 'EAN-13' },
      { id: 'barcodeEan8', icon: 'barcode-outline', barcodeName: 'EAN-8' },
      { id: 'barcodeEan5', icon: 'barcode-outline', barcodeName: 'EAN-5' },
      { id: 'barcodeEan2', icon: 'barcode-outline', barcodeName: 'EAN-2' },
      { id: 'barcodeUpca', icon: 'barcode-outline', barcodeName: 'UPC-A' },
      { id: 'barcodeUpce', icon: 'barcode-outline', barcodeName: 'UPC-E' },
      { id: 'barcodeIsbn', icon: 'barcode-outline', barcodeName: 'ISBN' },
      { id: 'barcodeIsmn', icon: 'barcode-outline', barcodeName: 'ISMN' },
      { id: 'barcodeIssn', icon: 'barcode-outline', barcodeName: 'ISSN' },
      { id: 'barcodeEan13composite', icon: 'barcode-outline', barcodeName: 'EAN-13 Comp' },
      { id: 'barcodeEan8composite', icon: 'barcode-outline', barcodeName: 'EAN-8 Comp' },
      { id: 'barcodeUpcacomposite', icon: 'barcode-outline', barcodeName: 'UPC-A Comp' },
      { id: 'barcodeUpcecomposite', icon: 'barcode-outline', barcodeName: 'UPC-E Comp' },
      // GS1/Logistics
      { id: 'barcodeGs1128', icon: 'barcode-outline', barcodeName: 'GS1-128' },
      { id: 'barcodeGs1cc', icon: 'barcode-outline', barcodeName: 'GS1 Composite' },
      { id: 'barcodeGs1databar', icon: 'barcode-outline', barcodeName: 'GS1 DataBar' },
      { id: 'barcodeGs1databarstacked', icon: 'barcode-outline', barcodeName: 'GS1 DB Stack' },
      { id: 'barcodeGs1databarstackedomni', icon: 'barcode-outline', barcodeName: 'GS1 DB Omni' },
      { id: 'barcodeGs1databartruncated', icon: 'barcode-outline', barcodeName: 'GS1 DB Trunc' },
      { id: 'barcodeGs1databarlimited', icon: 'barcode-outline', barcodeName: 'GS1 DB Limit' },
      { id: 'barcodeGs1databarexpanded', icon: 'barcode-outline', barcodeName: 'GS1 DB Exp' },
      { id: 'barcodeGs1databarexpandedstacked', icon: 'barcode-outline', barcodeName: 'GS1 DB Exp St' },
      { id: 'barcodeGs1northamericancoupon', icon: 'barcode-outline', barcodeName: 'GS1 Coupon' },
      { id: 'barcodeGs1qrcode', icon: 'qr-code-outline', barcodeName: 'GS1 QR' },
      { id: 'barcodeGs1dotcode', icon: 'ellipsis-horizontal', barcodeName: 'GS1 DotCode' },
      { id: 'barcodeSscc18', icon: 'barcode-outline', barcodeName: 'SSCC-18' },
      { id: 'barcodeEan14', icon: 'barcode-outline', barcodeName: 'EAN-14' },
      // Medical/Pharmaceutical
      { id: 'barcodePharmacode', icon: 'medkit-outline', barcodeName: 'Pharmacode' },
      { id: 'barcodePharmacode2', icon: 'medkit-outline', barcodeName: 'Pharmacode 2' },
      { id: 'barcodeCode32', icon: 'medkit-outline', barcodeName: 'Code 32' },
      { id: 'barcodePzn', icon: 'medkit-outline', barcodeName: 'PZN' },
      { id: 'barcodeHibc39', icon: 'medkit-outline', barcodeName: 'HIBC 39' },
      { id: 'barcodeHibc128', icon: 'medkit-outline', barcodeName: 'HIBC 128' },
      { id: 'barcodeHibcdatamatrix', icon: 'grid-outline', barcodeName: 'HIBC DM' },
      { id: 'barcodeHibcpdf417', icon: 'list-outline', barcodeName: 'HIBC PDF417' },
      { id: 'barcodeHibcqrcode', icon: 'qr-code-outline', barcodeName: 'HIBC QR' },
      { id: 'barcodeHibcazteccode', icon: 'apps-outline', barcodeName: 'HIBC Aztec' },
      { id: 'barcodeHibccodablockf', icon: 'reorder-four-outline', barcodeName: 'HIBC CodaBlk' },
      { id: 'barcodeHibcmicropdf417', icon: 'list-outline', barcodeName: 'HIBC MicroPDF' },
      // Library/Special
      { id: 'barcodeCodabar', icon: 'barcode-outline', barcodeName: 'Codabar' },
      { id: 'barcodeBc412', icon: 'barcode-outline', barcodeName: 'BC412' },
      { id: 'barcodeMsi', icon: 'barcode-outline', barcodeName: 'MSI' },
      { id: 'barcodePlessey', icon: 'barcode-outline', barcodeName: 'Plessey' },
      { id: 'barcodeTelepen', icon: 'barcode-outline', barcodeName: 'Telepen' },
      { id: 'barcodeTelepennumeric', icon: 'barcode-outline', barcodeName: 'Telepen Num' },
      { id: 'barcodeChannelcode', icon: 'barcode-outline', barcodeName: 'Channel' },
      { id: 'barcodePosicode', icon: 'barcode-outline', barcodeName: 'PosiCode' },
      // Postal
      { id: 'barcodePostnet', icon: 'mail-outline', barcodeName: 'POSTNET' },
      { id: 'barcodePlanet', icon: 'mail-outline', barcodeName: 'PLANET' },
      { id: 'barcodeUspsintellligentmail', icon: 'mail-outline', barcodeName: 'USPS IM' },
      { id: 'barcodeOnecode', icon: 'mail-outline', barcodeName: 'OneCode' },
      { id: 'barcodeRoyalmail', icon: 'mail-outline', barcodeName: 'Royal Mail' },
      { id: 'barcodeKix', icon: 'mail-outline', barcodeName: 'KIX' },
      { id: 'barcodeJapanpost', icon: 'mail-outline', barcodeName: 'Japan Post' },
      { id: 'barcodeAuspost', icon: 'mail-outline', barcodeName: 'Australia Post' },
      { id: 'barcodeDeutschepost', icon: 'mail-outline', barcodeName: 'Deutsche Post' },
      { id: 'barcodeDeutschepostidentcode', icon: 'mail-outline', barcodeName: 'DP Identcode' },
      { id: 'barcodeCepnet', icon: 'mail-outline', barcodeName: 'CEPNet' },
      { id: 'barcodeFlattermarken', icon: 'mail-outline', barcodeName: 'Flattermarken' },
      { id: 'barcodeLeitcode', icon: 'mail-outline', barcodeName: 'Leitcode' },
      { id: 'barcodeIdentcode', icon: 'mail-outline', barcodeName: 'Identcode' },
      // 2D Barcodes
      { id: 'barcodeQrcode', icon: 'qr-code-outline', barcodeName: 'QR Code' },
      { id: 'barcodeMicroqrcode', icon: 'qr-code-outline', barcodeName: 'Micro QR' },
      { id: 'barcodeRectangularmicroqrcode', icon: 'qr-code-outline', barcodeName: 'Rect Micro QR' },
      { id: 'barcodeDatamatrix', icon: 'grid-outline', barcodeName: 'Data Matrix' },
      { id: 'barcodeDatamatrixrectangular', icon: 'grid-outline', barcodeName: 'DM Rect' },
      { id: 'barcodeDatamatrixrectangularextension', icon: 'grid-outline', barcodeName: 'DM Rect Ext' },
      { id: 'barcodePdf417', icon: 'list-outline', barcodeName: 'PDF417' },
      { id: 'barcodePdf417compact', icon: 'list-outline', barcodeName: 'PDF417 Compact' },
      { id: 'barcodeMicropdf417', icon: 'list-outline', barcodeName: 'MicroPDF417' },
      { id: 'barcodeAzteccode', icon: 'apps-outline', barcodeName: 'Aztec Code' },
      { id: 'barcodeAzteccodecompact', icon: 'apps-outline', barcodeName: 'Aztec Compact' },
      { id: 'barcodeAztecrune', icon: 'apps-outline', barcodeName: 'Aztec Runes' },
      { id: 'barcodeMaxicode', icon: 'hexagon-outline', barcodeName: 'MaxiCode' },
      { id: 'barcodeDotcode', icon: 'ellipsis-horizontal', barcodeName: 'DotCode' },
      { id: 'barcodeHanxin', icon: 'qr-code-outline', barcodeName: 'Han Xin' },
      { id: 'barcodeCodeone', icon: 'grid-outline', barcodeName: 'Code One' },
      { id: 'barcodeUltracode', icon: 'qr-code-outline', barcodeName: 'Ultracode' },
      // Stacked
      { id: 'barcodeCodablockf', icon: 'reorder-four-outline', barcodeName: 'Codablock F' },
      { id: 'barcodeCode16k', icon: 'reorder-four-outline', barcodeName: 'Code 16K' },
      { id: 'barcodeCode49', icon: 'reorder-four-outline', barcodeName: 'Code 49' },
      // Automotive
      { id: 'barcodeVin', icon: 'car-outline', barcodeName: 'VIN' },
    ],
  },
  backup: {
    titleKey: 'proFeatures.backupFeatures',
    features: [
      // iCloud는 iOS에만 있다. Android에서 보여주면 광고를 보고 해제해도 쓸 곳이 없다
      ...(Platform.OS === 'ios' ? [{ id: 'icloudBackup', icon: 'cloud-outline' }] : []),
      { id: 'googleDriveBackup', icon: 'logo-google' },
    ],
  },
};

export default function ProFeaturesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
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

  // 잠금 상태 배지: 해제됨(초록) · 광고 시청 중(파랑, n/m) · 잠김(회색, 필요한 광고 수)
  const renderProgressBadge = (featureId, isUnlocked) => {
    if (isUnlocked) {
      return (
        <View style={[s.badge, { backgroundColor: colors.successSoft }]}>
          <Ionicons name="checkmark" size={12} color={colors.success} />
          <Text style={[s.badgeText, { color: colors.success, fontFamily: fonts.semiBold }]}>
            {t('featureLock.unlocked')}
          </Text>
        </View>
      );
    }

    const { current, required } = getAdProgress(featureId);
    const hasProgress = current > 0;

    return (
      <View style={[s.badge, { backgroundColor: hasProgress ? colors.primarySoft : colors.raised }]}>
        <Ionicons
          name={hasProgress ? 'play' : 'lock-closed'}
          size={11}
          color={hasProgress ? colors.primaryText : colors.textSecondary}
        />
        <Text style={[s.badgeText, { color: hasProgress ? colors.primaryText : colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {hasProgress ? `${current}/${required}` : required}
        </Text>
      </View>
    );
  };

  // 기능 행 렌더링
  const renderFeatureItem = (feature, onPress, isLast) => {
    const unlocked = !isLocked(feature.id);

    return (
      <MaterialPressable
        key={feature.id}
        style={[s.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
        onPress={() => onPress(feature.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Ionicons name={feature.icon} size={20} color={colors.textSecondary} />
        <Text style={[s.rowLabel, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
          {feature.barcodeName || feature.styleName || feature.typeName || t(`proFeatures.features.${feature.id}`) || feature.id}
        </Text>
        {renderProgressBadge(feature.id, unlocked)}
      </MaterialPressable>
    );
  };

  // 섹션: 카드 밖 머리글(+설명) + 행을 묶은 카드 하나
  const renderSection = (title, desc, features, onPress) => {
    const items = features.filter((feature) => LOCKED_FEATURES[feature.id]);
    if (items.length === 0) return null;
    return (
      <>
        <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {title}
        </Text>
        {desc ? (
          <Text style={[s.sectionDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{desc}</Text>
        ) : null}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {items.map((feature, index) => renderFeatureItem(feature, onPress, index === items.length - 1))}
        </View>
      </>
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
    const allFeatures = Object.keys(LOCKED_FEATURES).filter(id => LOTTERY_FEATURE_ENABLED || id !== 'lotteryScan');
    const unlockedCount = allFeatures.filter(id => !isLocked(id)).length;
    return { unlocked: unlockedCount, total: allFeatures.length };
  };

  const progress = getTotalProgress();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · (제목은 아래 큰 제목이 맡는다) */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={s.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <View style={s.headerTitleSpacer} />
        <View style={s.headerButton} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* 히어로: 아이콘 타일 + 큰 제목 + 설명 */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="lock-open-outline" size={28} color={colors.primaryText} />
          </View>
          <Text accessibilityRole="header" style={[s.heroTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.title') || '기능 잠금 해제'}
          </Text>
          <Text style={[s.heroSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('proFeatures.description')}
          </Text>
        </View>

        {/* 전체 진행률 표시 */}
        <View style={[s.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.progressHeader}>
            <Text style={[s.progressTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('proFeatures.unlockProgress') || '해제 진행률'}
            </Text>
            <Text style={[s.progressCount, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {progress.unlocked}
              <Text style={{ color: colors.textTertiary }}> / {progress.total}</Text>
            </Text>
          </View>
          <View style={[s.progressBarContainer, { backgroundColor: colors.raised }]}>
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
          <View style={s.progressFooter}>
            <Text style={[s.progressText2, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
              {progress.unlocked} / {progress.total} {t('proFeatures.featuresUnlocked') || '기능 해제됨'}
            </Text>
            {/* 광고 로딩 상태 표시 */}
            <View style={s.adStatusRow}>
              <Ionicons
                name={isAdLoaded ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={isAdLoaded ? colors.success : colors.textSecondary}
              />
              <Text style={[s.adStatusText, { color: isAdLoaded ? colors.success : colors.textSecondary, fontFamily: fonts.medium }]}>
                {isAdLoaded
                  ? (t('proFeatures.adReady') || '광고 준비됨')
                  : isAdLoading
                    ? (t('proFeatures.adLoading') || '광고 로딩 중...')
                    : (t('proFeatures.adNotLoaded') || '광고 로딩 대기')}
              </Text>
            </View>
          </View>
        </View>

        {/* 설정 기능 섹션 */}
        {renderSection(
          t('proFeatures.settingsFeatures') || '설정 기능',
          null,
          FEATURE_CATEGORIES.settings.features,
          handleFeaturePress
        )}

        {/* QR 타입 섹션 */}
        {renderSection(
          t('proFeatures.qrTypes') || 'QR 타입',
          t('proFeatures.qrTypesDesc') || '텍스트 타입은 무료',
          FEATURE_CATEGORIES.qrTypes.features,
          handleFeaturePress
        )}

        {/* 바코드 타입 섹션 */}
        {renderSection(
          t('proFeatures.barcodeTypes') || '바코드 타입',
          t('proFeatures.barcodeTypesDesc') || 'Code 128은 무료',
          FEATURE_CATEGORIES.barcodeTypes.features,
          handleFeaturePress
        )}

        {/* 백업/내보내기 섹션 */}
        {renderSection(
          t('proFeatures.backupFeatures') || '백업/내보내기',
          null,
          FEATURE_CATEGORIES.backup.features,
          handleFeaturePress
        )}

        {/* 광고 제거 버튼 - TODO: 추후 프로버전 출시 시 주석 해제 */}
        {/* <MaterialPressable
          style={[s.removeAdsButton, { backgroundColor: colors.primary }]}
          onPress={handleRemoveAds}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={[s.removeAdsText, { fontFamily: fonts.semiBold }]}>
            {t('proFeatures.removeAds') || '광고 제거하기'}
          </Text>
        </MaterialPressable> */}
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
  },
  // 히어로
  hero: {
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    ...TYPE.tabTitle,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  // 진행률 카드
  progressCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACE.card,
    marginBottom: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  progressText2: {
    fontSize: 13,
    flexShrink: 1,
  },
  adStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  adStatusText: {
    fontSize: 13,
  },
  // 섹션
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  sectionDesc: {
    ...TYPE.caption,
    marginTop: -4,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowLabel: {
    ...TYPE.body,
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // 광고 제거 버튼 (주석 처리된 버튼용)
  removeAdsButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  removeAdsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
