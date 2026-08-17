/**
 * KIZILKAN PLAYER — Liste Yenileme
 * Dosya  : frontend/src/utils/refreshPlaylist.ts
 * Sürüm  : v1.0.0 (v4.9.0)
 *
 * Bir listenin içeriğini kaynağından yeniden çeker (kanallar, filmler, diziler).
 * TAMAMEN CİHAZ-İÇİ — backend kullanmaz. Xtream'de üç istek paralel gider.
 *
 * v9.6.0: Stalker/MAC de artık cihaz-içi yenileniyor (src/utils/stalker.ts).
 */

import {
  fetchAndParseM3U,
  xtreamLogin,
  xtreamLiveStreams,
  xtreamVod,
  xtreamSeries,
} from "./iptv";
import type { Playlist } from "@/src/types";
// v10.5.2: DNS değişirse panel kodundan güncel adresi çözmek için.
import { reresolveServerFromCode, DEFAULT_CODE_SOURCE } from "./serverCode";

export interface RefreshResult {
  ok: boolean;
  /** updatePlaylist'e verilecek alanlar. */
  patch?: Partial<Playlist>;
  /** Kullanıcıya gösterilecek özet. */
  message: string;
}

export async function refreshPlaylistContent(pl: Playlist): Promise<RefreshResult> {
  try {
    if (pl.source === "xtream") {
      if (!pl.xtreamServer || !pl.xtreamUsername || !pl.xtreamPassword) {
        return { ok: false, message: "Xtream bilgileri eksik." };
      }
      const cred = {
        server: pl.xtreamServer,
        username: pl.xtreamUsername,
        password: pl.xtreamPassword,
      };

      /**
       * v10.5.2 — DNS OTOMATİK GÜNCELLEME
       * Kayıtlı DNS ölmüş olabilir (panel adres değiştirdi). Liste "Sunucu
       * Kodu" ile eklendiyse (panelCode var) kodu yeniden çözüp GÜNCEL DNS'i
       * buluruz; kullanıcı hiçbir şey yapmaz, liste kendiliğinden düzelir.
       * Kod yoksa davranış eskisi gibi (hata döner).
       */
      let login: Awaited<ReturnType<typeof xtreamLogin>>;
      let serverPatch: Partial<Playlist> = {};
      try {
        login = await xtreamLogin(cred);
      } catch (loginErr) {
        if (!pl.panelCode) throw loginErr;
        // Kod var: güncel DNS'i çöz ve yeni adresle devam et.
        const fresh = await reresolveServerFromCode(
          pl.codeSource || DEFAULT_CODE_SOURCE,
          pl.panelCode,
          pl.xtreamUsername,
          pl.xtreamPassword
        );
        cred.server = fresh.server;
        login = fresh.login;
        // Yeni DNS listeye KALICI yazılsın.
        serverPatch = { xtreamServer: fresh.server };
      }

      // Üçü PARALEL (hız). Biri yoksa diğerleri yine yüklenir.
      const [chRes, vodRes, serRes] = await Promise.allSettled([
        xtreamLiveStreams(cred),
        xtreamVod(cred),
        xtreamSeries(cred),
      ]);
      const channels = chRes.status === "fulfilled" ? chRes.value : [];
      const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
      const series = serRes.status === "fulfilled" ? serRes.value : [];

      if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
        return { ok: false, message: "Sunucuya ulaşılamadı veya içerik alınamadı." };
      }

      return {
        ok: true,
        patch: {
          ...serverPatch,   // v10.5.2: DNS değiştiyse yeni adres de kaydedilir
          channels,
          vod,
          series,
          accountInfo: login.user_info as any,
          serverInfo: (login.server_info || null) as any,
        },
        message:
          (serverPatch.xtreamServer ? "Sunucu adresi güncellendi • " : "") +
          `${channels.length} kanal • ${vod.length} film • ${series.length} dizi güncellendi`,
      };
    }

    if (pl.source === "m3u_url") {
      if (!pl.m3uUrl) return { ok: false, message: "M3U adresi yok." };
      const res = await fetchAndParseM3U(pl.m3uUrl);
      const total = res.channels.length + (res.vod?.length || 0) + (res.series?.length || 0);
      if (total === 0) return { ok: false, message: "Listede içerik bulunamadı." };
      return {
        ok: true,
        patch: { channels: res.channels, vod: res.vod, series: res.series },
        message: `${res.channels.length} kanal • ${res.vod?.length || 0} film • ${res.series?.length || 0} dizi güncellendi`,
      };
    }

    if (pl.source === "m3u_file") {
      return { ok: false, message: "Dosyadan eklenen listeler yenilenemez. Dosyayı tekrar ekleyin." };
    }

    if (pl.source === "stalker") {
      /**
       * STALKER / MAG YENİLEME — ARTIK CİHAZ İÇİ (v9.6.0)
       * Eskiden "yakında" deyip hiç yenilemiyordu. Protokol zaten
       * src/utils/stalker.ts içinde cihazda çalışıyor.
       */
      if (!pl.stalkerPortal || !pl.stalkerMac) {
        return { ok: false, message: "Portal/MAC bilgisi eksik." };
      }
      const { stalkerLogin, stalkerChannels, normalizeMac } = await import("@/src/utils/stalker");
      const cred = {
        portal: pl.stalkerPortal,
        mac: normalizeMac(pl.stalkerMac),
        serial: pl.stalkerSerial || undefined,
      };
      const { session } = await stalkerLogin(cred);
      const channels = await stalkerChannels(cred, session);
      if (channels.length === 0) {
        return { ok: false, message: "Portal bağlandı ama kanal listesi boş." };
      }
      return {
        ok: true,
        patch: { channels },
        message: `${channels.length} kanal güncellendi`,
      };
    }

    return { ok: false, message: "Bu liste türü yenilenemiyor." };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Yenileme başarısız." };
  }
}
