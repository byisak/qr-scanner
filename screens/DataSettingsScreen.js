// screens/DataSettingsScreen.js - 설정 > 데이터: 기록 내보내기 · 백업 · 복원 / 저장 공간(스캔 사진 캐시 삭제)
// 행과 캐시 계산·삭제 코드는 예전 SettingsScreen.js 에서 그대로 옮겨 왔다
import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, useFocusEffect } from 'expo-router';
import { SettingsSubScreen, SectionHeader, Group, SettingRow, NavRight, useSettingsUi } from '../components/SettingsKit';

export default function DataSettingsScreen() {
  const router = useRouter();
  const { t, colors, rowProps } = useSettingsUi();

  // 캐시 크기
  const [cacheSize, setCacheSize] = useState(0);
  const [isCalculatingCache, setIsCalculatingCache] = useState(false);

  // 캐시 크기 계산
  const calculateCacheSize = useCallback(async () => {
    setIsCalculatingCache(true);
    try {
      const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);

      if (!dirInfo.exists) {
        setCacheSize(0);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      let totalSize = 0;

      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${photoDir}${file}`);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }

      setCacheSize(totalSize);
    } catch (error) {
      console.error('Calculate cache size error:', error);
      setCacheSize(0);
    } finally {
      setIsCalculatingCache(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      calculateCacheSize();
    }, [calculateCacheSize])
  );

  // 캐시 크기 포맷팅
  const formatCacheSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 캐시 삭제
  const handleClearCache = () => {
    if (cacheSize === 0) {
      Alert.alert(
        t('settings.cache') || '캐시',
        t('settings.noCacheToDelete') || '삭제할 캐시가 없습니다.'
      );
      return;
    }

    Alert.alert(
      t('settings.clearCache') || '캐시 삭제',
      t('settings.clearCacheConfirm') || `저장된 사진 ${formatCacheSize(cacheSize)}를 삭제하시겠습니까?\n\n삭제된 사진은 복구할 수 없습니다.`,
      [
        { text: t('common.cancel') || '취소', style: 'cancel' },
        {
          text: t('common.delete') || '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
              const dirInfo = await FileSystem.getInfoAsync(photoDir);

              if (dirInfo.exists) {
                await FileSystem.deleteAsync(photoDir, { idempotent: true });
                // 폴더 재생성
                await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
              }

              setCacheSize(0);
              Alert.alert(
                t('settings.success') || '성공',
                t('settings.cacheCleared') || '캐시가 삭제되었습니다.'
              );
            } catch (error) {
              console.error('Clear cache error:', error);
              Alert.alert(
                t('settings.error') || '오류',
                t('settings.clearCacheError') || '캐시 삭제 중 오류가 발생했습니다.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SettingsSubScreen title={t('settingsHub.data')}>
      <Group colors={colors}>
        {/* 기록 내보내기 */}
        <SettingRow {...rowProps}
          label={t('settings.exportHistory')}
          desc={t('settings.exportHistoryDesc')}
          onPress={() => router.push('/export-history')}
        >
          <NavRight {...rowProps} />
        </SettingRow>

        {/* 백업 내보내기 */}
        <SettingRow {...rowProps}
          label={t('backupExport.title')}
          desc={t('backupExport.description')}
          onPress={() => router.push('/backup-export')}
        >
          <NavRight {...rowProps} />
        </SettingRow>

        {/* 백업 가져오기 */}
        <SettingRow {...rowProps}
          label={t('backupImport.title')}
          desc={t('backupImport.description')}
          onPress={() => router.push('/backup-import')}
        >
          <NavRight {...rowProps} />
        </SettingRow>
      </Group>

      {/* 저장 공간 */}
      <SectionHeader {...rowProps} title={t('settingsHub.sectionStorage')} />
      <Group colors={colors}>
        {/* 캐시 삭제 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.clearPhotoCache')}
          desc={t('settings.clearCacheDesc') || '저장된 스캔 사진을 삭제합니다'}
          onPress={handleClearCache}
        >
          <NavRight {...rowProps} value={isCalculatingCache ? '...' : formatCacheSize(cacheSize)} />
        </SettingRow>
      </Group>
    </SettingsSubScreen>
  );
}
