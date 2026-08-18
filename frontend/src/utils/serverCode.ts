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
  /** v11.7.0 — CANLI İSTATİSTİK */
  currentServer?: string;   // o an test edilen DNS
  dnsTried?: number;        // denenen toplam DNS sayısı
  found?: number;           // şu ana kadar bulunan hesap sayısı
}

export interface FindPanelOptions {
  /** Bu turda en fazla kaç panel denensin. 0 => sınırsız (tümü). */
  limit?: number;
  /** Baştan kaç panel atlansın (“aramaya devam et” için). */
  offset?: number;
  /**
   * Aynı anda kaç panel denensin. v11.7.0: ÜST SINIR 50 (eskiden 8'e kırpılıyordu).
   * Yüksek değer taramayı hızlandırır ama zayıf cihaz/ağda yığılma yapabilir.
   */
  concurrency?: number;
  /** v11.7.0: her giriş denemesi için zaman aşımı (ms). Tarama için kısa tutulur. */
  timeoutMs?: number;
  /** Önce denenecek panel adları (son kullanılanlar). */
  preferNames?: string[];
  /** İlerleme bildirimi (UI: “38/40 panel denendi…”). */
  onProgress?: (p: FindPanelProgress) => void;
  /**
   * v11.1.0 — CANLI SONUÇ.
   * Bir panel eşleşir eşleşmez çağrılır; UI bulunanları arama BİTMEDEN
   * alt alta gösterebilir (kullanıcı sonuna kadar beklemez).
   */
  onMatch?: (m: FindPanelMatch) => void;
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
  matches: FindPanelMatch[];
  /** Bu turda denenen panel sayısı (devam etmek için offset olarak kullanılır). */
  triedCount: number;
  /** Rehberdeki toplam panel sayısı. */
  totalCount: number;
  /**
   * v11.1.0 — TEŞHİS SAYAÇLARI.
   * "Bulunamadı" ile "ulaşılamadı" birbirinden ayrılır; aksi halde ağ/sunucu
   * sorunu yüzünden atlanan paneller "hesap yok" sanılıyordu.
   */
  authFailed: number;      // sunucu yanıt verdi, kimlik doğrulamadı
  unreachable: number;     // sunucuya hiç ulaşılamadı (DNS/zaman aşımı)
}

/**
 * OTOMATİK PANEL BULMA
 *
 * GÜVENLİK KURALLARI:
 *  - Her SUNUCUYA yalnızca bir kez denenir (fail2ban/IP engeli riskini önler).
 *    v11.1.0: Bir panelin BİRDEN FAZLA host'u varsa hepsi denenir — bunlar
 *    ayrı sunuculardır, dolayısıyla "sunucu başına tek deneme" kuralı bozulmaz.
 *    Eskiden yalnız ilk host deneniyordu; o adres ölüyse panel KAÇIRILIYORDU.
 *  - Tur tamamlanır; TÜM eşleşmeler döner.
 *  - Kullanıcıya çağrı öncesi açık onay gösterilmelidir.
 */
export async function findPanelByCredentials(
  baseUrl: string,
  username: string,
  password: string,
  opts: FindPanelOptions = {}
): Promise<FindPanelResult> {
  const base = trimBase(baseUrl);
  const all = await listPanels(base);

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
  const concurrency = Math.min(Math.max(1, opts.concurrency || 10), 50);   // v11.7.0: 50'ye kadar
  const timeoutMs = Math.min(Math.max(2000, opts.timeoutMs || 7000), 30000);

  let tried = 0;
  let authFailed = 0;
  let unreachable = 0;
  const matches: FindPanelMatch[] = [];
  /**
   * v11.7.0 — ÖNBELLEK KALDIRILDI (kullanıcı kararı).
   * Aynı DNS birden çok panelde listelense bile HER PANEL için bağımsız
   * denenir; sonuç paylaşılmaz. Böylece hiçbir panel/DNS eşleşmesi kaçmaz.
   */
  let dnsTried = 0;
  let cursor = 0;

  const tryServer = async (server: string) => {
    dnsTried++;
    try {
      const login = await xtreamLogin({ server, username, password }, timeoutMs);
      return { ok: true as const, login };
    } catch (e: any) {
      const msg = String(e?.message || "");
      const isAuth = msg.includes("hatalı") || msg.includes("Geçersiz kimlik");
      return { ok: false as const, auth: isAuth };
    }
  };

  const worker = async () => {
    while (true) {
      if (opts.shouldStop && opts.shouldStop()) return;
      const i = cursor++;
      if (i >= slice.length) return;
      const entry = slice[i];
      let matchedHere = false;
      let sawAuthFail = false;
      let sawUnreachable = false;
      try {
        const hosts = await resolveHosts(base, entry.name);
        /**
         * v11.2.0: Panelin TÜM DNS adresleri denenir (ilk çalışanda DURULMAZ).
         * Böylece çalışan her adres ayrı ayrı bulunur; kullanıcı hangi adresin
         * çalıştığını görebilir ve seçebilir (bir adres yavaş/ölü olabilir).
         */
        for (const server of hosts) {
          if (opts.shouldStop && opts.shouldStop()) break;
          if (!server) continue;
          opts.onProgress?.({
            tried, total: slice.length, current: entry.name,
            currentServer: server, dnsTried, found: matches.length,
          });
          const r = await tryServer(server);
          if (r.ok) {
            const m: FindPanelMatch = { panelName: entry.name, code: entry.code, server, login: r.login };
            matches.push(m);
            try { opts.onMatch?.(m); } catch {}
            matchedHere = true;
          } else if (r.auth) sawAuthFail = true;
          else sawUnreachable = true;
        }
      } catch {
        sawUnreachable = true;   // panel adı/host listesi çözülemedi
      } finally {
        if (!matchedHere) {
          if (sawAuthFail) authFailed++;
          else if (sawUnreachable) unreachable++;
        }
        tried++;
        opts.onProgress?.({
          tried, total: slice.length, current: entry.name,
          dnsTried, found: matches.length,
        });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { matches, triedCount: offset + tried, totalCount: ordered.length, authFailed, unreachable };
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
 * v12.1.0 — ABONELİK PARMAK İZİ
 * Aynı hesabın farklı DNS adreslerini (takma ad) gerçekten farklı
 * aboneliklerden ayırmak için kullanılır. Yalnız adres farklı diye 4 kopya
 * liste üretmemek için: parmak izi aynıysa TEK abonelik sayılır.
 * Kullanılan alanlar hesabı tanımlar, sunucu adını DEĞİL.
 */
export function accountFingerprint(login: { user_info?: any; server_info?: any } | null): string {
  const u = login?.user_info || {};
  const parts = [
    String(u.username ?? ""),
    String(u.exp_date ?? ""),
    String(u.max_connections ?? ""),
    String(u.created_at ?? ""),
    String(u.is_trial ?? ""),
  ];
  return parts.join("|");
}

export interface ValidatedHost {
  server: string;
  login: { user_info: any; server_info: any };
  fingerprint: string;
}

/**
 * v12.1.0 — PANELİN TÜM DNS ADRESLERİNİ DOĞRULA
 * "Kodum var" / "Paneli biliyorum" akışında da tüm adresler denenir; ilk
 * çalışanda DURULMAZ. Böylece:
 *   • kullanıcıya kaç geçerli adres olduğu gösterilebilir,
 *   • doğrulanmış adresler listeye kaydedilip DNS ölünce sırayla denenebilir.
 */
export async function validateAllHosts(
  baseUrl: string,
  code: string,
  username: string,
  password: string,
  opts: { onProgress?: (done: number, total: number, server: string) => void } = {}
): Promise<{ panelName: string; hosts: ValidatedHost[]; triedCount: number }> {
  const base = trimBase(baseUrl) || DEFAULT_CODE_SOURCE;
  const panelName = await resolvePanelName(base, code);
  const all = await resolveHosts(base, panelName);
  const hosts: ValidatedHost[] = [];
  let done = 0;
  for (const server of all) {
    opts.onProgress?.(done, all.length, server);
    try {
      const login = await xtreamLogin({ server, username, password }, 10000);
      hosts.push({ server, login, fingerprint: accountFingerprint(login) });
    } catch { /* bu adres çalışmadı */ }
    done++;
    opts.onProgress?.(done, all.length, server);
  }
  return { panelName, hosts, triedCount: all.length };
}

/**
 * v12.1.0 — DNS ÖLÜNCE KENDİNİ ONARMA (self-healing), doğru sırayla.
 * 1) Daha önce DOĞRULANMIŞ adresler (validatedHosts) — hızlı ve kesin.
 * 2) Olmazsa Firebase'den panel kodu yeniden çözülür (adres değişmiş olabilir).
 */
export async function healServer(
  pl: { panelCode?: string; codeSource?: string; validatedHosts?: string[]; preferredServer?: string; xtreamServer?: string },
  username: string,
  password: string
): Promise<{ server: string; login: { user_info: any; server_info: any } }> {
  const tried = new Set<string>();
  const candidates = [
    ...(pl.validatedHosts || []),
    pl.preferredServer || "",
    pl.xtreamServer || "",
  ].filter((h) => h && !tried.has(h) && (tried.add(h), true));

  for (const server of candidates) {
    try {
      const login = await xtreamLogin({ server, username, password }, 10000);
      return { server, login };
    } catch { /* sıradaki */ }
  }
  if (!pl.panelCode) throw new Error("Sunucuya ulaşılamadı ve panel kodu kayıtlı değil.");
  return await reresolveServerFromCode(pl.codeSource || DEFAULT_CODE_SOURCE, pl.panelCode, username, password);
}

/**
 * v12.1.0 — DNS OTOMATİK GÜNCELLEME
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
