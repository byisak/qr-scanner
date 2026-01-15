// screens/LotteryScanSettingsScreen.js - 복권 인식 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import LockIcon from '../components/LockIcon';
import { requestNotificationPermission, scheduleLotteryNotification, cancelLotteryNotification } from '../utils/lotteryNotification';
import { Picker } from '@react-native-picker/picker';

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
  const { isLocked, showUnlockAlert } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;

  // 잠금 상태
  const isLotteryScanLocked = isLocked('lotteryScan');

  // 상태
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false);
  const [koreaExpanded, setKoreaExpanded] = useState(false);
  const [koreaEnabled, setKoreaEnabled] = useState(true); // 대한민국 복권 활성화
  const [winningNotificationEnabled, setWinningNotificationEnabled] = useState(false);
  const [notificationHour, setNotificationHour] = useState(19); // 기본값 19시
  const [notificationMinute, setNotificationMinute] = useState(10); // 기본값 10분
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [tempHour, setTempHour] = useState(19);
  const [tempMinute, setTempMinute] = useState(10);

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const lotteryScan = await AsyncStorage.getItem('lotteryScanEnabled');
        if (lotteryScan !== null) setLotteryScanEnabled(lotteryScan === 'true');

        const winningNotif = await AsyncStorage.getItem('lotteryWinningNotificationEnabled');
        if (winningNotif !== null) setWinningNotificationEnabled(winningNotif === 'true');

        // 알림 시간 로드
        const savedHour = await AsyncStorage.getItem('lotteryNotificationHour');
        const savedMinute = await AsyncStorage.getItem('lotteryNotificationMinute');
        if (savedHour !== null) {
          setNotificationHour(parseInt(savedHour, 10));
          setTempHour(parseInt(savedHour, 10));
        }
        if (savedMinute !== null) {
          setNotificationMinute(parseInt(savedMinute, 10));
          setTempMinute(parseInt(savedMinute, 10));
        }
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

  // 시간 선택 열기
  const openTimePicker = () => {
    setTempHour(notificationHour);
    setTempMinute(notificationMinute);
    setTimePickerVisible(true);
  };

  // 시간 저장
  const handleSaveTime = async () => {
    setNotificationHour(tempHour);
    setNotificationMinute(tempMinute);
    setTimePickerVisible(false);

    try {
      await AsyncStorage.setItem('lotteryNotificationHour', tempHour.toString());
      await AsyncStorage.setItem('lotteryNotificationMinute', tempMinute.toString());

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

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {t('lotteryScan.title')}
        </Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* 복권 인식 활성화 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={[s.iconContainer, { backgroundColor: '#f39c1220' }]}>
                <Ionicons name="ticket" size={22} color="#f39c12" />
              </View>
              <View style={s.rowTextContainer}>
                <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {t('lotteryScan.enable')}
                </Text>
                <Text style={[s.rowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('lotteryScan.enableDesc')}
                </Text>
              </View>
            </View>
            <View style={s.switchContainer}>
              {isLotteryScanLocked && <LockIcon size={18} style={{ marginRight: 8 }} />}
              <Switch
                value={lotteryScanEnabled}
                onValueChange={handleLotteryScanToggle}
                trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* 안내 메시지 */}
        <View style={[s.infoBox, { backgroundColor: '#f39c1210' }]}>
          <Ionicons name="information-circle" size={20} color="#f39c12" />
          <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('lotteryScan.infoMessage')}
          </Text>
        </View>

        {/* 지원 복권 목록 - 복권 인식이 켜져있을 때만 표시 */}
        {lotteryScanEnabled && (
          <View style={[s.section, { backgroundColor: colors.surface, marginTop: 16 }]}>
            <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
              {t('lotteryScan.supportedLotteries')}
            </Text>

            {/* 대한민국 - 확장 가능한 항목 */}
            <View>
              <TouchableOpacity
                style={s.lotteryItem}
                onPress={() => setKoreaExpanded(!koreaExpanded)}
                activeOpacity={0.7}
              >
                <View style={s.lotteryItemLeft}>
                  <Text style={[s.countryName, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('lotteryScan.countries.korea')}
                  </Text>
                  <Text style={[s.lotteryName, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                    {t('lotteryScan.lotteryTypes.lotto645')}
                  </Text>
                </View>
                <Ionicons
                  name={koreaExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>

              {/* 확장된 설정 */}
              {koreaExpanded && (
                <View style={[s.expandedContent, { borderTopColor: colors.borderLight }]}>
                  {/* 당첨 알림 */}
                  <View style={s.subRow}>
                    <View style={s.subRowLeft}>
                      <View style={[s.subIconContainer, { backgroundColor: '#e74c3c20' }]}>
                        <Ionicons name="notifications" size={18} color="#e74c3c" />
                      </View>
                      <View style={s.subRowTextContainer}>
                        <Text style={[s.subRowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                          {t('lotteryScan.winningNotification')}
                        </Text>
                        <Text style={[s.subRowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                          {t('lotteryScan.winningNotificationDesc')}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={winningNotificationEnabled}
                      onValueChange={handleWinningNotificationToggle}
                      trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* 알림 시간 설정 - 알림이 켜져있을 때만 표시 */}
                  {winningNotificationEnabled && (
                    <TouchableOpacity
                      style={[s.subRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight }]}
                      onPress={openTimePicker}
                      activeOpacity={0.7}
                    >
                      <View style={s.subRowLeft}>
                        <View style={[s.subIconContainer, { backgroundColor: '#3498db20' }]}>
                          <Ionicons name="time" size={18} color="#3498db" />
                        </View>
                        <View style={s.subRowTextContainer}>
                          <Text style={[s.subRowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                            알림 시간
                          </Text>
                          <Text style={[s.subRowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                            매주 토요일 추첨 후 알림
                          </Text>
                        </View>
                      </View>
                      <View style={s.timeDisplay}>
                        <Text style={[s.timeText, { color: colors.primary, fontFamily: fonts.semiBold }]}>
                          {formatTime(notificationHour, notificationMinute)}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
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
            <Text style={[s.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              알림 시간 설정
            </Text>
            <Text style={[s.modalSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              매주 토요일 설정한 시간에 알림
            </Text>

            <View style={s.pickerContainer}>
              <View style={s.pickerWrapper}>
                <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>시</Text>
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
                <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>분</Text>
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
              <TouchableOpacity
                style={[s.modalButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => setTimePickerVisible(false)}
              >
                <Text style={[s.modalButtonText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveTime}
              >
                <Text style={[s.modalButtonText, { color: '#fff', fontFamily: fonts.semiBold }]}>
                  저장
                </Text>
              </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  lotteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  lotteryItemLeft: {
    flex: 1,
  },
  countryName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  lotteryName: {
    fontSize: 13,
    lineHeight: 18,
  },
  expandedContent: {
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    marginTop: 8,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  subIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subRowTextContainer: {
    flex: 1,
  },
  subRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  subRowDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 15,
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
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pickerWrapper: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  picker: {
    borderRadius: 12,
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
