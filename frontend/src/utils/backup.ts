import { storage } from '@/src/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Backup & Restore utilities.
 *
 * v10.8.0 — GERÇEK TAM YEDEK (kritik düzeltme)
 * ---------------------------------------------------------------------------
 * ESKİ HATA: bu dosya "her kizilkan.* anahtarını yedekler" diye yazıyordu ama
 * aslında SABİT BİR LİSTE kullanıyordu. Liste verileri ise profil bazlı ve
 * dinamik anahtarlarda tutulduğu için (kizilkan.playlists.meta.{profilId})
 * yedeğe HİÇ girmiyordu; kullanıcı yedeği geri yükleyince listeler gelmiyordu.
 * v10.6.0'da anahtar adları elle eklenmişti, yine yetmedi — çünkü anahtar adını
 * TAHMİN etmek kırılgan.
 *
 * YENİ: AsyncStorage'daki TÜM anahtarlar taranır ve "kizilkan." ile başlayan
 * her şey yedeklenir. Böylece bugünkü ve gelecekteki tüm anahtarlar (tüm
 * profillerin listeleri, favorileri, ayarları) otomatik dahil olur.
 */

/** Yedeğe ALINMAYACAK anahtarlar (geçici/önbellek — taşınması anlamsız). */
const EXCLUDE_PATTERNS = [
  'kizilkan.cache.',
  'kizilkan.epgCache',
  'kizilkan.tmp.',
];

function isBackupKey(k: string): boolean {
  if (!k || !k.startsWith('kizilkan.')) return false;
  return !EXCLUDE_PATTERNS.some((p) => k.startsWith(p));
}

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

  /**
   * 1) ASIL YOL — AsyncStorage'daki TÜM anahtarları tara.
   * Ham (raw) değerleri alıyoruz: storage.getItem JSON.parse ettiği için
   * ham değeri okumak, geri yüklemede birebir aynı biçimde yazmayı sağlar.
   */
  let scanned = 0;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const wanted = (allKeys || []).filter(isBackupKey);
    if (wanted.length > 0) {
      const pairs = await AsyncStorage.multiGet(wanted);
      for (const [k, v] of pairs) {
        if (typeof v === 'string' && v.length > 0) {
          data[k] = v;      // HAM değer (JSON-encoded)
          scanned++;
        }
      }
    }
  } catch {
    /* tarama başarısızsa aşağıdaki yedek yol devreye girer */
  }

  /**
   * 2) YEDEK YOL — tarama çalışmadıysa (ör. web/sınırlı ortam) bilinen
   * anahtarları tek tek dene. Buradaki değerler storage üzerinden okunduğu
   * için ÇÖZÜLMÜŞ (parse edilmiş) haldedir; restore tarafı iki biçimi de
   * kabul eder.
   */
  if (scanned === 0) {
    for (const key of KIZILKAN_KEYS) {
      const v = await storage.getItem<string>(key, '');
      if (v) data[key] = v;
    }
    try {
      const rawProfiles = await storage.getItem<string>('kizilkan.profiles', '');
      const ids: string[] = ['default'];
      if (rawProfiles) {
        const profiles = JSON.parse(rawProfiles);
        if (Array.isArray(profiles)) profiles.forEach((p: any) => p?.id && ids.push(String(p.id)));
      }
      for (const id of ids) {
        for (const prefix of PROFILE_PREFIXED) {
          const k = prefix + id;
          const v = await storage.getItem<string>(k, '');
          if (v) data[k] = v;
        }
      }
    } catch {}
  }

  return {
    version: '2.0',   // v10.8.0: tam tarama biçimi
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
    if (!isBackupKey(key)) continue;
    /**
     * v10.8.0 — İKİ BİÇİM DESTEĞİ.
     *  • YENİ yedekler (v2.0): değerler HAM (JSON-encoded) — doğrudan
     *    AsyncStorage'a yazılmalı, aksi halde çift kodlanır ve okunamaz.
     *  • ESKİ yedekler (v1.0): değerler storage üzerinden okunmuş (çözülmüş) —
     *    storage.setItem ile yazılmalı.
     * Ayrım: yeni biçim geçerli JSON'dur; eski biçim genelde düz metindir.
     * Hangi biçim olursa olsun sonuçta AsyncStorage'da AYNI hale gelmeli.
     */
    let ok = false;
    if (payload.version === '2.0') {
      try {
        await AsyncStorage.setItem(key, value);   // ham -> birebir geri yaz
        ok = true;
      } catch { ok = false; }
    }
    if (!ok) {
      ok = await storage.setItem(key, value);     // eski biçim / yedek yol
    }
    if (ok) restored++;
  }
  return { restored };
}
