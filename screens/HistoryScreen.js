// screens/HistoryScreen.js - 그룹별 히스토리 관리
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackScreenView, trackHistoryViewed } from '../utils/analytics';
import { parseQRContent, QR_CONTENT_TYPES } from '../utils/qrContentParser';
import { SwipeListView } from 'react-native-swipe-list-view';
import { updateLotteryNotificationOnCheck } from '../utils/lotteryNotification';
import { isDrawCompleted } from '../utils/lotteryApi';
import { LotteryIcon } from '../components/LotteryIcons';

const DEFAULT_GROUP_ID = 'default';

export default function HistoryScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { triggerSync } = useSync();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // 노치 없는 SE(inset 20)부터 Dynamic Island(59)까지 대응하도록 insets 기준으로 계산
  const statusBarHeight = insets.top + (Platform.OS === 'ios' ? 23 : 20);
  const searchMarginTop = insets.top + (Platform.OS === 'ios' ? 3 : 10);

  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
  const [selectedGroupId, setSelectedGroupId] = useState(DEFAULT_GROUP_ID);
  const [scanHistory, setScanHistory] = useState({ [DEFAULT_GROUP_ID]: [] });
  const [query, setQuery] = useState('');
  const [filteredList, setFilteredList] = useState([]);
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true); // 저장소를 읽는 동안 "기록 없음"이 잠깐 보이는 것 방지
  const feedback = useFeedback();

  // 그룹 데이터 로드
  const loadGroups = async () => {
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      const selectedId = await AsyncStorage.getItem('selectedGroupId');
      const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');

      // 실시간 서버전송 설정 로드
      const isRealtimeSyncEnabled = realtimeSync === 'true';
      setRealtimeSyncEnabled(isRealtimeSyncEnabled);

      if (groupsData) {
        const parsed = JSON.parse(groupsData);
        // 삭제된 그룹(isDeleted: true) 필터링
        // 실시간 서버전송이 꺼져있으면 세션 그룹(isCloudSync: true)도 필터링
        const filteredGroups = parsed.filter(g => {
          if (g.isDeleted) return false; // 삭제된 그룹 제외
          if (!isRealtimeSyncEnabled && g.isCloudSync) return false; // 서버전송 꺼진 경우 세션 그룹 제외
          return true;
        });
        // 기본 그룹 및 생성 그룹 이름을 현재 언어로 표시
        const localizedGroups = filteredGroups.map(g => {
          if (g.id === DEFAULT_GROUP_ID) {
            return { ...g, name: t('groupEdit.defaultGroup') };
          }
          if (g.id === 'generated') {
            return { ...g, name: t('history.generatedGroup') || '생성' };
          }
          return g;
        });
        setGroups(localizedGroups.length > 0 ? localizedGroups : [{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
      }

      if (historyData) {
        const parsed = JSON.parse(historyData);
        setScanHistory(parsed);
      } else {
        // 기존 히스토리 데이터 마이그레이션
        const oldHistory = await AsyncStorage.getItem('scanHistory');
        if (oldHistory) {
          const parsed = JSON.parse(oldHistory);
          const migrated = { [DEFAULT_GROUP_ID]: parsed };
          setScanHistory(migrated);
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(migrated));
          triggerSync();
        }
      }

      if (selectedId) {
        setSelectedGroupId(selectedId);
      }
    } catch (error) {
      console.error('Load groups error:', error);
      Alert.alert(t('common.error'), t('history.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // 화면 조회 추적
      trackScreenView('History', 'HistoryScreen');
      loadGroups();
    }, [t])
  );

  // 선택된 그룹의 히스토리 (최신순). 복사본을 정렬해야 state를 제자리에서 바꾸지 않는다
  const currentHistory = useMemo(() => {
    const history = scanHistory[selectedGroupId] || [];
    return [...history].sort((a, b) => b.timestamp - a.timestamp);
  }, [scanHistory, selectedGroupId]);

  // 검색 필터
  useEffect(() => {
    if (!query) {
      setFilteredList(currentHistory);
      return;
    }
    const q = query.toLowerCase();
    setFilteredList(
      currentHistory.filter(
        (i) => (i.code && i.code.toLowerCase().includes(q)) || (i.url && i.url.toLowerCase().includes(q)),
      ),
    );
  }, [query, currentHistory]);

  // 그룹 선택
  const selectGroup = async (groupId) => {
    setSelectedGroupId(groupId);
    await AsyncStorage.setItem('selectedGroupId', groupId);
    setQuery('');
  };

  // 현재 그룹의 히스토리 삭제
  const clearCurrentGroupHistory = async () => {
    const groupName = groups.find(g => g.id === selectedGroupId)?.name || t('groupEdit.defaultGroup');
    Alert.alert(t('history.deleteConfirmTitle'), `${groupName}${t('history.deleteConfirmMessage')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const updatedHistory = { ...scanHistory, [selectedGroupId]: [] };
          setScanHistory(updatedHistory);
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(updatedHistory));
          triggerSync();
          setQuery('');
        },
      },
    ]);
  };

  // 개별 항목 삭제. 확인 창 대신 "실행 취소" 토스트로 되돌릴 수 있게 한다
  const deleteHistoryItem = async (item) => {
    const groupId = selectedGroupId;
    const currentHistory = scanHistory[groupId] || [];
    const updatedHistory = currentHistory.filter(h => h.timestamp !== item.timestamp);
    const newScanHistory = { ...scanHistory, [groupId]: updatedHistory };
    setScanHistory(newScanHistory);
    await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(newScanHistory));
    triggerSync();

    feedback.warning(t('history.itemDeleted'), {
      actionLabel: t('common.undo'),
      onAction: async () => {
        let restored;
        setScanHistory(prev => {
          const list = prev[groupId] || [];
          if (list.some(h => h.timestamp === item.timestamp)) return prev;
          restored = { ...prev, [groupId]: [...list, item] };
          return restored;
        });
        if (restored) {
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(restored));
          triggerSync();
        }
      },
    });
  };

  // 스크린리더로도 삭제할 수 있게 행에 붙이는 접근성 액션
  const rowAccessibilityActions = [{ name: 'delete', label: t('common.delete') }];
  const handleRowAccessibilityAction = (item) => (event) => {
    if (event.nativeEvent.actionName === 'delete') deleteHistoryItem(item);
  };

  // SwipeListView에서 숨겨진 삭제 버튼 렌더링 (항상 44pt 이상)
  const renderHiddenItem = (data, rowMap) => {
    const item = data.item;
    return (
      <View style={s.rowBack}>
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={() => {
            if (rowMap[item.timestamp]) {
              rowMap[item.timestamp].closeRow();
            }
            deleteHistoryItem(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Ionicons name="trash" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  const formatDateTime = (timestamp) => {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}.${month}.${day}  ${hours}:${minutes}:${seconds}`;
  };

  const handleItemPress = async (item) => {
    // 복권 아이템인 경우 복권 결과 화면으로 이동
    if (item.lotteryData) {
      // 결과 확인 시 isChecked를 true로 업데이트
      if (!item.lotteryData.isChecked) {
        try {
          const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
          if (historyData) {
            const historyByGroup = JSON.parse(historyData);
            const currentHistory = historyByGroup[selectedGroupId] || [];
            const index = currentHistory.findIndex(h => h.code === item.code);
            if (index !== -1) {
              currentHistory[index].lotteryData.isChecked = true;
              currentHistory[index].lotteryData.checkedAt = Date.now();
              historyByGroup[selectedGroupId] = currentHistory;
              await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
              triggerSync();
              // 알림 업데이트 (미확인 복권 없으면 취소)
              updateLotteryNotificationOnCheck();
            }
          }
        } catch (error) {
          console.error('Failed to mark lottery as checked:', error);
        }
      }

      router.push({
        pathname: '/lottery-result',
        params: { code: item.code },
      });
      return;
    }

    // 일반 QR/바코드 결과 화면
    router.push({
      pathname: '/result',
      params: {
        code: item.code,
        url: item.url,
        isDuplicate: item.count && item.count > 1 ? 'true' : 'false',
        scanCount: (item.count || 1).toString(),
        timestamp: item.timestamp.toString(),
        scanTimes: item.scanTimes ? JSON.stringify(item.scanTimes) : JSON.stringify([item.timestamp]),
        photoUri: item.photos && item.photos.length > 0 ? item.photos[0] : '',
        groupId: selectedGroupId, // 그룹 ID 전달
        fromHistory: 'true', // 히스토리에서 왔음을 표시
        type: item.type || 'qr', // 바코드 타입 전달
        errorCorrectionLevel: item.errorCorrectionLevel || '', // EC 레벨 전달
        // 생성 코드 데이터 (편집용)
        isGenerated: item.isGenerated ? 'true' : 'false',
        generatorData: item.generatorData ? JSON.stringify(item.generatorData) : '',
        thumbnail: item.thumbnail || '',
      }
    });
  };

  const currentGroup = groups.find(g => g.id === selectedGroupId);

  // 각 그룹의 스캔 개수 계산
  const getGroupScanCount = (groupId) => {
    const history = scanHistory[groupId] || [];
    return history.length;
  };

  return (
    <View style={[s.c, { backgroundColor: colors.background }]}>
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

      {/* 검색 */}
      <View style={[s.search, { backgroundColor: colors.surface, marginTop: searchMarginTop }]}>
        <Ionicons name="search" size={20} color={colors.textTertiary} />
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder={t('history.searchPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t('common.search')}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel={t('history.clearSearch')} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 그룹 선택 탭 */}
      <View style={[s.groupTabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupTabs}>
          {groups.map((group) => {
            const scanCount = getGroupScanCount(group.id);
            const isActive = selectedGroupId === group.id;
            return (
              <TouchableOpacity
                key={group.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={[
                  s.groupTab,
                  { backgroundColor: isActive ? colors.primary : colors.inputBackground },
                  isActive && s.groupTabActive
                ]}
                onPress={() => selectGroup(group.id)}
              >
                {group.isCloudSync && (
                  <Ionicons name="cloud" size={16} color={isActive ? '#fff' : colors.primary} style={{ marginRight: 6 }} />
                )}
                {group.isScanUrlGroup && (
                  <Ionicons name="link" size={16} color={isActive ? '#fff' : '#2E7D32'} style={{ marginRight: 6 }} />
                )}
                <Text style={[s.groupTabText, { color: isActive ? '#fff' : colors.text, fontFamily: fonts.semiBold }, isActive && s.groupTabTextActive]}>
                  {group.id === DEFAULT_GROUP_ID ? t('groupEdit.defaultGroup') :
                   group.id === 'lottery-lotto' ? t('history.lottoGroup') :
                   group.id === 'lottery-pension' ? t('history.pensionGroup') : group.name}
                </Text>
                {scanCount > 0 && (
                  <View style={[s.groupCountBadge, { backgroundColor: isActive ? '#fff' : colors.primary }, isActive && s.groupCountBadgeActive]}>
                    <Text style={[s.groupCountBadgeText, { color: isActive ? colors.primary : '#fff', fontFamily: fonts.bold }, isActive && s.groupCountBadgeTextActive]}>
                      {scanCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[s.editGroupTab, { backgroundColor: colors.inputBackground }]} onPress={() => router.push('/group-edit')}>
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
            <Text style={[s.editGroupTabText, { color: colors.primary, fontFamily: fonts.semiBold }]}>{t('history.editGroups')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 헤더 */}
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {currentGroup?.id === DEFAULT_GROUP_ID ? t('groupEdit.defaultGroup') :
           currentGroup?.id === 'lottery-lotto' ? t('history.lottoGroup') :
           currentGroup?.id === 'lottery-pension' ? t('history.pensionGroup') : (currentGroup?.name || t('history.scanRecord'))} {filteredList.length > 0 && `(${filteredList.length})`}
        </Text>
        {currentHistory.length > 0 && (
          <TouchableOpacity onPress={clearCurrentGroupHistory} accessibilityLabel={t('history.deleteAll')}>
            <Text style={[s.del, { color: colors.error, fontFamily: fonts.semiBold }]}>{t('history.deleteAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 히스토리 목록 */}
      {isLoading && filteredList.length === 0 ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredList.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="file-tray-outline" size={64} color={colors.borderLight} />
          <Text style={[s.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{query ? t('history.noSearchResults') : t('history.emptyList')}</Text>
        </View>
      ) : (
        <SwipeListView
          data={filteredList}
          keyExtractor={(item) => `${item.timestamp}_${item.code || ''}`}
          renderItem={({ item }) => {
            const hasPhoto = item.photos && item.photos.length > 0;
            const hasThumbnail = item.thumbnail && !imageErrors[item.timestamp]; // 생성 코드 썸네일
            const isQRCode = !item.type || item.type === 'qr' || item.type === 'qrcode';
            const isGenerated = item.isGenerated === true;
            const ecLevel = item.errorCorrectionLevel;

            // QR 콘텐츠 파싱 (QR 코드인 경우에만)
            const parsedContent = isQRCode ? parseQRContent(item.code) : null;

            // 복권 아이템인 경우 특별 렌더링
            if (item.lotteryData) {
              const lotteryInfo = item.lotteryData;
              const isLotto = lotteryInfo.type === 'lotto';
              const typeColor = isLotto ? '#FFC107' : '#4CAF50';

              return (
                <TouchableOpacity
                  style={[s.item, { backgroundColor: colors.surface }]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${lotteryInfo.typeName} ${t('history.roundLabel', { round: lotteryInfo.round })}`}
                  accessibilityRole="button"
                  accessibilityActions={rowAccessibilityActions}
                  onAccessibilityAction={handleRowAccessibilityAction(item)}
                >
                  <View style={s.itemContent}>
                    {/* 복권 아이콘 (복주머니만) */}
                    <View style={s.lotteryIcon}>
                      <LotteryIcon type={isLotto ? 'lotto' : 'pension'} size={36} iconOnly />
                    </View>
                    <View style={[s.itemInfo, { marginLeft: 12 }]}>
                      {/* 1줄: 복권 종류 및 회차 */}
                      <Text style={[s.code, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
                        {lotteryInfo.typeName} {t('history.roundLabel', { round: lotteryInfo.round })}
                        {!isLotto && lotteryInfo.displayNumber && ` (${lotteryInfo.displayNumber})`}
                      </Text>

                      {/* 2줄: 배지들 */}
                      <View style={s.badgeRow}>
                        {/* 복권 타입 배지 */}
                        <View style={[s.badge, { backgroundColor: typeColor + '15' }]}>
                          <Text style={[s.badgeText, { color: typeColor }]}>
                            {isLotto ? t('history.lottoBadge') : t('history.pensionBadge')}
                          </Text>
                        </View>

                        {/* 게임 수 (로또만) */}
                        {isLotto && lotteryInfo.gameCount && (
                          <View style={[s.badge, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[s.badgeText, { color: colors.primary }]}>
                              {t('history.gamesLabel', { count: lotteryInfo.gameCount })}
                            </Text>
                          </View>
                        )}

                        {/* 확인 상태 - 추첨 완료 여부에 따라 다르게 표시 */}
                        {(() => {
                          const drawCompleted = isDrawCompleted(lotteryInfo.round, lotteryInfo.type);
                          if (lotteryInfo.isChecked) {
                            // 확인 완료
                            return (
                              <View style={[s.badge, { backgroundColor: '#34C759' + '15' }]}>
                                <Ionicons name="checkmark-circle" size={11} color="#34C759" />
                                <Text style={[s.badgeText, { color: '#34C759' }]}>{t('history.checked')}</Text>
                              </View>
                            );
                          } else if (drawCompleted) {
                            // 추첨 완료 + 미확인
                            return (
                              <View style={[s.badge, { backgroundColor: '#FF3B30' + '15' }]}>
                                <Ionicons name="alert-circle" size={11} color="#FF3B30" />
                                <Text style={[s.badgeText, { color: '#FF3B30' }]}>{t('history.unchecked')}</Text>
                              </View>
                            );
                          } else {
                            // 추첨 전 대기중
                            return (
                              <View style={[s.badge, { backgroundColor: '#FF9500' + '15' }]}>
                                <Ionicons name="time-outline" size={11} color="#FF9500" />
                                <Text style={[s.badgeText, { color: '#FF9500' }]}>{t('history.pending')}</Text>
                              </View>
                            );
                          }
                        })()}
                      </View>

                      {/* 3줄: 스캔 날짜 */}
                      <Text style={[s.time, { color: colors.textSecondary }]}>
                        {formatDateTime(item.timestamp)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              );
            }

            // 콘텐츠 타입 레이블
            const getContentTypeLabel = (type) => {
              const labels = {
                [QR_CONTENT_TYPES.URL]: t('qrTypes.url') || 'URL',
                [QR_CONTENT_TYPES.PHONE]: t('qrTypes.phone') || '전화',
                [QR_CONTENT_TYPES.SMS]: t('qrTypes.sms') || 'SMS',
                [QR_CONTENT_TYPES.EMAIL]: t('qrTypes.email') || '이메일',
                [QR_CONTENT_TYPES.WIFI]: t('qrTypes.wifi') || 'WiFi',
                [QR_CONTENT_TYPES.GEO]: t('qrTypes.location') || '위치',
                [QR_CONTENT_TYPES.CONTACT]: t('qrTypes.contact') || '연락처',
                [QR_CONTENT_TYPES.EVENT]: t('qrTypes.event') || '일정',
                [QR_CONTENT_TYPES.TEXT]: t('qrTypes.text') || '텍스트',
              };
              return labels[type] || type;
            };

            // EC 레벨 색상
            const getECLevelColor = (level) => {
              if (!level) return colors.textSecondary;
              switch (level.toUpperCase()) {
                case 'L': return '#FF9500';
                case 'M': return '#34C759';
                case 'Q': return '#007AFF';
                case 'H': return '#5856D6';
                default: return colors.textSecondary;
              }
            };

            return (
              <TouchableOpacity
                style={[s.item, { backgroundColor: colors.surface }]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
                accessibilityLabel={`${t('history.scanRecord')}: ${item.code}`}
                accessibilityRole="button"
                accessibilityActions={rowAccessibilityActions}
                onAccessibilityAction={handleRowAccessibilityAction(item)}
              >
                <View style={s.itemContent}>
                  {/* 생성 코드: QR은 썸네일, 바코드는 아이콘 */}
                  {isGenerated && isQRCode && hasThumbnail && (
                    <View style={[s.photoThumbnail, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                      <Image
                        source={{ uri: item.thumbnail }}
                        style={[s.photoThumbnail, { backgroundColor: 'white' }]}
                        resizeMode="contain"
                        onError={() => setImageErrors(prev => ({ ...prev, [item.timestamp]: true }))}
                      />
                    </View>
                  )}
                  {/* 생성 바코드: 아이콘으로 표시 */}
                  {isGenerated && !isQRCode && (
                    <View style={[s.photoThumbnail, s.barcodeIconContainer, { backgroundColor: '#9C27B0' + '15', borderColor: '#9C27B0' + '30' }]}>
                      <Ionicons name="barcode-outline" size={28} color="#9C27B0" />
                      <Text style={[s.barcodeTypeText, { color: '#9C27B0' }]} numberOfLines={1}>
                        {item.type?.toUpperCase() || 'BARCODE'}
                      </Text>
                    </View>
                  )}
                  {/* 사진 썸네일 - 클릭시 이미지 분석 */}
                  {!isGenerated && hasPhoto && (
                    <TouchableOpacity
                      onPress={() => !imageErrors[item.timestamp] && router.push({
                        pathname: '/image-analysis',
                        params: { imageUri: item.photos[0] }
                      })}
                      activeOpacity={imageErrors[item.timestamp] ? 1 : 0.7}
                    >
                      {imageErrors[item.timestamp] ? (
                        <View style={[s.photoThumbnail, s.photoPlaceholder, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                        </View>
                      ) : (
                        <>
                          <Image
                            source={{ uri: item.photos[0] }}
                            style={[s.photoThumbnail, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                            resizeMode="cover"
                            onError={() => setImageErrors(prev => ({ ...prev, [item.timestamp]: true }))}
                          />
                          <View style={[s.analyzeIconOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                            <Ionicons name="scan" size={16} color="#fff" />
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={[s.itemInfo, (hasPhoto || hasThumbnail || isGenerated) && s.itemInfoWithPhoto]}>
                    {/* 1줄: 스캔값 */}
                    <Text style={[s.code, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
                      {item.code}
                    </Text>

                    {/* 2줄: 바코드타입, 콘텐츠타입, 반복횟수, 에러레벨 */}
                    <View style={s.badgeRow}>
                      {/* 생성 코드 배지 */}
                      {isGenerated && (
                        <View style={[s.badge, { backgroundColor: '#9C27B0' + '15' }]}>
                          <Ionicons name="create-outline" size={11} color="#9C27B0" />
                          <Text style={[s.badgeText, { color: '#9C27B0' }]}>{t('history.generatedBadge') || '생성'}</Text>
                        </View>
                      )}
                      {/* 바코드 타입 */}
                      <View style={[s.badge, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons
                          name={isQRCode ? 'qr-code' : 'barcode'}
                          size={11}
                          color={colors.primary}
                        />
                        <Text style={[s.badgeText, { color: colors.primary }]}>
                          {isQRCode ? 'QR' : item.type.toUpperCase()}
                        </Text>
                      </View>

                      {/* 콘텐츠 타입 (QR 코드이고 TEXT가 아닌 경우만) */}
                      {parsedContent && parsedContent.type !== QR_CONTENT_TYPES.TEXT && (
                        <View style={[s.badge, { backgroundColor: parsedContent.color + '15' }]}>
                          <Ionicons name={parsedContent.icon} size={11} color={parsedContent.color} />
                          <Text style={[s.badgeText, { color: parsedContent.color }]}>
                            {getContentTypeLabel(parsedContent.type)}
                          </Text>
                        </View>
                      )}

                      {/* 반복 횟수 */}
                      {item.count && item.count > 1 && (
                        <View style={[s.badge, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                          <Ionicons name="repeat" size={11} color="#FF9500" />
                          <Text style={[s.badgeText, { color: '#FF9500' }]}>{item.count}</Text>
                        </View>
                      )}

                      {/* EC 레벨 (QR 코드만) */}
                      {isQRCode && ecLevel && (
                        <View style={[s.badge, { backgroundColor: getECLevelColor(ecLevel) + '15' }]}>
                          <Ionicons name="shield-checkmark" size={11} color={getECLevelColor(ecLevel)} />
                          <Text style={[s.badgeText, { color: getECLevelColor(ecLevel) }]}>
                            EC:{ecLevel.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* 3줄: 스캔 시간 */}
                    <Text style={[s.time, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{formatDateTime(item.timestamp)}</Text>

                    {item.url && (
                      <Text style={[s.url, { color: colors.primary, fontFamily: fonts.regular }]} numberOfLines={1}>
                        {item.url}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          renderHiddenItem={renderHiddenItem}
          rightOpenValue={-90}
          disableRightSwipe
          closeOnRowPress
          closeOnRowOpen
          closeOnScroll
          useNativeDriver={true}
          contentContainerStyle={s.listContent}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: {
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    // marginTop은 인라인 스타일로 동적 설정
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48, // 큰 글꼴에서 잘리지 않게 고정 높이 대신 최소 높이
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  groupTabsContainer: {
    borderBottomWidth: 1,
  },
  groupTabs: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  groupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  groupTabActive: {
    // Handled inline
  },
  groupTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  groupTabTextActive: {
    // Handled inline
  },
  groupCountBadge: {
    minWidth: 20,
    minHeight: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  groupCountBadgeActive: {
    // Handled inline
  },
  groupCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupCountBadgeTextActive: {
    // Handled inline
  },
  editGroupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    gap: 4,
  },
  editGroupTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  del: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
  listContent: {
    paddingBottom: 100,
  },
  item: {
    marginHorizontal: 15,
    marginVertical: 6,
    padding: 16,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  barcodeTypeText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  analyzeIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 7,
    padding: 4,
  },
  lotteryIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemInfoWithPhoto: {
    marginLeft: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  code: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9500',
    marginLeft: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  time: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  url: {
    fontSize: 12,
    marginTop: 8,
  },
  rowBack: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 8,
    marginHorizontal: 15,
    marginVertical: 6,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
