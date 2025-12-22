// components/NativeColorPicker.js - WebView 기반 네이티브 컬러 피커
import React, { useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

export default function NativeColorPicker({ visible, onClose, color, onColorChange, colors }) {
  const webViewRef = useRef(null);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          background: transparent;
        }
        .color-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .color-preview {
          width: 100%;
          height: 80px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.1);
        }
        .color-input-wrapper {
          position: relative;
          width: 100%;
          height: 80px;
        }
        .color-input {
          width: 100%;
          height: 100%;
          border: 2px solid #007AFF;
          border-radius: 12px;
          cursor: pointer;
          padding: 0;
          -webkit-appearance: none;
        }
        .color-input-label {
          text-align: center;
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
        }
        .color-input::-webkit-color-swatch-wrapper {
          padding: 0;
        }
        .color-input::-webkit-color-swatch {
          border: none;
          border-radius: 12px;
        }
        .hex-display {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          font-family: 'Menlo', 'Monaco', monospace;
          padding: 12px;
          background: rgba(0,0,0,0.05);
          border-radius: 8px;
        }
        .preset-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-top: 8px;
        }
        .preset-color {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .preset-color:active {
          transform: scale(0.9);
        }
        .preset-color.selected {
          border-color: #007AFF;
          box-shadow: 0 0 0 2px white, 0 0 0 4px #007AFF;
        }
      </style>
    </head>
    <body>
      <div class="color-container">
        <div class="color-preview" id="preview"></div>
        <div class="color-input-label">👆 탭하여 색상 선택</div>
        <div class="color-input-wrapper">
          <input type="color" class="color-input" id="colorInput" value="${color}">
        </div>
        <div class="hex-display" id="hexDisplay">${color.toUpperCase()}</div>
        <div class="preset-grid" id="presets"></div>
      </div>
      <script>
        const presets = ['#000000', '#FFFFFF', '#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#00C7BE', '#32ADE6', '#FFD60A', '#8E8E93', '#1C1C1E', '#2C2C2E'];
        const preview = document.getElementById('preview');
        const colorInput = document.getElementById('colorInput');
        const hexDisplay = document.getElementById('hexDisplay');
        const presetsContainer = document.getElementById('presets');

        function updateColor(hex) {
          preview.style.backgroundColor = hex;
          colorInput.value = hex;
          hexDisplay.textContent = hex.toUpperCase();
          updatePresetSelection(hex);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'colorChange', color: hex }));
        }

        function updatePresetSelection(hex) {
          document.querySelectorAll('.preset-color').forEach(el => {
            el.classList.toggle('selected', el.dataset.color.toUpperCase() === hex.toUpperCase());
          });
        }

        // 프리셋 색상 버튼 생성
        presets.forEach(color => {
          const btn = document.createElement('div');
          btn.className = 'preset-color';
          btn.style.backgroundColor = color;
          btn.dataset.color = color;
          if (color.toUpperCase() === '${color}'.toUpperCase()) {
            btn.classList.add('selected');
          }
          btn.onclick = () => updateColor(color);
          presetsContainer.appendChild(btn);
        });

        // 초기 색상 설정
        preview.style.backgroundColor = '${color}';

        // 컬러 피커 이벤트
        colorInput.addEventListener('input', (e) => {
          updateColor(e.target.value);
        });

        // 컬러 피커 클릭 시 네이티브 피커 열기
        colorInput.addEventListener('click', (e) => {
          e.target.click();
        });

        // 자동으로 컬러 피커 열기 (약간의 딜레이 후)
        setTimeout(() => {
          colorInput.click();
        }, 300);
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'colorChange') {
        onColorChange(data.color);
      }
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors?.surface || '#fff' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors?.text || '#000' }]}>색상 선택</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors?.text || '#000'} />
            </TouchableOpacity>
          </View>

          <WebView
            ref={webViewRef}
            source={{ html }}
            style={styles.webView}
            scrollEnabled={false}
            onMessage={handleMessage}
            originWhitelist={['*']}
            javaScriptEnabled={true}
          />

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors?.primary || '#007AFF' }]}
            onPress={onClose}
          >
            <Text style={styles.doneText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  webView: {
    height: 380,
    backgroundColor: 'transparent',
  },
  doneButton: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
