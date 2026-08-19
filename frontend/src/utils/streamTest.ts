/**
 * KIZILKAN PLAYER — Yayın Testi (Uygulama mı, Sağlayıcı mı?)
 * Dosya  : frontend/src/utils/streamTest.ts
 * Sürüm  : v1.0.0 (v5.4.0)
 *
 * ===========================================================================
 * NEDEN VAR?
 * ===========================================================================
 * Bir kanal açılmadığında en zor soru şu: sorun UYGULAMADA mı, yoksa
 * SAĞLAYICININ sunucusunda mı? Kullanıcı bunu tahmin etmek zorunda kalmasın
 * diye yayın adresine doğrudan bir istek atıp sunucunun ne dediğini
 * raporluyoruz.
 *
 * Yorumlama:
 *   200 / 206  -> Sunucu yayını VERİYOR. Sorun oynatıcı/codec tarafında.
 *   401 / 403  -> Sunucu REDDETTİ. Abonelik, eş zamanlı bağlantı sınırı veya
 *                 User-Agent engeli.
 *   404        -> Kanal sunucuda YOK. Liste eski, yenilemek gerekir.
 *   5xx        -> Sunucu arızalı.
 *   zaman aşımı-> Sunucuya ULAŞILAMIYOR (kapalı, engelli veya ağ sorunu).
 * ===========================================================================
 */

/** IPTV sunucularının çoğunun beklediği varsayılan istemci kimliği. */
export const DEFAULT_USER_AGENT = "VLC/3.0.20 LibVLC/3.0.20";

export interface StreamTestResult {
  ok: boolean;
  status?: number;
  /** Sunucunun döndürdüğü içerik türü (video/mp2t gibi). */
  contentType?: string | null;
  /** Yanıt süresi (ms). */
  ms: number;
  /** Kullanıcıya gösterilecek Türkçe başlık. */
  title: string;
  /** Ayrıntılı açıklama + öneri. */
  detail: string;
  /** Sorun kimde: "sunucu" | "oynatici" | "ag" | "bilinmiyor" */
  blame: "sunucu" | "oynatici" | "ag" | "bilinmiyor";
}

/**
 * Yayın adresini test eder.
 * Videoyu indirmemek için sadece ilk baytları istiyoruz (Range: 0-1).
 */
export async function testStream(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT,
  timeoutMs = 12000,
  extraHeaders: Record<string, string> = {},
): Promise<StreamTestResult> {
  const t0 = Date.now();

  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      ok: false, ms: 0, blame: "bilinmiyor",
      title: "Geçersiz adres",
      detail: "Bu kanalın yayın adresi geçerli bir http/https bağlantısı değil. Listeyi yenilemeyi deneyin.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...extraHeaders,
        "User-Agent": extraHeaders["User-Agent"] || userAgent,
        // Sadece ilk baytlar — tüm yayını indirmeyelim.
        Range: "bytes=0-1",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const status = res.status;
    const contentType = res.headers.get("content-type");

    if (status === 200 || status === 206) {
      return {
        ok: true, status, contentType, ms, blame: "oynatici",
        title: "Sunucu yayını veriyor",
        detail:
          `Sunucu yanıt verdi (HTTP ${status}, ${ms} ms).\n` +
          (contentType ? `İçerik türü: ${contentType}\n` : "") +
          "\nYani sağlayıcı tarafı ÇALIŞIYOR. Açılmıyorsa sorun oynatma tarafında olabilir:\n" +
          "• Player > Motor > VLC deneyin\n" +
          "• Player > Motor > Donanım hızlandırmayı kapatın\n" +
          "• Player > Tampon > 4 saniye yapın",
      };
    }

    if (status === 401 || status === 403) {
      return {
        ok: false, status, contentType, ms, blame: "sunucu",
        title: "Sunucu erişimi reddetti",
        detail:
          `Sunucu ${status} döndürdü.\n\nEn olası sebepler:\n` +
          "• Eş zamanlı bağlantı sınırınız dolu (başka cihazda açık oturumu kapatın)\n" +
          "• Aboneliğiniz bu kanalı kapsamıyor\n" +
          "• Sağlayıcı bu bağlantıyı veya istemci başlıklarını reddediyor\n\n" +
          "Player V2 aynı kanal başlıklarıyla test yaptı. Başka bir oynatıcı açıyorsa User-Agent/Referer/redirect farkı ayrıca incelenmelidir.",
      };
    }

    if (status === 404) {
      return {
        ok: false, status, contentType, ms, blame: "sunucu",
        title: "Kanal sunucuda bulunamadı",
        detail:
          "Sunucu 404 döndürdü — bu kanal artık sunucuda yok.\n\n" +
          "Listeniz eskimiş olabilir. Ana ekrandaki yenile düğmesiyle listeyi güncelleyin.",
      };
    }

    if (status >= 500) {
      return {
        ok: false, status, contentType, ms, blame: "sunucu",
        title: "Sunucu arızalı",
        detail: `Sunucu ${status} döndürdü. Sağlayıcının sunucusunda geçici bir sorun var. Bir süre sonra tekrar deneyin.`,
      };
    }

    return {
      ok: false, status, contentType, ms, blame: "bilinmiyor",
      title: `Beklenmeyen yanıt (${status})`,
      detail: `Sunucu ${status} döndürdü. Başka bir kanal deneyin; sorun sürerse listeyi yenileyin.`,
    };
  } catch (e: any) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const aborted = e?.name === "AbortError";
    return {
      ok: false, ms, blame: "ag",
      title: aborted ? "Sunucu yanıt vermedi" : "Bağlantı kurulamadı",
      detail:
        (aborted
          ? `Sunucu ${Math.round(timeoutMs / 1000)} saniyede yanıt vermedi.\n\n`
          : `Bağlantı hatası: ${String(e?.message || e)}\n\n`) +
        "Olası sebepler:\n" +
        "• Sağlayıcının sunucusu kapalı veya aşırı yüklü\n" +
        "• İnternetinizde sorun var\n" +
        "• VPN/DNS engeli\n\n" +
        "Ayarlar > Bağlantıyı Test Et ile internetinizi kontrol edebilirsiniz.",
    };
  }
}
