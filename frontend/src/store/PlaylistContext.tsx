import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { Playlist } from '@/src/types';
import { useProfiles } from './ProfileContext';

const STORAGE_KEY = 'kizilkan.playlists';
const ACTIVE_KEY = 'kizilkan.activePlaylistId';
const FAV_KEY_PREFIX = 'kizilkan.favorites.';
const REC_KEY_PREFIX = 'kizilkan.recent.';

interface PlaylistContextValue {
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  favorites: string[];
  recent: string[];
  isLoading: boolean;
  addPlaylist: (p: Playlist) => Promise<void>;
  removePlaylist: (id: string) => Promise<void>;
  updatePlaylist: (id: string, patch: Partial<Playlist>) => Promise<void>;
  setActivePlaylist: (id: string) => Promise<void>;
  toggleFavorite: (channelId: string) => Promise<void>;
  isFavorite: (channelId: string) => boolean;
  addToRecent: (channelId: string) => Promise<void>;
  clearRecent: () => Promise<void>;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const { activeProfile } = useProfiles();
  const profileId = activeProfile?.id || 'default';

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load playlists + activeId (global) once
  useEffect(() => {
    (async () => {
      const [pl, aid] = await Promise.all([
        storage.getItem<string>(STORAGE_KEY, ''),
        storage.getItem<string>(ACTIVE_KEY, ''),
      ]);
      try { if (pl) setPlaylists(JSON.parse(pl)); } catch {}
      if (aid) setActiveId(aid);
      setIsLoading(false);
    })();
  }, []);

  // Load favorites + recent per active profile
  useEffect(() => {
    (async () => {
      const favKey = FAV_KEY_PREFIX + profileId;
      const recKey = REC_KEY_PREFIX + profileId;
      const [fav, rec] = await Promise.all([
        storage.getItem<string>(favKey, ''),
        storage.getItem<string>(recKey, ''),
      ]);
      let favList: string[] = [];
      let recList: string[] = [];
      try { if (fav) favList = JSON.parse(fav); } catch {}
      try { if (rec) recList = JSON.parse(rec); } catch {}

      // Migration: on first switch to non-default profile, keep default's data
      // Nothing to do here — each profile has empty arrays initially.

      setFavorites(favList);
      setRecent(recList);
    })();
  }, [profileId]);

  const persist = useCallback(async (next: Playlist[]) => {
    setPlaylists(next);
    await storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addPlaylist = useCallback(async (p: Playlist) => {
    const next = [...playlists.filter(pl => pl.id !== p.id), p];
    await persist(next);
    await storage.setItem(ACTIVE_KEY, p.id);
    setActiveId(p.id);
  }, [playlists, persist]);

  const removePlaylist = useCallback(async (id: string) => {
    const next = playlists.filter(pl => pl.id !== id);
    await persist(next);
    if (activeId === id) {
      const newActive = next[0]?.id || null;
      setActiveId(newActive);
      if (newActive) await storage.setItem(ACTIVE_KEY, newActive);
      else await storage.removeItem(ACTIVE_KEY);
    }
  }, [playlists, persist, activeId]);

  const updatePlaylist = useCallback(async (id: string, patch: Partial<Playlist>) => {
    const next = playlists.map(pl => (pl.id === id ? { ...pl, ...patch } : pl));
    await persist(next);
  }, [playlists, persist]);

  const setActivePlaylist = useCallback(async (id: string) => {
    setActiveId(id);
    await storage.setItem(ACTIVE_KEY, id);
  }, []);

  const toggleFavorite = useCallback(async (channelId: string) => {
    const next = favorites.includes(channelId)
      ? favorites.filter(x => x !== channelId)
      : [...favorites, channelId];
    setFavorites(next);
    await storage.setItem(FAV_KEY_PREFIX + profileId, JSON.stringify(next));
  }, [favorites, profileId]);

  const isFavorite = useCallback((channelId: string) => favorites.includes(channelId), [favorites]);

  const addToRecent = useCallback(async (channelId: string) => {
    const next = [channelId, ...recent.filter(x => x !== channelId)].slice(0, 30);
    setRecent(next);
    await storage.setItem(REC_KEY_PREFIX + profileId, JSON.stringify(next));
  }, [recent, profileId]);

  const clearRecent = useCallback(async () => {
    setRecent([]);
    await storage.setItem(REC_KEY_PREFIX + profileId, JSON.stringify([]));
  }, [profileId]);

  const activePlaylist = playlists.find(p => p.id === activeId) || null;

  return (
    <PlaylistContext.Provider
      value={{
        playlists, activePlaylist, favorites, recent, isLoading,
        addPlaylist, removePlaylist, updatePlaylist, setActivePlaylist,
        toggleFavorite, isFavorite, addToRecent, clearRecent,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylists(): PlaylistContextValue {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistProvider');
  return ctx;
}
