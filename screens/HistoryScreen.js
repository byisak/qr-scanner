// screens/HistoryScreen.js - 그룹별 히스토리 관리
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
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
import { labelOfItem, formatLabelSummary } from '../utils/labelParser';
import { parseGs1, formatGs1Summary } from '../utils/gs1';
import { loadLabelSettings } from '../utils/labelCategories';
import { useTabBarOverlap } from '../hooks/useTabBarOverlap';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackScreenView, trackHistoryViewed } from '../utils/analytics';
import { parseQRContent, QR_CONTENT_TYPES } from '../utils/qrContentParser';
import { SwipeListView } from 'react-native-swipe-list-view';
import { updateLotteryNotificationOnCheck } from '../utils/lotteryNotification';
import { isDrawCompleted } from '../utils/lotteryApi';
import { LotteryIcon } from '../components/LotteryIcons';
import { LOTTERY_FEATURE_ENABLED } from '../utils/lotteryFeature';
import MaterialPressable from '../components/MaterialPressable';

const DEFAULT_GROUP_ID = 'default';
const HISTORY_VIEW_GROUP_KEY = 'historyViewGroupId';

const pad2 = (n) => String(n).padStart(2, '0');
const formatDay = (timestamp) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
};

// 왼쪽 40x40 종류 배지: URL은 강조, 2D(DataMatrix 등)는 성공, 1D 바코드는 주의, 그 밖의 QR은 중립
const TWO_D_LABELS = { datamatrix: 'DM', pdf417: 'PDF', aztec: 'AZ', maxicode: 'MAXI', microqr: 'MQR' };
const getKindBadge = (item, isQRCode, parsedContent, colors) => {
  if (isQRCode) {
    if (parsedContent && parsedContent.type === QR_CONTENT_TYPES.URL) {
      return { label: 'URL', bg: colors.primarySoft, fg: colors.primaryText };
    }
    return { label: 'QR', bg: colors.raised, fg: colors.textSecondary };
  }
  const type = String(item.type || '').toLowerCase();
  if (TWO_D_LABELS[type]) return { label: TWO_D_LABELS[type], bg: colors.successSoft, fg: colors.success };
  return { label: '1D', bg: colors.warningSoft, fg: colors.warning };
};

// 연한 바탕 + 진한 글자 배지
function SoftBadge({ bg, fg, icon, label, fontFamily }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={fg} /> : null}
      <Text style={[s.badgeText, { color: fg, fontFamily }]}>{label}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { triggerSync } = useSync();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const tabBarOverlap = useTabBarOverlap(); // 탭바에 가려지는 높이 (목록 끝 여백)

  // 노치 없는 SE(inset 20)부터 Dynamic Island(59)까지 대응하도록 insets 기준으로 계산
  const headerPaddingTop = insets.top + 8;

  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
  const [selectedGroupId, setSelectedGroupId] = useState(DEFAULT_GROUP_ID);
  const [scanHistory, setScanHistory] = useState({ [DEFAULT_GROUP_ID]: [] });
  const [query, setQuery] = useState('');
  const [filteredList, setFilteredList] = useState([]);
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true); // 저장소를 읽는 동안 "기록 없음"이 잠깐 보이는 것 방지
  const [labelCategories, setLabelCategories] = useState([]); // 라벨 필드 요약 표시용
  const feedback = useFeedback();

  // 그룹 데이터 로드
  const loadGroups = async () => {
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      // 히스토리에서 보고 있는 그룹은 스캐너의 저장 그룹(selectedGroupId)과 따로 기억한다.
      // 같은 키를 쓰면 B그룹 기록을 보기만 해도 이후 스캔이 B그룹에 저장됐다
      const viewedId = await AsyncStorage.getItem(HISTORY_VIEW_GROUP_KEY);
      const selectedId = viewedId || await AsyncStorage.getItem('selectedGroupId');
      const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
      loadLabelSettings().then(ls => setLabelCategories(ls.categories)).catch(() => {});

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
        // 보던 그룹이 삭제됐거나 숨겨졌으면 기본 그룹으로
        if (selectedId && !localizedGroups.some(g => g.id === selectedId)) {
          setSelectedGroupId(DEFAULT_GROUP_ID);
          if (historyData) setScanHistory(JSON.parse(historyData));
          return;
        }
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
    await AsyncStorage.setItem(HISTORY_VIEW_GROUP_KEY, groupId);
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

  // 날짜 섹션 하나가 둥근 묶음 카드 하나: 첫 행은 위 모서리, 마지막 행은 아래 모서리, 사이는 가는 구분선
  const rowEdgeStyle = (index, count) => [
    { backgroundColor: colors.surface, borderColor: colors.border },
    index === 0 ? s.rowFirst : [s.rowSeparated, { borderTopColor: colors.borderLight }],
    index === count - 1 && s.rowLast,
  ];

  // SwipeListView에서 숨겨진 삭제 버튼 렌더링 (항상 44pt 이상)
  const renderHiddenItem = (data, rowMap) => {
    const item = data.item;
    const rowCount = data.section ? data.section.data.length : 1;
    return (
      <View style={[s.rowBack, rowEdgeStyle(data.index, rowCount)]}>
        <MaterialPressable
          style={[s.deleteBtn, { backgroundColor: colors.errorSoft }, Platform.OS === 'android' && s.androidClip]}
          onPress={() => {
            if (rowMap[item.timestamp]) {
              rowMap[item.timestamp].closeRow();
            }
            deleteHistoryItem(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Ionicons name="trash" size={22} color={colors.error} />
        </MaterialPressable>
      </View>
    );
  };

  // 날짜는 섹션 머리글(formatDay)에, 행 오른쪽에는 시:분만
  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  // 날짜별 섹션 (filteredList는 최신순이라 같은 날 항목이 붙어 있다)
  const sections = useMemo(() => {
    const out = [];
    filteredList.forEach((item) => {
      const day = formatDay(item.timestamp);
      const last = out[out.length - 1];
      if (last && last.title === day) last.data.push(item);
      else out.push({ title: day, data: [item] });
    });
    return out;
  }, [filteredList]);

  const handleItemPress = async (item) => {
    // 복권 아이템인 경우 복권 결과 화면으로 이동 (기능을 꺼 두면 일반 결과 화면으로, lotteryData는 그대로)
    if (LOTTERY_FEATURE_ENABLED && item.lotteryData) {
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
        location: item.location || '', // 규칙으로 지정된 위치
        // 생성 코드 데이터 (편집용)
        isGenerated: item.isGenerated ? 'true' : 'false',
        generatorData: item.generatorData ? JSON.stringify(item.generatorData) : '',
        thumbnail: item.thumbnail || '',
      }
    });
  };

  // 각 그룹의 스캔 개수 계산
  const getGroupScanCount = (groupId) => {
    const history = scanHistory[groupId] || [];
    return history.length;
  };

  return (
    <View style={[s.c, { backgroundColor: colors.background }]}>
      {/* 헤더: 큰 탭 제목 + 오른쪽 아이콘 버튼 */}
      <View style={[s.header, { paddingTop: headerPaddingTop }]}>
        <Text style={[s.title, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
          {t('history.title')}
        </Text>
        {currentHistory.length > 0 && (
          <MaterialPressable
            style={s.iconButton}
            onPress={clearCurrentGroupHistory}
            accessibilityLabel={t('history.deleteAll')}
            accessibilityRole="button"
            borderless
          >
            <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
          </MaterialPressable>
        )}
      </View>

      {/* 검색 */}
      <View style={s.searchWrap}>
        <View style={[s.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[s.input, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('history.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={t('common.search')}
          />
          {query ? (
            <MaterialPressable onPress={() => setQuery('')} accessibilityLabel={t('history.clearSearch')} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </MaterialPressable>
          ) : null}
        </View>
      </View>

      {/* 그룹 선택 칩 */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {groups.map((group) => {
            const scanCount = getGroupScanCount(group.id);
            const isActive = selectedGroupId === group.id;
            const labelColor = isActive ? colors.background : colors.textSecondary;
            return (
              <MaterialPressable
                key={group.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={[
                  s.chip,
                  isActive
                    ? { backgroundColor: colors.text, borderColor: colors.text }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                hitSlop={{ top: 4, bottom: 4 }}
                onPress={() => selectGroup(group.id)}
              >
                {group.isCloudSync && (
                  <Ionicons name="cloud" size={14} color={isActive ? colors.background : colors.primaryText} />
                )}
                {group.isScanUrlGroup && (
                  <Ionicons name="link" size={14} color={isActive ? colors.background : colors.success} />
                )}
                <Text style={[s.chipText, { color: labelColor, fontFamily: isActive ? fonts.semiBold : fonts.regular, fontWeight: isActive ? '600' : '500' }]} numberOfLines={1}>
                  {group.id === DEFAULT_GROUP_ID ? t('groupEdit.defaultGroup') :
                   group.id === 'lottery-lotto' ? t('history.lottoGroup') :
                   group.id === 'lottery-pension' ? t('history.pensionGroup') : group.name}
                </Text>
                {scanCount > 0 && (
                  <Text style={[s.chipCount, isActive ? { color: colors.background, opacity: 0.7 } : { color: colors.textTertiary }, { fontFamily: fonts.regular }]}>
                    {scanCount}
                  </Text>
                )}
              </MaterialPressable>
            );
          })}
          <MaterialPressable style={[s.chip, s.chipDashed, { borderColor: colors.border }]} hitSlop={{ top: 4, bottom: 4 }} onPress={() => router.push('/group-edit')}>
            <Text style={[s.chipText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('history.editGroups')}</Text>
          </MaterialPressable>
        </ScrollView>
      </View>

      {/* 히스토리 목록 */}
      {isLoading && filteredList.length === 0 ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredList.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="file-tray-outline" size={48} color={colors.textTertiary} />
          <Text style={[s.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{query ? t('history.noSearchResults') : t('history.emptyList')}</Text>
        </View>
      ) : (
        <SwipeListView
          useSectionList
          sections={sections}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{section.title}</Text>
          )}
          keyExtractor={(item) => `${item.timestamp}_${item.code || ''}`}
          renderItem={({ item, index, section }) => {
            const rowCount = section.data.length;
            const hasPhoto = item.photos && item.photos.length > 0;
            const hasThumbnail = item.thumbnail && !imageErrors[item.timestamp]; // 생성 코드 썸네일
            const isQRCode = !item.type || item.type === 'qr' || item.type === 'qrcode';
            const isGenerated = item.isGenerated === true;
            const ecLevel = item.errorCorrectionLevel;

            // QR 콘텐츠 파싱 (QR 코드인 경우에만)
            const parsedContent = isQRCode ? parseQRContent(item.code) : null;

            // 복권 아이템인 경우 특별 렌더링 (기능을 꺼 두면 일반 항목처럼 보인다)
            if (LOTTERY_FEATURE_ENABLED && item.lotteryData) {
              const lotteryInfo = item.lotteryData;
              const isLotto = lotteryInfo.type === 'lotto';

              return (
                <MaterialPressable
                  style={[s.row, rowEdgeStyle(index, rowCount)]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${lotteryInfo.typeName} ${t('history.roundLabel', { round: lotteryInfo.round })}`}
                  accessibilityRole="button"
                  accessibilityActions={rowAccessibilityActions}
                  onAccessibilityAction={handleRowAccessibilityAction(item)}
                >
                  {/* 복권 아이콘 (복주머니만) */}
                  <View style={[s.lead, { backgroundColor: colors.raised }]}>
                    <LotteryIcon type={isLotto ? 'lotto' : 'pension'} size={28} iconOnly />
                  </View>
                  <View style={s.rowBody}>
                    {/* 1줄: 복권 종류 및 회차 */}
                    <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
                      {lotteryInfo.typeName} {t('history.roundLabel', { round: lotteryInfo.round })}
                      {!isLotto && lotteryInfo.displayNumber && ` (${lotteryInfo.displayNumber})`}
                    </Text>

                    {/* 2줄: 배지들 */}
                    <View style={s.badgeRow}>
                      {/* 복권 타입 배지 */}
                      <SoftBadge fontFamily={fonts.semiBold}
                        bg={isLotto ? colors.warningSoft : colors.successSoft}
                        fg={isLotto ? colors.warning : colors.success}
                        label={isLotto ? t('history.lottoBadge') : t('history.pensionBadge')}
                      />

                      {/* 게임 수 (로또만) */}
                      {isLotto && lotteryInfo.gameCount && (
                        <SoftBadge fontFamily={fonts.semiBold} bg={colors.primarySoft} fg={colors.primaryText} label={t('history.gamesLabel', { count: lotteryInfo.gameCount })} />
                      )}

                      {/* 확인 상태 - 추첨 완료 여부에 따라 다르게 표시 */}
                      {(() => {
                        const drawCompleted = isDrawCompleted(lotteryInfo.round, lotteryInfo.type);
                        if (lotteryInfo.isChecked) {
                          // 확인 완료
                          return <SoftBadge fontFamily={fonts.semiBold} bg={colors.successSoft} fg={colors.success} icon="checkmark-circle" label={t('history.checked')} />;
                        } else if (drawCompleted) {
                          // 추첨 완료 + 미확인
                          return <SoftBadge fontFamily={fonts.semiBold} bg={colors.errorSoft} fg={colors.error} icon="alert-circle" label={t('history.unchecked')} />;
                        }
                        // 추첨 전 대기중
                        return <SoftBadge fontFamily={fonts.semiBold} bg={colors.warningSoft} fg={colors.warning} icon="time-outline" label={t('history.pending')} />;
                      })()}
                    </View>
                  </View>
                  {/* 스캔 시각 */}
                  <Text style={[s.time, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                    {formatTime(item.timestamp)}
                  </Text>
                </MaterialPressable>
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

            const kind = getKindBadge(item, isQRCode, parsedContent, colors);

            // 보조 줄: 코드 종류 · 수량 · 라벨/GS1 요약 · 위치
            const labelSummary = formatLabelSummary(labelOfItem(item, labelCategories), 3, t);
            const meta = [
              isQRCode ? 'QR' : item.type.toUpperCase(),
              typeof item.quantity === 'number' ? t('scanner.quantityBadge', { count: item.quantity }) : '',
              labelSummary || formatGs1Summary(item.gs1 || parseGs1(item.code), t),
              item.location ? `${t('result.location')} ${item.location}` : '',
            ].filter(Boolean).join(' · ');

            const showContentType = parsedContent && parsedContent.type !== QR_CONTENT_TYPES.TEXT;
            const showCount = item.count && item.count > 1;
            const showEc = isQRCode && ecLevel;
            const hasBadges = isGenerated || showContentType || showCount || showEc;

            return (
              <MaterialPressable
                style={[s.row, rowEdgeStyle(index, rowCount)]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
                accessibilityLabel={`${t('history.scanRecord')}: ${item.code}`}
                accessibilityRole="button"
                accessibilityActions={rowAccessibilityActions}
                onAccessibilityAction={handleRowAccessibilityAction(item)}
              >
                {/* 왼쪽: 사진(누르면 이미지 분석) · 생성 QR 썸네일 · 종류 배지 */}
                {!isGenerated && hasPhoto ? (
                  <MaterialPressable
                    onPress={() => !imageErrors[item.timestamp] && router.push({
                      pathname: '/image-analysis',
                      params: { imageUri: item.photos[0] }
                    })}
                    activeOpacity={imageErrors[item.timestamp] ? 1 : 0.7}
                    hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  >
                    {imageErrors[item.timestamp] ? (
                      <View style={[s.lead, { backgroundColor: colors.raised }]}>
                        <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                      </View>
                    ) : (
                      <View style={[s.lead, { backgroundColor: colors.raised }]}>
                        <Image
                          source={{ uri: item.photos[0] }}
                          style={s.leadImage}
                          resizeMode="cover"
                          onError={() => setImageErrors(prev => ({ ...prev, [item.timestamp]: true }))}
                        />
                        <View style={[s.analyzeIconOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                          <Ionicons name="scan" size={11} color="#fff" />
                        </View>
                      </View>
                    )}
                  </MaterialPressable>
                ) : isGenerated && isQRCode && hasThumbnail ? (
                  <View style={[s.lead, s.leadThumb, { borderColor: colors.border }]}>
                    <Image
                      source={{ uri: item.thumbnail }}
                      style={s.leadImage}
                      resizeMode="contain"
                      onError={() => setImageErrors(prev => ({ ...prev, [item.timestamp]: true }))}
                    />
                  </View>
                ) : (
                  <View style={[s.lead, { backgroundColor: kind.bg }]}>
                    <Text style={[s.leadText, { color: kind.fg }]} numberOfLines={1}>{kind.label}</Text>
                  </View>
                )}

                <View style={s.rowBody}>
                  {/* 1줄: 스캔값 */}
                  <Text style={[s.value, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                    {item.code}
                  </Text>
                  {/* 2줄: 종류 · 수량 · 라벨 요약 · 위치 */}
                  <Text style={[s.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1} ellipsizeMode="middle">
                    {meta}
                  </Text>
                  {item.memo ? (
                    <Text style={[s.meta, { color: colors.textTertiary, fontFamily: fonts.regular, fontStyle: 'italic' }]} numberOfLines={1}>
                      {item.memo}
                    </Text>
                  ) : null}

                  {/* 배지: 생성, 콘텐츠 종류, 반복 횟수, 오류 정정 레벨 */}
                  {hasBadges && (
                    <View style={s.badgeRow}>
                      {isGenerated && (
                        <SoftBadge fontFamily={fonts.semiBold} bg={colors.raised} fg={colors.textSecondary} icon="create-outline" label={t('history.generatedBadge') || '생성'} />
                      )}
                      {showContentType && (
                        <SoftBadge fontFamily={fonts.semiBold} bg={colors.primarySoft} fg={colors.primaryText} icon={parsedContent.icon} label={getContentTypeLabel(parsedContent.type)} />
                      )}
                      {showCount && (
                        <SoftBadge fontFamily={fonts.semiBold} bg={colors.warningSoft} fg={colors.warning} icon="repeat" label={String(item.count)} />
                      )}
                      {showEc && (
                        <SoftBadge fontFamily={fonts.semiBold} bg={colors.raised} fg={colors.textSecondary} icon="shield-checkmark" label={`EC:${ecLevel.toUpperCase()}`} />
                      )}
                    </View>
                  )}

                  {item.url && (
                    <Text style={[s.meta, { color: colors.primaryText, fontFamily: fonts.regular }]} numberOfLines={1}>
                      {item.url}
                    </Text>
                  )}
                </View>

                {/* 스캔 시각 */}
                <Text style={[s.time, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{formatTime(item.timestamp)}</Text>
              </MaterialPressable>
            );
          }}
          renderHiddenItem={renderHiddenItem}
          rightOpenValue={-90}
          disableRightSwipe
          closeOnRowPress
          closeOnRowOpen
          closeOnScroll
          useNativeDriver={true}
          contentContainerStyle={[s.listContent, { paddingBottom: tabBarOverlap + 24 }]}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    // paddingTop은 인라인 스타일로 동적 설정
    paddingBottom: SPACE.section,
    minHeight: SIZE.touch,
  },
  title: {
    ...TYPE.tabTitle,
    flex: 1,
  },
  iconButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    marginRight: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrap: {
    paddingHorizontal: SPACE.screen,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.input, // 큰 글꼴에서 잘리지 않게 고정 높이 대신 최소 높이
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingVertical: 0,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.gap,
    paddingHorizontal: SPACE.screen,
    paddingTop: SPACE.section,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.chip,
    paddingHorizontal: 12,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden', // Android 물결이 칩 모서리 안에 머물게
  },
  chipDashed: {
    borderStyle: 'dashed',
  },
  chipText: {
    fontSize: 13,
  },
  chipCount: {
    fontSize: 12,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACE.screen,
    paddingBottom: 100,
  },
  emptyText: {
    ...TYPE.body,
    marginTop: SPACE.section,
    textAlign: 'center',
  },
  listContent: {
    // iOS는 반투명 탭바 밑까지 목록이 그려져 여유가 필요. Android 네이티브 탭바는 가리지 않는다
    paddingTop: 4,
    paddingBottom: 100, // 실제 값은 탭바 높이 기준으로 인라인에서 덮어쓴다
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: SPACE.section,
    marginBottom: 6,
    marginHorizontal: SPACE.screen + 4,
  },
  // 행: 섹션 묶음 카드의 한 줄 (그림자 없음)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.rowWithDesc,
    marginHorizontal: SPACE.screen,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden', // 물결·사진이 묶음 모서리 안에 머물게
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: RADIUS.group,
    borderTopRightRadius: RADIUS.group,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: RADIUS.group,
    borderBottomRightRadius: RADIUS.group,
  },
  rowSeparated: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lead: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  leadThumb: {
    backgroundColor: 'white', // QR 이미지는 흰 바탕이어야 읽힌다
    borderWidth: 1,
  },
  leadImage: {
    width: '100%',
    height: '100%',
  },
  leadText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '500',
  },
  analyzeIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderTopLeftRadius: 6,
    padding: 3,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...TYPE.body,
  },
  value: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '500',
  },
  meta: {
    ...TYPE.caption,
  },
  time: {
    ...TYPE.caption,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.badge,
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  androidClip: {
    overflow: 'hidden',
  },
  // 밀었을 때 보이는 뒷면: 앞 행과 같은 묶음 카드 모양을 유지
  rowBack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: SPACE.screen,
    paddingRight: 14,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  deleteBtn: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: RADIUS.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
