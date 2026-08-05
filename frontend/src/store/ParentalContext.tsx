import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { ParentalSettings } from '@/src/types';
import { checkPin, isAccepted } from "@/src/utils/pin";

const KEY = 'kizilkan.parental';
/** PIN SecureStore anahtarı — düz metin AsyncStorage'da tutulmaz (v9.7.0). */
const PIN_SECURE_KEY = 'kizilkan.parental.pin';

const DEFAULT: ParentalSettings = { enabled: false, pin: '', lockedCategories: [] };

interface ParentalContextValue {
  settings: ParentalSettings;
  unlockedCategories: string[];
  isLoading: boolean;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  verifyPin: (pin: string) => boolean;
  verifyPinAsync: (pin: string) => Promise<boolean>;
  toggleCategoryLock: (category: string) => Promise<void>;
  isCategoryLocked: (category: string) => boolean;
  unlockCategoryForSession: (category: string) => void;
  isUnlockedInSession: (category: string) => boolean;
}

const ParentalContext = createContext<ParentalContextValue | null>(null);

export function ParentalProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ParentalSettings>(DEFAULT);
  const [unlockedCategories, setUnlockedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>(KEY, '');
      let next: ParentalSettings = { ...DEFAULT };
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') next = { ...DEFAULT, ...parsed };
        } catch {}
      }
      // SecureStore'dan PIN oku
      let securePin = await storage.secureGet<string>(PIN_SECURE_KEY, '');
      // MIGRASYON: eski düz metin PIN varsa SecureStore'a taşı
      if ((!securePin || securePin === '') && next.pin) {
        await storage.secureSet(PIN_SECURE_KEY, next.pin);
        securePin = next.pin;
        // Düz metinden sil
        const cleaned = { ...next, pin: '' };
        await storage.setItem(KEY, JSON.stringify({ ...cleaned, pin: undefined, hasPin: !!securePin }));
        next = { ...cleaned, pin: securePin || '' };
      } else {
        next = { ...next, pin: securePin || '' };
      }
      setSettings(next);
      setIsLoading(false);
    })();
  }, []);

  /** PIN hariç ayarları AsyncStorage'a yazar; PIN yalnızca SecureStore. */
  const persistMeta = useCallback(async (next: ParentalSettings) => {
    setSettings(next);
    const { pin: _p, ...meta } = next as any;
    await storage.setItem(KEY, JSON.stringify({
      enabled: next.enabled,
      lockedCategories: next.lockedCategories,
      hasPin: !!next.pin,
    }));
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await storage.secureSet(PIN_SECURE_KEY, pin);
    await persistMeta({ ...settings, enabled: true, pin });
  }, [settings, persistMeta]);

  const clearPin = useCallback(async () => {
    await storage.secureRemove(PIN_SECURE_KEY);
    setSettings({ ...DEFAULT });
    await storage.setItem(KEY, JSON.stringify({ enabled: false, lockedCategories: [], hasPin: false }));
    setUnlockedCategories([]);
  }, []);

  const verifyPin = useCallback((pin: string) => settings.enabled && settings.pin === pin, [settings]);

  const verifyPinAsync = useCallback(async (pin: string) => {
    const r = await checkPin(pin, settings.pin);
    return isAccepted(r);
  }, [settings.pin]);

  const toggleCategoryLock = useCallback(async (category: string) => {
    const isLocked = settings.lockedCategories.includes(category);
    const next = isLocked
      ? settings.lockedCategories.filter(c => c !== category)
      : [...settings.lockedCategories, category];
    await persistMeta({ ...settings, lockedCategories: next });
  }, [settings, persistMeta]);

  const isCategoryLocked = useCallback(
    (category: string) => settings.enabled && settings.lockedCategories.includes(category),
    [settings]
  );

  const unlockCategoryForSession = useCallback((category: string) => {
    setUnlockedCategories(prev => prev.includes(category) ? prev : [...prev, category]);
  }, []);

  const isUnlockedInSession = useCallback(
    (category: string) => unlockedCategories.includes(category),
    [unlockedCategories]
  );

  return (
    <ParentalContext.Provider value={{
      settings, unlockedCategories, isLoading,
      setPin, clearPin, verifyPin, verifyPinAsync, toggleCategoryLock, isCategoryLocked,
      unlockCategoryForSession, isUnlockedInSession,
    }}>
      {children}
    </ParentalContext.Provider>
  );
}

export function useParental(): ParentalContextValue {
  const ctx = useContext(ParentalContext);
  if (!ctx) throw new Error('useParental must be used within ParentalProvider');
  return ctx;
}
