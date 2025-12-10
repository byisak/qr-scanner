// constants/Fonts.js - Font configuration for multi-language support

// Font families by language
export const FontFamilies = {
  // Korean - Pretendard
  ko: {
    regular: 'Pretendard-Regular',
    medium: 'Pretendard-Medium',
    semiBold: 'Pretendard-SemiBold',
    bold: 'Pretendard-Bold',
  },
  // English - Inter
  en: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  // Japanese - Noto Sans JP
  ja: {
    regular: 'NotoSansJP-Regular',
    medium: 'NotoSansJP-Medium',
    semiBold: 'NotoSansJP-SemiBold',
    bold: 'NotoSansJP-Bold',
  },
  // Chinese - Noto Sans SC
  zh: {
    regular: 'NotoSansSC-Regular',
    medium: 'NotoSansSC-Medium',
    semiBold: 'NotoSansSC-SemiBold',
    bold: 'NotoSansSC-Bold',
  },
  // Spanish - Inter (same as English, Latin alphabet)
  es: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
};

// Font assets map for expo-font loading
export const FontAssets = {
  // Pretendard (Korean)
  'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  // Inter (English, Spanish)
  'Inter-Regular': require('../assets/fonts/Inter_400Regular.ttf'),
  'Inter-Medium': require('../assets/fonts/Inter_500Medium.ttf'),
  'Inter-SemiBold': require('../assets/fonts/Inter_600SemiBold.ttf'),
  'Inter-Bold': require('../assets/fonts/Inter_700Bold.ttf'),
  // Noto Sans JP (Japanese)
  'NotoSansJP-Regular': require('../assets/fonts/NotoSansJP_400Regular.ttf'),
  'NotoSansJP-Medium': require('../assets/fonts/NotoSansJP_500Medium.ttf'),
  'NotoSansJP-SemiBold': require('../assets/fonts/NotoSansJP_600SemiBold.ttf'),
  'NotoSansJP-Bold': require('../assets/fonts/NotoSansJP_700Bold.ttf'),
  // Noto Sans SC (Chinese)
  'NotoSansSC-Regular': require('../assets/fonts/NotoSansSC_400Regular.ttf'),
  'NotoSansSC-Medium': require('../assets/fonts/NotoSansSC_500Medium.ttf'),
  'NotoSansSC-SemiBold': require('../assets/fonts/NotoSansSC_600SemiBold.ttf'),
  'NotoSansSC-Bold': require('../assets/fonts/NotoSansSC_700Bold.ttf'),
};

// Default font family (fallback)
export const DefaultFontFamily = FontFamilies.en;

// Get font family by language code
export const getFontFamily = (languageCode) => {
  return FontFamilies[languageCode] || DefaultFontFamily;
};

// Get font style by weight
export const getFontStyle = (languageCode, weight = 'regular') => {
  const fontFamily = getFontFamily(languageCode);
  return { fontFamily: fontFamily[weight] || fontFamily.regular };
};
