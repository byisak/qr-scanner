// contexts/PurchaseContext.js - 인앱 구매 상태 관리
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as InAppPurchases from 'expo-in-app-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PurchaseContext = createContext();

// 인앱 구매 상품 ID (App Store Connect / Google Play Console에서 설정)
const PRODUCT_ID = 'qr_scanner_premium';

export function PurchaseProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);

  // 초기화
  useEffect(() => {
    initializePurchases();

    return () => {
      // 앱 종료 시 IAP 연결 해제
      InAppPurchases.disconnectAsync().catch(() => {});
    };
  }, []);

  const initializePurchases = async () => {
    try {
      // 저장된 프리미엄 상태 확인
      const savedPremium = await AsyncStorage.getItem('isPremium');
      if (savedPremium === 'true') {
        setIsPremium(true);
      }

      // IAP 연결
      await InAppPurchases.connectAsync();

      // 상품 정보 가져오기
      const { results } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
      if (results && results.length > 0) {
        setProducts(results);
      }

      // 구매 리스너 설정
      InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
        if (responseCode === InAppPurchases.IAPResponseCode.OK) {
          results?.forEach(async (purchase) => {
            if (!purchase.acknowledged) {
              // 구매 완료 처리
              await InAppPurchases.finishTransactionAsync(purchase, true);
              await unlockPremium();
            }
          });
        } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
          console.log('User canceled the purchase');
        } else {
          console.log('Purchase failed with code:', responseCode);
        }
      });

      // 이전 구매 확인 (복원)
      const history = await InAppPurchases.getPurchaseHistoryAsync();
      if (history.results?.some(p => p.productId === PRODUCT_ID)) {
        await unlockPremium();
      }
    } catch (error) {
      console.log('IAP initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 프리미엄 구매
  const purchasePremium = async () => {
    try {
      setIsLoading(true);

      // 상품 정보가 없으면 다시 가져오기
      if (products.length === 0) {
        const { results } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
        if (!results || results.length === 0) {
          Alert.alert('오류', '상품 정보를 가져올 수 없습니다.');
          return false;
        }
        setProducts(results);
      }

      // 구매 진행
      await InAppPurchases.purchaseItemAsync(PRODUCT_ID);
      return true;
    } catch (error) {
      console.log('Purchase error:', error);
      Alert.alert('오류', '구매를 완료할 수 없습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 구매 복원
  const restorePurchase = async () => {
    try {
      setIsLoading(true);

      const { results } = await InAppPurchases.getPurchaseHistoryAsync();

      const hasPremium = results?.some(
        purchase => purchase.productId === PRODUCT_ID
      );

      if (hasPremium) {
        await unlockPremium();
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log('Restore error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 프리미엄 해제 (영구 저장)
  const unlockPremium = async () => {
    setIsPremium(true);
    await AsyncStorage.setItem('isPremium', 'true');
  };

  // 상품 가격 정보
  const getProductPrice = () => {
    if (products.length > 0) {
      return products[0].price || '₩4,900';
    }
    return '₩4,900';
  };

  return (
    <PurchaseContext.Provider
      value={{
        isPremium,
        isLoading,
        purchasePremium,
        restorePurchase,
        getProductPrice,
      }}
    >
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const context = useContext(PurchaseContext);
  if (!context) {
    throw new Error('usePurchase must be used within a PurchaseProvider');
  }
  return context;
}

export default PurchaseContext;
