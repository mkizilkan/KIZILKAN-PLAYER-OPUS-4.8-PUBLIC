import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { Profile } from '@/src/types';

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
  addProfile: (name: string, color?: string, isKids?: boolean) => Promise<Profile>;
  updateProfile: (id: string, patch: Partial<Profile>) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  setPin: (id: string, pin: string | null) => Promise<void>;
  verifyPin: (id: string, pin: string) => boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
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
      setProfiles(list);
      if (aid && list.some(p => p.id === aid)) setActiveId(aid);
      setIsLoading(false);
    })();
  }, []);

  const persist = useCallback(async (next: Profile[]) => {
    setProfiles(next);
    await storage.setItem(PROFILES_KEY, JSON.stringify(next));
  }, []);

  const addProfile = useCallback(async (name: string, color?: string, isKids?: boolean): Promise<Profile> => {
    const idx = profiles.length;
    const p: Profile = {
      id: `p-${Date.now()}`,
      name: name.trim() || `Profil ${idx + 1}`,
      color: color || AVATAR_COLORS[idx % AVATAR_COLORS.length],
      hasPin: false,
      isKids: !!isKids,
    };
    await persist([...profiles, p]);
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
    if (!profiles.some(p => p.id === id)) return;
    setActiveId(id);
    await storage.setItem(ACTIVE_KEY, id);
  }, [profiles]);

  const setPin = useCallback(async (id: string, pin: string | null) => {
    const next = profiles.map(p => (p.id === id ? { ...p, hasPin: !!pin, pin: pin || undefined } : p));
    await persist(next);
  }, [profiles, persist]);

  const verifyPin = useCallback((id: string, pin: string) => {
    const p = profiles.find(x => x.id === id);
    return !!p && !!p.hasPin && p.pin === pin;
  }, [profiles]);

  const activeProfile = profiles.find(p => p.id === activeId) || profiles[0] || DEFAULT_PROFILE;

  return (
    <ProfileContext.Provider value={{
      profiles, activeProfile, isLoading,
      addProfile, updateProfile, removeProfile, switchProfile, setPin, verifyPin,
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
