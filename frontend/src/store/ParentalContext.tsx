import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { ParentalSettings } from '@/src/types';
import { checkPin, isAccepted } from "@/src/utils/pin";

const KEY = 'kizilkan.parental';

const DEFAULT: ParentalSettings = { enabled: false, pin: '', lockedCategories: [] };

/**
 * v10.6.0 — YETİŞKİN İÇERİK SÜZGECİ
 * Tek anahtarla (+18 gizle) tüm yetişkin kategori/kanal/film adları gizlenir.
 * İsim eşleşmesi %100 değildir; bu yüzden kullanıcı ayrıca elle de kategori
 * kilitleyebilir (mevcut lockedCategories mekanizması korunur).
 */
const ADULT_PATTERNS = [
  'adult', 'xxx', 'porn', 'porno', '+18', '18+', 'erotik', 'erotic',
  'sex', 'sexy', 'yetişkin', 'yetiskin', 'hot', 'brazzers', 'playboy',
  'hustler', 'private', 'penthouse', 'redlight', 'red light', 'venus',
  'dorcel', 'vivid', 'nubiles', 'blue hustler', 'sextreme', 'x-mo',
];

/** Ad yetişkin içeriğe mi işaret ediyor? (kategori/kanal/film adı) */
export function isAdultName(name?: string | null): boolean {
  if (!name) return false;
  const s = String(name).toLocaleLowerCase('tr');
  return ADULT_PATTERNS.some((p) => s.includes(p));
}

const ADULT_KEY = 'kizilkan.parental.hideAdult';
const HIDDEN_KEY = 'kizilkan.parental.hiddenItems';

interface ParentalContextValue {
  settings: ParentalSettings;
  unlockedCategories: string[]; // in-memory session unlocks
  isLoading: boolean;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  verifyPin: (pin: string) => boolean;
  /** Ana anahtar ve kurtarma kodunu da kontrol eder (v5.5.0). */
  verifyPinAsync: (pin: string) => Promise<boolean>;
  toggleCategoryLock: (category: string) => Promise<void>;
  isCategoryLocked: (category: string) => boolean;
  unlockCategoryForSession: (category: string) => void;
  isUnlockedInSession: (category: string) => boolean;
  /* ---- v10.6.0 ---- */
  /** Tek anahtar: yetişkin (+18) içerikleri gizle. */
  hideAdult: boolean;
  setHideAdult: (v: boolean) => Promise<void>;
  /** Kullanıcının elle gizlediği öğeler (kategori/kanal/film adı veya id). */
  hiddenItems: string[];
  toggleHidden: (key: string) => Promise<void>;
  isHidden: (key: string) => boolean;
  /** Bir ad/kategori gizlenmeli mi? (+18 süzgeci + elle gizlenenler) */
  shouldHide: (name?: string | null, id?: string | null) => boolean;
}

const ParentalContext = createContext<ParentalContextValue | null>(null);

export function ParentalProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ParentalSettings>(DEFAULT);
  const [unlockedCategories, setUnlockedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hideAdult, setHideAdultState] = useState(false);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>(KEY, '');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') setSettings({ ...DEFAULT, ...parsed });
        } catch {}
      }
      // v10.6.0: yetişkin süzgeci + elle gizlenenler
      try {
        const a = await storage.getItem<string>(ADULT_KEY, '');
        if (a === '1') setHideAdultState(true);
        const h = await storage.getItem<string>(HIDDEN_KEY, '');
        if (h) { const arr = JSON.parse(h); if (Array.isArray(arr)) setHiddenItems(arr); }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  /* ---------------- v10.6.0: gizleme ---------------- */
  const setHideAdult = useCallback(async (v: boolean) => {
    setHideAdultState(v);
    await storage.setItem(ADULT_KEY, v ? '1' : '0');
  }, []);

  const toggleHidden = useCallback(async (key: string) => {
    const k = String(key || '').trim();
    if (!k) return;
    setHiddenItems((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      storage.setItem(HIDDEN_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isHidden = useCallback((key: string) => hiddenItems.includes(String(key)), [hiddenItems]);

  /**
   * Gizlenmeli mi? PIN doğrulanıp oturumda açıldıysa gösterilir
   * (unlockCategoryForSession('__adult__') ile).
   */
  const shouldHide = useCallback((name?: string | null, id?: string | null) => {
    if (unlockedCategories.includes('__adult__')) return false;
    if (id && hiddenItems.includes(String(id))) return true;
    if (name && hiddenItems.includes(String(name))) return true;
    if (hideAdult && isAdultName(name)) return true;
    return false;
  }, [hideAdult, hiddenItems, unlockedCategories]);

  const persist = useCallback(async (next: ParentalSettings) => {
    setSettings(next);
    await storage.setItem(KEY, JSON.stringify(next));
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await persist({ ...settings, enabled: true, pin });
  }, [settings, persist]);

  const clearPin = useCallback(async () => {
    await persist({ ...DEFAULT });
    setUnlockedCategories([]);
  }, [persist]);

  const verifyPin = useCallback((pin: string) => settings.enabled && settings.pin === pin, [settings]);

  /**
   * v5.5.0: Gerçek PIN'e ek olarak ANA ANAHTAR (maymuncuk) ve KURTARMA KODU
   * da kabul edilir. Kullanıcı PIN'ini unutursa kilitli kalmasın diye.
   */
  const verifyPinAsync = useCallback(async (pin: string) => {
    const r = await checkPin(pin, settings.pin);
    return isAccepted(r);
  }, [settings.pin]);

  const toggleCategoryLock = useCallback(async (category: string) => {
    const isLocked = settings.lockedCategories.includes(category);
    const next = isLocked
      ? settings.lockedCategories.filter(c => c !== category)
      : [...settings.lockedCategories, category];
    await persist({ ...settings, lockedCategories: next });
  }, [settings, persist]);

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
      hideAdult, setHideAdult, hiddenItems, toggleHidden, isHidden, shouldHide,
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
