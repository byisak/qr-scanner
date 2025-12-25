// screens/PrivacyPolicyScreen.js - 개인정보 처리방침 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('settings.privacyPolicy') || '개인정보 처리방침'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
          최종 업데이트: 2024년 12월 24일
        </Text>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            1. 개인정보의 수집 및 이용 목적
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            QR스캐너(이하 "앱")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.{'\n\n'}
            • 회원 가입 및 관리{'\n'}
            • 서비스 제공 및 운영{'\n'}
            • 스캔 기록 저장 및 동기화{'\n'}
            • 서비스 개선 및 신규 서비스 개발{'\n'}
            • 고객 문의 응대
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            2. 수집하는 개인정보 항목
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 서비스 제공을 위해 다음과 같은 개인정보를 수집할 수 있습니다:{'\n\n'}
            <Text style={styles.bold}>필수 항목</Text>{'\n'}
            • 이메일 주소 (회원가입 시){'\n'}
            • 비밀번호{'\n\n'}
            <Text style={styles.bold}>선택 항목</Text>{'\n'}
            • 이름/닉네임{'\n'}
            • 프로필 이미지{'\n\n'}
            <Text style={styles.bold}>자동 수집 항목</Text>{'\n'}
            • 기기 정보 (기기 모델, OS 버전){'\n'}
            • 앱 사용 기록{'\n'}
            • 스캔 기록 (사용자 동의 시)
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            3. 개인정보의 보유 및 이용 기간
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 앱은 아래와 같이 관계 법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.{'\n\n'}
            • 계약 또는 청약철회 등에 관한 기록: 5년{'\n'}
            • 대금결제 및 재화 등의 공급에 관한 기록: 5년{'\n'}
            • 소비자의 불만 또는 분쟁처리에 관한 기록: 3년{'\n'}
            • 접속에 관한 기록: 3개월
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            4. 개인정보의 제3자 제공
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다:{'\n\n'}
            • 이용자가 사전에 동의한 경우{'\n'}
            • 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            5. 개인정보의 파기 절차 및 방법
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.{'\n\n'}
            <Text style={styles.bold}>파기 절차</Text>{'\n'}
            이용자가 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져 내부 방침 및 기타 관련 법령에 따라 일정기간 저장된 후 혹은 즉시 파기됩니다.{'\n\n'}
            <Text style={styles.bold}>파기 방법</Text>{'\n'}
            전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            6. 이용자의 권리
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다:{'\n\n'}
            • 개인정보 열람 요구{'\n'}
            • 오류 등이 있을 경우 정정 요구{'\n'}
            • 삭제 요구{'\n'}
            • 처리정지 요구{'\n\n'}
            위의 권리 행사는 앱에 대해 서면, 전자우편 등을 통하여 하실 수 있으며, 앱은 이에 대해 지체 없이 조치하겠습니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            7. 개인정보 보호책임자
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.{'\n\n'}
            <Text style={styles.bold}>개인정보 보호책임자</Text>{'\n'}
            • 담당자: 고객지원팀{'\n'}
            • 연락처: 앱 내 1:1 문의
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            8. 개인정보 처리방침의 변경
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            9. 카메라 및 갤러리 접근 권한
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 QR코드 및 바코드 스캔 기능을 제공하기 위해 카메라 접근 권한이 필요합니다. 또한, 이미지에서 코드를 인식하기 위해 갤러리 접근 권한이 필요할 수 있습니다.{'\n\n'}
            이러한 권한은 오직 앱의 핵심 기능 제공을 위해서만 사용되며, 사용자의 명시적 동의 없이 사진이나 영상이 수집, 저장 또는 전송되지 않습니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            부칙
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            이 개인정보 처리방침은 2024년 12월 24일부터 시행됩니다.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
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
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
  },
  bottomSpace: {
    height: 40,
  },
});
