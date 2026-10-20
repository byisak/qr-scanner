// screens/ScanSettingsScreen.js - 설정 > 스캔: 인식(바코드 종류·카메라·스캔 영역) / 결과 / 기타 / 스캔 모드 세부 설정
// 행과 동작은 예전 SettingsScreen.js "스캔" 섹션에서 그대로 옮겨 왔다
import React, { useState, useCallback } from 'react';
import { Switch, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { loadHardwareKeySettings, confirmKeyOf } from '../utils/hardwareKeys';
import { SettingsSubScreen, SectionHeader, Group, SettingRow, NavRight, SettingsHint, useSettingsUi } from '../components/SettingsKit';
import { URL_SAFETY_KEY } from '../utils/urlSafety';

export default function ScanSettingsScreen() {
  const router = useRouter();
  const { isLocked, showUnlockAlert } = useFeatureLock();
  const { t, colors, fonts, switchColors, rowProps, statusProps } = useSettingsUi();

  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(13); // 기본값: 모든 바코드 타입 (13개)
  const [selectedCamera, setSelectedCamera] = useState('back');
  const [scanRegionMode, setScanRegionMode] = useState('full');
  const [resultWindowAutoOpen, setResultWindowAutoOpen] = useState(true); // 결과창 자동 열림 (기본값: true)
  const [singleCodeShowValue, setSingleCodeShowValue] = useState(false); // 일반 스캔에서도 인식된 값 표시
  const [urlOpenMode, setUrlOpenMode] = useState('inApp');
  const [urlSafetyOn, setUrlSafetyOn] = useState(true); // 링크 안전 검사 (기본 켬)
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(true); // 기본값: 켬
  const [photoQuality, setPhotoQuality] = useState('0.5'); // 기본값: 중간
  const [hardwareKeySettings, setHardwareKeySettings] = useState({ keyMap: {}, scanConfirmMode: 'auto' });

  // 하위 화면에서 바꾸고 돌아오면 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const b = await AsyncStorage.getItem('selectedBarcodes');
          if (b) {
            const parsed = JSON.parse(b);
            setSelectedBarcodesCount(parsed.length || 13);
          }
          const camera = await AsyncStorage.getItem('selectedCamera');
          if (camera) setSelectedCamera(camera);
          const savedScanRegion = await AsyncStorage.getItem('scanRegionMode');
          setScanRegionMode(savedScanRegion || 'full');
          const rwa = await AsyncStorage.getItem('resultWindowAutoOpen');
          // null이면 기본값 true 유지
          setResultWindowAutoOpen(rwa === null ? true : rwa === 'true');
          setSingleCodeShowValue((await AsyncStorage.getItem('singleCodeShowValue')) === 'true');
          const savedUrlOpenMode = await AsyncStorage.getItem('urlOpenMode');
          if (savedUrlOpenMode) setUrlOpenMode(savedUrlOpenMode);
          setUrlSafetyOn((await AsyncStorage.getItem(URL_SAFETY_KEY)) !== 'false');
          const p = await AsyncStorage.getItem('photoSaveEnabled');
          // null이면 기본값 true (스캔 화면·사진 저장 화면과 같은 기본값)
          setPhotoSaveEnabled(p === null ? true : p === 'true');
          const q = await AsyncStorage.getItem('photoQuality');
          if (q !== null) setPhotoQuality(q);
          loadHardwareKeySettings().then(setHardwareKeySettings).catch(() => {});
        } catch (error) {
          console.error('Load scan settings error:', error);
        }
      })();
    }, [])
  );

  // 압축률 전체 라벨 반환 (예: "높음 고화질(권장)")
  const getQualityFullLabel = (quality) => {
    const labels = {
      '1.0': `${t('photoSaveSettings.qualityOriginal')} ${t('photoSaveSettings.qualityOriginalDesc')}`,
      '0.8': `${t('photoSaveSettings.qualityHigh')} ${t('photoSaveSettings.qualityHighDesc')}`,
      '0.6': `${t('photoSaveSettings.qualityMedium')} ${t('photoSaveSettings.qualityMediumDesc')}`,
      '0.4': `${t('photoSaveSettings.qualityLow')} ${t('photoSaveSettings.qualityLowDesc')}`,
      '0.2': `${t('photoSaveSettings.qualityMinimum')} ${t('photoSaveSettings.qualityMinimumDesc')}`,
    };
    return labels[quality] || `${t('photoSaveSettings.qualityHigh')} ${t('photoSaveSettings.qualityHighDesc')}`;
  };

  return (
    <SettingsSubScreen title={t('settingsHub.scan')}>
      {/* 인식 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionRecognition')} />
      <Group colors={colors}>
        {/* 바코드 선택 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.barcodeTypes')}
          onPress={() => router.push('/barcode-selection')}
        >
          <NavRight {...rowProps} value={t('settingsHub.barcodeCount', { count: selectedBarcodesCount })} />
        </SettingRow>

        {/* 카메라 선택 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.camera')}
          onPress={() => router.push('/camera-selection')}
        >
          <NavRight {...rowProps} value={selectedCamera === 'front' ? t('cameraSelection.frontCamera') : t('cameraSelection.backCamera')} />
        </SettingRow>

        {/* 스캔 영역 제한 */}
        <SettingRow {...rowProps}
          label={t('scanRegion.title')}
          onPress={() => router.push('/scan-region-selection')}
        >
          <NavRight {...rowProps} value={t(`scanRegion.${scanRegionMode}`)} />
        </SettingRow>
      </Group>

      {/* 결과 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionResult')} />
      <Group colors={colors}>
        {/* 결과창 자동 열림 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.resultAutoOpen')}
          desc={t('settingsHub.resultAutoOpenDesc')}
          onPress={() => router.push('/result-window-settings')}
        >
          <NavRight {...rowProps} {...statusProps(resultWindowAutoOpen)} />
        </SettingRow>

        {/* 인식된 코드 값 표시 (일반 스캔) */}
        <SettingRow {...rowProps}
          label={t('settingsHub.showValue')}
          desc={t('settingsHub.showValueDesc')}
        >
          <Switch
            value={singleCodeShowValue}
            onValueChange={async (value) => {
              setSingleCodeShowValue(value);
              try {
                await AsyncStorage.setItem('singleCodeShowValue', value.toString());
              } catch (error) {
                console.error('Save singleCodeShowValue error:', error);
                setSingleCodeShowValue(!value);
              }
            }}
            {...switchColors}
            accessibilityLabel={t('settingsHub.showValue')}
          />
        </SettingRow>

        {/* URL 열기 방식 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.urlOpenMode')}
          onPress={() => router.push('/url-open-mode-selection')}
        >
          <NavRight {...rowProps} value={t(`urlOpenMode.${urlOpenMode}`)} />
        </SettingRow>

        {/* 링크 안전 검사 */}
        <SettingRow {...rowProps} label={t('urlSafety.settingLabel')} desc={t('urlSafety.settingDesc')}>
          <Switch
            value={urlSafetyOn}
            onValueChange={(v) => { setUrlSafetyOn(v); AsyncStorage.setItem(URL_SAFETY_KEY, v ? 'true' : 'false').catch(() => {}); }}
            {...switchColors}
            accessibilityLabel={t('urlSafety.settingLabel')}
          />
        </SettingRow>
      </Group>

      {/* 기타 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionOther')} />
      <Group colors={colors}>
        {/* 사진 저장 */}
        <SettingRow {...rowProps}
          label={t('settings.photoSave')}
          desc={photoSaveEnabled ? getQualityFullLabel(photoQuality) : t('settings.photoSaveDesc')}
          onPress={() => {
            if (isLocked('photoSave')) {
              showUnlockAlert('photoSave', () => router.push('/photo-save-settings'));
            } else {
              router.push('/photo-save-settings');
            }
          }}
        >
          <NavRight {...rowProps} lockFeature="photoSave" {...statusProps(photoSaveEnabled)} />
        </SettingRow>

        {/* 하드웨어 키 · 수동 확정 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.hardwareKeys')}
          desc={(() => {
            if (hardwareKeySettings.scanConfirmMode !== 'manual') return t('scanConfirm.autoStatus');
            const key = Platform.OS === 'android' ? confirmKeyOf(hardwareKeySettings.keyMap) : null;
            return key ? t('scanConfirm.manualStatus', { key: t(`hardwareKeys.${key}`) }) : t('scanConfirm.manualStatusButton');
          })()}
          onPress={() => router.push('/hardware-keys')}
        >
          <NavRight {...rowProps} />
        </SettingRow>
      </Group>

      {/* 스캔 모드 세부 설정: 모드 켜고 끄기는 스캔 화면 아래 알약으로 옮겼지만,
          중복 처리·스캔 수 표시·여러 코드 값 표시는 이 화면들에서만 바꿀 수 있어 남겨 둔다 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionModeOptions')} />
      <Group colors={colors}>
        {/* 연속 스캔 모드 */}
        <SettingRow {...rowProps}
          label={t('continuousScan.title') || t('settings.batchScanMode')}
          desc={t('settingsHub.continuousOptionsDesc')}
          onPress={() => {
            if (isLocked('batchScan')) {
              showUnlockAlert('batchScan', () => router.push('/continuous-scan-settings'));
            } else {
              router.push('/continuous-scan-settings');
            }
          }}
        >
          <NavRight {...rowProps} lockFeature="batchScan" />
        </SettingRow>

        {/* 여러 코드 인식 모드 */}
        <SettingRow {...rowProps}
          label={t('settings.multiCodeMode')}
          desc={t('settingsHub.multiOptionsDesc')}
          onPress={() => router.push('/multi-code-mode-settings')}
        >
          <NavRight {...rowProps} />
        </SettingRow>
      </Group>
      <SettingsHint colors={colors} fonts={fonts} text={t('settingsHub.modeOptionsHint')} />
    </SettingsSubScreen>
  );
}
