// screens/WorkFeaturesScreen.js - 설정 > 업무 기능: 실사·검수 / 자동 처리 / 보내기 / 기타
// 각 기능의 컨트롤은 예전 SettingsScreen.js 에서 그대로 옮겨 왔다.
// 스위치였던 것은 스위치, 자기 화면으로 가는 행이었던 것은 그대로 이동하고 켬/끔만 값으로 보여 준다
import React, { useState, useCallback } from 'react';
import { View, Text, Switch, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { getActiveStocktake } from '../utils/stocktake';
import { loadItems } from '../utils/itemMaster';
import { isPcKeyboardAvailable, PC_KEYBOARD_ENABLED_KEY } from '../utils/pcKeyboard';
import { loadScanRules } from '../utils/scanRulesStore';
import { LABEL_AUTO_SPLIT_KEY } from '../utils/labelCategories';
import { SettingsSubScreen, SectionHeader, Group, SettingRow, NavRight, SettingsHint, settingsStyles as s, useSettingsUi } from '../components/SettingsKit';

// 업무 기능 켬/끔 상태를 읽기만 한다 (설정 첫 화면 요약 "N개 켜짐"과 이 화면이 같이 쓴다)
export async function loadWorkFeatureStates() {
  const [activeStocktake, scanRules, entries, scanLink] = await Promise.all([
    getActiveStocktake().catch(() => null),
    loadScanRules().catch(() => ({ rules: [], enabled: true })),
    AsyncStorage.multiGet(['quantityMode', LABEL_AUTO_SPLIT_KEY, 'realtimeSyncEnabled', 'nfcReadEnabled', 'productAutoSearch']),
    SecureStore.getItemAsync('scanLinkEnabled').catch(() => null),
  ]);
  const v = Object.fromEntries(entries);
  return {
    stocktake: !!activeStocktake, // 진행 중인 실사가 있으면 켬
    quantityMode: v.quantityMode === 'true',
    scanRules: scanRules.enabled && scanRules.rules.some(r => r.enabled !== false), // 규칙 사용 + 켜진 규칙이 하나라도
    labelFields: v[LABEL_AUTO_SPLIT_KEY] === null ? true : v[LABEL_AUTO_SPLIT_KEY] === 'true', // 라벨 자동 분리 (기본 켬)
    realtimeSync: v.realtimeSyncEnabled === 'true',
    scanUrl: scanLink === 'true',
    nfc: v.nfcReadEnabled !== 'false',
    productSearch: v.productAutoSearch === 'true',
  };
}

// 첫 화면 요약에 세는 기능 (상품 검색은 설정 화면에서 임시로 숨겨 두어 세지 않는다)
export const COUNTED_WORK_FEATURES = ['stocktake', 'quantityMode', 'scanRules', 'labelFields', 'realtimeSync', 'scanUrl', 'nfc'];

export default function WorkFeaturesScreen() {
  const router = useRouter();
  const { isLocked, showUnlockAlert } = useFeatureLock();
  const { t, colors, fonts, switchColors, rowProps, statusProps } = useSettingsUi();

  const [states, setStates] = useState({});
  const [itemCount, setItemCount] = useState(0); // 품목 마스터 건수
  const [pcKeyboardOn, setPcKeyboardOn] = useState(false);
  const [quantityMode, setQuantityMode] = useState(false); // 같은 코드 → 수량 +1
  const [nfcReadEnabled, setNfcReadEnabled] = useState(true); // NFC 태그 읽기
  const [on, setOn] = useState(false); // 스캔 연동 URL 사용
  const [scanUrlList, setScanUrlList] = useState([]);
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [realtimeSyncExplained, setRealtimeSyncExplained] = useState(false); // 실시간 서버전송 설명 페이지 확인 여부
  // const [productAutoSearch, setProductAutoSearch] = useState(false); // 제품 검색 - 임시 비활성화

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const next = await loadWorkFeatureStates();
          setStates(next);
          loadItems().then(list => setItemCount(list.length)).catch(() => {});
          setPcKeyboardOn((await AsyncStorage.getItem(PC_KEYBOARD_ENABLED_KEY)) === 'true');
          setQuantityMode(next.quantityMode);
          setNfcReadEnabled(next.nfc);
          setOn(next.scanUrl);
          setRealtimeSyncEnabled(next.realtimeSync);

          // 스캔 연동 URL 목록 로드
          const savedUrlList = await SecureStore.getItemAsync('scanUrlList');
          if (savedUrlList) {
            setScanUrlList(JSON.parse(savedUrlList));
          }
          const explained = await AsyncStorage.getItem('realtimeSyncExplained');
          setRealtimeSyncExplained(explained === 'true');
        } catch (error) {
          console.error('Load work feature settings error:', error);
        }
      })();
    }, [])
  );

  return (
    <SettingsSubScreen title={t('settingsHub.work')}>
      <SettingsHint colors={colors} fonts={fonts} text={t('settingsHub.workHint', { single: t('scanner.modeSingle') })} />

      {/* 실사·검수 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionCheck')} />
      <Group colors={colors}>
        {/* 재고 실사 */}
        <SettingRow {...rowProps}
          label={t('stocktake.title')}
          desc={t('settingsHub.stocktakeDesc')}
          onPress={() => router.push('/stocktakes')}
        >
          <NavRight {...rowProps} {...statusProps(!!states.stocktake)} />
        </SettingRow>

        {/* 품목 관리 (코드 → 품명 사전) */}
        <SettingRow {...rowProps}
          label={t('itemMaster.title')}
          desc={t('itemMaster.desc')}
          onPress={() => router.push('/item-master')}
        >
          <NavRight {...rowProps} value={itemCount ? t('itemMaster.count', { count: itemCount }) : undefined} />
        </SettingRow>

        {/* 수량 누적 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.quantityMode')}
          desc={t('settingsHub.quantityModeDesc')}
        >
          <Switch
            value={quantityMode}
            onValueChange={async (value) => {
              setQuantityMode(value);
              try {
                await AsyncStorage.setItem('quantityMode', value.toString());
              } catch (error) {
                setQuantityMode(!value);
              }
            }}
            {...switchColors}
            accessibilityLabel={t('settingsHub.quantityMode')}
          />
        </SettingRow>
      </Group>

      {/* 자동 처리 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionAuto')} />
      <Group colors={colors}>
        {/* 자동 규칙 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.scanRules')}
          desc={t('settingsHub.scanRulesDesc')}
          onPress={() => router.push('/scan-rules')}
        >
          <NavRight {...rowProps} {...statusProps(!!states.scanRules)} />
        </SettingRow>

        {/* 라벨 카테고리 (구분자로 나뉜 코드를 필드로) */}
        <SettingRow {...rowProps}
          label={t('settingsHub.labelFields')}
          desc={t('settingsHub.labelFieldsDesc')}
          onPress={() => router.push('/label-categories')}
        >
          <NavRight {...rowProps} {...statusProps(!!states.labelFields)} />
        </SettingRow>
      </Group>

      {/* 보내기 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionSend')} />
      <Group colors={colors}>
        {/* 실시간 서버전송 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.realtimeSync')}
          desc={t('settingsHub.realtimeSyncDesc')}
          onPress={() => {
            if (isLocked('realtimeSync')) {
              showUnlockAlert('realtimeSync', () => {
                // 설명은 처음 한 번만 보여 주고, 그다음부터는 바로 설정으로
                router.push(realtimeSyncExplained ? '/realtime-sync-settings' : '/realtime-sync-explanation');
              });
            } else {
              // 설명은 처음 한 번만 보여 주고, 그다음부터는 바로 설정으로
              router.push(realtimeSyncExplained ? '/realtime-sync-settings' : '/realtime-sync-explanation');
            }
          }}
        >
          <NavRight {...rowProps} lockFeature="realtimeSync" {...statusProps(realtimeSyncEnabled)} />
        </SettingRow>

        {/* 스캔 연동 URL (+ 활성화 시 URL 목록) */}
        <View>
          <SettingRow {...rowProps}
            label={t('settingsHub.scanUrl')}
            desc={t('settingsHub.scanUrlDesc')}
            onPress={() => {
              if (isLocked('scanUrlIntegration')) {
                showUnlockAlert('scanUrlIntegration', () => router.push('/scan-url-settings'));
              } else {
                router.push('/scan-url-settings');
              }
            }}
          >
            <NavRight {...rowProps} lockFeature="scanUrlIntegration" {...statusProps(on)} />
          </SettingRow>

          {/* 스캔 연동 URL 목록 - 활성화 시에만 표시 */}
          {on && scanUrlList.length > 0 && (
            <View style={s.urlListWrap}>
              <View style={[s.urlListContainer, { backgroundColor: colors.raised }]}>
                {scanUrlList.map((item, index) => (
                  <View key={item.id} style={[s.urlListItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={[s.urlStatusDot, { backgroundColor: item.enabled ? colors.success : colors.textTertiary }]} />
                    <View style={s.urlListItemText}>
                      <Text style={[s.urlListItemName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[s.urlListItemUrl, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 제품 검색 - 임시 비활성화 (예전 설정 화면에서도 주석으로 숨겨 둔 상태 그대로)
        <SettingRow {...rowProps}
          label={t('productSearch.title')}
          desc={t('productSearch.description')}
          onPress={() => {
            if (isLocked('productSearch')) {
              showUnlockAlert('productSearch', () => router.push('/product-search-settings'));
            } else {
              router.push('/product-search-settings');
            }
          }}
        >
          <NavRight {...rowProps} lockFeature="productSearch" {...statusProps(!!states.productSearch)} />
        </SettingRow>
        */}
        {/* PC 키보드 입력 (블루투스, Android 9+) */}
        {isPcKeyboardAvailable && (
          <SettingRow {...rowProps}
            label={t('pcKeyboard.title')}
            desc={t('pcKeyboard.rowDesc')}
            onPress={() => router.push('/pc-keyboard')}
          >
            <NavRight {...rowProps} {...statusProps(pcKeyboardOn)} />
          </SettingRow>
        )}
      </Group>

      {/* 기타 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionOther')} />
      <Group colors={colors}>
        {/* NFC 태그 읽기 */}
        <SettingRow {...rowProps}
          label={t('nfc.setting')}
          desc={Platform.OS === 'ios' ? t('settingsHub.nfcDescIos') : t('settingsHub.nfcDesc')}
        >
          <Switch
            value={nfcReadEnabled}
            onValueChange={async (value) => {
              setNfcReadEnabled(value);
              try {
                await AsyncStorage.setItem('nfcReadEnabled', value.toString());
              } catch (error) {
                setNfcReadEnabled(!value);
              }
            }}
            {...switchColors}
            accessibilityLabel={t('nfc.setting')}
          />
        </SettingRow>
      </Group>
    </SettingsSubScreen>
  );
}
