// screens/HistoryScreen.js - Expo Router 버전
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

export default function HistoryScreen() {
  const router = useRouter();
  const [all, setAll] = useState([]);
  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      const data = (await AsyncStorage.getItem('scanHistory')) || '[]';
      const parsed = JSON.parse(data);
      // ✅ 최신순 정렬 (timestamp 기준 내림차순)
      const sorted = parsed.sort((a, b) => b.timestamp - a.timestamp);
      setAll(sorted);
      setList(sorted);
    } catch (error) {
      console.error('Load history error:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  useEffect(() => {
    if (!query) {
      setList(all);
      return;
    }
    const q = query.toLowerCase();
    setList(
      all.filter(
        (i) => i.code.toLowerCase().includes(q) || (i.url && i.url.toLowerCase().includes(q)),
      ),
    );
  }, [query, all]);

  const clear = async () => {
    Alert.alert('전체 삭제', '모든 스캔 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('scanHistory');
            setAll([]);
            setList([]);
            setQuery('');
          } catch (error) {
            console.error('Clear history error:', error);
          }
        },
      },
    ]);
  };

  // ✅ 년월일시분초까지 표시
  const formatDateTime = (timestamp) => {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}.${month}.${day}  ${hours}:${minutes}:${seconds}`;
  };

  const handleItemPress = (item) => {
    router.push({ pathname: '/result', params: { code: item.code, url: item.url } });
  };

  return (
    <View style={s.c}>
      <View style={s.search}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={s.input}
          placeholder="코드 또는 URL 검색"
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="검색 입력"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="검색어 지우기">
            <Ionicons name="close-circle" size={22} color="#888" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.header}>
        <Text style={s.title}>스캔 기록 {list.length > 0 && `(${list.length})`}</Text>
        {all.length > 0 && (
          <TouchableOpacity onPress={clear} accessibilityLabel="전체 삭제">
            <Text style={s.del}>전체 삭제</Text>
          </TouchableOpacity>
        )}
      </View>

      {list.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="file-tray-outline" size={64} color="#ccc" />
          <Text style={s.emptyText}>{query ? '검색 결과 없음' : '기록이 없습니다'}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.item}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
              accessibilityLabel={`스캔 기록: ${item.code}`}
              accessibilityRole="button"
            >
              <View style={s.itemHeader}>
                <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
                <Text style={s.code} numberOfLines={1}>
                  {item.code}
                </Text>
              </View>
              <Text style={s.time}>{formatDateTime(item.timestamp)}</Text>
              {item.url && (
                <Text style={s.url} numberOfLines={1}>
                  {item.url}
                </Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={s.listContent}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#f9f9f9' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    marginTop: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  del: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
    marginTop: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 6,
    padding: 16,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  code: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
    color: '#000',
  },
  time: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  url: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
  },
});
