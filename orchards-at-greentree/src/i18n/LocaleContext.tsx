import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, type Locale, type Strings } from './translations';

export type LocaleOverride = 'system' | Locale;

const KEY = 'orchards.locale.v1';

function systemLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode ?? 'en';
  return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
}

interface LocaleContextValue {
  /** What the user picked: 'system', or an explicit override. */
  override: LocaleOverride;
  /** The locale actually in effect, after resolving 'system'. */
  locale: Locale;
  setOverride: (next: LocaleOverride) => void;
  t: Strings;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverrideState] = useState<LocaleOverride>('system');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(KEY);
        if (alive && (stored === 'en' || stored === 'es' || stored === 'system')) {
          setOverrideState(stored);
        }
      } catch {
        // Fall back to 'system'.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setOverride = useCallback((next: LocaleOverride) => {
    setOverrideState(next);
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const locale = override === 'system' ? systemLocale() : override;
  const t = translations[locale];

  const value = useMemo(
    () => ({ override, locale, setOverride, t }),
    [override, locale, setOverride, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
