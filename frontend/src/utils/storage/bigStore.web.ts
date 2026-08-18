/**
 * KIZILKAN PLAYER — Büyük Veri Deposu (Web)
 * Dosya   : frontend/src/utils/storage/bigStore.web.ts
 * Sürüm   : v1.0.0
 * Faz     : FAZ A.4 / Bölüm 0
 *
 * Web'de dosya sistemi yoktur. AsyncStorage'ın web shim'i IndexedDB kullanır
 * ve native'deki ~2MB satır limiti YOKTUR — bu yüzden web'de doğrudan
 * AsyncStorage'a yazmak güvenlidir. Yine de ÇİFT KODLAMAYI önlemek için tek
 * seferde JSON.stringify uygularız (native bigStore da tek kez yazıyor).
 *
 * Anahtar biçimi: kizilkan.big.<id>
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BigStore } from "./bigStore.types";

const PREFIX = "kizilkan.big.";
const keyFor = (id: string) => PREFIX + String(id);

export const bigStore: BigStore = {
  async write(id: string, data: unknown): Promise<boolean> {
    try {
      await AsyncStorage.setItem(keyFor(id), JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("[bigStore.web.write] başarısız:", id, e);
      return false;
    }
  },

  async read<T>(id: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(id));
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn("[bigStore.web.read] başarısız:", id, e);
      return fallback;
    }
  },

  async remove(id: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(keyFor(id));
      return true;
    } catch (e) {
      console.warn("[bigStore.web.remove] başarısız:", id, e);
      return false;
    }
  },

  async exists(id: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(id));
      return raw != null;
    } catch {
      return false;
    }
  },

  /** v12.0.0: tür bazlı yazma (web: ayrı anahtar). */
  async writeKind(id: string, kind: string, data: unknown): Promise<boolean> {
    try {
      await AsyncStorage.setItem(keyFor(id) + "." + kind, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("[bigStore.web.writeKind] başarısız:", id, kind, e);
      return false;
    }
  },

  /** v12.0.0: tür bazlı okuma; yoksa eski tek-anahtar biçiminden alır. */
  async readKind<T>(id: string, kind: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(id) + "." + kind);
      if (raw != null) return JSON.parse(raw) as T;
      const legacy = await AsyncStorage.getItem(keyFor(id));
      if (legacy == null) return fallback;
      const parsed = JSON.parse(legacy) as any;
      const value = (parsed?.[kind] ?? fallback) as T;
      try { await AsyncStorage.setItem(keyFor(id) + "." + kind, JSON.stringify(value)); } catch {}
      return value;
    } catch (e) {
      console.warn("[bigStore.web.readKind] başarısız:", id, kind, e);
      return fallback;
    }
  },
};
