/**
 * KIZILKAN PLAYER — Oynatma Listesi Deposu (Context)
 * Dosya   : frontend/src/store/PlaylistContext.tsx
 * Sürüm   : v2.0.0  (önceki: v1.x)
 * Faz     : FAZ A.4 / Bölüm 0 — Liste Kalıcılığı
 *
 * ===========================================================================
 * BU SÜRÜMDE NE DEĞİŞTİ (neden liste artık kaybolmayacak)
 * ===========================================================================
 * ESKİ DAVRANIŞ (kırık):
 *   - Tüm listeler (channels + vod + series dahil) TEK bir AsyncStorage
 *     anahtarına yazılıyordu: storage.setItem(KEY, JSON.stringify(all)).
 *   - storage.setItem İÇERİDE bir kez daha JSON.stringify yapıyordu -> ÇİFT
 *     KODLAMA -> ~2x boyut.
 *   - Android AsyncStorage'ın satır başına ~2MB limiti aşılınca yazma SESSİZCE
 *     başarısız oluyordu (false dönüyordu ama kontrol edilmiyordu).
 *   - Sonuç: uygulama kapanıp açılınca liste boş -> her açılışta onboarding.
 *
 * YENİ DAVRANIŞ (bu dosya):
 *   - HAFİF metadata (ad, kaynak, kimlik bilgileri, accountInfo, sayaçlar)
 *     AsyncStorage'da 'kizilkan.playlists.meta' altında tutulur. Küçük ve güvenli.
 *   - AĞIR diziler (channels/vod/series) her liste için AYRI DOSYAYA yazılır:
 *     bigStore.write(id, { channels, vod, series }). Dosya sisteminin boyut
 *     limiti yoktur -> 150.000+ kanal bile kaydedilir.
 *   - Yazma başarısı KONTROL EDİLİR; başarısızsa hata fırlatılır, sessiz kayıp biter.
 *   - Migration: eski 'kizilkan.playlists' anahtarı varsa, ilk açılışta otomatik
 *     olarak yeni yapıya taşınır ve eski anahtar temizlenir. Mevcut kullanıcı
 *     verisini KAYBETMEZ.
 *
 * ===========================================================================
 * DIŞ ARAYÜZ KORUNDU
 * ===========================================================================
 * usePlaylists() döndürdüğü her şey ve fonksiyon imzaları BİREBİR aynı.
 * activePlaylist.channels / .vod / .series hâlâ BELLEKTE mevcut (aktif liste
 * için). Böylece player.tsx, stats.tsx, hidden-manager.tsx, epg-timeline.tsx,
 * detail.tsx gibi 10+ ekranın HİÇBİRİ değişmeden çalışmaya devam eder.
 *
 * MİMARİ: playlists[] içindeki nesneler metadata + (yalnızca yüklenmiş olanlar
 * için) ağır diziler taşır. Uygulama açılışında SADECE metadata okunur (hızlı);
 * ağır diziler AKTİF liste için tembel (lazy) yüklenir.
 * ===========================================================================
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { storage } from '@/src/utils/storage';
import { bigStore } from '@/src/utils/storage/bigStore';
import { Playlist } from '@/src/types';
import { useProfiles } from './ProfileContext';

/**
 * v5.7.0 — LİSTELER ARTIK PROFİLE ÖZEL
 * ESKİ: tüm profiller aynı listeyi paylaşıyordu; yeni profil açınca öncekinin
 *       kanalları görünüyordu. Kullanıcının isteği: her profilin linkleri ve
 *       içerikleri KENDİNE ÖZEL olsun.
 * YENİ: depolama anahtarları profil kimliğini içeriyor.
 * Mevcut veriler kaybolmasın diye ilk açılışta eski (ortak) veri, o anki
 * profile TAŞINIYOR.
 */
const metaKey = (pid: string) => `kizilkan.playlists.meta.${pid}`;
const activeKey = (pid: string) => `kizilkan.activePlaylistId.${pid}`;

const GLOBAL_META_KEY = 'kizilkan.playlists.meta';   // v5.6 ve öncesi (ortak)
const LEGACY_KEY = 'kizilkan.playlists';             // en eski (tek blob)
const GLOBAL_ACTIVE_KEY = 'kizilkan.activePlaylistId';
/** Ortak listelerin hangi profile taşındığını işaretler (bir kez). */
const MIGRATED_KEY = 'kizilkan.playlists.migratedTo';
const FAV_KEY_PREFIX = 'kizilkan.favorites.';
const REC_KEY_PREFIX = 'kizilkan.recent.';

/** Ağır dizileri ayıklayıp yalnızca metadata bırakır (AsyncStorage'a yazmak için). */
type PlaylistMeta = Omit<Playlist, 'channels' | 'vod' | 'series'> & {
  channelsCount?: number;
  vodCount?: number;
  seriesCount?: number;
};

function toMeta(p: Playlist): PlaylistMeta {
  const { channels, vod, series, ...rest } = p;
  return {
    ...rest,
    channelsCount: channels?.length || 0,
    vodCount: vod?.length || 0,
    seriesCount: series?.length || 0,
  };
}

/** Metadata + (varsa) ağır diziyi birleştirip tam Playlist'e döndürür. */
function fromMeta(meta: PlaylistMeta, heavy?: { channels?: any[]; vod?: any[]; series?: any[] }): Playlist {
  const { channelsCount, vodCount, seriesCount, ...rest } = meta as any;
  return {
    ...(rest as Omit<Playlist, 'channels' | 'vod' | 'series'>),
    channels: heavy?.channels || [],
    vod: heavy?.vod || [],
    series: heavy?.series || [],
  };
}

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

  /**
   * BAYAT KAPANIŞ KORUMASI (v6.2.0) — KRİTİK
   * persistMeta/addPlaylist gibi useCallback'ler activeProfile'ı kullanıyor
   * ama bağımlılık dizisi boştu. Sonuç: HER ZAMAN ilk render'daki değeri
   * (yani 'default') görüyorlardı -> liste yanlış anahtara yazılıyor,
   * uygulama yeniden açılınca "liste yok" görünüyordu.
   * Ref her render'da güncellenir; kapanışlar bunu okur.
   */
  const activeProfileIdRef = useRef<string>('default');
  activeProfileIdRef.current = activeProfile?.id || 'default';

  /** Kayıt/okuma için HER ZAMAN güncel profil kimliği. */
  const currentPid = () => activeProfileIdRef.current;
  const profileId = activeProfile?.id || 'default';

  // playlists: metadata + (aktif liste için) ağır diziler bellekte
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  /** v10.8.0: effect'lerden GÜNCEL listeye erişim (bayat kapanış olmasın). */
  const playlistsRef = useRef<Playlist[]>([]);
  playlistsRef.current = playlists;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hangi liste id'lerinin ağır verisi belleğe yüklendi (tekrar okumayı önler)
  const loadedHeavy = useRef<Set<string>>(new Set());

  // --- Açılış: metadata oku (+ gerekirse eski veriyi migrate et) -----------
  useEffect(() => {
    (async () => {
      try {
        // PROFİL DEĞİŞİMİ: önceki profilin listesi ekranda kalmasın.
        setIsLoading(true);
        setPlaylists([]);
        setActiveId(null);
        /**
         * KRİTİK (v6.3.0): "yüklendi" işaretlerini de temizle.
         * ESKİ HATA: loadedHeavy seti profil değişiminde temizlenmiyordu.
         * A -> B -> A geçişinde, A'nın listesi "zaten yüklü" sanılıp kanalları
         * BİR DAHA OKUNMUYORDU. Sonuç: liste görünür ama İÇİ BOŞ.
         */
        loadedHeavy.current.clear();

        // 1) Eski tek-anahtar formatı var mı? Varsa migrate et.
        const legacyRaw = await storage.getItem<string>(LEGACY_KEY, '');
        if (legacyRaw) {
          try {
            const legacyList: Playlist[] = JSON.parse(legacyRaw);
            if (Array.isArray(legacyList) && legacyList.length > 0) {
              // Her listenin ağır verisini dosyaya yaz, metadata'yı topla.
              const metas: PlaylistMeta[] = [];
              for (const p of legacyList) {
                await bigStore.write(p.id, {
                  channels: p.channels || [],
                  vod: p.vod || [],
                  series: p.series || [],
                });
                metas.push(toMeta(p));
              }
              // En eski (tek blob) veriyi ORTAK anahtara yaz; aşağıdaki taşıma
              // adımı bunu aktif profile aktaracak.
              await storage.setItem(GLOBAL_META_KEY, JSON.stringify(metas));
            }
          } catch (e) {
            console.warn('[Playlist] legacy migrate parse hatası', e);
          }
          // Eski anahtarı temizle (bir daha migrate etmesin).
          await storage.removeItem(LEGACY_KEY);
        }

        // 2) PROFİLE ÖZEL metadata'yı oku.
        // v6.0.0: Henüz gerçek profil yoksa (ilk kurulum, welcome sürüyor)
        // taşıma yapma; yanlışlıkla 'default' altına yazmasın.
        const pid = activeProfile?.id || 'default';
        const realProfile = !!activeProfile?.id && activeProfile.id !== 'default';
        let metaRaw = await storage.getItem<string>(metaKey(pid), '');
        let aid = await storage.getItem<string>(activeKey(pid), '');

        // TAŞIMA: bu profilde veri yoksa ve ORTAK (eski) veri varsa, mevcut
        // listeler bu profile aktarılır. Böylece güncelleme sonrası kimse
        // listesini kaybetmez. Taşıma yalnızca BİR KEZ olur.
        // TAŞIMA YALNIZCA BİR KEZ, TEK PROFİLE (v5.9.0 düzeltmesi)
        // ESKİ HATA: ortak anahtar silinmediği için HER YENİ PROFİL aynı
        // listeyi devralıyordu -> "listeler profillerle karışıyor".
        // YENİ: taşıma bir bayrakla işaretleniyor; sadece ilk profil devralır,
        // sonraki profiller BOŞ başlar (kullanıcının istediği davranış).
        if (!metaRaw && realProfile) {
          const migratedTo = await storage.getItem<string>(MIGRATED_KEY, '');
          if (!migratedTo) {
            const globalMeta = await storage.getItem<string>(GLOBAL_META_KEY, '');
            if (globalMeta) {
              await storage.setItem(metaKey(pid), globalMeta);
              const globalActive = await storage.getItem<string>(GLOBAL_ACTIVE_KEY, '');
              if (globalActive) await storage.setItem(activeKey(pid), globalActive);
              metaRaw = globalMeta;
              aid = globalActive || '';
              // Bayrağı koy: başka hiçbir profil bu listeyi devralmasın.
              await storage.setItem(MIGRATED_KEY, pid);
              // Ortak anahtarları temizle (bir daha kullanılmayacak).
              await storage.removeItem(GLOBAL_META_KEY);
              await storage.removeItem(GLOBAL_ACTIVE_KEY);
            }
          }
        }

        let metas: PlaylistMeta[] = [];
        try { if (metaRaw) metas = JSON.parse(metaRaw); } catch {}

        const initial: Playlist[] = (metas || []).map(m => fromMeta(m));
        setPlaylists(initial);
        if (aid) setActiveId(aid);
      } catch (e) {
        console.warn('[Playlist] açılış yükleme hatası', e);
      } finally {
        setIsLoading(false);
      }
    })();
    // PROFİL DEĞİŞİNCE YENİDEN YÜKLE (v5.7.0)
    // Listeler artık profile özel olduğu için, profil değiştiğinde o profilin
    // kendi listeleri okunmalı. Bağımlılık boş olduğu için eskiden önceki
    // profilin listesi ekranda kalıyordu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  // --- Aktif liste değişince ağır verisini tembel yükle ---------------------
  useEffect(() => {
    if (!activeId) return;
    if (loadedHeavy.current.has(activeId)) return;
    (async () => {
      const heavy = await bigStore.read(activeId, { channels: [], vod: [], series: [] });
      loadedHeavy.current.add(activeId);
      setPlaylists(prev =>
        prev.map(p =>
          p.id === activeId
            ? { ...p, channels: heavy.channels || [], vod: heavy.vod || [], series: heavy.series || [] }
            : p
        )
      );

      /**
       * v10.8.0 — YEDEKTEN DÖNÜŞTE İÇERİĞİ OTOMATİK İNDİR (kritik)
       * Kanal/film/dizi verileri AsyncStorage'da DEĞİL, cihazdaki dosyalarda
       * (bigStore) tutulur; bu yüzden yedek dosyası yalnızca HESAP bilgilerini
       * taşır. Yedek başka cihaza yüklenince liste görünür ama İÇERİĞİ BOŞ
       * olurdu ("listeler gelmedi" şikâyeti). Artık içerik boşsa ve listenin
       * kaynak bilgisi varsa, içerik sessizce kaynağından yeniden indirilir.
       */
      const isEmpty = (heavy.channels?.length || 0) === 0
        && (heavy.vod?.length || 0) === 0
        && (heavy.series?.length || 0) === 0;
      if (!isEmpty) return;
      const pl = playlistsRef.current.find(p => p.id === activeId);
      if (!pl) return;
      const hasSource = !!(pl.m3uUrl || pl.xtreamServer || pl.stalkerPortal || pl.panelCode);
      if (!hasSource) return;
      try {
        const { refreshPlaylistContent } = await import('@/src/utils/refreshPlaylist');
        const res = await refreshPlaylistContent(pl);
        if (res?.ok && res.patch) {
          await bigStore.write(activeId, {
            channels: (res.patch as any).channels || [],
            vod: (res.patch as any).vod || [],
            series: (res.patch as any).series || [],
          });
          setPlaylists(prev => prev.map(p => (p.id === activeId ? { ...p, ...(res.patch as any) } : p)));
        }
      } catch { /* çevrimdışı olabilir; kullanıcı "Tümünü Güncelle" ile deneyebilir */ }
    })();
  }, [activeId]);

  // --- Favoriler + son izlenenler (profile göre) ----------------------------
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
      setFavorites(favList);
      setRecent(recList);
    })();
  }, [profileId]);

  /** Metadata'yı AsyncStorage'a yazar (hafif, limitsiz güvenli). */
  const persistMeta = useCallback(async (list: Playlist[]) => {
    const metas = list.map(toMeta);
    const pid = currentPid();
    const ok = await storage.setItem(metaKey(pid), JSON.stringify(metas));
    if (!ok) {
      throw new Error('Liste bilgisi kaydedilemedi (meta yazma hatası).');
    }
  }, []);

  const addPlaylist = useCallback(async (p: Playlist) => {
    // 1) Ağır veriyi DOSYAYA yaz — başarıyı kontrol et.
    const heavyOk = await bigStore.write(p.id, {
      channels: p.channels || [],
      vod: p.vod || [],
      series: p.series || [],
    });
    if (!heavyOk) {
      throw new Error('Liste içeriği cihaza kaydedilemedi. Depolama alanını kontrol edin.');
    }

    /**
     * 2) Belleği güncelle.
     *
     * v10.7.0 — BAYAT KAPANIŞ DÜZELTMESİ (KRİTİK)
     * ESKİ HATA: `const next = [...playlists.filter(...), p]` kullanılıyordu.
     * `playsists` bu callback'in OLUŞTUĞU render'daki değerdi. Art arda
     * (döngüyle) birden çok liste eklenince — ör. "panelimi bilmiyorum"da 4
     * panel birden seçilince — her çağrı AYNI eski diziyi görüp bir öncekini
     * EZİYORDU; 4 liste eklendi sanılıp cihazda 1 tanesi kalıyordu.
     * ÇÖZÜM: güncelleyici (functional) biçim + hesaplanan diziyi ref'ten okuyup
     * metadata'yı ona göre yazmak.
     */
    let next: Playlist[] = [];
    setPlaylists((prev) => {
      next = [...prev.filter(pl => pl.id !== p.id), p];
      return next;
    });
    loadedHeavy.current.add(p.id);

    // 3) Metadata'yı yaz (yukarıda hesaplanan GÜNCEL dizi ile).
    await persistMeta(next);

    // 4) Aktif yap.
    await storage.setItem(activeKey(currentPid()), p.id);
    setActiveId(p.id);
  }, [persistMeta]);

  const removePlaylist = useCallback(async (id: string) => {
    const next = playlists.filter(pl => pl.id !== id);
    setPlaylists(next);
    await persistMeta(next);
    await bigStore.remove(id);
    loadedHeavy.current.delete(id);
    if (activeId === id) {
      const newActive = next[0]?.id || null;
      setActiveId(newActive);
      const pid2 = currentPid();
      if (newActive) await storage.setItem(activeKey(pid2), newActive);
      else await storage.removeItem(activeKey(pid2));
    }
  }, [playlists, persistMeta, activeId]);

  const updatePlaylist = useCallback(async (id: string, patch: Partial<Playlist>) => {
    const target = playlists.find(pl => pl.id === id);
    const next = playlists.map(pl => (pl.id === id ? { ...pl, ...patch } : pl));
    setPlaylists(next);

    // Ağır alanlardan biri güncellendiyse dosyayı da yenile.
    const heavyTouched = 'channels' in patch || 'vod' in patch || 'series' in patch;
    if (heavyTouched && target) {
      const merged = { ...target, ...patch };
      const ok = await bigStore.write(id, {
        channels: merged.channels || [],
        vod: merged.vod || [],
        series: merged.series || [],
      });
      if (!ok) throw new Error('Liste içeriği güncellenemedi.');
      loadedHeavy.current.add(id);
    }
    await persistMeta(next);
  }, [playlists, persistMeta]);

  const setActivePlaylist = useCallback(async (id: string) => {
    setActiveId(id);
    await storage.setItem(activeKey(currentPid()), id);
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
