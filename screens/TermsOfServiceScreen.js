// screens/TermsOfServiceScreen.js - 서비스 이용약관 화면
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

export default function TermsOfServiceScreen() {
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
          {t('settings.termsOfService') || '서비스 이용약관'}
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
            제1조 (목적)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            이 약관은 QR스캐너(이하 "앱")가 제공하는 QR코드 및 바코드 스캔 서비스의 이용조건 및 절차, 이용자와 앱 간의 권리, 의무 및 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제2조 (정의)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            ① "서비스"란 앱이 제공하는 QR코드 및 바코드 스캔, 생성, 기록 관리 등의 기능을 말합니다.{'\n\n'}
            ② "이용자"란 이 약관에 따라 앱이 제공하는 서비스를 이용하는 자를 말합니다.{'\n\n'}
            ③ "회원"이란 앱에 개인정보를 제공하여 회원등록을 한 자로서, 앱의 정보를 지속적으로 제공받으며 앱이 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제3조 (약관의 효력 및 변경)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            ① 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을 발생합니다.{'\n\n'}
            ② 앱은 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위에서 이 약관을 변경할 수 있으며, 약관이 변경된 경우에는 지체없이 이를 공지합니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제4조 (서비스의 제공)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            앱은 다음과 같은 서비스를 제공합니다:{'\n\n'}
            • QR코드 및 바코드 스캔 기능{'\n'}
            • QR코드 및 바코드 생성 기능{'\n'}
            • 스캔 기록 저장 및 관리{'\n'}
            • 이미지 분석을 통한 코드 인식{'\n'}
            • 스캔 데이터 내보내기{'\n'}
            • 기타 앱이 정하는 서비스
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제5조 (서비스 이용)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            ① 서비스 이용은 앱의 업무상 또는 기술상 특별한 지장이 없는 한 연중무휴, 1일 24시간을 원칙으로 합니다.{'\n\n'}
            ② 앱은 시스템 정기점검, 증설 및 교체를 위해 서비스를 일시적으로 중단할 수 있으며, 이 경우 사전에 공지합니다.{'\n\n'}
            ③ 앱은 긴급한 시스템 점검, 증설 및 교체, 설비의 장애, 서비스 이용의 폭주, 국가비상사태, 정전 등 부득이한 사유가 발생한 경우 사전 예고 없이 서비스를 일시적으로 중단할 수 있습니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제6조 (이용자의 의무)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            이용자는 다음 행위를 하여서는 안 됩니다:{'\n\n'}
            • 타인의 정보 도용{'\n'}
            • 앱에 게시된 정보의 무단 변경{'\n'}
            • 앱이 허용하지 않은 정보의 송신 또는 게시{'\n'}
            • 앱 및 제3자의 저작권 등 지적재산권 침해{'\n'}
            • 앱 및 제3자의 명예 손상 또는 업무 방해{'\n'}
            • 외설적이거나 폭력적인 정보 게시{'\n'}
            • 기타 불법적이거나 부당한 행위
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제7조 (면책조항)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            ① 앱은 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인해 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.{'\n\n'}
            ② 앱은 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.{'\n\n'}
            ③ 앱은 이용자가 서비스를 통해 얻은 정보 또는 자료 등으로 인해 발생한 손해에 대하여 책임을 지지 않습니다.{'\n\n'}
            ④ 앱은 이용자 상호간 또는 이용자와 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임도 없습니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제8조 (저작권)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            ① 앱이 작성한 저작물에 대한 저작권 및 기타 지적재산권은 앱에 귀속됩니다.{'\n\n'}
            ② 이용자는 앱을 이용함으로써 얻은 정보를 앱의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 할 수 없습니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            제9조 (분쟁해결)
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            ① 앱은 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위해 노력합니다.{'\n\n'}
            ② 이 약관에 명시되지 않은 사항은 관계 법령 및 상관례에 따릅니다.{'\n\n'}
            ③ 서비스 이용으로 발생한 분쟁에 대해 소송이 제기될 경우, 앱의 본사 소재지를 관할하는 법원을 전속 관할법원으로 합니다.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            부칙
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            이 약관은 2024년 12월 24일부터 시행합니다.
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
  bottomSpace: {
    height: 40,
  },
});
