// screens/LotteryScanSettingsScreen.js - 복권 인식 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import LockIcon from '../components/LockIcon';
import { requestNotificationPermission, scheduleLotteryNotification, cancelLotteryNotification } from '../utils/lotteryNotification';
import { Picker } from '@react-native-picker/picker';
import MaterialPressable from '../components/MaterialPressable';

// 지원 복권 목록
const SUPPORTED_LOTTERIES = [
  { country: 'korea', lotteries: 'lotto645' },
  // { country: 'usa', lotteries: 'powerballMega' },
  // { country: 'uk', lotteries: 'ukLottoEuro' },
  // { country: 'canada', lotteries: 'lotto649Max' },
  // { country: 'europe', lotteries: 'euroMillionsJackpot' },
  // { country: 'japan', lotteries: 'takarakuji' },
  // { country: 'china', lotteries: 'welfareLottery' },
  // { country: 'singapore', lotteries: 'toto4d' },
  // { country: 'southAfrica', lotteries: 'lottoPowerball' },
];

export default function LotteryScanSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLocked, showUnlockAlert } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;

  // 잠금 상태
  const isLotteryScanLocked = isLocked('lotteryScan');

  // 상태
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false);
  const [koreaExpanded, setKoreaExpanded] = useState(false);
  const [koreaEnabled, setKoreaEnabled] = useState(true); // 대한민국 복권 활성화
  const [winningNotificationEnabled, setWinningNotificationEnabled] = useState(false);

  // 로또 6/45 알림 시간 (토요일 추첨)
  const [lottoNotificationHour, setLottoNotificationHour] = useState(20); // 기본값 20시 50분
  const [lottoNotificationMinute, setLottoNotificationMinute] = useState(50);

  // 연금복권720+ 알림 시간 (목요일 추첨)
  const [pensionNotificationHour, setPensionNotificationHour] = useState(19); // 기본값 19시 10분
  const [pensionNotificationMinute, setPensionNotificationMinute] = useState(10);

  // 시간 선택 모달
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerType, setTimePickerType] = useState('lotto'); // 'lotto' or 'pension'
  const [tempHour, setTempHour] = useState(20);
  const [tempMinute, setTempMinute] = useState(50);

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const lotteryScan = await AsyncStorage.getItem('lotteryScanEnabled');
        if (lotteryScan !== null) setLotteryScanEnabled(lotteryScan === 'true');

        const winningNotif = await AsyncStorage.getItem('lotteryWinningNotificationEnabled');
        if (winningNotif !== null) setWinningNotificationEnabled(winningNotif === 'true');

        // 로또 알림 시간 로드
        const lottoHour = await AsyncStorage.getItem('lottoNotificationHour');
        const lottoMinute = await AsyncStorage.getItem('lottoNotificationMinute');
        if (lottoHour !== null) setLottoNotificationHour(parseInt(lottoHour, 10));
        if (lottoMinute !== null) setLottoNotificationMinute(parseInt(lottoMinute, 10));

        // 연금복권 알림 시간 로드
        const pensionHour = await AsyncStorage.getItem('pensionNotificationHour');
        const pensionMinute = await AsyncStorage.getItem('pensionNotificationMinute');
        if (pensionHour !== null) setPensionNotificationHour(parseInt(pensionHour, 10));
        if (pensionMinute !== null) setPensionNotificationMinute(parseInt(pensionMinute, 10));
      } catch (error) {
        console.error('Load lottery scan settings error:', error);
      }
    })();
  }, []);

  // 복권 인식 활성화 저장
  const handleLotteryScanToggle = async (value) => {
    // 잠금 상태에서 켜려고 할 때 광고 시청 필요
    if (value && isLotteryScanLocked) {
      showUnlockAlert('lotteryScan', () => {
        // 광고 시청 후 활성화
        enableLotteryScan();
      });
      return;
    }

    if (value) {
      enableLotteryScan();
    } else {
      // 끄는 것은 언제든 가능
      setLotteryScanEnabled(false);
      try {
        await AsyncStorage.setItem('lotteryScanEnabled', 'false');
      } catch (error) {
        console.error('Save lottery scan enabled error:', error);
      }
    }
  };

  // 복권 인식 활성화 실행
  const enableLotteryScan = async () => {
    setLotteryScanEnabled(true);
    try {
      await AsyncStorage.setItem('lotteryScanEnabled', 'true');

      // 다른 고급 스캔 기능 비활성화 (상호 배타적)
      await AsyncStorage.setItem('continuousScanEnabled', 'false');
      await AsyncStorage.setItem('batchScanEnabled', 'false');
      await AsyncStorage.setItem('multiCodeModeEnabled', 'false');
      await SecureStore.setItemAsync('scanLinkEnabled', 'false');
      await AsyncStorage.setItem('realtimeSyncEnabled', 'false');
    } catch (error) {
      console.error('Save lottery scan enabled error:', error);
    }
  };

  // 당첨 알림 활성화 저장
  const handleWinningNotificationToggle = async (value) => {
    if (value) {
      // 활성화 시 알림 권한 요청
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        Alert.alert(
          '알림 권한 필요',
          '당첨 알림을 받으려면 알림 권한이 필요합니다. 설정에서 알림을 허용해주세요.',
          [{ text: '확인' }]
        );
        return;
      }

      setWinningNotificationEnabled(true);
      try {
        await AsyncStorage.setItem('lotteryWinningNotificationEnabled', 'true');
        // 알림 스케줄링
        await scheduleLotteryNotification();
      } catch (error) {
        console.error('Save winning notification enabled error:', error);
      }
    } else {
      // 비활성화 시 알림 취소
      setWinningNotificationEnabled(false);
      try {
        await AsyncStorage.setItem('lotteryWinningNotificationEnabled', 'false');
        await cancelLotteryNotification();
      } catch (error) {
        console.error('Save winning notification enabled error:', error);
      }
    }
  };

  // 로또 시간 선택 열기
  const openLottoTimePicker = () => {
    setTimePickerType('lotto');
    setTempHour(lottoNotificationHour);
    setTempMinute(lottoNotificationMinute);
    setTimePickerVisible(true);
  };

  // 연금복권 시간 선택 열기
  const openPensionTimePicker = () => {
    setTimePickerType('pension');
    setTempHour(pensionNotificationHour);
    setTempMinute(pensionNotificationMinute);
    setTimePickerVisible(true);
  };

  // 시간 저장
  const handleSaveTime = async () => {
    setTimePickerVisible(false);

    try {
      if (timePickerType === 'lotto') {
        setLottoNotificationHour(tempHour);
        setLottoNotificationMinute(tempMinute);
        await AsyncStorage.setItem('lottoNotificationHour', tempHour.toString());
        await AsyncStorage.setItem('lottoNotificationMinute', tempMinute.toString());
      } else {
        setPensionNotificationHour(tempHour);
        setPensionNotificationMinute(tempMinute);
        await AsyncStorage.setItem('pensionNotificationHour', tempHour.toString());
        await AsyncStorage.setItem('pensionNotificationMinute', tempMinute.toString());
      }

      // 알림이 활성화되어 있으면 새 시간으로 재스케줄링
      if (winningNotificationEnabled) {
        await scheduleLotteryNotification();
      }
    } catch (error) {
      console.error('Save notification time error:', error);
    }
  };

  // 시간 포맷팅
  const formatTime = (hour, minute) => {
    const period = hour >= 12 ? '오후' : '오전';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            style={s.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('lotteryScan.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 복권 인식 활성화 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('lotteryScan.enable')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('lotteryScan.enableDesc')}
              </Text>
            </View>
            <View style={s.rowRight}>
              {isLotteryScanLocked && (
                <LockIcon featureId="lotteryScan" size={12} badge style={[s.lockBadge, { backgroundColor: colors.errorSoft }]} />
              )}
              <Switch
                value={lotteryScanEnabled}
                onValueChange={handleLotteryScanToggle}
                {...switchColors}
              />
            </View>
          </View>
        </View>

        {/* 안내 메시지 */}
        <View style={[s.infoBox, { backgroundColor: colors.raised }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('lotteryScan.infoMessage')}
          </Text>
        </View>

        {/* 지원 복권 목록 - 복권 인식이 켜져있을 때만 표시 */}
        {lotteryScanEnabled && (
          <>
            <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('lotteryScan.supportedLotteries')}
            </Text>
            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* 대한민국 - 확장 가능한 항목 */}
              <MaterialPressable
                style={[s.row, s.rowWithDesc]}
                onPress={() => setKoreaExpanded(!koreaExpanded)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: koreaExpanded }}
              >
                <View style={s.rowText}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('lotteryScan.countries.korea')}
                  </Text>
                  <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('lotteryScan.lotteryTypes.lotto645')}
                  </Text>
                </View>
                <Ionicons
                  name={koreaExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textTertiary}
                />
              </MaterialPressable>

              {/* 확장된 설정 */}
              {koreaExpanded && (
                <>
                  <View style={[s.separator, { backgroundColor: colors.borderLight }]} />
                  {/* 당첨 알림 */}
                  <View style={[s.row, s.rowWithDesc]}>
                    <View style={s.rowText}>
                      <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                        {t('lotteryScan.winningNotification')}
                      </Text>
                      <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                        {t('lotteryScan.winningNotificationDesc')}
                      </Text>
                    </View>
                    <Switch
                      value={winningNotificationEnabled}
                      onValueChange={handleWinningNotificationToggle}
                      {...switchColors}
                    />
                  </View>

                  {/* 알림 시간 설정 - 알림이 켜져있을 때만 표시 */}
                  {winningNotificationEnabled && (
                    <>
                      <View style={[s.separator, { backgroundColor: colors.borderLight }]} />
                      {/* 로또 6/45 알림 시간 */}
                      <MaterialPressable
                        style={[s.row, s.rowWithDesc]}
                        onPress={openLottoTimePicker}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                      >
                        <View style={s.rowText}>
                          <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                            로또 6/45 알림
                          </Text>
                          <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            매주 토요일 추첨 후 알림
                          </Text>
                        </View>
                        <View style={s.rowRight}>
                          <Text style={[s.value, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            {formatTime(lottoNotificationHour, lottoNotificationMinute)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </View>
                      </MaterialPressable>
                      <View style={[s.separator, { backgroundColor: colors.borderLight }]} />
                      {/* 연금복권720+ 알림 시간 */}
                      <MaterialPressable
                        style={[s.row, s.rowWithDesc]}
                        onPress={openPensionTimePicker}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                      >
                        <View style={s.rowText}>
                          <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                            연금복권720+ 알림
                          </Text>
                          <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            매주 목요일 추첨 후 알림
                          </Text>
                        </View>
                        <View style={s.rowRight}>
                          <Text style={[s.value, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            {formatTime(pensionNotificationHour, pensionNotificationMinute)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </View>
                      </MaterialPressable>
                    </>
                  )}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* 시간 선택 모달 */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setTimePickerVisible(false)}
        >
          <Pressable
            style={[s.modalContent, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[s.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {timePickerType === 'lotto' ? '로또 6/45' : '연금복권720+'} 알림 시간
            </Text>
            <Text style={[s.modalSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {timePickerType === 'lotto'
                ? '매주 토요일 설정한 시간에 알림'
                : '매주 목요일 설정한 시간에 알림'}
            </Text>

            <View style={s.pickerContainer}>
              <View style={s.pickerWrapper}>
                <Text style={[s.pickerLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>시</Text>
                <View style={[s.picker, { backgroundColor: colors.inputBackground }]}>
                  <Picker
                    selectedValue={tempHour}
                    onValueChange={(value) => setTempHour(value)}
                    style={{ width: 100, height: 150 }}
                    itemStyle={{ fontSize: 20, height: 150 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <Picker.Item key={i} label={`${i}시`} value={i} />
                    ))}
                  </Picker>
                </View>
              </View>

              <Text style={[s.pickerSeparator, { color: colors.text }]}>:</Text>

              <View style={s.pickerWrapper}>
                <Text style={[s.pickerLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>분</Text>
                <View style={[s.picker, { backgroundColor: colors.inputBackground }]}>
                  <Picker
                    selectedValue={tempMinute}
                    onValueChange={(value) => setTempMinute(value)}
                    style={{ width: 100, height: 150 }}
                    itemStyle={{ fontSize: 20, height: 150 }}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <Picker.Item key={i} label={`${i}분`} value={i} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <View style={s.modalButtons}>
              <MaterialPressable
                style={[s.modalButton, s.modalButtonSecondary, { backgroundColor: colors.raised, borderColor: colors.border }]}
                onPress={() => setTimePickerVisible(false)}
                accessibilityRole="button"
              >
                <Text style={[s.modalButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  취소
                </Text>
              </MaterialPressable>
              <MaterialPressable
                style={[s.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveTime}
                accessibilityRole="button"
              >
                <Text style={[s.modalButtonText, { color: '#fff', fontFamily: fonts.semiBold }]}>
                  저장
                </Text>
              </MaterialPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flexShrink: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
    gap: SPACE.gap,
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowWithDesc: {
    minHeight: SIZE.rowWithDesc,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.control,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  value: {
    fontSize: 13,
  },
  lockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.card,
    padding: SPACE.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerWrapper: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  picker: {
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    height: 150,
  },
  pickerSeparator: {
    fontSize: 24,
    fontWeight: '600',
    marginHorizontal: 12,
    marginTop: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalButtonSecondary: {
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
