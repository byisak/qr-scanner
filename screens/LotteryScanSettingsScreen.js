// screens/LotteryScanSettingsScreen.js - 복권 인식 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

// 지원 복권 목록
const SUPPORTED_LOTTERIES = [
  { country: 'korea', lotteries: 'lotto645' },
  { country: 'usa', lotteries: 'powerballMega' },
  { country: 'uk', lotteries: 'ukLottoEuro' },
  { country: 'canada', lotteries: 'lotto649Max' },
  { country: 'europe', lotteries: 'euroMillionsJackpot' },
  { country: 'japan', lotteries: 'takarakuji' },
  { country: 'china', lotteries: 'welfareLottery' },
  { country: 'singapore', lotteries: 'toto4d' },
  { country: 'southAfrica', lotteries: 'lottoPowerball' },
];

export default function LotteryScanSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // 상태
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false);
  const [winningNotificationEnabled, setWinningNotificationEnabled] = useState(false);

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const lotteryScan = await AsyncStorage.getItem('lotteryScanEnabled');
        if (lotteryScan !== null) setLotteryScanEnabled(lotteryScan === 'true');

        const winningNotif = await AsyncStorage.getItem('lotteryWinningNotificationEnabled');
        if (winningNotif !== null) setWinningNotificationEnabled(winningNotif === 'true');
      } catch (error) {
        console.error('Load lottery scan settings error:', error);
      }
    })();
  }, []);

  // 복권 인식 활성화 저장
  const handleLotteryScanToggle = async (value) => {
    setLotteryScanEnabled(value);
    try {
      await AsyncStorage.setItem('lotteryScanEnabled', value.toString());
    } catch (error) {
      console.error('Save lottery scan enabled error:', error);
    }
  };

  // 당첨 알림 활성화 저장
  const handleWinningNotificationToggle = async (value) => {
    setWinningNotificationEnabled(value);
    try {
      await AsyncStorage.setItem('lotteryWinningNotificationEnabled', value.toString());
    } catch (error) {
      console.error('Save winning notification enabled error:', error);
    }
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
            <Switch
              value={lotteryScanEnabled}
              onValueChange={handleLotteryScanToggle}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 당첨 알림 - 복권 인식이 켜져있을 때만 표시 */}
        {lotteryScanEnabled && (
          <View style={[s.section, { backgroundColor: colors.surface }]}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={[s.iconContainer, { backgroundColor: '#e74c3c20' }]}>
                  <Ionicons name="notifications" size={22} color="#e74c3c" />
                </View>
                <View style={s.rowTextContainer}>
                  <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('lotteryScan.winningNotification')}
                  </Text>
                  <Text style={[s.rowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
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
          </View>
        )}

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

            {SUPPORTED_LOTTERIES.map((item, index) => (
              <View
                key={item.country}
                style={[
                  s.lotteryItem,
                  index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }
                ]}
              >
                <Text style={[s.countryName, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {t(`lotteryScan.countries.${item.country}`)}
                </Text>
                <Text style={[s.lotteryName, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t(`lotteryScan.lotteryTypes.${item.lotteries}`)}
                </Text>
              </View>
            ))}
          </View>
        )}

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
    paddingVertical: 12,
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
});
