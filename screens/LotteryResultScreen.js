// screens/LotteryResultScreen.js - 복권 당첨 결과 화면

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseLotteryQR, getLottoNumberColor } from '../utils/lotteryParser';
import { checkLotteryResult, formatPrize, getWinMessage } from '../utils/lotteryChecker';
import { getLottoWinNumbers, getPensionWinNumbers } from '../utils/lotteryApi';

export default function LotteryResultScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [lotteryData, setLotteryData] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isBeforeDraw, setIsBeforeDraw] = useState(false);
  const [nextDrawTime, setNextDrawTime] = useState(null);

  useEffect(() => {
    loadLotteryResult();
  }, [params.code]);

  const loadLotteryResult = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsBeforeDraw(false);

      // QR 코드 파싱
      const parsed = parseLotteryQR(params.code);
      if (!parsed) {
        setError('유효하지 않은 복권 QR 코드입니다.');
        setLoading(false);
        return;
      }

      setLotteryData(parsed);

      // API에서 당첨번호 조회 시도 (drwNoDate 포함)
      const winData = parsed.type === 'lotto'
        ? await getLottoWinNumbers(parsed.round)
        : await getPensionWinNumbers(parsed.round);

      // API에서 데이터를 가져오지 못한 경우 (추첨 전)
      if (!winData) {
        setIsBeforeDraw(true);
        setNextDrawTime(null); // API에서 추첨일을 가져올 수 없음
        setLoading(false);
        return;
      }

      // API에서 drwNoDate를 가져왔으면 사용
      if (winData.drawDate) {
        setNextDrawTime(new Date(winData.drawDate + 'T20:45:00+09:00'));
      }

      // 당첨 확인
      const checkResult = await checkLotteryResult(parsed);
      if (!checkResult.success) {
        setError(checkResult.error);
        setLoading(false);
        return;
      }

      setResult(checkResult);
    } catch (err) {
      setError('당첨 확인 중 오류가 발생했습니다.');
      console.error('Lottery check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleShare = async () => {
    if (!result) return;

    try {
      let message;
      if (lotteryData?.type === 'pension') {
        message = `연금복권720+ ${result.round}회 당첨 결과\n\n` +
          `당첨번호: ${result.winGroup}조 ${result.winNumber}\n` +
          `보너스: ${result.bonusNumber}\n\n` +
          `${getWinMessage(result.bestRank, result.totalPrize, 'pension')}`;
      } else {
        message = `로또 ${result.round}회 당첨 결과\n\n` +
          `당첨번호: ${result.winNumbers.join(', ')} + ${result.bonusNumber}\n\n` +
          `${getWinMessage(result.bestRank, result.totalPrize, 'lotto')}`;
      }

      await Share.share({ message });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // 상태 배지: 당첨은 성공, 낙첨은 중립, 추첨 전은 주의 (연한 바탕 + 진한 글자)
  const WIN_TONE = { bg: colors.successSoft, fg: colors.success };
  const LOSE_TONE = { bg: colors.raised, fg: colors.textSecondary };
  const WAIT_TONE = { bg: colors.warningSoft, fg: colors.warning };

  // 게임 구분(A~E, 본추첨/보너스) 배지
  const renderGameLabel = (text, isPension, isMainDraw) => (
    <View
      style={[
        styles.gameLabel,
        isPension && styles.pensionGameLabel,
        { backgroundColor: isPension && isMainDraw ? colors.primarySoft : colors.raised },
      ]}
    >
      <Text
        style={[
          styles.gameLabelText,
          isPension && styles.pensionGameLabelText,
          { color: isPension && isMainDraw ? colors.primaryText : colors.textSecondary, fontFamily: fonts.semiBold },
        ]}
      >
        {text}
      </Text>
    </View>
  );

  const renderRankBadge = (label, tone) => (
    <View style={[styles.rankBadge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.rankText, { color: tone.fg, fontFamily: fonts.semiBold }]}>{label}</Text>
    </View>
  );

  // 묶음 카드 안의 행: 첫 행 말고는 위쪽에 얇은 구분선
  const rowSeparator = (index) => (index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight } : null);

  const renderNumberBall = (num, isBonus = false, size = 40) => {
    const bgColor = getLottoNumberColor(num);

    return (
      <View
        key={`${num}-${isBonus ? 'bonus' : 'main'}`}
        style={[
          styles.numberBall,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
            borderWidth: isBonus ? 3 : 0,
            borderColor: isBonus ? colors.text : 'transparent',
          }
        ]}
      >
        <Text style={[styles.numberText, { color: '#fff', fontSize: size * 0.4, fontWeight: 'bold' }]}>
          {num}
        </Text>
      </View>
    );
  };

  const renderGameResult = (game, winNumbers, bonusNumber, index) => {
    const isWinner = game.rank > 0;
    const rankLabel = isWinner ? `${game.rank}등당첨` : '낙첨';

    return (
      <View key={game.label} style={[styles.gameRow, rowSeparator(index)]}>
        {/* 게임 라벨 */}
        {renderGameLabel(game.label, false, false)}

        {/* 등수 배지 */}
        {renderRankBadge(rankLabel, isWinner ? WIN_TONE : LOSE_TONE)}

        {/* 번호들 - 맞춘 번호 강조 */}
        <View style={styles.gameNumbers}>
          {(game.numbers || []).map((num) => {
            const bgColor = getLottoNumberColor(num);
            const isMatch = winNumbers.includes(num);
            const isBonusMatch = num === bonusNumber && game.hasBonus;
            const isHighlighted = isMatch || isBonusMatch;
            return (
              <View
                key={num}
                style={[
                  styles.numberBall,
                  {
                    width: isHighlighted ? 36 : 32,
                    height: isHighlighted ? 36 : 32,
                    borderRadius: isHighlighted ? 18 : 16,
                    backgroundColor: isHighlighted ? bgColor : colors.raised,
                    borderWidth: isHighlighted ? 3 : 0,
                    borderColor: isBonusMatch ? colors.warning : (isMatch ? colors.success : 'transparent'),
                  }
                ]}
              >
                <Text style={[
                  styles.numberText,
                  {
                    color: isHighlighted ? '#fff' : colors.textTertiary,
                    fontSize: isHighlighted ? 14 : 12,
                    fontWeight: isHighlighted ? 'bold' : 'normal',
                  }
                ]}>
                  {num}
                </Text>
                {isHighlighted && (
                  <View style={[styles.matchIndicator, { backgroundColor: colors.success, borderColor: colors.surface }]}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // 연금복권 게임 결과 렌더링
  const renderPensionGameResult = (game, index) => {
    const isWinner = game.rank > 0 || game.rank === 'bonus';
    let rankLabel;
    if (game.rank === 'bonus') {
      rankLabel = '보너스당첨';
    } else if (game.rank > 0) {
      rankLabel = `${game.rank}등당첨`;
    } else {
      rankLabel = '낙첨';
    }

    return (
      <View key={game.label} style={[styles.gameRow, rowSeparator(index)]}>
        {/* 게임 라벨 */}
        {renderGameLabel(game.label === '본 추첨' ? '본추첨' : '보너스', true, game.label === '본 추첨')}

        {/* 등수 배지 */}
        {renderRankBadge(rankLabel, isWinner ? WIN_TONE : LOSE_TONE)}

        {/* 번호 + 당첨금 */}
        <View style={styles.gameNumbers}>
          <Text style={[styles.pensionNumber, { color: colors.text, fontFamily: fonts.bold }]}>
            {game.displayNumber}
          </Text>
        </View>

        {/* 당첨금 표시 */}
        {isWinner && game.prizeText && (
          <Text style={[styles.prizeText, { color: colors.success, fontFamily: fonts.semiBold }]}>
            {game.prizeText}
          </Text>
        )}
      </View>
    );
  };

  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const groupStyle = [styles.group, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 · 공유 */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          구매복권 당첨결과
        </Text>
        <MaterialPressable
          onPress={handleShare}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('result.share')}
        >
          <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
        </MaterialPressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            당첨 확인 중...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={[styles.stateTile, { backgroundColor: colors.errorSoft }]}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
          </View>
          <Text style={[styles.errorText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {error}
          </Text>
          <MaterialPressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadLotteryResult}
            accessibilityRole="button"
          >
            <Text style={[styles.retryButtonText, { fontFamily: fonts.semiBold }]}>다시 시도</Text>
          </MaterialPressable>
        </View>
      ) : isBeforeDraw && lotteryData ? (
        <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* 회차 정보 + 당첨 번호 - 추첨 전 */}
          <View style={cardStyle}>
            <Text style={[styles.roundText, { color: colors.text, fontFamily: fonts.bold }]}>
              {lotteryData.round}회
            </Text>
            {nextDrawTime && (
              <Text style={[styles.drawDate, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                추첨 예정: {formatDate(nextDrawTime)}
              </Text>
            )}
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              당첨번호
            </Text>
            <View style={styles.beforeDrawContainer}>
              <View style={[styles.stateTile, { backgroundColor: colors.raised }]}>
                <Ionicons name="time-outline" size={28} color={colors.textSecondary} />
              </View>
              <Text style={[styles.beforeDrawText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                추첨 전입니다
              </Text>
            </View>
          </View>

          {/* 대기중 안내 */}
          <View style={[styles.totalPrizeCard, { backgroundColor: colors.warningSoft }]}>
            <Text style={[styles.totalPrizeLabel, { color: colors.warning, fontFamily: fonts.semiBold }]}>
              ⏰ 추첨 대기중
            </Text>
            <Text style={[styles.totalPrizeAmount, styles.totalPrizeAmountSmall, { color: colors.text, fontFamily: fonts.bold }]}>
              추첨 후 당첨 결과를 확인하세요
            </Text>
          </View>

          {/* 내 복권 번호 */}
          <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            내 복권 번호
          </Text>
          <View style={groupStyle}>
            {(lotteryData?.games || []).map((game, index) => (
              <View key={index} style={[styles.gameRow, rowSeparator(index)]}>
                {/* 게임 라벨 */}
                {renderGameLabel(
                  lotteryData.type === 'pension'
                    ? (game.label === '본 추첨' ? '본추첨' : '보너스')
                    : String.fromCharCode(65 + index),
                  lotteryData.type === 'pension',
                  game.label === '본 추첨'
                )}

                {/* 대기중 배지 */}
                {renderRankBadge('대기중', WAIT_TONE)}

                {/* 번호들 */}
                <View style={styles.gameNumbers}>
                  {lotteryData.type === 'pension' ? (
                    /* 연금복권: 조+번호 표시 */
                    <Text style={[styles.pensionNumber, { color: colors.text, fontFamily: fonts.bold }]}>
                      {game.displayNumber}
                    </Text>
                  ) : (
                    /* 로또: 번호공 표시 */
                    (game.numbers || []).map((num) => {
                      const bgColor = getLottoNumberColor(num);
                      return (
                        <View
                          key={num}
                          style={[
                            styles.numberBall,
                            {
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: bgColor,
                            }
                          ]}
                        >
                          <Text style={[styles.numberText, { color: '#fff', fontSize: 13 }]}>
                            {num}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* 안내 메시지 */}
          <View style={[styles.infoBox, { backgroundColor: colors.raised }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              복권 번호가 기록탭에 저장되었습니다.{'\n'}
              추첨 후 다시 확인하시면 당첨 결과를 볼 수 있습니다.
            </Text>
          </View>
        </ScrollView>
      ) : result ? (
        <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* 회차 정보 + 당첨 번호 */}
          <View style={cardStyle}>
            <Text style={[styles.roundText, { color: colors.text, fontFamily: fonts.bold }]}>
              {result.round}회
            </Text>
            {lotteryData?.type === 'lotto' && result.drawDate && (
              <Text style={[styles.drawDate, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                추첨일: {result.drawDate}
              </Text>
            )}
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              당첨번호
            </Text>
            {lotteryData?.type === 'pension' ? (
              /* 연금복권 당첨번호 */
              <View style={styles.pensionWinNumbers}>
                <View style={styles.pensionWinRow}>
                  <Text style={[styles.pensionWinLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>1등</Text>
                  <Text style={[styles.pensionWinNumber, { color: colors.text, fontFamily: fonts.bold }]}>
                    {result.winGroup}조 {result.winNumber}
                  </Text>
                </View>
                <View style={styles.pensionWinRow}>
                  <Text style={[styles.pensionWinLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>보너스</Text>
                  <Text style={[styles.pensionWinNumber, { color: colors.text, fontFamily: fonts.bold }]}>
                    각 조 {result.bonusNumber}
                  </Text>
                </View>
              </View>
            ) : (
              /* 로또 당첨번호 */
              <View style={styles.winNumbersRow}>
                {(result.winNumbers || []).map((num) => renderNumberBall(num, false, 40))}
                <Text style={[styles.plusSign, { color: colors.textSecondary }]}>+</Text>
                {renderNumberBall(result.bonusNumber, true, 40)}
              </View>
            )}
          </View>

          {/* 총 당첨금 */}
          <View style={[
            styles.totalPrizeCard,
            result.hasWin
              ? { backgroundColor: colors.successSoft }
              : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
          ]}>
            <Text style={[
              styles.totalPrizeLabel,
              { color: result.hasWin ? colors.success : colors.textSecondary, fontFamily: fonts.semiBold }
            ]}>
              {result.hasWin ? '축하합니다!' : '아쉽습니다'}
            </Text>
            <Text style={[
              styles.totalPrizeAmount,
              {
                color: colors.text,
                fontFamily: fonts.bold,
              }
            ]}>
              {getWinMessage(result.bestRank, result.totalPrize, lotteryData?.type)}
            </Text>
          </View>

          {/* 게임별 결과 */}
          <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            게임별 결과
          </Text>
          <View style={groupStyle}>
            {lotteryData?.type === 'pension' ? (
              /* 연금복권 게임별 결과 */
              (result?.games || []).map((game, index) => renderPensionGameResult(game, index))
            ) : (
              /* 로또 게임별 결과 */
              (result?.games || []).map((game, index) =>
                renderGameResult(game, result.winNumbers || [], result.bonusNumber, index)
              )
            )}
          </View>

          {/* 1등 당첨 정보 (로또만) */}
          {lotteryData?.type === 'lotto' && result.firstWinAmount > 0 && (
            <View style={[cardStyle, styles.firstPrizeInfo]}>
              <Text style={[styles.firstPrizeTitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                이번 회차 1등 당첨금
              </Text>
              <Text style={[styles.firstPrizeAmount, { color: colors.text, fontFamily: fonts.bold }]}>
                {formatPrize(result.firstWinAmount)}
              </Text>
              <Text style={[styles.firstPrizeCount, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                당첨자 {result.firstWinCount}명
              </Text>
            </View>
          )}

          {/* 당첨 조건 설명 */}
          <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            당첨 조건
          </Text>
          <View style={[styles.infoBox, styles.prizeConditionList, { backgroundColor: colors.raised }]}>
            {lotteryData?.type === 'pension' ? (
              /* 연금복권 당첨 조건 */
              <>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>1등: 조 + 6자리 번호 모두 일치 (월 700만원 x 20년)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>2등: 끝 6자리 일치 (월 100만원 x 10년)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>3등: 끝 5자리 일치 (100만원)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>4등: 끝 4자리 일치 (10만원)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>5등: 끝 3자리 일치 (5만원)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>6등: 끝 2자리 일치 (5천원)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>7등: 끝 1자리 일치 (1천원)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>보너스: 보너스 번호 6자리 일치 (월 100만원 x 10년)</Text>
              </>
            ) : (
              /* 로또 당첨 조건 */
              <>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>1등: 6개 번호 모두 일치</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>2등: 5개 번호 + 보너스 번호 일치</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>3등: 5개 번호 일치</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>4등: 4개 번호 일치 (5만원)</Text>
                <Text style={[styles.prizeConditionItem, { color: colors.textSecondary }]}>5등: 3개 번호 일치 (5천원)</Text>
              </>
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  stateTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    height: SIZE.primaryButton,
    paddingHorizontal: 28,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
    gap: SPACE.gap,
  },
  card: {
    padding: SPACE.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  roundText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  drawDate: {
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  cardLabel: {
    ...TYPE.sectionHeader,
    marginBottom: 12,
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
  winNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  numberBall: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  numberText: {
    fontWeight: 'bold',
  },
  matchIndicator: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  pensionNumber: {
    fontSize: 16,
    letterSpacing: 1,
  },
  pensionWinNumbers: {
    alignItems: 'center',
  },
  pensionWinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 12,
  },
  pensionWinLabel: {
    fontSize: 13,
    width: 50,
    textAlign: 'right',
  },
  pensionWinNumber: {
    fontSize: 20,
    letterSpacing: 2,
  },
  plusSign: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  totalPrizeCard: {
    padding: SPACE.card,
    borderRadius: RADIUS.card,
    alignItems: 'center',
  },
  totalPrizeLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  totalPrizeAmount: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  totalPrizeAmountSmall: {
    fontSize: 17,
    letterSpacing: 0,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  gameLabel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  gameLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pensionGameLabel: {
    width: 'auto',
    paddingHorizontal: 8,
    borderRadius: RADIUS.badge,
  },
  pensionGameLabelText: {
    fontSize: 11,
  },
  rankBadge: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: RADIUS.badge,
    marginRight: 8,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gameNumbers: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  prizeText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  firstPrizeInfo: {
    alignItems: 'center',
  },
  firstPrizeTitle: {
    fontSize: 13,
  },
  firstPrizeAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  firstPrizeCount: {
    fontSize: 13,
    marginTop: 4,
  },
  beforeDrawContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  beforeDrawText: {
    fontSize: 15,
    marginTop: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: RADIUS.control,
    gap: 10,
    marginTop: SPACE.gap,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  prizeConditionList: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 0,
  },
  prizeConditionItem: {
    fontSize: 12,
    lineHeight: 18,
  },
});
