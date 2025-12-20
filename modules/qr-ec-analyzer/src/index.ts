import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

export interface QrAnalysisResult {
  success: boolean;
  data?: string;
  ecLevel?: 'L' | 'M' | 'Q' | 'H';
  error?: string;
}

// Native module interface
interface QrEcAnalyzerModuleType {
  analyzeQrCode(imagePath: string): Promise<QrAnalysisResult>;
}

// Get the native module
const QrEcAnalyzerModule = requireNativeModule<QrEcAnalyzerModuleType>('QrEcAnalyzer');

/**
 * Analyze a QR code image and extract EC level
 * @param imagePath - Path to the image file (file:// URI)
 * @returns Promise with QR analysis result including EC level
 */
export async function analyzeQrCode(imagePath: string): Promise<QrAnalysisResult> {
  try {
    // Remove file:// prefix if present for native processing
    const cleanPath = imagePath.replace(/^file:\/\//, '');
    return await QrEcAnalyzerModule.analyzeQrCode(cleanPath);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

export default {
  analyzeQrCode,
};
