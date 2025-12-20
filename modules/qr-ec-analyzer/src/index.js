import { requireNativeModule } from 'expo-modules-core';

// Get the native module
const QrEcAnalyzerModule = requireNativeModule('QrEcAnalyzer');

/**
 * Analyze a QR code image and extract EC level
 * @param {string} imagePath - Path to the image file (file:// URI)
 * @returns {Promise<{success: boolean, data?: string, ecLevel?: string, error?: string}>}
 */
export async function analyzeQrCode(imagePath) {
  try {
    // Remove file:// prefix if present for native processing
    const cleanPath = imagePath.replace(/^file:\/\//, '');
    return await QrEcAnalyzerModule.analyzeQrCode(cleanPath);
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

export default {
  analyzeQrCode,
};
