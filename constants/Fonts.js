// constants/Fonts.js - Font configuration for multi-language support
// CJK languages use system fonts to reduce app size (73MB → 1.3MB)

// Font families by language
export const FontFamilies = {
  // Korean - System font (Apple SD Gothic Neo on iOS, Noto Sans KR on Android)
  ko: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  // English - Inter (custom font for branding)
  en: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  // Japanese - System font (Hiragino Sans on iOS, Noto Sans JP on Android)
  ja: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  // Chinese - System font (PingFang SC on iOS, Noto Sans SC on Android)
  zh: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
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
// Only Inter fonts are loaded - CJK languages use system fonts
export const FontAssets = {
  // Inter (English, Spanish)
  'Inter-Regular': require('../assets/fonts/Inter_400Regular.ttf'),
  'Inter-Medium': require('../assets/fonts/Inter_500Medium.ttf'),
  'Inter-SemiBold': require('../assets/fonts/Inter_600SemiBold.ttf'),
  'Inter-Bold': require('../assets/fonts/Inter_700Bold.ttf'),
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
