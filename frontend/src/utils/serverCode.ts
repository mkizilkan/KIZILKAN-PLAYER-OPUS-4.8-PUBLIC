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

/* =========================================================================
 * v10.4.0 — PANEL REHBERİ ve OTOMATİK PANEL BULMA
 * Amaç: panel kodunu/adını bilmeyen (özellikle yaşlı) kullanıcılar.
 * ========================================================================= */

export interface PanelEntry {
  /** Sunucu kodu (zeroWebServers anahtarı). */
  code: string;
  /** Panel adı (zeroWebServers değeri). */
  name: string;
}

/**
 * REHBER: tüm "kod -> panel adı" haritasını TEK istekte çeker.
 * Sunucu kodu ekranında "Panel Listesi" olarak gösterilir; kullanıcı kod
 * yazmak yerine panel ADINA dokunur, kod otomatik dolar.
 */
export async function listPanels(baseUrl: string): Promise<PanelEntry[]> {
  const base = trimBase(baseUrl);
  if (!base) throw new Error("Kod kaynağı adresi boş.");
  const data = await getJson(`${base}/Master/zeroWebServers.json`);
  if (!data || typeof data !== "object") {
    throw new Error("Panel listesi alınamadı.");
  }
  const out: PanelEntry[] = [];
  for (const [code, name] of Object.entries(data as Record<string, unknown>)) {
    if (typeof name === "string" && name.trim()) {
      out.push({ code: String(code), name: name.trim() });
    }
  }
  // Panel adına göre alfabetik (Türkçe duyarlı).
  out.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return out;
}

export interface FindPanelProgress {
  /** Şu ana kadar denenen panel sayısı. */
  tried: number;
  /** Bu turda denenecek toplam panel sayısı. */
  total: number;
  /** Şu an denenen panelin adı. */
  current: string;
}

export interface FindPanelOptions {
  /** Bu turda en fazla kaç panel denensin. 0 => sınırsız (tümü). */
  limit?: number;
  /** Baştan kaç panel atlansın (“aramaya devam et” için). */
  offset?: number;
  /** Aynı anda kaç panel denensin (sunucuları yormadan hız). */
  concurrency?: number;
  /** Önce denenecek panel adları (son kullanılanlar). */
  preferNames?: string[];
  /** İlerleme bildirimi (UI: “38/40 panel denendi…”). */
  onProgress?: (p: FindPanelProgress) => void;
  /** true dönerse arama durur (kullanıcı “Durdur” dedi). */
  shouldStop?: () => boolean;
}

export interface FindPanelMatch {
  panelName: string;
  code: string;
  server: string;
  login: { user_info: any; server_info: any };
}

export interface FindPanelResult {
  /**
   * TÜM eşleşmeler. v10.5.2: ARTIK İLK EŞLEŞMEDE DURULMUYOR.
   * Neden: "ali/12345" gibi yaygın bilgiler BİRDEN FAZLA panelde geçerli
   * olabiliyor. İlk eşleşmeyi doğru kabul etmek, kullanıcıya YABANCI bir
   * sağlayıcının listesini yükletir (ve başkasının hesabına giriş anlamına
   * gelir). Bu yüzden tur tamamlanır, tüm adaylar toplanır ve birden fazlaysa
   * seçimi KULLANICI yapar (bitiş tarihi vb. ayırt edici bilgilerle).
   */
  matches: FindPanelMatch[];
  /** Bu turda denenen panel sayısı (devam etmek için offset olarak kullanılır). */
  triedCount: number;
  /** Rehberdeki toplam panel sayısı. */
  totalCount: number;
}

/**
 * OTOMATİK PANEL BULMA
 * Kullanıcı adı + şifre ile hangi panel(ler)e ait olduğunu bulur.
 *
 * GÜVENLİK KURALLARI (bilerek sıkı):
 *  - Her panele YALNIZCA BİR kez denenir (fail2ban/IP engeli riskini önler).
 *  - Panel başına yalnızca İLK host denenir (aynı panele çoklu deneme yok).
 *  - Tur tamamlanır; TÜM eşleşmeler döner (yanlış panel seçimini önlemek için).
 *  - Kullanıcıya çağrı öncesi açık onay gösterilmelidir (şifre üçüncü taraf
 *    sunuculara gönderilir) — bu fonksiyon onayı VARSAYAR, UI sorar.
 */
export async function findPanelByCredentials(
  baseUrl: string,
  username: string,
  password: string,
  opts: FindPanelOptions = {}
): Promise<FindPanelResult> {
  const base = trimBase(baseUrl);
  const all = await listPanels(base);

  // Son kullanılanları öne al (isimce eşleşenler).
  const prefer = new Set((opts.preferNames || []).map((n) => n.trim().toLowerCase()));
  const ordered = prefer.size
    ? [...all].sort((a, b) => {
        const pa = prefer.has(a.name.toLowerCase()) ? 0 : 1;
        const pb = prefer.has(b.name.toLowerCase()) ? 0 : 1;
        return pa - pb;
      })
    : all;

  const offset = Math.max(0, opts.offset || 0);
  const limit = opts.limit && opts.limit > 0 ? opts.limit : ordered.length;
  const slice = ordered.slice(offset, offset + limit);
  const concurrency = Math.min(Math.max(1, opts.concurrency || 6), 8);

  let tried = 0;
  const matches: FindPanelMatch[] = [];
  let cursor = 0;

  const worker = async () => {
    while (true) {
      if (opts.shouldStop && opts.shouldStop()) return;
      const i = cursor++;
      if (i >= slice.length) return;
      const entry = slice[i];
      try {
        const hosts = await resolveHosts(base, entry.name);
        // KURAL: panel başına tek deneme -> yalnızca ilk host.
        const server = hosts[0];
        if (server) {
          const login = await xtreamLogin({ server, username, password });
          matches.push({ panelName: entry.name, code: entry.code, server, login });
        }
      } catch {
        // Bu panel değil (kimlik doğrulamadı / host yok / erişilemedi) — devam.
      } finally {
        tried++;
        opts.onProgress?.({ tried, total: slice.length, current: entry.name });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { matches, triedCount: offset + tried, totalCount: ordered.length };
}

/**
 * Hesap özeti — çoklu eşleşmede kullanıcının KENDİ paketini ayırt etmesi için.
 * xtreamLogin yanıtındaki user_info'dan gelir; ek istek gerektirmez.
 */
export function describeAccount(userInfo: any): string {
  if (!userInfo || typeof userInfo !== "object") return "";
  const parts: string[] = [];
  const exp = userInfo.exp_date;
  if (exp) {
    const n = Number(exp);
    if (!Number.isNaN(n) && n > 0) {
      try {
        parts.push(`Bitiş: ${new Date(n * 1000).toLocaleDateString("tr")}`);
      } catch { /* tarih okunamazsa atla */ }
    }
  } else if (userInfo.is_trial === "1") {
    parts.push("Deneme hesabı");
  }
  if (userInfo.max_connections) parts.push(`${userInfo.max_connections} bağlantı`);
  if (userInfo.status) parts.push(String(userInfo.status));
  return parts.join(" · ");
}

/**
 * AKILLI YAPIŞTIRMA — sağlayıcıdan gelen tam adresten bilgileri ayıklar.
 * Örn: http://dns.com:8080/get.php?username=ali&password=123&type=m3u_plus
 * veya .../player_api.php?username=...&password=...
 * Yaşlı kullanıcı hiçbir alanı elle doldurmaz; adresi yapıştırır.
 */
export function parseXtreamUrl(
  raw: string
): { server: string; username: string; password: string } | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(https?:\/\/[^/\s]+)/i);
  if (!m) return null;
  const server = trimBase(m[1]);
  const user = s.match(/[?&]username=([^&\s]+)/i);
  const pass = s.match(/[?&]password=([^&\s]+)/i);
  if (!user || !pass) return null;
  try {
    return {
      server,
      username: decodeURIComponent(user[1]),
      password: decodeURIComponent(pass[1]),
    };
  } catch {
    return { server, username: user[1], password: pass[1] };
  }
}

/**
 * v10.5.2 — DNS OTOMATİK GÜNCELLEME
 * Kayıtlı listedeki panel kodundan GÜNCEL çalışan DNS'i yeniden çözer.
 *
 * NEDEN: Sunucu koduyla eklenen liste, çözülmüş DNS'i SABİT kaydediyordu.
 * Panelin DNS'i değişince liste ölüyor, kullanıcı listeyi silip yeniden
 * eklemek zorunda kalıyordu ("kod aynı kalır" vaadi işlemiyordu). Artık kod
 * listeyle birlikte saklanıyor; yenilemede ve bağlantı hatasında bu fonksiyon
 * güncel DNS'i bulup listeyi kendiliğinden günceller.
 *
 * @returns çalışan DNS ve login; hiçbiri çalışmazsa hata fırlatır.
 */
export async function reresolveServerFromCode(
  baseUrl: string,
  code: string,
  username: string,
  password: string
): Promise<{ server: string; login: { user_info: any; server_info: any } }> {
  const base = trimBase(baseUrl) || DEFAULT_CODE_SOURCE;
  const panelName = await resolvePanelName(base, code);
  const hosts = await resolveHosts(base, panelName);
  return await pickWorkingHost(hosts, username, password);
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
