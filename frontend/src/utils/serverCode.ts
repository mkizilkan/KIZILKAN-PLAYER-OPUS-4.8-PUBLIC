/**
 * SUNUCU KODU İLE GİRİŞ — ÇÖZÜCÜ (v9.13.0)
 * ===========================================================================
 * Amaç: DNS adresini unutmuş / DNS'i sık değişen panellerdeki kullanıcılar
 * (özellikle yaşlı kullanıcılar) için kolaylık. Kullanıcı sadece kısa bir
 * "Panel Kodu" + kullanıcı adı + şifre girer; uygulama kodu bir uzak kaynaktan
 * çözer, çalışan DNS'i bulur ve standart Xtream akışına devreder.
 *
 * ÖNEMLİ TASARIM: Kaynak (base URL) KODA SABİT GÖMÜLÜ DEĞİLDİR.
 * Uygulama sahibinin (senin) verdiği bir VARSAYILAN ile gelir ama Ayarlar'dan
 * değiştirilebilir. Böylece belirli bir üçüncü-taraf adresine kilitli değil,
 * uygulamayı yöneten kişinin kontrolündeki kaynağa bakar.
 *
 * Akış:
 *   1) {base}/Master/zeroWebServers/{KOD}.json   -> panel adı (string)
 *   2) {base}/Master/Servers/{panel adı}.json    -> { Hosts: { ad: dns, ... } }
 *   3) Host'lar sırayla xtreamLogin ile denenir; ilk çalışan DNS seçilir.
 * ===========================================================================
 */
import { xtreamLogin } from "@/src/utils/iptv";

/** Uygulama sahibinin verdiği VARSAYILAN kaynak. Ayarlardan değiştirilebilir.
 *  Storage'da değer yoksa bu kullanılır. */
export const DEFAULT_CODE_SOURCE =
  "https://splayer-747601f.asia-southeast1.firebasedatabase.app";

/** Kaynak URL'i storage'da saklamak için anahtar. */
export const CODE_SOURCE_KEY = "kizilkan.codeSource.baseUrl";

function trimBase(u: string): string {
  return String(u || "").trim().replace(/\/+$/, "");
}

async function getJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Kaynağa bağlanılamadı. İnternet veya kaynak adresini kontrol edin.");
  }
  if (!res.ok) throw new Error(`Kaynak yanıtı hatalı (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch {
    throw new Error("Kaynaktan beklenmeyen yanıt geldi.");
  }
}

/** Adım A: Panel kodu -> panel adı. */
export async function resolvePanelName(baseUrl: string, code: string): Promise<string> {
  const base = trimBase(baseUrl);
  if (!base) throw new Error("Kod kaynağı adresi boş.");
  const c = String(code || "").trim();
  if (!c) throw new Error("Panel kodu boş.");
  const data = await getJson(`${base}/Master/zeroWebServers/${encodeURIComponent(c)}.json`);
  // Firebase bulunamayan yolda null döner.
  if (data == null || typeof data !== "string" || !data.trim()) {
    throw new Error("Panel kodu bulunamadı. Kodu kontrol edin.");
  }
  return data.trim();
}

/** Adım B: Panel adı -> DNS host listesi. */
export async function resolveHosts(baseUrl: string, panelName: string): Promise<string[]> {
  const base = trimBase(baseUrl);
  const data = await getJson(`${base}/Master/Servers/${encodeURIComponent(panelName)}.json`);
  const hostsObj = data && typeof data === "object" ? (data as any).Hosts : null;
  if (!hostsObj || typeof hostsObj !== "object") {
    throw new Error("Bu panel için sunucu adresi bulunamadı.");
  }
  const hosts = Object.values(hostsObj)
    .map((v) => trimBase(String(v)))
    .filter(Boolean);
  if (hosts.length === 0) throw new Error("Sunucu adresi listesi boş.");
  // Tekilleştir (aynı DNS birden çok ada bağlı olabilir).
  return Array.from(new Set(hosts));
}

/** Adım C: Host'ları sırayla dener, İLK çalışan (kimlik doğrulayan) DNS'i döner. */
export async function pickWorkingHost(
  hosts: string[],
  username: string,
  password: string
): Promise<{ server: string; login: { user_info: any; server_info: any } }> {
  let lastErr: Error | null = null;
  for (const server of hosts) {
    try {
      const login = await xtreamLogin({ server, username, password });
      return { server, login };
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  // Hepsi denendi, hiçbiri çalışmadı.
  throw lastErr || new Error("Hiçbir sunucu adresi çalışmadı.");
}

/**
 * Tümü bir arada: panel kodu + kullanıcı bilgileri -> çalışan DNS + login.
 * Çözülen DNS, standart Xtream listesi oluşturmak için kullanılır (iptv.ts).
 */
export async function resolveServerCode(
  baseUrl: string,
  code: string,
  username: string,
  password: string
): Promise<{ panelName: string; server: string; login: { user_info: any; server_info: any }; hosts: string[] }> {
  const panelName = await resolvePanelName(baseUrl, code);
  const hosts = await resolveHosts(baseUrl, panelName);
  const { server, login } = await pickWorkingHost(hosts, username, password);
  return { panelName, server, login, hosts };
}
