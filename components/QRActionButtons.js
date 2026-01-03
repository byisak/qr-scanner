// components/QRActionButtons.js - QR 타입별 액션 버튼 컴포넌트
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { QR_CONTENT_TYPES } from '../utils/qrContentParser';

/**
 * QR 타입별 액션 버튼 컴포넌트
 */
export default function QRActionButtons({
  parsedContent,
  colors,
  fonts,
  t,
  onCopy,
  onShare,
  onOpenUrl,
}) {
  const { type, data, raw } = parsedContent;

  // 전화걸기
  const handleCall = async () => {
    const phoneNumber = data.phoneNumber || (data.phones && data.phones[0]);
    if (!phoneNumber) return;

    const url = `tel:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('result.error') || '오류', t('qrActions.cannotCall') || '전화를 걸 수 없습니다.');
      }
    } catch (error) {
      console.error('Call error:', error);
    }
  };

  // SMS 보내기
  const handleSendSms = async () => {
    const phoneNumber = data.phoneNumber;
    const body = data.body || '';
    if (!phoneNumber) return;

    let url = `sms:${phoneNumber}`;
    if (body) {
      url += Platform.OS === 'ios' ? `&body=${encodeURIComponent(body)}` : `?body=${encodeURIComponent(body)}`;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('SMS error:', error);
    }
  };

  // 이메일 보내기
  const handleSendEmail = async () => {
    const email = data.email || (data.emails && data.emails[0]);
    if (!email) return;

    let url = `mailto:${email}`;
    const params = [];
    if (data.subject) params.push(`subject=${encodeURIComponent(data.subject)}`);
    if (data.body) params.push(`body=${encodeURIComponent(data.body)}`);
    if (data.cc) params.push(`cc=${encodeURIComponent(data.cc)}`);
    if (data.bcc) params.push(`bcc=${encodeURIComponent(data.bcc)}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Email error:', error);
    }
  };

  // 지도 열기
  const handleOpenMap = async () => {
    const { latitude, longitude, query } = data;
    if (latitude === undefined || longitude === undefined) return;

    let url;
    if (Platform.OS === 'ios') {
      url = `maps:?ll=${latitude},${longitude}&q=${query || '위치'}`;
    } else {
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${query || '위치'})`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Google Maps 웹 URL로 폴백
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Map error:', error);
    }
  };

  // 길찾기
  const handleGetDirections = async () => {
    const { latitude, longitude } = data;
    if (latitude === undefined || longitude === undefined) return;

    let url;
    if (Platform.OS === 'ios') {
      url = `maps:?daddr=${latitude},${longitude}&dirflg=d`;
    } else {
      url = `google.navigation:q=${latitude},${longitude}`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Google Maps 웹 URL로 폴백
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Directions error:', error);
    }
  };

  // WiFi 비밀번호 복사
  const handleCopyWifiPassword = async () => {
    if (!data.password) {
      Alert.alert(t('result.info') || '정보', t('qrActions.noPassword') || '비밀번호가 없습니다.');
      return;
    }
    await Clipboard.setStringAsync(data.password);
    Alert.alert(t('result.copySuccess') || '복사됨', t('qrActions.passwordCopied') || '비밀번호가 복사되었습니다.');
  };

  // WiFi 설정 열기
  const handleOpenWifiSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:WIFI');
      } else {
        await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      }
    } catch (error) {
      Alert.alert(t('result.info') || '정보', t('qrActions.openSettingsManually') || '설정 앱에서 WiFi를 연결해주세요.');
    }
  };

  // 연락처 추가 (expo-contacts 필요 - 추후 구현)
  const handleAddContact = () => {
    Alert.alert(
      t('qrActions.addContact') || '연락처 추가',
      t('qrActions.addContactDesc') || '연락처 앱에서 수동으로 추가해주세요.\n\n' +
        (data.fullName ? `이름: ${data.fullName}\n` : '') +
        (data.phones?.[0] ? `전화: ${data.phones[0]}\n` : '') +
        (data.emails?.[0] ? `이메일: ${data.emails[0]}` : ''),
      [{ text: t('common.ok') || '확인' }]
    );
  };

  // 캘린더 추가 (expo-calendar 필요 - 추후 구현)
  const handleAddToCalendar = () => {
    Alert.alert(
      t('qrActions.addToCalendar') || '캘린더에 추가',
      t('qrActions.addToCalendarDesc') || '캘린더 앱에서 수동으로 추가해주세요.\n\n' +
        (data.title ? `제목: ${data.title}\n` : '') +
        (data.location ? `장소: ${data.location}\n` : '') +
        (data.startDate ? `시작: ${data.startDate.toLocaleString()}\n` : '') +
        (data.endDate ? `종료: ${data.endDate.toLocaleString()}` : ''),
      [{ text: t('common.ok') || '확인' }]
    );
  };

  // 웹 검색
  const handleSearchWeb = async () => {
    const query = encodeURIComponent(data.text || raw);
    const url = `https://www.google.com/search?q=${query}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // 액션 버튼 렌더링
  const renderActionButton = (icon, label, onPress, color = colors.primary) => (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: color + '15', borderColor: color + '30' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color, fontFamily: fonts.medium }]}>{label}</Text>
    </TouchableOpacity>
  );

  // 타입별 액션 버튼 그룹
  const renderActions = () => {
    switch (type) {
      case QR_CONTENT_TYPES.PHONE:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('call', t('qrActions.call') || '전화걸기', handleCall, '#34C759')}
              {renderActionButton('person-add', t('qrActions.addContact') || '연락처 추가', handleAddContact, '#FF2D55')}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.SMS:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('chatbubble', t('qrActions.sendSms') || '문자 보내기', handleSendSms, '#FF9500')}
              {renderActionButton('call', t('qrActions.call') || '전화걸기', handleCall, '#34C759')}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.EMAIL:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('mail', t('qrActions.sendEmail') || '이메일 보내기', handleSendEmail, '#007AFF')}
              {renderActionButton('person-add', t('qrActions.addContact') || '연락처 추가', handleAddContact, '#FF2D55')}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.WIFI:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('wifi', t('qrActions.openWifiSettings') || 'WiFi 설정', handleOpenWifiSettings, '#5856D6')}
              {renderActionButton('key', t('qrActions.copyPassword') || '비밀번호 복사', handleCopyWifiPassword, '#FF9500')}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.GEO:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('map', t('qrActions.openMap') || '지도에서 보기', handleOpenMap, '#FF3B30')}
              {renderActionButton('navigate', t('qrActions.getDirections') || '길찾기', handleGetDirections, '#007AFF')}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.CONTACT:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('person-add', t('qrActions.addContact') || '연락처 추가', handleAddContact, '#FF2D55')}
              {data.phones?.[0] && renderActionButton('call', t('qrActions.call') || '전화걸기', handleCall, '#34C759')}
            </View>
            <View style={styles.actionRow}>
              {data.emails?.[0] && renderActionButton('mail', t('qrActions.sendEmail') || '이메일', handleSendEmail, '#007AFF')}
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.EVENT:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('calendar', t('qrActions.addToCalendar') || '캘린더에 추가', handleAddToCalendar, '#FF9500')}
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.URL:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('globe', t('result.open') || '열기', onOpenUrl, '#667eea')}
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
          </>
        );

      case QR_CONTENT_TYPES.TEXT:
      default:
        return (
          <>
            <View style={styles.actionRow}>
              {renderActionButton('copy', t('result.copy') || '복사', onCopy)}
              {renderActionButton('share-outline', t('result.share') || '공유', onShare)}
            </View>
            <View style={styles.actionRow}>
              {renderActionButton('search', t('qrActions.searchWeb') || '웹 검색', handleSearchWeb, '#8E8E93')}
            </View>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderActions()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
