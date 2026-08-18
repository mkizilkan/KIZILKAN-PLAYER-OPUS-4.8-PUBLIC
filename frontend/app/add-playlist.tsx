import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { api } from "@/src/utils/api";
import {
  fetchAndParseM3U, parseM3U,
  xtreamLogin as xtLoginLocal,
  xtreamLiveStreams, xtreamVod as xtVodLocal, xtreamSeries as xtSeriesLocal,
  detectXtreamFromM3U,
} from "@/src/utils/iptv";
import type { Playlist, AccountInfo } from "@/src/types";
import { FocusButton } from "@/src/components/FocusButton";
// v10.4.0: akıllı yapıştırma (panodaki tam adresten bilgileri ayıklamak için)
import * as Clipboard from "expo-clipboard";
import {
  resolveServerCode, DEFAULT_CODE_SOURCE, CODE_SOURCE_KEY,
  // v10.4.0: panel rehberi, otomatik bulma, akıllı yapıştırma
  listPanels, findPanelByCredentials, parseXtreamUrl, describeAccount,
  validateAllHosts,   // v12.1.0: panelin tüm DNS adreslerini doğrula
  type PanelEntry, type FindPanelMatch,
} from "@/src/utils/serverCode";
import { storage } from "@/src/utils/storage";

type Method = "m3u_url" | "m3u_file" | "xtream" | "stalker" | "code";

export default function AddPlaylist() {
  /**
   * ALAN ARASI GEÇİŞ (v9.3.0 — kullanıcı isteği)
   * Telefon/tablette klavyedeki "İleri" tuşu, TV'de kumanda OK tuşu bir
   * sonraki alana geçirir. Eskiden her alanı elle seçmek gerekiyordu.
   */
  const refXtUser = React.useRef<any>(null);
  const refXtPass = React.useRef<any>(null);
  const refStMac = React.useRef<any>(null);
  const refStSerial = React.useRef<any>(null);
  const refM3uUrl = React.useRef<any>(null);
  const refXtServer = React.useRef<any>(null);
  const refStPortal = React.useRef<any>(null);

  const router = useRouter();
  const { colors } = useTheme();
  const { addPlaylist } = usePlaylists();

  const [method, setMethod] = useState<Method>("m3u_url");
  const [name, setName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [xtServer, setXtServer] = useState("");
  const [xtUser, setXtUser] = useState("");
  const [xtPass, setXtPass] = useState("");
  const [stPortal, setStPortal] = useState("");
  const [stMac, setStMac] = useState("");
  const [stSerial, setStSerial] = useState("");
  // v9.13.0: Sunucu Kodu ile giriş
  const [codeVal, setCodeVal] = useState("");
  const [codeSource, setCodeSource] = useState(DEFAULT_CODE_SOURCE);
  const [showCodeSource, setShowCodeSource] = useState(false);
  /* ---- v10.4.0: PANEL REHBERİ ---- */
  const [panelListOpen, setPanelListOpen] = useState(false);
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");
  /* ---- v10.4.0: OTOMATİK PANEL BULMA ---- */
  const [findOpen, setFindOpen] = useState(false);          // onay ekranı
  const [finding, setFinding] = useState(false);            // arama sürüyor
  const [findMsg, setFindMsg] = useState("");               // "38/40 panel denendi…"
  const [findOffset, setFindOffset] = useState(0);          // devam için imleç
  const [findTotal, setFindTotal] = useState(0);            // rehberdeki toplam
  const [findExhausted, setFindExhausted] = useState(false);// bu tur bitti, devam?
  /** v10.5.2: birden fazla panelde eşleşme -> kullanıcı seçer (yanlış panel riski). */
  const [findMatches, setFindMatches] = useState<FindPanelMatch[]>([]);
  /** v11.1.0: arama SÜRERKEN bulunanlar (anında alt alta gösterilir). */
  const [liveMatches, setLiveMatches] = useState<FindPanelMatch[]>([]);
  /** v10.6.0: kullanıcı birden fazla panel seçip HEPSİNİ ekleyebilir. */
  const [selectedMatches, setSelectedMatches] = useState<Record<string, boolean>>({});
  /** v10.6.0: her adayın kanal sayısı (seçimde ayırt etmeye yardımcı). */
  const [matchCounts, setMatchCounts] = useState<Record<string, number | "loading" | "error">>({});
  /** v10.6.0: sunucu-kodu alt modu — ekran görüntülerindeki üç yol. */
  const [codeMode, setCodeMode] = useState<"have" | "know" | "unknown">("have");
  const scrollRef = React.useRef<ScrollView | null>(null);
  /** v10.6.0: klavye alanı kapatmasın — odaklanan alanı görünür yap. */
  const scrollToInput = (y: number) => {
    setTimeout(() => { try { scrollRef.current?.scrollToEnd({ animated: true }); } catch {} }, 250);
  };
  const findStopRef = React.useRef(false);
  /** Bir turda denenecek panel sayısı (Ayarlar'dan değiştirilebilir hale gelecek). */
  const FIND_BATCH = 40;
  /**
   * v11.7.0 — TARAMA HIZI (kullanıcı ayarı, 1-50).
   * Aynı anda kaç panel deneneceğini kullanıcı belirler. Yüksek değer çok daha
   * hızlıdır; zayıf cihaz/ağda yığılma yapabilir diye uyarı gösteriyoruz.
   */
  const [scanSpeed, setScanSpeed] = useState(10);
  const SPEED_KEY = "kizilkan.scanSpeed";
  React.useEffect(() => {
    storage.getItem<string>(SPEED_KEY, "").then((v) => {
      const n = parseInt(String(v || ""), 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 50) setScanSpeed(n);
    }).catch(() => {});
  }, []);
  const applySpeed = (n: number) => {
    const v = Math.min(50, Math.max(1, Math.round(n) || 1));
    setScanSpeed(v);
    storage.setItem(SPEED_KEY, String(v)).catch(() => {});
  };
  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // v9.13.0: Kaydedilmiş "kod kaynağı" URL'ini yükle (yoksa varsayılan = senin adresin).
  React.useEffect(() => {
    storage.getItem<string>(CODE_SOURCE_KEY, "").then((v) => {
      if (v && v.trim()) setCodeSource(v.trim());
    }).catch(() => {});
  }, []);

  /* =====================================================================
   * v10.4.0 — PANEL REHBERİ
   * Kullanıcı kodu bilmiyor ama panel ADINI tanıyor olabilir. Liste açılınca
   * tüm "kod -> panel adı" haritası tek istekte çekilir; isme dokununca kod
   * otomatik dolar.
   * ===================================================================== */
  const openPanelList = async () => {
    setPanelListOpen(true);
    if (panels.length > 0) return;      // zaten yüklü
    setPanelsLoading(true);
    setError(null);
    try {
      const list = await listPanels(codeSource);
      setPanels(list);
    } catch (e: any) {
      setError(e?.message || "Panel listesi alınamadı.");
      setPanelListOpen(false);
    } finally {
      setPanelsLoading(false);
    }
  };

  const choosePanel = (p: PanelEntry) => {
    setCodeVal(p.code);
    setPanelListOpen(false);
    setPanelSearch("");
  };

  const filteredPanels = React.useMemo(() => {
    const q = panelSearch.trim().toLocaleLowerCase("tr");
    if (!q) return panels;
    return panels.filter(
      (p) => p.name.toLocaleLowerCase("tr").includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [panels, panelSearch]);

  /* =====================================================================
   * v10.4.0 — OTOMATİK PANEL BULMA ("Panelimi bilmiyorum")
   * Kullanıcı adı/şifre ile hangi panele ait olduğunu bulur.
   * GÜVENLİK: panel başına TEK deneme, ilk eşleşmede dur, kullanıcıdan
   * ÖNCEDEN açık onay alınır (şifre üçüncü taraf sunuculara gönderilir).
   * ===================================================================== */
  const runFind = async (offset: number, batch: number = FIND_BATCH) => {
    if (!xtUser.trim() || !xtPass.trim()) {
      setError("Önce kullanıcı adı ve şifreyi girin.");
      return;
    }
    setFindOpen(false);
    setFinding(true);
    setFindExhausted(false);
    setError(null);
    findStopRef.current = false;
    setFindMsg(batch === 0 ? "Tüm paneller taranıyor…" : `İlk ${batch} panel taranıyor…`);
    if (offset === 0) setLiveMatches([]);   // yeni arama -> canlı liste sıfırla
    try {
      const res = await findPanelByCredentials(codeSource, xtUser.trim(), xtPass.trim(), {
        limit: batch,   // 0 => kalan TÜM panelleri tara
        offset,
        concurrency: scanSpeed,   // v11.7.0: kullanıcı ayarı (1-50)
        timeoutMs: 7000,          // v11.7.0: tarama için kısa zaman aşımı
        // v10.9.0: kullanıcı ne olduğunu görsün — sayı + o an denenen panel adı
        onProgress: (p) => setFindMsg(
          // v11.7.0: canlı istatistik — panel, DNS, bulunan sayısı ve o anki adres
          `Panel ${p.tried}/${p.total} · DNS ${p.dnsTried ?? 0} · Bulunan ${p.found ?? 0}\n` +
          `${p.current}${p.currentServer ? " → " + p.currentServer.replace(/^https?:\/\//, "") : ""}`
        ),
        // v11.1.0: bulunanı ANINDA ekrana ekle (sona kadar bekletme)
        onMatch: (m) => setLiveMatches((prev) => (
          // v11.2.0: aynı panelin FARKLI DNS adresleri ayrı kayıt olarak durur
          prev.some(x => x.code === m.code && x.server === m.server) ? prev : [...prev, m]
        )),
        shouldStop: () => findStopRef.current,
      });
      setFindOffset(res.triedCount);
      setFindTotal(res.totalCount);

      if (res.matches.length === 0) {
        setFindExhausted(true);
        /**
         * v11.1.0 — DÜRÜST SONUÇ MESAJI.
         * Eskiden ağ/sunucu hatası da "bulunamadı" sayılıyordu; hesap gerçekte
         * varken kullanıcı "yok" sanıyordu. Artık ulaşılamayan panel sayısı
         * ayrıca yazılır ve tekrar denemesi önerilir.
         */
        const tail = res.unreachable > 0
          ? ` (${res.unreachable} panele ulaşılamadı — bağlantı/sunucu sorunu olabilir, tekrar deneyin)`
          : "";
        setFindMsg(
          (res.triedCount >= res.totalCount
            ? "Hiçbir panelde bulunamadı."
            : `Bu ${res.triedCount} panelde bulunamadı.`) + tail
        );
      } else if (res.matches.length === 1) {
        /**
         * TEK EŞLEŞME — yine de ONAY istiyoruz. Aynı kullanıcı adı/şifre
         * başka bir sağlayıcıda da geçerli olabilir; kullanıcı kendi
         * paketini (bitiş tarihi vb.) görüp doğrulasın.
         */
        const m = res.matches[0];
        setFindMsg("");
        setFindExhausted(false);
        const info = describeAccount(m.login?.user_info);
        Alert.alert(
          "Panel bulundu",
          `Panel: ${m.panelName}\nSunucu kodu: ${m.code}${info ? `\n${info}` : ""}\n\nBu sizin paneliniz mi?`,
          [
            { text: "Hayır", style: "cancel" },
            { text: "Evet, kullan", onPress: () => setCodeVal(m.code) },
          ]
        );
      } else {
        /**
         * ÇOKLU EŞLEŞME (v10.5.2) — KRİTİK GÜVENLİK NOKTASI.
         * "ali/12345" gibi yaygın bilgiler birden fazla panelde geçerli
         * olabiliyor. İlkini doğru saymak, kullanıcıya YABANCI sağlayıcının
         * listesini yükletir (ve başkasının hesabına giriş demektir).
         * Bu yüzden seçimi kullanıcı yapar; ayırt etmesi için her adayın
         * hesap özeti (bitiş tarihi, bağlantı) gösterilir.
         */
        setFindMatches(res.matches);
        setSelectedMatches({});
        setFindMsg("");
        setFindExhausted(false);
        loadMatchCounts(res.matches);
      }
    } catch (e: any) {
      setError(e?.message || "Panel araması başarısız.");
    } finally {
      setFinding(false);
    }
  };

  /**
   * v10.6.0 — ADAYLARIN KANAL SAYISI
   * Kullanıcı hangi panelin kendisine ait olduğunu ayırt edebilsin diye her
   * adayın kanal sayısı arka planda çekilir (aynı anda en fazla 3 istek).
   */
  const loadMatchCounts = async (matches: FindPanelMatch[]) => {
    const init: Record<string, number | "loading" | "error"> = {};
    // v11.2.0: anahtar kod+sunucu — aynı panelin farklı DNS'leri karışmasın
    matches.forEach((m) => { init[`${m.code}|${m.server}`] = "loading"; });
    setMatchCounts(init);
    let i = 0;
    const worker = async () => {
      while (i < matches.length) {
        const m = matches[i++];
        try {
          const chs = await xtreamLiveStreams({
            server: m.server, username: xtUser.trim(), password: xtPass.trim(),
          });
          setMatchCounts((prev) => ({ ...prev, [`${m.code}|${m.server}`]: chs.length }));
        } catch {
          setMatchCounts((prev) => ({ ...prev, [`${m.code}|${m.server}`]: "error" }));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  /**
   * v10.6.0 — SEÇİLEN PANELLERİ TOPLU EKLE
   * Kullanıcı birden fazla adayı seçebilir; her biri AYRI liste olarak eklenir.
   * Böylece içeriğine bakıp kendisine ait olmayanı sonradan silebilir
   * (tek tek "sil-baştan dene" döngüsü ortadan kalkar).
   */
  const addSelectedMatches = async () => {
    const chosen = findMatches.filter((m) => selectedMatches[`${m.code}|${m.server}`]);
    if (chosen.length === 0) { setError("En az bir panel seçin."); return; }
    setFindMatches([]);
    setLoading(true);
    setError(null);
    let added = 0;
    const failed: string[] = [];
    /** v11.0.0: "Kalanların hepsini ekle" seçilirse sonraki boşlarda soru sorulmaz. */
    let addEmptyAll = false;
    /** İçeriği alınamadığı halde kullanıcı isteğiyle eklenenler (özet için). */
    const emptyAdded: string[] = [];
    for (let idx = 0; idx < chosen.length; idx++) {
      const m = chosen[idx];
      setProgress(`${idx + 1}/${chosen.length} • ${m.panelName} yükleniyor…`);
      try {
        const cred = { server: m.server, username: xtUser.trim(), password: xtPass.trim() };
        const [chRes, vodRes, serRes] = await Promise.allSettled([
          xtreamLiveStreams(cred), xtVodLocal(cred), xtSeriesLocal(cred),
        ]);
        const channels = chRes.status === "fulfilled" ? chRes.value : [];
        const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
        const series = serRes.status === "fulfilled" ? serRes.value : [];
        let ch2 = channels, vod2 = vod, ser2 = series;
        if (ch2.length === 0 && vod2.length === 0 && ser2.length === 0) {
          /**
           * v10.9.0: TEK DENEMEDE VAZGEÇME.
           * Sunucular yoğunken ilk istek boş/zaman aşımı dönebiliyor; panel
           * "içerik yok" sanılıp atlanıyordu. Kısa bekleyip BİR KEZ daha dener.
           */
          setProgress(`${idx + 1}/${chosen.length} • ${m.panelName} yeniden deneniyor…`);
          await new Promise((r) => setTimeout(r, 1200));
          const retry = await Promise.allSettled([
            xtreamLiveStreams(cred), xtVodLocal(cred), xtSeriesLocal(cred),
          ]);
          ch2 = retry[0].status === "fulfilled" ? retry[0].value : [];
          vod2 = retry[1].status === "fulfilled" ? retry[1].value : [];
          ser2 = retry[2].status === "fulfilled" ? retry[2].value : [];
        }
        if (ch2.length === 0 && vod2.length === 0 && ser2.length === 0) {
          /**
           * v11.0.0 — KARARI KULLANICI VERİR.
           * İki denemede de içerik gelmediyse panel otomatik ATLANMIYOR;
           * sunucuda geçici bir sorun olabilir (bakım, yoğunluk, zaman aşımı).
           * Kullanıcıya soruyoruz: yine de eklensin mi? Eklenirse hesap bilgisi
           * kaydedilir, içerik daha sonra "Tümünü Güncelle" ile kendiliğinden
           * indirilir (liste boş kalmaz, hesap kaybolmaz).
           */
          if (addEmptyAll) {
            emptyAdded.push(m.panelName);   // kullanıcı daha önce "hepsini ekle" dedi
          } else {
            const decision = await new Promise<"add" | "skip" | "addAll">((resolve) => {
              Alert.alert(
                "İçerik alınamadı",
                `"${m.panelName}" panelinden şu an kanal/film listesi alınamadı.\n\n` +
                `Sunucuda geçici bir sorun olabilir. Hesabı yine de eklemek ister misiniz? ` +
                `Eklerseniz içerik daha sonra otomatik indirilir.`,
                [
                  { text: "Ekleme", style: "cancel", onPress: () => resolve("skip") },
                  { text: "Yine de ekle", onPress: () => resolve("add") },
                  { text: "Kalanların hepsini ekle", onPress: () => resolve("addAll") },
                ],
                { cancelable: false }
              );
            });
            if (decision === "skip") {
              failed.push(`${m.panelName} (kullanıcı eklemedi)`);
              continue;
            }
            if (decision === "addAll") addEmptyAll = true;
            emptyAdded.push(m.panelName);
          }
        }
        await addPlaylist({
          // v10.7.0: benzersizlik garantisi (aynı ms'de iki ekleme çakışmasın)
          id: `pl-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          name: m.panelName,
          source: "xtream",
          xtreamServer: m.server,
          xtreamUsername: xtUser.trim(),
          xtreamPassword: xtPass.trim(),
          panelCode: m.code,
          codeSource: codeSource,
          accountInfo: m.login?.user_info as AccountInfo,
          serverInfo: m.login?.server_info || null,
          channels: ch2, vod: vod2, series: ser2,
          createdAt: new Date().toISOString(),
        } as Playlist);
        added++;
      } catch (e: any) {
        // v10.7.0: hata artık YUTULMUYOR — kullanıcı hangi panelin eklenmediğini görür.
        failed.push(`${m.panelName} (${e?.message || "eklenemedi"})`);
      }
    }
    setLoading(false);
    setProgress("");
    if (added > 0) {
      Alert.alert(
        "Eklendi",
        `${added}/${chosen.length} liste eklendi.` +
        (emptyAdded.length
          ? `\n\nİçeriği şu an alınamayan (hesap kaydedildi, sonra otomatik indirilecek):\n• ${emptyAdded.join("\n• ")}`
          : "") +
        (failed.length ? `\n\nEklenmeyen:\n• ${failed.join("\n• ")}` : "") +
        `\n\nİçeriklerine bakıp size ait olmayanı listeler ekranından silebilirsiniz.`,
        /**
         * v11.7.0: router.back() İŞE YARAMIYORDU — bu ekrana çoğu yerden
         * router.replace ile geliniyor, yani geri gidilecek bir yer yok ve
         * kullanıcı sonuç ekranında kalıyordu. Artık doğrudan oynatma
         * listelerine yönlendiriliyor.
         */
        [{ text: "Tamam", onPress: () => router.replace("/playlist-select") }]
      );
    } else {
      setError(`Hiçbir liste eklenemedi.${failed.length ? " " + failed.join(" · ") : ""}`);
    }
  };

  /* v10.4.0 — AKILLI YAPIŞTIRMA: tam get.php/player_api adresinden bilgileri ayıkla. */  const smartPaste = async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      const parsed = parseXtreamUrl(txt);
      if (!parsed) {
        setError("Panoda geçerli bir adres bulunamadı. Sağlayıcınızın gönderdiği tam adresi kopyalayın.");
        return;
      }
      setXtUser(parsed.username);
      setXtPass(parsed.password);
      setXtServer(parsed.server);
      setMethod("xtream");
      setError(null);
      Alert.alert("Bilgiler dolduruldu", `Sunucu: ${parsed.server}\nKullanıcı: ${parsed.username}`);
    } catch {
      setError("Pano okunamadı.");
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setFileName(asset.name);
      const response = await fetch(asset.uri);
      const text = await response.text();
      setFileContent(text);
    } catch (e: any) {
      setError("Dosya seçilemedi: " + e.message);
    }
  };

  const useDemo = () => {
    setMethod("m3u_url");
    setName("iptv-org (Demo)");
    setM3uUrl("https://iptv-org.github.io/iptv/countries/tr.m3u");
  };

  /**
   * Algılanan Xtream bilgileriyle DOĞRUDAN yükler.
   * (setState asenkron olduğu için state'e güvenmeden yerel değerlerle çalışır.)
   */
  const submitXtreamDirect = async (cred: { server: string; username: string; password: string }) => {
    setLoading(true);
    setProgress("Kimlik doğrulanıyor (Xtream)...");
    try {
      const id = `pl-${Date.now()}`;
      const login = await xtLoginLocal(cred);
      setProgress("Kanallar, filmler ve diziler paralel yükleniyor...");
      const [chRes, vodRes, serRes] = await Promise.allSettled([
        xtreamLiveStreams(cred),
        xtVodLocal(cred),
        xtSeriesLocal(cred),
      ]);
      const channels = chRes.status === "fulfilled" ? chRes.value : [];
      const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
      const series = serRes.status === "fulfilled" ? serRes.value : [];
      if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
        throw new Error("İçerik yüklenemedi. Sunucu veya bilgileri kontrol edin.");
      }
      const playlist: Playlist = {
        id, name: name.trim() || "Xtream Codes", source: "xtream",
        xtreamServer: cred.server, xtreamUsername: cred.username, xtreamPassword: cred.password,
        accountInfo: login.user_info as AccountInfo,
        serverInfo: login.server_info || null,
        channels, vod, series,
        createdAt: new Date().toISOString(),
      };
      const total = channels.length + vod.length + series.length;
      if (total === 0) throw new Error("Hiç içerik bulunamadı. Kaynağı kontrol edin.");
      await addPlaylist(playlist);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  /** Kullanıcıya Evet/Hayır sorar (Promise tabanlı). */
  const askYesNo = (title: string, message: string): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: "Hayır, M3U olarak ekle", onPress: () => resolve(false), style: "cancel" },
          { text: "Evet, Xtream olarak ekle", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });

  const submit = async () => {
    /**
     * v10.6.0: "Paneli bilmiyorum" modunda ana düğme LİSTE EKLEMEZ; önce
     * hesabı arar (onay ekranını açar). Kod bilinmediği için normal ekleme
     * akışı zaten çalışamaz.
     */
    if (method === "code" && codeMode === "unknown") {
      if (!xtUser.trim() || !xtPass.trim()) {
        setError("Kullanıcı adı ve şifre gerekli.");
        return;
      }
      setFindOpen(true);
      return;
    }
    setError(null);

    // XTREAM OTOMATİK ALGILAMA (kullanıcı isteği):
    // M3U URL'i aslında bir Xtream portalı (get.php / player_api.php) ise,
    // kullanıcıya sor. Kabul ederse Xtream moduna geçir — kategoriler, EPG ve
    // hesap bilgisi gibi çok daha zengin veri gelir.
    if (method === "m3u_url" && m3uUrl.trim()) {
      const detected = detectXtreamFromM3U(m3uUrl.trim());
      if (detected) {
        const useXtream = await askYesNo(
          "Xtream Portalı Algılandı",
          "Girdiğiniz bağlantı bir Xtream Codes portalı gibi görünüyor. Xtream olarak eklerseniz kategoriler, EPG ve hesap bilgileri de yüklenir. Nasıl eklemek istersiniz?"
        );
        if (useXtream) {
          // Alanları doldur ve Xtream moduna geç, sonra normal akış devam etsin.
          setMethod("xtream");
          setXtServer(detected.server);
          setXtUser(detected.username);
          setXtPass(detected.password);
          // Not: state güncellemesi asenkron; bu yüzden aşağıda yerel değişkenlerle
          // devam etmek için doğrudan Xtream yükleme akışını burada tetikliyoruz.
          await submitXtreamDirect(detected);
          return;
        }
        // Hayır dediyse normal M3U akışıyla devam eder.
      }
    }

    setLoading(true);
    setProgress("");
    try {
      const id = `pl-${Date.now()}`;
      let playlist: Playlist;

      if (method === "m3u_url") {
        if (!m3uUrl.trim()) throw new Error("M3U URL boş olamaz");
        setProgress("Kanallar yükleniyor (cihazdan doğrudan)...");
        const res = await fetchAndParseM3U(m3uUrl.trim());
        playlist = {
          id, name: name.trim() || "M3U Listesi", source: "m3u_url",
          m3uUrl: m3uUrl.trim(),
          channels: res.channels,
          vod: res.vod,
          series: res.series,
          createdAt: new Date().toISOString(),
        };
      } else if (method === "m3u_file") {
        if (!fileContent) throw new Error("Lütfen bir M3U dosyası seçin");
        setProgress("Kanallar ayrıştırılıyor...");
        const res = parseM3U(fileContent);
        playlist = {
          id, name: name.trim() || fileName || "M3U Dosyası", source: "m3u_file",
          channels: res.channels,
          vod: res.vod,
          series: res.series,
          createdAt: new Date().toISOString(),
        };
      } else if (method === "xtream") {
        if (!xtServer.trim() || !xtUser.trim() || !xtPass.trim())
          throw new Error("Sunucu, kullanıcı adı ve şifre gereklidir");
        setProgress("Kimlik doğrulanıyor (cihazdan doğrudan)...");
        const cred = { server: xtServer.trim(), username: xtUser.trim(), password: xtPass.trim() };
        const login = await xtLoginLocal(cred);

        // HIZ: Kanallar + Filmler + Diziler ARTIK PARALEL yükleniyor (IPTV Extreme gibi).
        // ESKİ: art arda await -> kanallar bitmeden filmler başlamıyordu (3x yavaş).
        // YENİ: Promise.allSettled -> üçü aynı anda; biri yoksa (VOD/Series olmayan
        // sağlayıcı) diğerleri yine yüklenir, hata tüm işlemi durdurmaz.
        setProgress("Kanallar, filmler ve diziler paralel yükleniyor...");
        const [chRes, vodRes, serRes] = await Promise.allSettled([
          xtreamLiveStreams(cred),
          xtVodLocal(cred),
          xtSeriesLocal(cred),
        ]);

        const channels = chRes.status === "fulfilled" ? chRes.value : [];
        const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
        const series = serRes.status === "fulfilled" ? serRes.value : [];

        if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
          // Hiçbiri gelmediyse gerçek bir bağlantı sorunu var.
          throw new Error("İçerik yüklenemedi. Sunucu veya bilgileri kontrol edin.");
        }

        playlist = {
          id, name: name.trim() || "Xtream Codes", source: "xtream",
          xtreamServer: xtServer.trim(), xtreamUsername: xtUser.trim(), xtreamPassword: xtPass.trim(),
          accountInfo: login.user_info as AccountInfo,
          serverInfo: login.server_info || null,
          channels, vod, series,
          createdAt: new Date().toISOString(),
        };
      } else if (method === "code") {
        /**
         * SUNUCU KODU İLE GİRİŞ (v9.13.0)
         * Kısa kod + kullanıcı adı + şifre -> uzak kaynaktan panel/DNS çözülür
         * (src/utils/serverCode.ts) -> çalışan DNS ile STANDART Xtream listesi
         * oluşturulur. Kaynak URL varsayılanı uygulama sahibinindir ama
         * değiştirilebilir; girilen değer hatırlanır.
         */
        if (!codeVal.trim() || !xtUser.trim() || !xtPass.trim())
          throw new Error("Panel kodu, kullanıcı adı ve şifre gereklidir");
        const src = codeSource.trim() || DEFAULT_CODE_SOURCE;
        await storage.setItem(CODE_SOURCE_KEY, src);

        /**
         * v12.1.0 — PANELİN TÜM DNS ADRESLERİ DOĞRULANIR.
         * Eskiden ilk çalışan adreste durulup tek adres saklanıyordu; o adres
         * ölünce liste çalışmaz hale geliyordu. Artık tüm adresler denenir,
         * DOĞRULANMIŞ olanların hepsi listeye kaydedilir (validatedHosts) ve
         * DNS ölürse sırayla bunlara geçilir (self-healing).
         */
        setProgress("Panel kodu çözülüyor...");
        const vres = await validateAllHosts(
          src, codeVal.trim(), xtUser.trim(), xtPass.trim(),
          { onProgress: (d, t, srv) => setProgress(`Adres deneniyor ${d}/${t} — ${srv.replace(/^https?:\/\//, "")}`) }
        );
        if (vres.hosts.length === 0) {
          throw new Error("Panelin hiçbir adresi çalışmadı. Kod ve giriş bilgilerini kontrol edin.");
        }
        const server = vres.hosts[0].server;
        const codeLogin = vres.hosts[0].login;
        const validatedHosts = vres.hosts.map((h) => h.server);
        const fp = vres.hosts[0].fingerprint;
        /**
         * Aynı abonelik mi, farklı mı? Parmak izleri aynıysa bunlar yalnızca
         * DNS takma adlarıdır -> TEK liste. Farklıysa kullanıcıya bildirilir.
         */
        const distinct = Array.from(new Set(vres.hosts.map((h) => h.fingerprint)));
        const cred = { server, username: xtUser.trim(), password: xtPass.trim() };

        setProgress(
          `Panel: ${vres.panelName} · ${vres.hosts.length}/${vres.triedCount} adres geçerli` +
          (distinct.length > 1 ? ` · DİKKAT: ${distinct.length} farklı abonelik` : " · aynı abonelik") +
          "\nKanallar, filmler ve diziler yükleniyor..."
        );
        const [chRes, vodRes, serRes] = await Promise.allSettled([
          xtreamLiveStreams(cred), xtVodLocal(cred), xtSeriesLocal(cred),
        ]);
        const channels = chRes.status === "fulfilled" ? chRes.value : [];
        const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
        const series = serRes.status === "fulfilled" ? serRes.value : [];
        if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
          throw new Error("İçerik yüklenemedi. Kod veya kullanıcı bilgilerini kontrol edin.");
        }

        playlist = {
          id, name: name.trim() || `Sunucu ${codeVal.trim()}`, source: "xtream",
          xtreamServer: server, xtreamUsername: xtUser.trim(), xtreamPassword: xtPass.trim(),
          // v10.5.2: kodu SAKLA — DNS değişirse yenilemede kendiliğinden çözülsün.
          panelCode: codeVal.trim(), codeSource: src,
          // v12.1.0: doğrulanmış adresler + tercih edilen adres + abonelik kimliği
          preferredServer: server, validatedHosts, accountFingerprint: fp,
          accountInfo: codeLogin.user_info as AccountInfo,
          serverInfo: codeLogin.server_info || null,
          channels, vod, series,
          createdAt: new Date().toISOString(),
        };
      } else {
        /**
         * STALKER / MAG — ARTIK CİHAZ İÇİ (v9.1.0)
         * Eskiden backend proxy'ye bağımlıydı (emergent kalıntısı). Protokolün
         * tamamı src/utils/stalker.ts içinde cihazda çalışıyor:
         *   handshake -> get_profile -> get_genres -> get_all_channels
         * Yayın adresleri GEÇİCİ olduğu için oynatma anında create_link ile
         * ayrıca çözülür (player tarafında).
         */
        if (!stPortal.trim() || !stMac.trim())
          throw new Error("Portal adresi ve MAC adresi gereklidir");

        const { stalkerLogin: stLogin, stalkerChannels, normalizeMac } = await import("@/src/utils/stalker");
        const cred = {
          portal: stPortal.trim(),
          mac: normalizeMac(stMac.trim()),
          serial: stSerial.trim() || undefined,
        };

        setProgress("Portala bağlanılıyor...");
        const { session, profile: prof } = await stLogin(cred);

        setProgress("Kanallar yükleniyor...");
        const chans = await stalkerChannels(cred, session);
        if (chans.length === 0) {
          throw new Error(
            "Portal bağlandı ama kanal listesi BOŞ.\n\n" +
              "Olası sebepler:\n" +
              "• MAC adresi bu portalda kayıtlı değil\n" +
              "• Abonelik süresi dolmuş\n" +
              "• Portal bu cihaz türünü kabul etmiyor"
          );
        }
        const load = { channels: chans };
        const profile = prof || {};
        playlist = {
          id, name: name.trim() || "MAG Portal", source: "stalker",
          stalkerPortal: stPortal.trim(), stalkerMac: stMac.trim().toUpperCase(),
          stalkerSerial: stSerial.trim() || undefined,
          accountInfo: {
            username: profile.login,
            status: profile.status,
            mac: profile.mac,
            phone: profile.phone,
            tariff_plan: profile.tariff_plan,
            tariff_expired_date: profile.tariff_expired_date || profile.exp_billing_date,
          },
          channels: load.channels, createdAt: new Date().toISOString(),
        };
      }

      const totalItems = (playlist.channels?.length || 0) + (playlist.vod?.length || 0) + (playlist.series?.length || 0);
      if (totalItems === 0) throw new Error("Hiç kanal/film/dizi bulunamadı. Kaynağı kontrol edin.");
      await addPlaylist(playlist);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const methods: { key: Method; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "m3u_url", label: "M3U URL", icon: "link" },
    { key: "m3u_file", label: "M3U Dosya", icon: "document-attach" },
    { key: "xtream", label: "Xtream", icon: "server" },
    { key: "code", label: "Sunucu Kodu", icon: "keypad" },
    { key: "stalker", label: "MAG", icon: "hardware-chip" },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top", "bottom"]} testID="add-playlist-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}   /* v10.9.0: Android zaten adjustResize yapar; "height" görünümü çökertiyordu */>
        <View style={styles.header}>
          <FocusButton testID="close-btn" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </FocusButton>
          <Text style={[styles.title, { color: colors.onSurface }]}>Oynatma Listesi Ekle</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          /* v10.6.0: klavye açılınca alanlar altta kalmasın — bol alt boşluk +
             otomatik kaydırma (Android'de KeyboardAvoidingView tek başına yetmiyor). */
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 420 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary }]}>KAYNAK TÜRÜ</Text>
          <View style={styles.methodGrid}>
            {methods.map(m => {
              const active = method === m.key;
              return (
                <FocusButton
                  key={m.key}
                  testID={`method-${m.key}-btn`}
                  onPress={() => setMethod(m.key)}
                  activeOpacity={0.85}
                  focusable
                  style={[
                    styles.methodCard,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    active && { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary },
                  ]}
                >
                  <Ionicons name={m.icon} size={26} color={active ? colors.brandPrimary : colors.onSurfaceSecondary} />
                  <Text style={[styles.methodLabel, { color: active ? colors.onSurface : colors.onSurfaceSecondary }]}>{m.label}</Text>
                </FocusButton>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>LİSTE ADI (isteğe bağlı)</Text>
          <TextInput
            testID="playlist-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Örn: MAG254 Aboneliğim"
            placeholderTextColor={colors.onSurfaceTertiary}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              // İsimden sonra ilgili kaynağın İLK alanına geç.
              (refM3uUrl.current || refXtServer.current || refStPortal.current)?.focus();
            }}
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
          />

          {method === "m3u_url" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>M3U URL</Text>
              <TextInput
                testID="m3u-url-input"
                ref={refM3uUrl}
                value={m3uUrl}
                onChangeText={setM3uUrl}
                placeholder="https://example.com/playlist.m3u"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                blurOnSubmit
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <FocusButton testID="use-demo-btn" onPress={useDemo} style={styles.demoRow}>
                <Ionicons name="flash" size={16} color={colors.brandPrimary} />
                <Text style={[styles.demoText, { color: colors.brandPrimary }]}>Demo listeyi kullan (iptv-org TR)</Text>
              </FocusButton>
            </>
          )}

          {method === "m3u_file" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>M3U DOSYASI</Text>
              <FocusButton
                testID="pick-file-btn"
                onPress={pickFile}
                style={[styles.fileBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Ionicons name="cloud-upload-outline" size={22} color={colors.brandPrimary} />
                <Text style={[styles.fileText, { color: colors.onSurface }]} numberOfLines={1}>
                  {fileName || "Dosya seç (.m3u / .m3u8)"}
                </Text>
              </FocusButton>
            </>
          )}

          {method === "xtream" && (
            <>
              {/**
                * v10.4.0 — AKILLI YAPIŞTIRMA
                * Sağlayıcıdan gelen tam adres (…/get.php?username=…&password=…)
                * panoya kopyalanıp tek dokunuşla üç alana birden dağıtılır.
                * Yaşlı kullanıcı hiçbir alanı elle doldurmak zorunda kalmaz.
                */}
              <FocusButton
                testID="smart-paste-btn"
                onPress={smartPaste}
                style={[styles.helperBtn, { borderColor: colors.brandPrimary, marginTop: SPACING.lg }]}
              >
                <Ionicons name="clipboard" size={16} color={colors.brandPrimary} />
                <Text style={{ color: colors.brandPrimary, fontSize: FONT.size.sm, fontWeight: "600" }}>
                  Adresi yapıştır — bilgileri otomatik doldur
                </Text>
              </FocusButton>

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>SUNUCU</Text>
              <TextInput
                testID="xtream-server-input"
                ref={refXtServer}
                value={xtServer}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtUser.current?.focus()}
                onChangeText={setXtServer}
                placeholder="http://sunucu.com:8080"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>KULLANICI ADI</Text>
              <TextInput
                testID="xtream-username-input"
                ref={refXtUser}
                value={xtUser}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtPass.current?.focus()}
                onChangeText={setXtUser}
                placeholder="kullanici_adiniz"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>ŞİFRE</Text>
              <TextInput
                testID="xtream-password-input"
                ref={refXtPass}
                value={xtPass}
                returnKeyType="done"
                onChangeText={setXtPass}
                placeholder="••••••••"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
            </>
          )}

          {method === "code" && (
            <>
              <View style={[styles.infoBanner, { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary }]}>
                <Ionicons name="people" size={18} color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>
                  Panel kodunu bilmiyorsanız sorun değil. Panel adından seçebilir veya yalnız
                  kullanıcı adı ve şifre ile hesabınızı otomatik aratabilirsiniz.
                </Text>
              </View>

              {/* ---- v10.6.0: NASIL EKLEMEK İSTİYORSUNUZ? (üç mod) ---- */}
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>
                NASIL EKLEMEK İSTİYORSUNUZ?
              </Text>
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                {([
                  { k: "have", icon: "keypad", label: "Kodum var" },
                  { k: "know", icon: "list", label: "Paneli biliyorum" },
                ] as const).map((m) => (
                  <FocusButton
                    key={m.k}
                    testID={`code-mode-${m.k}`}
                    onPress={() => { setCodeMode(m.k); if (m.k === "know") openPanelList(); }}
                    style={[
                      styles.modeBtn,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: codeMode === m.k ? colors.brandPrimary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={m.icon as any} size={22} color={codeMode === m.k ? colors.brandPrimary : colors.onSurfaceSecondary} />
                    <Text style={{ color: codeMode === m.k ? colors.onSurface : colors.onSurfaceSecondary, fontWeight: "600" }}>
                      {m.label}
                    </Text>
                  </FocusButton>
                ))}
              </View>
              <FocusButton
                testID="code-mode-unknown"
                onPress={() => setCodeMode("unknown")}
                style={[
                  styles.modeBtn,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: codeMode === "unknown" ? colors.brandPrimary : colors.border,
                    marginTop: SPACING.sm,
                  },
                ]}
              >
                <Ionicons name="search" size={22} color={codeMode === "unknown" ? colors.brandPrimary : colors.onSurfaceSecondary} />
                <Text style={{ color: codeMode === "unknown" ? colors.onSurface : colors.onSurfaceSecondary, fontWeight: "600" }}>
                  Paneli bilmiyorum
                </Text>
              </FocusButton>

              {/* ---- MOD: Kodum var ---- */}
              {codeMode === "have" && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>PANEL KODU</Text>
                  <TextInput
                    testID="code-value-input"
                    value={codeVal}
                    onChangeText={setCodeVal}
                    placeholder="Örn: 0001"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => refXtUser.current?.focus()}
                    onFocus={() => scrollToInput(0)}
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
                  />
                </>
              )}

              {/* ---- MOD: Paneli biliyorum (rehber, ekran içinde) ---- */}
              {codeMode === "know" && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>
                    PANEL / SUNUCU REHBERİ
                  </Text>
                  <TextInput
                    testID="panel-search-input"
                    value={panelSearch}
                    onChangeText={setPanelSearch}
                    placeholder="Panel adı veya sunucu kodu ara"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => scrollToInput(0)}
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
                  />
                  {panelsLoading ? (
                    <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                      <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Rehber yükleniyor...</Text>
                    </View>
                  ) : (
                    <View style={{ maxHeight: 260 }}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredPanels.slice(0, 60).map((p) => (
                          <FocusButton
                            key={p.code}
                            testID={`panel-item-${p.code}`}
                            onPress={() => { setCodeVal(p.code); setCodeMode("have"); }}
                            style={[styles.panelRow, { borderColor: colors.border, backgroundColor: codeVal === p.code ? colors.brandPrimary + "22" : "transparent" }]}
                          >
                            <Ionicons name="server" size={18} color={colors.brandPrimary} />
                            <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.base }} numberOfLines={1}>{p.name}</Text>
                            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>{p.code}</Text>
                          </FocusButton>
                        ))}
                        {filteredPanels.length === 0 && (
                          <Text style={{ color: colors.onSurfaceSecondary, padding: SPACING.md, textAlign: "center" }}>
                            Eşleşen panel yok.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {/* ---- MOD: Paneli bilmiyorum (güvenlik bilgisi + hız ayarı) ---- */}
              {codeMode === "unknown" && (
                <>
                  <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.brandPrimary} />
                    <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm, lineHeight: 19 }}>
                      Kullanıcı adı ve şifreniz Firebase'e gönderilmez. Uygulama Firebase'den yalnız
                      panel/sunucu rehberini alır ve giriş bilgilerini cihazınızdan doğrudan aday IPTV
                      sunucularında dener.
                    </Text>
                  </View>

                  {/**
                    * v11.7.0 — TARAMA HIZI.
                    * Aynı anda kaç panelin deneneceğini kullanıcı seçer (1-50).
                    * Yüksek değer aramayı ciddi hızlandırır.
                    */}
                  <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>
                    TARAMA HIZI (AYNI ANDA {scanSpeed} PANEL)
                  </Text>
                  <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                    {[5, 10, 25, 50].map((n) => (
                      <FocusButton
                        key={n}
                        testID={`scan-speed-${n}`}
                        onPress={() => applySpeed(n)}
                        style={[
                          styles.helperBtn,
                          { borderColor: scanSpeed === n ? colors.brandPrimary : colors.border },
                        ]}
                      >
                        <Text style={{ color: scanSpeed === n ? colors.brandPrimary : colors.onSurface, fontWeight: "700" }}>
                          {n === 5 ? "Yavaş 5" : n === 10 ? "Normal 10" : n === 25 ? "Hızlı 25" : "Çok hızlı 50"}
                        </Text>
                      </FocusButton>
                    ))}
                  </View>
                  <TextInput
                    testID="scan-speed-input"
                    value={String(scanSpeed)}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
                      if (!Number.isNaN(n)) applySpeed(n); else setScanSpeed(1);
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="1-50 arası"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border, marginTop: SPACING.sm }]}
                  />
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: SPACING.xs }}>
                    Yüksek değer taramayı hızlandırır. Zayıf cihaz veya yavaş internette çok yüksek
                    değer takılmaya yol açabilir.
                  </Text>
                </>
              )}

              {/* Arama ilerlemesi / sonucu */}
              {(finding || findExhausted) && (
                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: SPACING.sm }]}>
                  {finding && <ActivityIndicator size="small" color={colors.brandPrimary} />}
                  <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>{findMsg}</Text>
                  {finding ? (
                    <FocusButton testID="panel-find-stop" onPress={() => { findStopRef.current = true; }}>
                      <Text style={{ color: colors.error, fontWeight: "700" }}>Durdur</Text>
                    </FocusButton>
                  ) : findExhausted && findOffset < findTotal ? (
                    <View style={{ gap: SPACING.xs }}>
                      <FocusButton testID="panel-find-more" onPress={() => runFind(findOffset, FIND_BATCH)}>
                        <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Devam ({FIND_BATCH})</Text>
                      </FocusButton>
                      <FocusButton testID="panel-find-all" onPress={() => runFind(findOffset, 0)}>
                        <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>
                          Kalan tümü ({findTotal - findOffset})
                        </Text>
                      </FocusButton>
                    </View>
                  ) : null}
                </View>
              )}

              {/**
                * v11.1.0 — CANLI SONUÇLAR.
                * Bulunan paneller aramanın SONUNU beklemeden, bulundukları anda
                * alt alta listelenir. Kullanıcı neyin bulunduğunu eş zamanlı
                * görür; arama uzun sürse de "hiçbir şey olmuyor" hissi olmaz.
                */}
              {liveMatches.length > 0 && (
                <View style={{ marginTop: SPACING.sm }}>
                  <Text style={[styles.sectionLabel, { color: colors.brandPrimary }]}>
                    BULUNAN HESAPLAR ({liveMatches.length})
                  </Text>
                  {liveMatches.map((m, i) => {
                    const info = describeAccount(m.login?.user_info);
                    return (
                      <View
                        key={`${m.code}-${i}`}
                        style={[styles.panelRow, { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + "18" }]}
                      >
                        <Ionicons name="checkmark-circle" size={18} color={colors.brandPrimary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.onSurface, fontSize: FONT.size.base }} numberOfLines={1}>
                            {i + 1}. {m.panelName}
                          </Text>
                          <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.xs }} numberOfLines={1}>
                            {m.server.replace(/^https?:\/\//, "")}{info ? ` · ${info}` : ""}
                          </Text>
                        </View>
                        <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>{m.code}</Text>
                      </View>
                    );
                  })}
                  {!finding && findMatches.length === 0 && (
                    <FocusButton
                      testID="live-matches-choose"
                      onPress={() => { setFindMatches(liveMatches); loadMatchCounts(liveMatches); }}
                      style={[styles.helperBtn, { borderColor: colors.brandPrimary, marginTop: SPACING.sm }]}
                    >
                      <Ionicons name="add-circle" size={16} color={colors.brandPrimary} />
                      <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>
                        Bunlardan seç ve ekle
                      </Text>
                    </FocusButton>
                  )}
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>KULLANICI ADI</Text>
              <TextInput
                testID="code-user-input"
                ref={refXtUser}
                value={xtUser}
                onChangeText={setXtUser}
                placeholder="Kullanıcı adı"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtPass.current?.focus()}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>ŞİFRE</Text>
              <TextInput
                testID="code-pass-input"
                ref={refXtPass}
                value={xtPass}
                onChangeText={setXtPass}
                placeholder="Şifre"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                returnKeyType="done"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />

              {/* Kaynak URL — varsayılan uygulama sahibinindir; gelişmiş kullanıcı değiştirebilir. */}
              <FocusButton
                testID="code-source-toggle"
                onPress={() => setShowCodeSource(v => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
              >
                <Ionicons name={showCodeSource ? "chevron-down" : "chevron-forward"} size={16} color={colors.onSurfaceSecondary} />
                <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>Kod kaynağı (gelişmiş)</Text>
              </FocusButton>
              {showCodeSource && (
                <>
                  <TextInput
                    testID="code-source-input"
                    value={codeSource}
                    onChangeText={setCodeSource}
                    placeholder={DEFAULT_CODE_SOURCE}
                    placeholderTextColor={colors.onSurfaceTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
                  />
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: -4, marginBottom: 4 }}>
                    Boş bırakılırsa varsayılan kaynak kullanılır.
                  </Text>
                </>
              )}
            </>
          )}

          {method === "stalker" && (
            <>
              <View style={[styles.infoBanner, { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary }]}>
                <Ionicons name="information-circle" size={18} color={colors.brandPrimary} />
                <Text style={[styles.infoBannerText, { color: colors.onSurface }]}>
                  Sadece SİZE AİT MAG cihazının MAC adresini girin. Başkasının MAC adresini kullanmak yasadışıdır.
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>PORTAL URL</Text>
              <TextInput
                testID="stalker-portal-input"
                ref={refStPortal}
                value={stPortal}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refStMac.current?.focus()}
                onChangeText={setStPortal}
                placeholder="http://portal.saglayici.com"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>MAC ADRESİ</Text>
              <TextInput
                testID="stalker-mac-input"
                ref={refStMac}
                value={stMac}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refStSerial.current?.focus()}
                onChangeText={t => setStMac(t.toUpperCase())}
                placeholder="00:1A:79:AA:BB:CC"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>
                SERIAL NUMBER (isteğe bağlı)
              </Text>
              <TextInput
                testID="stalker-serial-input"
                ref={refStSerial}
                value={stSerial}
                returnKeyType="done"
                onChangeText={setStSerial}
                placeholder="062015N001999"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
            </>
          )}

          {error && (
            <View testID="error-box" style={[styles.errorBox, { backgroundColor: colors.error + "22", borderColor: colors.error }]}>
              <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" }}>
                <Ionicons name="alert-circle" size={18} color={colors.error} style={{ marginTop: 2 }} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
              {/sunucu|ulaş|network|erişil|internet/i.test(error) && (
                <FocusButton
                  testID="error-diagnostic-btn"
                  onPress={() => router.push("/diagnostic")}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 6, marginTop: SPACING.sm, paddingVertical: SPACING.sm,
                    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.error,
                  }}
                >
                  <Ionicons name="pulse" size={16} color={colors.error} />
                  <Text style={{ color: colors.error, fontWeight: FONT.weight.bold }}>Bağlantıyı Test Et</Text>
                </FocusButton>
              )}
            </View>
          )}

          {loading && progress && (
            <View style={[styles.progressBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={[styles.progressText, { color: colors.onSurface }]}>{progress}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <FocusButton
            testID="submit-playlist-btn"
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
            style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={colors.onBrandPrimary} />
                <Text style={[styles.ctaText, { color: colors.onBrandPrimary }]}>
                  {method === "code" && codeMode === "unknown" ? "Hesabımı Bul ve Ekle" : "Kaydet ve Yükle"}
                </Text>
              </>
            )}
          </FocusButton>
        </View>
      </KeyboardAvoidingView>

      {/* =================== v10.4.0: PANEL LİSTESİ =================== */}
      <Modal visible={panelListOpen} transparent animationType="slide" onRequestClose={() => setPanelListOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Panel Listesi</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, marginBottom: SPACING.sm }}>
              Panelinizin adına dokunun; sunucu kodu otomatik dolacak.
            </Text>
            <TextInput
              testID="panel-search-input"
              value={panelSearch}
              onChangeText={setPanelSearch}
              placeholder="Panel adı veya kod ara…"
              placeholderTextColor={colors.onSurfaceTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
            />
            {panelsLoading ? (
              <View style={{ padding: SPACING.lg, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurfaceSecondary, marginTop: SPACING.sm }}>Liste yükleniyor…</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380, marginTop: SPACING.sm }} keyboardShouldPersistTaps="handled">
                {filteredPanels.length === 0 ? (
                  <Text style={{ color: colors.onSurfaceSecondary, padding: SPACING.md, textAlign: "center" }}>
                    Eşleşen panel yok.
                  </Text>
                ) : (
                  filteredPanels.map((p) => (
                    <FocusButton
                      key={p.code}
                      testID={`panel-item-${p.code}`}
                      onPress={() => choosePanel(p)}
                      style={[styles.panelRow, { borderColor: colors.border }]}
                    >
                      <Ionicons name="server" size={18} color={colors.brandPrimary} />
                      <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.base }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>{p.code}</Text>
                    </FocusButton>
                  ))
                )}
              </ScrollView>
            )}
            <FocusButton
              testID="panel-list-close"
              onPress={() => setPanelListOpen(false)}
              style={[styles.modalClose, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Kapat</Text>
            </FocusButton>
          </View>
        </View>
      </Modal>

      {/* ========== v10.4.0: OTOMATİK BULMA — AÇIK ONAY EKRANI ==========
          Kullanıcının şifresi, ait olmadığı panellere de gönderilecek.
          Bu yüzden aramadan ÖNCE açıkça bilgilendirip onay alıyoruz. */}
      <Modal visible={findOpen} transparent animationType="fade" onRequestClose={() => setFindOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Panelimi bul</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, lineHeight: 20 }}>
              Kullanıcı adınız ve şifreniz, doğru paneli bulmak için panellere sırayla denenecek.
              Her panele yalnızca bir kez denenir ve panel bulununca arama durur.
              {"\n\n"}Bu işlem sırasında bilgileriniz denenen sunuculara gönderilir. Devam etmek istiyor musunuz?
            </Text>
            <FocusButton
              testID="find-start-all"
              onPress={() => { setFindOffset(0); runFind(0, 0); }}
              style={[styles.modalClose, { borderColor: colors.brandPrimary }]}
            >
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>
                Tümünü ara (tüm paneller — uzun sürebilir)
              </Text>
            </FocusButton>
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }}>
              <FocusButton
                testID="find-cancel"
                onPress={() => setFindOpen(false)}
                style={[styles.modalClose, { flex: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Vazgeç</Text>
              </FocusButton>
              <FocusButton
                testID="find-start"
                onPress={() => { setFindOffset(0); runFind(0, FIND_BATCH); }}
                style={[styles.modalClose, { flex: 1, backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Hızlı ara ({FIND_BATCH})</Text>
              </FocusButton>
            </View>
          </View>
        </View>
      </Modal>
      {/* ===== v10.5.2: ÇOKLU EŞLEŞME — KULLANICI KENDİ PANELİNİ SEÇER ===== */}
      <Modal
        visible={findMatches.length > 0}
        transparent
        animationType="slide"
        onRequestClose={() => setFindMatches([])}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Birden fazla panel bulundu</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, lineHeight: 20 }}>
              Aynı kullanıcı adı ve şifre {findMatches.length} panelde geçerli görünüyor.
              İstediğiniz kadarını seçip ekleyebilirsiniz; içeriklerine bakıp size ait olmayanı
              listeler ekranından silin. Kanal sayısı ve abonelik bitiş tarihi ayırt etmenize yardımcı olur.
            </Text>
            <ScrollView style={{ maxHeight: 340, marginTop: SPACING.md }}>
              {findMatches.map((m) => {
                const info = describeAccount(m.login?.user_info);
                const mk = `${m.code}|${m.server}`;
                const cnt = matchCounts[mk];
                const on = !!selectedMatches[mk];
                return (
                  <FocusButton
                    key={mk}
                    testID={`find-match-${m.code}`}
                    onPress={() => setSelectedMatches((p) => ({ ...p, [mk]: !p[mk] }))}
                    style={[styles.panelRow, { borderColor: on ? colors.brandPrimary : colors.border, backgroundColor: on ? colors.brandPrimary + "22" : "transparent" }]}
                  >
                    <Ionicons
                      name={on ? "checkbox" : "square-outline"}
                      size={20}
                      color={on ? colors.brandPrimary : colors.onSurfaceSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontSize: FONT.size.base }} numberOfLines={1}>
                        {m.panelName}
                      </Text>
                      <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.xs }} numberOfLines={1}>
                        {cnt === "loading" ? "Kanal sayısı alınıyor…"
                          : cnt === "error" ? "Kanal sayısı alınamadı"
                          : typeof cnt === "number" ? `${cnt} kanal` : ""}
                        {info ? ` · ${info}` : ""}
                      </Text>
                      {/* v11.2.0: aynı panelin farklı DNS'leri ayırt edilsin */}
                      <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs }} numberOfLines={1}>
                        {m.server.replace(/^https?:\/\//, "")}
                      </Text>
                    </View>
                    <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>{m.code}</Text>
                  </FocusButton>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <FocusButton
                testID="find-match-cancel"
                onPress={() => { setFindMatches([]); setSelectedMatches({}); }}
                style={[styles.modalClose, { flex: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Vazgeç</Text>
              </FocusButton>
              <FocusButton
                testID="find-match-add"
                onPress={addSelectedMatches}
                style={[styles.modalClose, { flex: 1, backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>
                  Seçilenleri Ekle ({Object.values(selectedMatches).filter(Boolean).length})
                </Text>
              </FocusButton>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  sectionLabel: {
    fontSize: FONT.size.xs,
    fontWeight: FONT.weight.bold,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  methodGrid: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  methodCard: {
    width: "23%",
    minWidth: 74,
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    gap: SPACING.xs,
  },
  methodLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    fontSize: FONT.size.lg,
  },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm },
  demoText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  fileBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    height: 52, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg,
  },
  fileText: { fontSize: FONT.size.base, flex: 1 },
  infoBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    marginTop: SPACING.md,
  },
  infoBannerText: { flex: 1, fontSize: FONT.size.sm, lineHeight: 18 },
  /* ---- v10.4.0: panel rehberi / otomatik bulma ---- */
  modeBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.xs,
    paddingVertical: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1,
  },
  helperBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.xs, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: SPACING.lg,
  },
  modalSheet: {
    borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg,
  },
  modalTitle: { fontSize: FONT.size.lg, fontWeight: "700", marginBottom: SPACING.xs },
  modalClose: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACING.md,
  },
  panelRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1, borderRadius: RADIUS.sm,
  },
  errorBox: {
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  errorText: { flex: 1, fontSize: FONT.size.base, lineHeight: 20 },
  progressBox: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  progressText: { fontSize: FONT.size.base },
  footer: { padding: SPACING.lg, borderTopWidth: 1 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    height: 56, borderRadius: RADIUS.pill,
  },
  ctaText: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
});
