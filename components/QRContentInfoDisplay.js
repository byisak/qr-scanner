// components/QRContentInfoDisplay.js - QR 콘텐츠 정보 표시 컴포넌트
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { QR_CONTENT_TYPES } from '../utils/qrContentParser';

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

  // 정보 라인 렌더링
  const renderInfoLine = (label, value, icon = null) => {
    if (!value) return null;
    return (
      <View style={styles.infoLine}>
        {icon && <Ionicons name={icon} size={16} color={colors.textSecondary} style={styles.infoIcon} />}
        <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
          {label}:
        </Text>
        <Text style={[styles.infoValue, { color: colors.text, fontFamily: fonts.regular }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    );
  };

  // WiFi 정보 렌더링
  const renderWifiInfo = () => (
    <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoHeader}>
        <Ionicons name="wifi" size={24} color="#5856D6" />
        <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>WiFi</Text>
      </View>

      <View style={styles.infoContent}>
        {renderInfoLine(t('qrActions.networkName') || '네트워크', data.ssid, 'globe-outline')}

        <View style={styles.infoLine}>
          <Ionicons name="key-outline" size={16} color={colors.textSecondary} style={styles.infoIcon} />
          <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
            {t('qrActions.password') || '비밀번호'}:
          </Text>
          <Text style={[styles.infoValue, { color: colors.text, fontFamily: fonts.regular }]}>
            {showPassword ? data.password || '-' : maskPassword(data.password) || '-'}
          </Text>
          {data.password && (
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {renderInfoLine(t('qrActions.security') || '암호화', data.security || 'WPA', 'shield-checkmark-outline')}
      </View>
    </View>
  );

  // 위치 정보 렌더링 (미니맵 포함)
  const renderGeoInfo = () => {
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng);

    return (
      <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <Ionicons name="location" size={24} color="#FF3B30" />
          <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('qrTypes.location') || '위치'}
          </Text>
        </View>

        <View style={styles.infoContent}>
          {renderInfoLine(t('qrActions.latitude') || '위도', data.latitude)}
          {renderInfoLine(t('qrActions.longitude') || '경도', data.longitude)}
          {data.query && renderInfoLine(t('qrActions.address') || '주소', data.query)}
        </View>

        {/* 미니맵 */}
        {hasValidCoords && (
          <View style={styles.miniMapContainer}>
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
                pinColor="#FF3B30"
              />
            </MapView>
          </View>
        )}
      </View>
    );
  };

  // 연락처 정보 렌더링
  const renderContactInfo = () => (
    <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoHeader}>
        <Ionicons name="person" size={24} color="#FF2D55" />
        <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('qrTypes.contact') || '연락처'}
        </Text>
      </View>

      <View style={styles.infoContent}>
        {renderInfoLine(t('generator.fields.nameLabel') || '이름', data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim(), 'person-outline')}
        {data.phones?.[0] && renderInfoLine(t('generator.fields.phoneLabel') || '전화', data.phones[0], 'call-outline')}
        {data.emails?.[0] && renderInfoLine(t('generator.fields.emailLabel') || '이메일', data.emails[0], 'mail-outline')}
        {data.organization && renderInfoLine(t('generator.fields.companyLabel') || '회사', data.organization, 'business-outline')}
        {data.title && renderInfoLine(t('generator.fields.titleLabel') || '직함', data.title)}
        {data.addresses?.[0] && renderInfoLine(t('generator.fields.addressLabel') || '주소', data.addresses[0], 'location-outline')}
        {data.urls?.[0] && renderInfoLine('URL', data.urls[0], 'globe-outline')}
      </View>
    </View>
  );

  // 일정 정보 렌더링
  const renderEventInfo = () => (
    <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoHeader}>
        <Ionicons name="calendar" size={24} color="#FF9500" />
        <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('qrTypes.event') || '일정'}
        </Text>
      </View>

      <View style={styles.infoContent}>
        {renderInfoLine(t('generator.fields.eventTitleLabel') || '제목', data.title, 'document-text-outline')}
        {data.startDate && renderInfoLine(t('generator.fields.startDateLabel') || '시작', formatDate(data.startDate), 'time-outline')}
        {data.endDate && renderInfoLine(t('generator.fields.endDateLabel') || '종료', formatDate(data.endDate), 'timer-outline')}
        {data.location && renderInfoLine(t('generator.fields.eventLocationLabel') || '장소', data.location, 'location-outline')}
        {data.description && renderInfoLine(t('generator.fields.descriptionLabel') || '설명', data.description, 'chatbox-outline')}
      </View>
    </View>
  );

  // 이메일 정보 렌더링
  const renderEmailInfo = () => (
    <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoHeader}>
        <Ionicons name="mail" size={24} color="#007AFF" />
        <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('qrTypes.email') || '이메일'}
        </Text>
      </View>

      <View style={styles.infoContent}>
        {renderInfoLine(t('generator.fields.recipientLabel') || '수신자', data.email, 'person-outline')}
        {data.subject && renderInfoLine(t('generator.fields.subjectLabel') || '제목', data.subject, 'document-text-outline')}
        {data.body && renderInfoLine(t('generator.fields.messageLabel') || '내용', data.body, 'chatbox-outline')}
      </View>
    </View>
  );

  // SMS 정보 렌더링
  const renderSmsInfo = () => (
    <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoHeader}>
        <Ionicons name="chatbubble" size={24} color="#FF9500" />
        <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>SMS</Text>
      </View>

      <View style={styles.infoContent}>
        {renderInfoLine(t('generator.fields.phoneLabel') || '전화번호', data.phoneNumber, 'call-outline')}
        {data.body && renderInfoLine(t('generator.fields.messageLabel') || '메시지', data.body, 'chatbox-outline')}
      </View>
    </View>
  );

  // 전화번호 정보 렌더링
  const renderPhoneInfo = () => (
    <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.infoHeader}>
        <Ionicons name="call" size={24} color="#34C759" />
        <Text style={[styles.infoTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('qrTypes.phone') || '전화번호'}
        </Text>
      </View>

      <View style={styles.infoContent}>
        {renderInfoLine(t('generator.fields.phoneLabel') || '전화번호', data.phoneNumber, 'call-outline')}
      </View>
    </View>
  );

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
  infoContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  infoContent: {
    padding: 16,
    gap: 10,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoIcon: {
    marginTop: 2,
    width: 18,
  },
  infoLabel: {
    fontSize: 14,
    minWidth: 70,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  miniMapContainer: {
    height: 150,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  miniMap: {
    flex: 1,
  },
});
