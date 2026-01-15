// screens/LotteryResultScreen.js - 복권 당첨 결과 화면

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseLotteryQR, getLottoNumberColor } from '../utils/lotteryParser';
import { checkLotteryResult, formatPrize, getWinMessage } from '../utils/lotteryChecker';
import { isDrawCompleted, getNextDrawTime } from '../utils/lotteryApi';

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

  useEffect(() => {
    loadLotteryResult();
  }, [params.code]);

  const loadLotteryResult = async () => {
    try {
      setLoading(true);
      setError(null);

      // QR 코드 파싱
      const parsed = parseLotteryQR(params.code);
      if (!parsed) {
        setError('유효하지 않은 복권 QR 코드입니다.');
        setLoading(false);
        return;
      }

      setLotteryData(parsed);

      // 추첨 완료 여부 확인
      const drawCompleted = isDrawCompleted(parsed.round, parsed.type);
      if (!drawCompleted) {
        const nextDraw = getNextDrawTime(parsed.type);
        setError(`아직 추첨 전입니다.\n추첨 예정: ${formatDate(nextDraw)}`);
        setLoading(false);
        return;
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
      const message = `🎱 로또 ${result.round}회 당첨 결과\n\n` +
        `당첨번호: ${result.winNumbers.join(', ')} + ${result.bonusNumber}\n\n` +
        `${getWinMessage(result.bestRank, result.totalPrize)}`;

      await Share.share({ message });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const renderNumberBall = (num, isWin = false, isBonus = false, size = 36) => {
    const bgColor = isWin ? getLottoNumberColor(num) : (isDark ? '#333' : '#E0E0E0');
    const textColor = isWin ? '#fff' : colors.textSecondary;

    return (
      <View
        key={num}
        style={[
          styles.numberBall,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
            borderWidth: isBonus ? 2 : 0,
            borderColor: isBonus ? '#FFD700' : 'transparent',
          }
        ]}
      >
        <Text style={[styles.numberText, { color: textColor, fontSize: size * 0.4 }]}>
          {num}
        </Text>
      </View>
    );
  };

  const renderGameResult = (game, winNumbers, bonusNumber) => {
    const isWinner = game.rank > 0;
    const rankColor = game.rankColor || colors.textSecondary;

    return (
      <View
        key={game.label}
        style={[
          styles.gameRow,
          {
            backgroundColor: isWinner ? (rankColor + '15') : colors.surface,
            borderColor: isWinner ? rankColor : colors.border,
          }
        ]}
      >
        {/* 게임 라벨 */}
        <View style={styles.gameLabel}>
          <Text style={[styles.gameLabelText, { color: colors.text, fontFamily: fonts.bold }]}>
            {game.label}
          </Text>
        </View>

        {/* 등수 */}
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>{game.rankName}</Text>
        </View>

        {/* 번호들 */}
        <View style={styles.gameNumbers}>
          {game.numbers.map((num) => {
            const isMatch = winNumbers.includes(num);
            const isBonusMatch = num === bonusNumber && game.hasBonus;
            return renderNumberBall(num, isMatch, isBonusMatch, 32);
          })}
        </View>

        {/* 당첨금 */}
        {game.prize > 0 && (
          <Text style={[styles.prizeText, { color: rankColor, fontFamily: fonts.bold }]}>
            {formatPrize(game.prize)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {lotteryData?.type === 'lotto' ? '로또 당첨결과' : '연금복권 당첨결과'}
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            당첨 확인 중...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadLotteryResult}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : result ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 회차 정보 */}
          <View style={[styles.roundInfo, { backgroundColor: colors.surface }]}>
            <Text style={[styles.roundText, { color: colors.primary, fontFamily: fonts.bold }]}>
              {result.round}회
            </Text>
            <Text style={[styles.drawDate, { color: colors.textSecondary }]}>
              추첨일: {result.drawDate}
            </Text>
          </View>

          {/* 당첨 번호 */}
          <View style={[styles.winNumbersCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              당첨번호
            </Text>
            <View style={styles.winNumbersRow}>
              {result.winNumbers.map((num) => renderNumberBall(num, true))}
              <Text style={[styles.plusSign, { color: colors.textSecondary }]}>+</Text>
              {renderNumberBall(result.bonusNumber, true, true)}
            </View>
          </View>

          {/* 총 당첨금 */}
          <View style={[
            styles.totalPrizeCard,
            {
              backgroundColor: result.hasWin ? '#4CAF50' : colors.surface,
            }
          ]}>
            <Text style={[
              styles.totalPrizeLabel,
              { color: result.hasWin ? '#fff' : colors.textSecondary }
            ]}>
              {result.hasWin ? '🎉 축하합니다!' : '😢 아쉽습니다'}
            </Text>
            <Text style={[
              styles.totalPrizeAmount,
              {
                color: result.hasWin ? '#fff' : colors.text,
                fontFamily: fonts.bold,
              }
            ]}>
              총 {formatPrize(result.totalPrize)} 당첨
            </Text>
          </View>

          {/* 게임별 결과 */}
          <View style={styles.gamesSection}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold, marginBottom: 12 }]}>
              게임별 결과
            </Text>
            {result.games.map((game) =>
              renderGameResult(game, result.winNumbers, result.bonusNumber)
            )}
          </View>

          {/* 1등 당첨 정보 */}
          {result.firstWinAmount > 0 && (
            <View style={[styles.firstPrizeInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.firstPrizeTitle, { color: colors.textSecondary }]}>
                이번 회차 1등 당첨금
              </Text>
              <Text style={[styles.firstPrizeAmount, { color: colors.text, fontFamily: fonts.bold }]}>
                {formatPrize(result.firstWinAmount)}
              </Text>
              <Text style={[styles.firstPrizeCount, { color: colors.textSecondary }]}>
                당첨자 {result.firstWinCount}명
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  roundInfo: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  roundText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  drawDate: {
    fontSize: 14,
    marginTop: 4,
  },
  winNumbersCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  numberText: {
    fontWeight: 'bold',
  },
  plusSign: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  totalPrizeCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalPrizeLabel: {
    fontSize: 18,
    marginBottom: 8,
  },
  totalPrizeAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  gamesSection: {
    marginBottom: 16,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  gameLabel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  gameLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gameNumbers: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  prizeText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  firstPrizeInfo: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  firstPrizeTitle: {
    fontSize: 14,
  },
  firstPrizeAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  firstPrizeCount: {
    fontSize: 14,
    marginTop: 4,
  },
});
