// =============================
// File: context/ThemeContext.tsx (NY FIL)
// =============================
import React, { createContext, useState, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

type ColorMode = 'light' | 'dark';

type ThemeContextType = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme() ?? 'light';
  const [colorMode, setColorMode] = useState<ColorMode>(systemTheme);

  const toggleColorMode = () => {
    setColorMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const value = useMemo(() => ({ colorMode, setColorMode, toggleColorMode }), [colorMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};