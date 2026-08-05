/**
 * KIZILKAN PLAYER — Program Hatırlatıcıları (cihaz içi)
 * Sürüm: v1.0.0 (v9.8.0)
 */
import { storage } from "./storage";

export interface Reminder {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  startTs: number; // unix sec
  createdAt: number;
}

const KEY = "kizilkan.reminders";

export async function listReminders(): Promise<Reminder[]> {
  const raw = await storage.getItem<string>(KEY, "[]");
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function addReminder(r: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
  const list = await listReminders();
  const item: Reminder = {
    ...r,
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  // aynı kanal+başlangıç varsa güncelle
  const next = list.filter(
    (x) => !(x.channelId === r.channelId && x.startTs === r.startTs)
  );
  next.push(item);
  next.sort((a, b) => a.startTs - b.startTs);
  await storage.setItem(KEY, JSON.stringify(next));
  return item;
}

export async function removeReminder(id: string): Promise<void> {
  const list = await listReminders();
  await storage.setItem(KEY, JSON.stringify(list.filter((x) => x.id !== id)));
}

/** Süresi geçmişleri temizle */
export async function pruneReminders(): Promise<void> {
  const now = Math.floor(Date.now() / 1000) - 3600;
  const list = await listReminders();
  await storage.setItem(KEY, JSON.stringify(list.filter((x) => x.startTs > now)));
}
