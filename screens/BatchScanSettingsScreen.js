// screens/BatchScanSettingsScreen.js - 배치 스캔 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BatchScanSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // 상태
  const [batchScanEnabled, setBatchScanEnabled] = useState(false);
  const [showScanCounter, setShowScanCounter] = useState(true);
  const [duplicateDetection, setDuplicateDetection] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState('alert'); // 'alert', 'skip', 'allow'

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const batchEnabled = await AsyncStorage.getItem('batchScanEnabled');
        const counter = await AsyncStorage.getItem('batchShowScanCounter');
        const duplicate = await AsyncStorage.getItem('batchDuplicateDetection');
        const dupAction = await AsyncStorage.getItem('batchDuplicateAction');

        if (batchEnabled !== null) setBatchScanEnabled(batchEnabled === 'true');
        if (counter !== null) setShowScanCounter(counter === 'true');
        if (duplicate !== null) setDuplicateDetection(duplicate === 'true');
        if (dupAction !== null) setDuplicateAction(dupAction);
      } catch (error) {
        console.error('Load batch scan settings error:', error);
      }
    })();
  }, []);

  // 배치 스캔 활성화 저장
  const handleBatchScanToggle = async (value) => {
    setBatchScanEnabled(value);
    try {
      await AsyncStorage.setItem('batchScanEnabled', value.toString());
    } catch (error) {
      console.error('Save batch scan enabled error:', error);
    }
  };

  // 스캔 카운터 표시 저장
  const handleScanCounterToggle = async (value) => {
    setShowScanCounter(value);
    try {
      await AsyncStorage.setItem('batchShowScanCounter', value.toString());
    } catch (error) {
      console.error('Save scan counter setting error:', error);
    }
  };

  // 중복 감지 저장
  const handleDuplicateDetectionToggle = async (value) => {
    setDuplicateDetection(value);
    try {
      await AsyncStorage.setItem('batchDuplicateDetection', value.toString());
    } catch (error) {
      console.error('Save duplicate detection setting error:', error);
    }
  };

  // 중복 처리 방식 저장
  const handleDuplicateActionChange = async (action) => {
    setDuplicateAction(action);
    try {
      await AsyncStorage.setItem('batchDuplicateAction', action);
    } catch (error) {
      console.error('Save duplicate action setting error:', error);
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
          {t('batchScan.title')}
        </Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* 배치 스캔 활성화 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={[s.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="rocket" size={22} color={colors.primary} />
              </View>
              <View style={s.rowTextContainer}>
                <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {t('batchScan.enable')}
                </Text>
                <Text style={[s.rowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('batchScan.enableDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={batchScanEnabled}
              onValueChange={handleBatchScanToggle}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 배치 스캔 옵션 - 활성화 시에만 표시 */}
        {batchScanEnabled && (
          <>
            {/* 스캔 카운터 */}
            <View style={[s.section, { backgroundColor: colors.surface }]}>
              <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                {t('batchScan.displayOptions')}
              </Text>

              <View style={s.row}>
                <View style={s.rowLeft}>
                  <View style={[s.iconContainer, { backgroundColor: '#3498db20' }]}>
                    <Ionicons name="speedometer" size={22} color="#3498db" />
                  </View>
                  <View style={s.rowTextContainer}>
                    <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {t('batchScan.showCounter')}
                    </Text>
                    <Text style={[s.rowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                      {t('batchScan.showCounterDesc')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={showScanCounter}
                  onValueChange={handleScanCounterToggle}
                  trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* 중복 감지 */}
            <View style={[s.section, { backgroundColor: colors.surface }]}>
              <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                {t('batchScan.duplicateSection')}
              </Text>

              <View style={s.row}>
                <View style={s.rowLeft}>
                  <View style={[s.iconContainer, { backgroundColor: '#e74c3c20' }]}>
                    <Ionicons name="copy" size={22} color="#e74c3c" />
                  </View>
                  <View style={s.rowTextContainer}>
                    <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {t('batchScan.duplicateDetection')}
                    </Text>
                    <Text style={[s.rowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                      {t('batchScan.duplicateDetectionDesc')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={duplicateDetection}
                  onValueChange={handleDuplicateDetectionToggle}
                  trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                  thumbColor="#fff"
                />
              </View>

              {/* 중복 처리 방식 - 중복 감지 활성화 시에만 표시 */}
              {duplicateDetection && (
                <View style={[s.actionOptions, { borderTopColor: colors.borderLight }]}>
                  <Text style={[s.actionLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                    {t('batchScan.duplicateAction')}
                  </Text>

                  {/* 알림 후 추가 */}
                  <TouchableOpacity
                    style={[
                      s.actionItem,
                      duplicateAction === 'alert' && { backgroundColor: colors.primary + '15' }
                    ]}
                    onPress={() => handleDuplicateActionChange('alert')}
                    activeOpacity={0.7}
                  >
                    <View style={s.actionItemLeft}>
                      <Ionicons
                        name="alert-circle"
                        size={20}
                        color={duplicateAction === 'alert' ? colors.primary : colors.textTertiary}
                      />
                      <Text style={[
                        s.actionItemText,
                        { color: duplicateAction === 'alert' ? colors.primary : colors.text, fontFamily: fonts.medium }
                      ]}>
                        {t('batchScan.actionAlert')}
                      </Text>
                    </View>
                    {duplicateAction === 'alert' && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>

                  {/* 자동 스킵 */}
                  <TouchableOpacity
                    style={[
                      s.actionItem,
                      duplicateAction === 'skip' && { backgroundColor: colors.primary + '15' }
                    ]}
                    onPress={() => handleDuplicateActionChange('skip')}
                    activeOpacity={0.7}
                  >
                    <View style={s.actionItemLeft}>
                      <Ionicons
                        name="play-skip-forward"
                        size={20}
                        color={duplicateAction === 'skip' ? colors.primary : colors.textTertiary}
                      />
                      <Text style={[
                        s.actionItemText,
                        { color: duplicateAction === 'skip' ? colors.primary : colors.text, fontFamily: fonts.medium }
                      ]}>
                        {t('batchScan.actionSkip')}
                      </Text>
                    </View>
                    {duplicateAction === 'skip' && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>

                  {/* 모두 허용 */}
                  <TouchableOpacity
                    style={[
                      s.actionItem,
                      duplicateAction === 'allow' && { backgroundColor: colors.primary + '15' }
                    ]}
                    onPress={() => handleDuplicateActionChange('allow')}
                    activeOpacity={0.7}
                  >
                    <View style={s.actionItemLeft}>
                      <Ionicons
                        name="checkmark-done"
                        size={20}
                        color={duplicateAction === 'allow' ? colors.primary : colors.textTertiary}
                      />
                      <Text style={[
                        s.actionItemText,
                        { color: duplicateAction === 'allow' ? colors.primary : colors.text, fontFamily: fonts.medium }
                      ]}>
                        {t('batchScan.actionAllow')}
                      </Text>
                    </View>
                    {duplicateAction === 'allow' && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 안내 메시지 */}
            <View style={[s.infoBox, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('batchScan.infoMessage')}
              </Text>
            </View>
          </>
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
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
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
  actionOptions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionLabel: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionItemText: {
    fontSize: 15,
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
});
