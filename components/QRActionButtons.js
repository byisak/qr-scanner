// components/QRActionButtons.js - QR 타입별 액션 버튼 컴포넌트
import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert, Platform, ActivityIndicator, PermissionsAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import WifiManager from 'react-native-wifi-reborn';
import { QR_CONTENT_TYPES } from '../utils/qrContentParser';
import MaterialPressable from './MaterialPressable';
import { RADIUS, SIZE } from '../constants/Design';

/**
 * QR 타입별 액션 버튼 컴포넌트.
 * 타입마다 대표 동작 하나는 꽉 찬 주 버튼, 나머지는 같은 크기의 타일(3열)로 둔다.
 * extraActions: 화면이 덧붙이는 타일 [{ icon, label, onPress }] (예: 코드 재생성)
 */
export default function QRActionButtons({
  parsedContent,
  colors,
  fonts,
  t,
  onCopy,
  onShare,
  onOpenUrl,
  extraActions = [],
}) {
  const { type, data, raw } = parsedContent;

  // 전화걸기
  const handleCall = async () => {
    const phoneNumber = data.phoneNumber || (data.phones && data.phones[0]);
    if (!phoneNumber) return;

    // Android 11+에서는 <queries>에 tel 스킴이 없으면 canOpenURL이 false를 돌려주므로 바로 연다
    const url = `tel:${phoneNumber}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Call error:', error);
      Alert.alert(t('result.error') || '오류', t('qrActions.cannotCall') || '전화를 걸 수 없습니다.');
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

  // 네트워크 이름 복사
  const handleCopyNetworkName = async () => {
    if (!data.ssid) return;
    await Clipboard.setStringAsync(data.ssid);
    Alert.alert(t('result.copySuccess') || '복사됨', t('qrActions.networkCopied') || '네트워크 이름이 복사되었습니다.');
  };

  // WiFi 연결 상태
  const [isConnecting, setIsConnecting] = useState(false);

  // WiFi 자동 연결
  const handleConnectWifi = async () => {
    if (!data.ssid) {
      Alert.alert(t('result.error') || '오류', t('qrActions.noNetworkName') || '네트워크 이름이 없습니다.');
      return;
    }

    const securityType = (data.security || 'WPA').toUpperCase();
    const ssid = data.ssid;
    const password = data.password || '';

    // WPA/WPA2는 최소 8자 비밀번호 필요
    if (securityType !== 'NOPASS' && securityType !== 'NONE' && securityType !== 'WEP') {
      if (password.length > 0 && password.length < 8) {
        Alert.alert(
          t('qrActions.connectionFailed') || '연결 실패',
          t('qrActions.invalidPassword') || 'WPA/WPA2 비밀번호는 8자 이상이어야 합니다. 설정에서 직접 연결하시겠습니까?',
          [
            { text: t('common.cancel') || '취소', style: 'cancel' },
            {
              text: t('qrActions.openSettings') || '설정 열기',
              onPress: () => openWifiSettings()
            }
          ]
        );
        return;
      }
    }

    setIsConnecting(true);

    try {
      // Android에서 위치 권한 필요
      if (Platform.OS === 'android') {
        // react-native-wifi-reborn에는 requestPermissions가 없다. 위치 권한은 RN API로 직접 요청한다
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        if (!granted) {
          Alert.alert(
            t('result.permissionDenied') || '권한 거부',
            t('qrActions.locationPermissionForWifi') || 'WiFi 연결을 위해 위치 권한이 필요합니다.'
          );
          setIsConnecting(false);
          return;
        }
      }

      // 보안 타입에 따른 연결
      const isWep = securityType === 'WEP';
      const isOpen = securityType === 'NOPASS' || securityType === 'NONE' || !password;

      if (isOpen) {
        // 오픈 네트워크
        if (Platform.OS === 'ios') {
          await WifiManager.connectToSSID(ssid);
        } else {
          await WifiManager.connectToProtectedSSID(ssid, '', false, false);
        }
      } else {
        // 보안 네트워크 (WEP 또는 WPA/WPA2)
        await WifiManager.connectToProtectedSSID(ssid, password, isWep, false);
      }

      Alert.alert(
        t('common.success') || '성공',
        (t('qrActions.wifiConnected') || 'WiFi에 연결되었습니다.').replace('{ssid}', ssid)
      );
    } catch (error) {
      console.error('WiFi connection error:', error);

      // 실패 시 설정 앱으로 이동 옵션 제공
      Alert.alert(
        t('qrActions.connectionFailed') || '연결 실패',
        t('qrActions.wifiConnectionError') || 'WiFi 연결에 실패했습니다. 설정에서 직접 연결하시겠습니까?',
        [
          { text: t('common.cancel') || '취소', style: 'cancel' },
          {
            text: t('qrActions.openSettings') || '설정 열기',
            onPress: () => openWifiSettings()
          }
        ]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // WiFi 설정 열기
  const openWifiSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:WIFI');
      } else {
        await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      }
    } catch (e) {
      console.error('Open settings error:', e);
      // 폴백: 일반 설정 열기
      try {
        if (Platform.OS === 'ios') {
          await Linking.openURL('app-settings:');
        } else {
          await Linking.openSettings();
        }
      } catch (e2) {
        console.error('Open general settings error:', e2);
      }
    }
  };

  // 연락처 추가
  const handleAddContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('result.permissionDenied') || '권한 거부',
          t('qrActions.contactPermissionDenied') || '연락처 권한이 필요합니다.'
        );
        return;
      }

      const contact = {
        [Contacts.Fields.FirstName]: data.firstName || data.fullName || '',
        [Contacts.Fields.LastName]: data.lastName || '',
        [Contacts.Fields.Company]: data.organization || '',
        [Contacts.Fields.JobTitle]: data.title || '',
      };

      if (data.phones && data.phones.length > 0) {
        contact[Contacts.Fields.PhoneNumbers] = data.phones.map(phone => ({
          label: 'mobile',
          number: phone,
        }));
      }

      if (data.emails && data.emails.length > 0) {
        contact[Contacts.Fields.Emails] = data.emails.map(email => ({
          label: 'work',
          email: email,
        }));
      }

      if (data.addresses && data.addresses.length > 0) {
        contact[Contacts.Fields.Addresses] = data.addresses.map(addr => ({
          label: 'home',
          street: addr,
        }));
      }

      if (data.urls && data.urls.length > 0) {
        contact[Contacts.Fields.UrlAddresses] = data.urls.map(url => ({
          label: 'homepage',
          url: url,
        }));
      }

      if (data.note) {
        contact[Contacts.Fields.Note] = data.note;
      }

      // iOS에서는 presentFormAsync, Android에서도 동일
      const contactId = await Contacts.addContactAsync(contact);

      if (contactId) {
        Alert.alert(
          t('common.success') || '성공',
          t('qrActions.contactAdded') || '연락처가 추가되었습니다.'
        );
      }
    } catch (error) {
      console.error('Add contact error:', error);
      // 실패 시 수동 추가 안내
      Alert.alert(
        t('qrActions.addContact') || '연락처 추가',
        t('qrActions.addContactDesc') || '연락처 앱에서 수동으로 추가해주세요.\n\n' +
          (data.fullName ? `이름: ${data.fullName}\n` : '') +
          (data.phones?.[0] ? `전화: ${data.phones[0]}\n` : '') +
          (data.emails?.[0] ? `이메일: ${data.emails[0]}` : ''),
        [{ text: t('common.confirm') || '확인' }]
      );
    }
  };

  // 캘린더에 추가
  const handleAddToCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('result.permissionDenied') || '권한 거부',
          t('qrActions.calendarPermissionDenied') || '캘린더 권한이 필요합니다.'
        );
        return;
      }

      // 기본 캘린더 가져오기
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

      // 쓰기 가능한 캘린더 찾기
      let defaultCalendar = calendars.find(cal => cal.allowsModifications && cal.isPrimary);
      if (!defaultCalendar) {
        defaultCalendar = calendars.find(cal => cal.allowsModifications);
      }

      if (!defaultCalendar) {
        // 캘린더가 없으면 새로 생성
        if (Platform.OS === 'ios') {
          const defaultCalendarSource = calendars.find(cal => cal.source?.isLocalAccount)?.source;
          if (defaultCalendarSource) {
            const newCalendarId = await Calendar.createCalendarAsync({
              title: 'QR Scanner Events',
              color: '#2F6FEB',
              entityType: Calendar.EntityTypes.EVENT,
              sourceId: defaultCalendarSource.id,
              source: defaultCalendarSource,
              name: 'qrScannerCalendar',
              ownerAccount: 'personal',
              accessLevel: Calendar.CalendarAccessLevel.OWNER,
            });
            defaultCalendar = { id: newCalendarId };
          }
        } else {
          // Android: 계정 캘린더가 없는 기기(구글 계정 미로그인 등)용 로컬 캘린더
          const newCalendarId = await Calendar.createCalendarAsync({
            title: 'QR Scanner Events',
            color: '#2F6FEB',
            entityType: Calendar.EntityTypes.EVENT,
            source: { isLocalAccount: true, name: 'QR Scanner', type: Calendar.SourceType.LOCAL },
            name: 'qrScannerCalendar',
            ownerAccount: 'personal',
            accessLevel: Calendar.CalendarAccessLevel.OWNER,
          });
          defaultCalendar = { id: newCalendarId };
        }
      }

      if (!defaultCalendar) {
        Alert.alert(
          t('result.error') || '오류',
          t('qrActions.noCalendarFound') || '사용 가능한 캘린더가 없습니다.'
        );
        return;
      }

      const eventDetails = {
        title: data.title || t('qrActions.untitledEvent') || '제목 없음',
        startDate: data.startDate || new Date(),
        endDate: data.endDate || new Date(Date.now() + 60 * 60 * 1000), // 기본 1시간
        location: data.location || '',
        notes: data.description || '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const eventId = await Calendar.createEventAsync(defaultCalendar.id, eventDetails);

      if (eventId) {
        Alert.alert(
          t('common.success') || '성공',
          t('qrActions.eventAdded') || '일정이 캘린더에 추가되었습니다.'
        );
      }
    } catch (error) {
      console.error('Add to calendar error:', error);
      // 실패 시 수동 추가 안내
      Alert.alert(
        t('qrActions.addToCalendar') || '캘린더에 추가',
        t('qrActions.addToCalendarDesc') || '캘린더 앱에서 수동으로 추가해주세요.\n\n' +
          (data.title ? `제목: ${data.title}\n` : '') +
          (data.location ? `장소: ${data.location}\n` : '') +
          (data.startDate ? `시작: ${data.startDate.toLocaleString()}\n` : '') +
          (data.endDate ? `종료: ${data.endDate.toLocaleString()}` : ''),
        [{ text: t('common.confirm') || '확인' }]
      );
    }
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

  // 동작 하나: { key, icon, label, onPress, loading }
  const act = (key, icon, label, onPress, loading = false) => ({ key, icon, label, onPress, loading });
  const copy = act('copy', 'copy-outline', t('result.copy') || '복사', onCopy);
  const share = act('share', 'share-outline', t('result.share') || '공유', onShare);
  const call = act('call', 'call-outline', t('qrActions.call') || '전화걸기', handleCall);
  const addContact = act('addContact', 'person-add-outline', t('qrActions.addContact') || '연락처 추가', handleAddContact);
  const sendEmail = act('sendEmail', 'mail-outline', t('qrActions.sendEmail') || '이메일 보내기', handleSendEmail);

  // 타입별 { primary, secondary[] }
  const plan = (() => {
    switch (type) {
      case QR_CONTENT_TYPES.PHONE:
        return { primary: call, secondary: [addContact, copy, share] };
      case QR_CONTENT_TYPES.SMS:
        return { primary: act('sendSms', 'chatbubble-outline', t('qrActions.sendSms') || '문자 보내기', handleSendSms), secondary: [call, copy, share] };
      case QR_CONTENT_TYPES.EMAIL:
        return { primary: sendEmail, secondary: [addContact, copy, share] };
      case QR_CONTENT_TYPES.WIFI:
        return {
          primary: act('connect', 'wifi', isConnecting ? (t('qrActions.connecting') || '연결 중...') : (t('qrActions.connect') || '연결'), handleConnectWifi, isConnecting),
          secondary: [
            act('copyNetwork', 'copy-outline', t('qrActions.copyNetworkName') || '네트워크 복사', handleCopyNetworkName),
            act('copyPassword', 'key-outline', t('qrActions.copyPassword') || '비밀번호 복사', handleCopyWifiPassword),
            share,
          ],
        };
      case QR_CONTENT_TYPES.GEO:
        return {
          primary: act('openMap', 'map-outline', t('qrActions.openMap') || '지도에서 보기', handleOpenMap),
          secondary: [act('directions', 'navigate-outline', t('qrActions.getDirections') || '길찾기', handleGetDirections), copy, share],
        };
      case QR_CONTENT_TYPES.CONTACT:
        return {
          primary: addContact,
          secondary: [data.phones?.[0] && call, data.emails?.[0] && sendEmail, copy, share].filter(Boolean),
        };
      case QR_CONTENT_TYPES.EVENT:
        return { primary: act('calendar', 'calendar-outline', t('qrActions.addToCalendar') || '캘린더에 추가', handleAddToCalendar), secondary: [copy, share] };
      case QR_CONTENT_TYPES.URL:
        return { primary: act('open', 'open-outline', t('result.open') || '열기', onOpenUrl), secondary: [copy, share] };
      case QR_CONTENT_TYPES.TEXT:
      default:
        // 텍스트는 대표 동작이 없다 → 타일만
        return { primary: null, secondary: [copy, share, act('search', 'search-outline', t('qrActions.searchWeb') || '웹 검색', handleSearchWeb)] };
    }
  })();

  const tiles = [...plan.secondary, ...extraActions.map((a, i) => act(`extra-${i}`, a.icon, a.label, a.onPress))];

  return (
    <View style={styles.container}>
      {plan.primary && (
        <MaterialPressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }, plan.primary.loading && { opacity: 0.8 }]}
          onPress={plan.primary.onPress}
          disabled={plan.primary.loading}
          accessibilityRole="button"
          accessibilityLabel={plan.primary.label}
        >
          {plan.primary.loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={plan.primary.icon} size={20} color="#fff" />
          )}
          <Text style={[styles.primaryLabel, { fontFamily: fonts.semiBold }]}>{plan.primary.label}</Text>
        </MaterialPressable>
      )}
      <View style={styles.tileGrid}>
        {tiles.map((a) => (
          <MaterialPressable
            key={a.key}
            style={[styles.tile, { backgroundColor: colors.raised, borderColor: colors.border }]}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Ionicons name={a.icon} size={20} color={colors.text} />
            <Text style={[styles.tileLabel, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{a.label}</Text>
          </MaterialPressable>
        ))}
        {/* 마지막 줄이 늘어나지 않게 빈 칸으로 3열을 채운다 */}
        {Array.from({ length: (3 - (tiles.length % 3)) % 3 }, (_, i) => (
          <View key={`spacer-${i}`} style={[styles.tile, styles.tileSpacer]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  primaryButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    // 3열: (100% - 간격 2개) / 3
    flexBasis: '31%',
    flexGrow: 1,
    height: 64,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  tileSpacer: {
    borderWidth: 0,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
