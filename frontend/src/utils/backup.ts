import { storage } from '@/src/utils/storage';

/**
 * Backup & Restore utilities.
 * All AsyncStorage keys we own are prefixed with "kizilkan."
 * We export/import a JSON blob containing every kizilkan.* key.
 */

const KIZILKAN_KEYS = [
  'kizilkan.theme',
  'kizilkan.playlists',
  'kizilkan.activePlaylistId',
  'kizilkan.parental',
  'kizilkan.profiles',
  'kizilkan.activeProfileId',
  // v10.6.0: profil ayrımı öncesi/ortak liste anahtarları da yedeğe girsin.
  'kizilkan.playlists.meta',
  'kizilkan.playlists.migratedTo',
];

const PROFILE_PREFIXED = [
  'kizilkan.favorites.',
  'kizilkan.recent.',
  /**
   * v10.6.0 — PLAYLIST HESAPLARI YEDEKTE YOKTU (düzeltildi).
   * Listeler v5.6'dan beri PROFİL BAZLI anahtarlarda tutuluyor
   * (kizilkan.playlists.meta.{profilId}) ama yedek yalnızca ESKİ ortak
   * anahtarları alıyordu; bu yüzden yedekte hesap/sunucu bilgileri çıkmıyordu.
   */
  'kizilkan.playlists.meta.',
  'kizilkan.activePlaylistId.',
];

export interface BackupPayload {
  version: string;
  createdAt: string;
  appName: string;
  data: Record<string, string>;
}

export async function createBackup(): Promise<BackupPayload> {
  const data: Record<string, string> = {};
  for (const key of KIZILKAN_KEYS) {
    const v = await storage.getItem<string>(key, '');
    if (v) data[key] = v;
  }
  // Also collect profile-scoped keys (favorites/recent per profile)
  try {
    const rawProfiles = await storage.getItem<string>('kizilkan.profiles', '');
    if (rawProfiles) {
      const profiles = JSON.parse(rawProfiles);
      if (Array.isArray(profiles)) {
        for (const p of profiles) {
          for (const prefix of PROFILE_PREFIXED) {
            const k = prefix + p.id;
            const v = await storage.getItem<string>(k, '');
            if (v) data[k] = v;
          }
        }
      }
    }
    // Also always include default profile keys
    for (const prefix of PROFILE_PREFIXED) {
      const k = prefix + 'default';
      const v = await storage.getItem<string>(k, '');
      if (v) data[k] = v;
    }
  } catch {}

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    appName: 'KIZILKAN PLAYER',
    data,
  };
}

export async function restoreBackup(payload: BackupPayload): Promise<{ restored: number }> {
  if (!payload?.data || typeof payload.data !== 'object') {
    throw new Error('Geçersiz yedek dosyası');
  }
  let restored = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (typeof value !== 'string') continue;
    if (!key.startsWith('kizilkan.')) continue;
    await storage.setItem(key, value);
    restored++;
  }
  return { restored };
}
