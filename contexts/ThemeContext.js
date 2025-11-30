// contexts/ThemeContext.js - Theme context for managing display mode
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = 'selectedTheme';
const DEFAULT_THEME = 'system'; // 'light', 'dark', or 'system'

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(DEFAULT_THEME); // User's choice
  const [actualTheme, setActualTheme] = useState('light'); // Actual applied theme
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme
  useEffect(() => {
    loadTheme();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        setActualTheme(colorScheme === 'dark' ? 'dark' : 'light');
      }
    });

    return () => subscription.remove();
  }, [themeMode]);

  // Update actual theme when theme mode changes
  useEffect(() => {
    if (themeMode === 'system') {
      const systemTheme = Appearance.getColorScheme();
      setActualTheme(systemTheme === 'dark' ? 'dark' : 'light');
    } else {
      setActualTheme(themeMode);
    }
  }, [themeMode]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeMode(savedTheme);
      } else {
        // If no saved theme, use system default
        const systemTheme = Appearance.getColorScheme();
        setActualTheme(systemTheme === 'dark' ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Load theme error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Change theme mode
  const changeTheme = async (newTheme) => {
    try {
      if (['light', 'dark', 'system'].includes(newTheme)) {
        setThemeMode(newTheme);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
    } catch (error) {
      console.error('Change theme error:', error);
    }
  };

  const value = {
    themeMode, // User's selected mode: 'light', 'dark', or 'system'
    actualTheme, // Actual theme being applied: 'light' or 'dark'
    changeTheme,
    isLoading,
    isDark: actualTheme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
