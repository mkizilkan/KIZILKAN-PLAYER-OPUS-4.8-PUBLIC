/**
 * KIZILKAN PLAYER — Kullanıcı Özelleştirmeleri (İsim / Simge / Grup)
 * Dosya  : frontend/src/utils/overrides.ts
 * Sürüm  : v1.0.0 (v5.0.0)
 *
 * ===========================================================================
 * NE İŞE YARIYOR?
 * ===========================================================================
 * IPTV Extreme Pro'daki "İsimleri Yönet", "Kanal Simgesi Değiştir" ve
 * "Add / Remove Group" özelliklerinin karşılığı.
 *
 * Kullanıcının yaptığı değişiklikler LİSTEYİ BOZMADAN ayrı saklanır. Liste
 * yenilendiğinde (sağlayıcıdan tekrar çekildiğinde) özelleştirmeler KAYBOLMAZ,
 * çünkü kanalın kalıcı ID'sine bağlıdırlar.
 *
 * Yapı:  kizilkan.overrides.<playlistId> = {
 *          "<itemId>": { name?: string, logo?: string, groups?: string[] }
 *        }
 * ===========================================================================
 */

import { storage } from "./storage";

export interface ItemOverride {
  /** Kullanıcının verdiği isim (orijinalin yerine gösterilir). */
  name?: string;
  /** Kullanıcının verdiği logo/afiş adresi. */
  logo?: string;
  /** Kullanıcının eklediği özel gruplar. */
  groups?: string[];
}

export type OverrideMap = Record<string, ItemOverride>;

const KEY_PREFIX = "kizilkan.overrides.";

/** Değişiklikleri dinleyenler (ekranların anında güncellenmesi için). */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOverrides(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { listeners.forEach(fn => { try { fn(); } catch {} }); }

/** Bir listenin tüm özelleştirmelerini okur. */
export async function loadOverrides(playlistId: string): Promise<OverrideMap> {
  if (!playlistId) return {};
  try {
    const raw = await storage.getItem<string>(KEY_PREFIX + playlistId, "");
    if (!raw) return {};
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Tek bir öğenin özelleştirmesini günceller (birleştirerek). */
export async function setOverride(
  playlistId: string,
  itemId: string,
  patch: ItemOverride
): Promise<OverrideMap> {
  const map = await loadOverrides(playlistId);
  const current = map[itemId] || {};
  const next: ItemOverride = { ...current, ...patch };

  // Boş alanları temizle (gereksiz veri tutma).
  if (!next.name) delete next.name;
  if (!next.logo) delete next.logo;
  if (next.groups && next.groups.length === 0) delete next.groups;

  if (Object.keys(next).length === 0) delete map[itemId];
  else map[itemId] = next;

  await storage.setItem(KEY_PREFIX + playlistId, JSON.stringify(map));
  notify();
  return map;
}

/** Bir öğeyi özel gruba ekler/çıkarır. */
export async function toggleGroup(
  playlistId: string,
  itemId: string,
  group: string
): Promise<OverrideMap> {
  const map = await loadOverrides(playlistId);
  const current = map[itemId] || {};
  const groups = new Set(current.groups || []);
  if (groups.has(group)) groups.delete(group);
  else groups.add(group);
  return setOverride(playlistId, itemId, { groups: Array.from(groups) });
}

/** Bir öğenin tüm özelleştirmelerini siler. */
export async function clearOverride(playlistId: string, itemId: string): Promise<void> {
  const map = await loadOverrides(playlistId);
  delete map[itemId];
  await storage.setItem(KEY_PREFIX + playlistId, JSON.stringify(map));
  notify();
}

/** Listedeki tüm özel grup adlarını toplar (kategori listesine eklemek için). */
export function collectCustomGroups(map: OverrideMap): string[] {
  const set = new Set<string>();
  Object.values(map).forEach(o => (o.groups || []).forEach(g => set.add(g)));
  return Array.from(set).sort();
}

/**
 * Bir öğeye özelleştirmeleri uygular (isim/logo).
 * Orijinal nesneyi DEĞİŞTİRMEZ, kopyasını döndürür.
 */
export function applyOverride<T extends { id: string; name?: string; logo?: string; poster?: string | null }>(
  item: T,
  map: OverrideMap
): T {
  const o = map[item.id];
  if (!o) return item;
  const out: any = { ...item };
  if (o.name) out.name = o.name;
  if (o.logo) {
    out.logo = o.logo;
    if ("poster" in out) out.poster = o.logo;
  }
  return out as T;
}
