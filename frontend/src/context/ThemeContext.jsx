import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('syllabus_tutor_theme');
      return saved || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = (typeof localStorage !== 'undefined' && localStorage.getItem('syllabus_tutor_theme')) || 'dark';
    if (initial === 'system') return prefersDark ? 'dark' : 'light';
    return initial;
  });

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (currentTheme) => {
      let resolved = currentTheme;
      if (currentTheme === 'system') {
        resolved = prefersDark.matches ? 'dark' : 'light';
      }

      setResolvedTheme(resolved);
      root.setAttribute('data-theme', resolved);

      try {
        localStorage.setItem('syllabus_tutor_theme', currentTheme);
      } catch (err) {
        console.warn('Unable to persist theme to localStorage', err);
      }
    };

    applyTheme(theme);

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    prefersDark.addEventListener('change', handleSystemChange);
    return () => prefersDark.removeEventListener('change', handleSystemChange);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
