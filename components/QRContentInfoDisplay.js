// components/QRContentInfoDisplay.js - QR 콘텐츠 정보 표시 컴포넌트
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { QR_CONTENT_TYPES } from '../utils/qrContentParser';
import MaterialPressable from './MaterialPressable';
import { RADIUS, TYPE, MONO } from '../constants/Design';

/**
 * QR 콘텐츠 정보 표시 컴포넌트
 */
export default function QRContentInfoDisplay({
  parsedContent,
  colors,
  fonts,
  t,
}) {
  const { type, data } = parsedContent;
  const [showPassword, setShowPassword] = useState(false);

  // 비밀번호 마스킹
  const maskPassword = (password) => {
    if (!password) return '';
    return '•'.repeat(Math.min(password.length, 8));
  };

  // 날짜 포맷팅
  const formatDate = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    try {
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date.toString();
    }
  };

  // 정보 라인 렌더링 (결과 화면 라벨 행과 같은 모양: 이름 13 · 값 15)
  const renderInfoLine = (label, value) => {
    if (!value) return null;
    return (
      <View style={styles.infoLine}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: colors.text, fontFamily: fonts.regular }]} numberOfLines={2} selectable>
          {value}
        </Text>
      </View>
    );
  };

  // 하위 상자: 보조 바탕 + 작은 머리글(아이콘·제목)
  const renderBox = (icon, title, children, extra = null) => (
    <View style={[styles.infoContainer, { backgroundColor: colors.inputBackground }]}>
      <View style={styles.infoHeader}>
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
        <Text style={[styles.infoTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
      {extra}
    </View>
  );

  // WiFi 정보 렌더링
  const renderWifiInfo = () => renderBox('wifi-outline', 'WiFi', (
    <>
      {renderInfoLine(t('qrActions.networkName') || '네트워크', data.ssid)}

      <View style={styles.infoLine}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
          {t('qrActions.password') || '비밀번호'}
        </Text>
        <Text style={[styles.infoValue, { color: colors.text, fontFamily: showPassword && data.password ? MONO : fonts.regular }]} selectable={showPassword}>
          {showPassword ? data.password || '-' : maskPassword(data.password) || '-'}
        </Text>
        {data.password && (
          <MaterialPressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textSecondary}
            />
          </MaterialPressable>
        )}
      </View>

      {renderInfoLine(t('qrActions.security') || '암호화', data.security || 'WPA')}
    </>
  ));

  // 위치 정보 렌더링 (미니맵 포함)
  const renderGeoInfo = () => {
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng);

    return renderBox('location-outline', t('qrTypes.location') || '위치', (
      <>
        {renderInfoLine(t('qrActions.latitude') || '위도', data.latitude)}
        {renderInfoLine(t('qrActions.longitude') || '경도', data.longitude)}
        {data.query && renderInfoLine(t('qrActions.address') || '주소', data.query)}
      </>
    ), hasValidCoords ? (
      /* 미니맵 */
      <View style={[styles.miniMapContainer, { borderColor: colors.border }]}>
        <MapView
          style={styles.miniMap}
          initialRegion={{
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          pointerEvents="none"
        >
          <Marker
            coordinate={{ latitude: lat, longitude: lng }}
            pinColor={colors.error}
          />
        </MapView>
      </View>
    ) : null);
  };

  // 연락처 정보 렌더링
  const renderContactInfo = () => renderBox('person-outline', t('qrTypes.contact') || '연락처', (
    <>
      {renderInfoLine(t('generator.fields.nameLabel') || '이름', data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim())}
      {data.phones?.[0] && renderInfoLine(t('generator.fields.phoneLabel') || '전화', data.phones[0])}
      {data.emails?.[0] && renderInfoLine(t('generator.fields.emailLabel') || '이메일', data.emails[0])}
      {data.organization && renderInfoLine(t('generator.fields.companyLabel') || '회사', data.organization)}
      {data.title && renderInfoLine(t('generator.fields.titleLabel') || '직함', data.title)}
      {data.addresses?.[0] && renderInfoLine(t('generator.fields.addressLabel') || '주소', data.addresses[0])}
      {data.urls?.[0] && renderInfoLine('URL', data.urls[0])}
    </>
  ));

  // 일정 정보 렌더링
  const renderEventInfo = () => renderBox('calendar-outline', t('qrTypes.event') || '일정', (
    <>
      {renderInfoLine(t('generator.fields.eventTitleLabel') || '제목', data.title)}
      {data.startDate && renderInfoLine(t('generator.fields.startDateLabel') || '시작', formatDate(data.startDate))}
      {data.endDate && renderInfoLine(t('generator.fields.endDateLabel') || '종료', formatDate(data.endDate))}
      {data.location && renderInfoLine(t('generator.fields.eventLocationLabel') || '장소', data.location)}
      {data.description && renderInfoLine(t('generator.fields.descriptionLabel') || '설명', data.description)}
    </>
  ));

  // 이메일 정보 렌더링
  const renderEmailInfo = () => renderBox('mail-outline', t('qrTypes.email') || '이메일', (
    <>
      {renderInfoLine(t('generator.fields.recipientLabel') || '수신자', data.email)}
      {data.subject && renderInfoLine(t('generator.fields.subjectLabel') || '제목', data.subject)}
      {data.body && renderInfoLine(t('generator.fields.messageLabel') || '내용', data.body)}
    </>
  ));

  // SMS 정보 렌더링
  const renderSmsInfo = () => renderBox('chatbubble-outline', 'SMS', (
    <>
      {renderInfoLine(t('generator.fields.phoneLabel') || '전화번호', data.phoneNumber)}
      {data.body && renderInfoLine(t('generator.fields.messageLabel') || '메시지', data.body)}
    </>
  ));

  // 전화번호 정보 렌더링
  const renderPhoneInfo = () => renderBox('call-outline', t('qrTypes.phone') || '전화번호', (
    renderInfoLine(t('generator.fields.phoneLabel') || '전화번호', data.phoneNumber)
  ));

  // 타입별 렌더링
  switch (type) {
    case QR_CONTENT_TYPES.WIFI:
      return renderWifiInfo();
    case QR_CONTENT_TYPES.GEO:
      return renderGeoInfo();
    case QR_CONTENT_TYPES.CONTACT:
      return renderContactInfo();
    case QR_CONTENT_TYPES.EVENT:
      return renderEventInfo();
    case QR_CONTENT_TYPES.EMAIL:
      return renderEmailInfo();
    case QR_CONTENT_TYPES.SMS:
      return renderSmsInfo();
    case QR_CONTENT_TYPES.PHONE:
      return renderPhoneInfo();
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  // 결과 화면 labelCard와 같은 하위 상자
  infoContainer: {
    borderRadius: RADIUS.control,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  infoTitle: {
    flex: 1,
    ...TYPE.sectionHeader,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
  },
  infoLabel: {
    width: 88,
    fontSize: 13,
    paddingTop: 1,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
  },
  eyeButton: {
    width: 32,
    height: 32,
    marginVertical: -7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniMapContainer: {
    height: 150,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  miniMap: {
    flex: 1,
  },
});
