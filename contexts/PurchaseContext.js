// contexts/PurchaseContext.js - 인앱 구매 상태 관리 (react-native-iap 사용)
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PurchaseContext = createContext();

// 인앱 구매 상품 ID (App Store Connect / Google Play Console에서 설정)
const PRODUCT_IDS = Platform.select({
  ios: ['qr_scanner_premium'],
  android: ['qr_scanner_premium'],
});

export function PurchaseProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);

  // 초기화
  useEffect(() => {
    let purchaseUpdateSubscription;
    let purchaseErrorSubscription;

    const initIAP = async () => {
      try {
        // 저장된 프리미엄 상태 확인
        const savedPremium = await AsyncStorage.getItem('isPremium');
        if (savedPremium === 'true') {
          setIsPremium(true);
        }

        // IAP 연결
        await initConnection();

        // 상품 정보 가져오기
        const availableProducts = await getProducts({ skus: PRODUCT_IDS });
        if (availableProducts && availableProducts.length > 0) {
          setProducts(availableProducts);
        }

        // 구매 업데이트 리스너
        purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
          const receipt = purchase.transactionReceipt;
          if (receipt) {
            // 구매 완료 처리
            await finishTransaction({ purchase, isConsumable: false });
            await unlockPremium();
          }
        });

        // 구매 에러 리스너
        purchaseErrorSubscription = purchaseErrorListener((error) => {
          console.log('Purchase error:', error);
        });

        // 이전 구매 확인 (복원)
        const purchases = await getAvailablePurchases();
        if (purchases?.some(p => PRODUCT_IDS.includes(p.productId))) {
          await unlockPremium();
        }
      } catch (error) {
        console.log('IAP initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initIAP();

    return () => {
      // 클린업
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
      endConnection();
    };
  }, []);

  // 프리미엄 구매
  const purchasePremium = async () => {
    try {
      setIsLoading(true);

      // 상품 정보가 없으면 다시 가져오기
      if (products.length === 0) {
        const availableProducts = await getProducts({ skus: PRODUCT_IDS });
        if (!availableProducts || availableProducts.length === 0) {
          Alert.alert('오류', '상품 정보를 가져올 수 없습니다.');
          return false;
        }
        setProducts(availableProducts);
      }

      // 구매 진행
      await requestPurchase({ sku: PRODUCT_IDS[0] });
      return true;
    } catch (error) {
      console.log('Purchase error:', error);
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('오류', '구매를 완료할 수 없습니다.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 구매 복원
  const restorePurchase = async () => {
    try {
      setIsLoading(true);

      const purchases = await getAvailablePurchases();

      const hasPremium = purchases?.some(
        purchase => PRODUCT_IDS.includes(purchase.productId)
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
      return products[0].localizedPrice || '₩4,900';
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
