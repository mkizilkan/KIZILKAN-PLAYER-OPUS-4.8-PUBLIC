import React, { createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import { storage } from '@/src/utils/storage';
import { Profile } from '@/src/types';
import { checkPin, isAccepted } from "@/src/utils/pin";

const PROFILES_KEY = 'kizilkan.profiles';
const ACTIVE_KEY = 'kizilkan.activeProfileId';

const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Ben',
  color: '#E50914',
  hasPin: false,
};

const AVATAR_COLORS = ['#E50914', '#FF7A00', '#00C853', '#0A84FF', '#AB47BC', '#EF5350', '#26A69A', '#FFCA28'];

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile;
  isLoading: boolean;
  addProfile: (name: string, color?: string, isKids?: boolean, pin?: string | null) => Promise<Profile>;
  updateProfile: (id: string, patch: Partial<Profile>) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  setPin: (id: string, pin: string | null) => Promise<void>;
  verifyPin: (id: string, pin: string) => boolean;
  /** Ana anahtar + kurtarma kodu destekli doğrulama (v5.5.0). */
  verifyPinAsync: (id: string, pin: string) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  /**
   * BAYAT KAPANIŞ (stale closure) KORUMASI — v5.9.0
   * addProfile'dan hemen sonra switchProfile/setPin çağrıldığında, bu
   * fonksiyonların kapanışındaki `profiles` dizisi HENÜZ YENİ PROFİLİ
   * İÇERMİYORDU. Sonuç: switchProfile sessizce geri dönüyor (profil
   * değişmiyor -> listeler karışıyor, ekran donuyor).
   * Çözüm: her zaman güncel listeyi tutan bir ref.
   */
  const profilesRef = useRef<Profile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([DEFAULT_PROFILE]);
  const [activeId, setActiveId] = useState<string>('default');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [raw, aid] = await Promise.all([
        storage.getItem<string>(PROFILES_KEY, ''),
        storage.getItem<string>(ACTIVE_KEY, 'default'),
      ]);
      let list: Profile[] = [DEFAULT_PROFILE];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        } catch {}
      }
      profilesRef.current = list;   // ilk yüklemede de ref dolsun
      setProfiles(list);
      if (aid && list.some(p => p.id === aid)) setActiveId(aid);
      setIsLoading(false);
    })();
  }, []);

  const persist = useCallback(async (next: Profile[]) => {
    profilesRef.current = next;   // ref her zaman güncel kalsın
    setProfiles(next);
    await storage.setItem(PROFILES_KEY, JSON.stringify(next));
  }, []);

  /**
   * v5.7.0 — PIN artık BURADA, profil oluşturulurken atanıyor (atomik).
   * ESKİ HATA: addProfile'dan sonra ayrıca setPin çağrılıyordu; setPin ise
   * kendi kapanışındaki (closure) ESKİ profiles dizisini kullandığı için yeni
   * profili bulamıyor ve ESKİ listeyi geri yazıyordu -> yeni profil siliniyor,
   * ekran donuyordu. Tek işlemde yaparak bu sınıf hatayı tamamen kapatıyoruz.
   */
  const addProfile = useCallback(async (name: string, color?: string, isKids?: boolean, pin?: string | null): Promise<Profile> => {
    const base = profilesRef.current.length ? profilesRef.current : profiles;
    const idx = base.length;
    const p: Profile = {
      id: `p-${Date.now()}`,
      name: name.trim() || `Profil ${idx + 1}`,
      color: color || AVATAR_COLORS[idx % AVATAR_COLORS.length],
      hasPin: !!pin,
      pin: pin || undefined,
      isKids: !!isKids,
    };
    await persist([...base, p]);
    return p;
  }, [profiles, persist]);

  const updateProfile = useCallback(async (id: string, patch: Partial<Profile>) => {
    const next = profiles.map(p => (p.id === id ? { ...p, ...patch } : p));
    await persist(next);
  }, [profiles, persist]);

  const removeProfile = useCallback(async (id: string) => {
    if (profiles.length <= 1) return; // Always keep at least one
    const next = profiles.filter(p => p.id !== id);
    await persist(next);
    if (activeId === id) {
      const newActive = next[0].id;
      setActiveId(newActive);
      await storage.setItem(ACTIVE_KEY, newActive);
    }
  }, [profiles, persist, activeId]);

  const switchProfile = useCallback(async (id: string) => {
    // REF kullanıyoruz: yeni eklenen profil de anında görünür.
    const list = profilesRef.current.length ? profilesRef.current : profiles;
    if (!list.some(p => p.id === id)) return;
    setActiveId(id);
    await storage.setItem(ACTIVE_KEY, id);
  }, [profiles]);

  const setPin = useCallback(async (id: string, pin: string | null) => {
    // GÜVENLİK: profil listede yoksa HİÇBİR ŞEY YAZMA. (Eskiden eski liste geri
    // yazılıyor ve yeni eklenen profil siliniyordu.)
    const list = profilesRef.current.length ? profilesRef.current : profiles;
    const exists = list.some(p => p.id === id);
    if (!exists) return;
    const next = list.map(p => (p.id === id ? { ...p, hasPin: !!pin, pin: pin || undefined } : p));
    await persist(next);
  }, [profiles, persist]);

  const verifyPin = useCallback((id: string, pin: string) => {
    const p = profiles.find(x => x.id === id);
    return !!p && !!p.hasPin && p.pin === pin;
  }, [profiles]);

  /**
   * v5.5.0: Profil PIN'i unutulursa kilitli kalmasın diye ANA ANAHTAR ve
   * KURTARMA KODU da kabul edilir.
   */
  const verifyPinAsync = useCallback(async (id: string, pin: string) => {
    const p = profiles.find(x => x.id === id);
    const r = await checkPin(pin, p?.pin);
    return isAccepted(r);
  }, [profiles]);

  const activeProfile = profiles.find(p => p.id === activeId) || profiles[0] || DEFAULT_PROFILE;

  return (
    <ProfileContext.Provider value={{
      profiles, activeProfile, isLoading,
      addProfile, updateProfile, removeProfile, switchProfile, setPin, verifyPin, verifyPinAsync,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider');
  return ctx;
}

export const PROFILE_AVATAR_COLORS = AVATAR_COLORS;
