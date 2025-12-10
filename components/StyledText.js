// components/StyledText.js - Custom Text component with font support
import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

// Map fontWeight to font variant
const weightMap = {
  'normal': 'regular',
  '400': 'regular',
  '500': 'medium',
  '600': 'semiBold',
  'bold': 'bold',
  '700': 'bold',
};

export const Text = ({ style, children, ...props }) => {
  const { fonts } = useLanguage();

  // Extract fontWeight from style
  const flatStyle = StyleSheet.flatten(style) || {};
  const fontWeight = flatStyle.fontWeight || 'normal';

  // Get the appropriate font variant based on weight
  const weightKey = weightMap[fontWeight] || 'regular';
  const fontFamily = fonts[weightKey] || fonts.regular;

  // Create new style with fontFamily and remove fontWeight (as it's embedded in the font)
  const newStyle = {
    ...flatStyle,
    fontFamily,
    // Keep fontWeight for fallback on unsupported platforms
  };

  return (
    <RNText style={newStyle} {...props}>
      {children}
    </RNText>
  );
};

// Convenience components for different weights
export const TextRegular = ({ style, ...props }) => {
  const { fonts } = useLanguage();
  return <RNText style={[{ fontFamily: fonts.regular }, style]} {...props} />;
};

export const TextMedium = ({ style, ...props }) => {
  const { fonts } = useLanguage();
  return <RNText style={[{ fontFamily: fonts.medium }, style]} {...props} />;
};

export const TextSemiBold = ({ style, ...props }) => {
  const { fonts } = useLanguage();
  return <RNText style={[{ fontFamily: fonts.semiBold }, style]} {...props} />;
};

export const TextBold = ({ style, ...props }) => {
  const { fonts } = useLanguage();
  return <RNText style={[{ fontFamily: fonts.bold }, style]} {...props} />;
};

export default Text;
