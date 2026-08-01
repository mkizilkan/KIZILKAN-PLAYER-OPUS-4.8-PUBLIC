/**
 * KIZILKAN PLAYER — TV Kumanda Medya Tuşları (CH+/−) Config Plugin
 * Dosya   : frontend/plugins/withTvRemoteKeys.js
 * Sürüm   : v1.0.0 (v6.4.0)
 *
 * ---------------------------------------------------------------------------
 * NE İŞE YARIYOR?
 * ---------------------------------------------------------------------------
 * React Native'in çekirdeğinde kumanda MEDYA tuşları için olay yoktur.
 * D-pad (yön + OK + Geri) Android'in odak sistemiyle zaten çalışır; ancak
 * CH+ / CH− ve oynat/duraklat gibi tuşlar uygulamaya ULAŞMAZ.
 *
 * Bu plugin, prebuild sırasında MainActivity.kt dosyasına küçük bir
 * `onKeyDown` geçersiz kılması (override) enjekte eder. Yakalanan tuşlar
 * DeviceEventManagerModule üzerinden JS tarafına "KizilkanRemoteKey" olayı
 * olarak gönderilir. JS tarafı bunu dinleyip kanal değiştirir.
 *
 * Kullanıcının cihazlarında karşılığı:
 *   Homatics Box R 4K+ : CH+ / CH−            -> kanal ileri/geri
 *   Fire TV 4K Max     : CH+ / CH− + medya    -> kanal + oynat/duraklat
 *   Chromecast / Wanbo : bu tuşlar yok        -> etkisiz (zarar vermez)
 *
 * ---------------------------------------------------------------------------
 * RİSK NOTU (dürüstlük)
 * ---------------------------------------------------------------------------
 * Bu plugin NATIVE kaynak dosyasını değiştirir. Yanlış giderse derleme
 * kırılabilir. Bu yüzden:
 *   • Enjeksiyon SADECE bir kez yapılır (imza kontrolü ile).
 *   • MainActivity zaten `onKeyDown` içeriyorsa DOKUNULMAZ.
 *   • Beklenmeyen bir yapı görülürse sessizce atlanır (build kırılmaz).
 * ---------------------------------------------------------------------------
 */

const { withMainActivity } = require("@expo/config-plugins");

/** Enjeksiyonun daha önce yapıldığını anlamak için benzersiz imza. */
const MARKER = "KIZILKAN_REMOTE_KEYS";

const KOTLIN_BLOCK = `
  // ${MARKER} — TV kumanda medya tuşları (CH+/-, oynat/duraklat)
  //
  // v7.2.0 NOT: Önce onKeyDown kullanıyorduk. react-native-tvos fork'unun
  // MainActivity'sinde zaten bir onKeyDown olabildiği için eklentimiz
  // "çakışmasın" diye enjeksiyonu ATLIYORDU ve CH+/- hiç çalışmıyordu.
  //
  // dispatchKeyEvent, olay zincirinin EN BAŞINDA çalışır ve fork'un kendi
  // işleyicisiyle çakışmaz: ilgilenmediğimiz tuşları super'e devrederiz.
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    if (event.action != android.view.KeyEvent.ACTION_DOWN) {
      return super.dispatchKeyEvent(event)
    }
    val keyCode = event.keyCode

    /**
     * UZUN-BAS GERİ (v7.6.0) — TiviMate deseni
     * Geri tuşu BASILI TUTULUNCA "kanal listesine dön" komutu gönderilir.
     * Kısa basış normal geri davranışını korur (JS tarafına karışmayız).
     * repeatCount, Android'in tuş tekrar sayacıdır; basılı tutunca artar.
     */
    if (keyCode == android.view.KeyEvent.KEYCODE_BACK && event.repeatCount == 1) {
      try {
        val ctxB = reactInstanceManager?.currentReactContext
        if (ctxB != null) {
          val pB = com.facebook.react.bridge.Arguments.createMap()
          pB.putString("key", "backLongPress")
          ctxB.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("KizilkanRemoteKey", pB)
          return true   // uzun basışı TÜKET: normal geri tetiklenmesin
        }
      } catch (e: Exception) { }
    }

    val name = when (keyCode) {
      android.view.KeyEvent.KEYCODE_CHANNEL_UP -> "channelUp"
      android.view.KeyEvent.KEYCODE_CHANNEL_DOWN -> "channelDown"
      android.view.KeyEvent.KEYCODE_MEDIA_NEXT -> "channelUp"
      android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS -> "channelDown"
      android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "playPause"
      android.view.KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
      android.view.KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
      android.view.KeyEvent.KEYCODE_MEDIA_STOP -> "stop"
      android.view.KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "forward"
      android.view.KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
      android.view.KeyEvent.KEYCODE_INFO -> "info"
      android.view.KeyEvent.KEYCODE_GUIDE -> "guide"
      else -> null
    }

    /**
     * D-PAD SOL/SAĞ BİLDİRİMİ (v7.4.0)
     * Liste içindeyken sol/sağ ile menülere çıkabilmek için JS'e haber
     * veriyoruz. DİKKAT: Bu tuşları TÜKETMİYORUZ (return true yok) —
     * normal odak gezinmesi bozulmasın. JS tarafı isterse tepki verir.
     */
    if (keyCode == android.view.KeyEvent.KEYCODE_DPAD_LEFT ||
        keyCode == android.view.KeyEvent.KEYCODE_DPAD_RIGHT ||
        keyCode == android.view.KeyEvent.KEYCODE_DPAD_UP ||
        keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN) {
      try {
        val ctx2 = reactInstanceManager?.currentReactContext
        if (ctx2 != null) {
          val p2 = com.facebook.react.bridge.Arguments.createMap()
          val dirName = when (keyCode) {
            android.view.KeyEvent.KEYCODE_DPAD_LEFT -> "dpadLeft"
            android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> "dpadRight"
            android.view.KeyEvent.KEYCODE_DPAD_UP -> "dpadUp"
            else -> "dpadDown"
          }
          p2.putString("key", dirName)
          ctx2.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("KizilkanRemoteKey", p2)
        }
      } catch (e: Exception) { }
      // TÜKETMİYORUZ: super'e devrederek normal odak akışı korunur.
      return super.dispatchKeyEvent(event)
    }

    if (name != null) {
      try {
        val ctx = reactInstanceManager?.currentReactContext
        if (ctx != null) {
          val params = com.facebook.react.bridge.Arguments.createMap()
          params.putString("key", name)
          ctx.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("KizilkanRemoteKey", params)
          return true
        }
      } catch (e: Exception) {
        // Olay gönderilemezse varsayılan davranışa düş — uygulama çökmemeli.
      }
    }
    // İlgilenmediğimiz tüm tuşlar normal akışına devam eder (D-pad dahil).
    return super.dispatchKeyEvent(event)
  }
`;

const withTvRemoteKeys = (config) => {
  return withMainActivity(config, (cfg) => {
    const file = cfg.modResults;

    // Sadece Kotlin destekleniyor (Expo SDK 50+ varsayılanı).
    if (file.language !== "kt") {
      console.warn("[withTvRemoteKeys] MainActivity Kotlin değil, atlandı.");
      return cfg;
    }

    let src = file.contents;

    // 1) Zaten enjekte edilmiş mi?
    if (src.includes(MARKER)) {
      return cfg;
    }

    // 2) Zaten bir onKeyDown var mı? Varsa DOKUNMA (çakışma riski).
    if (/override\s+fun\s+dispatchKeyEvent/.test(src)) {
      console.warn("[withTvRemoteKeys] MainActivity'de dispatchKeyEvent zaten var, atlandı.");
      return cfg;
    }

    // 3) Sınıf gövdesinin SON kapanış süslü parantezini bul ve öncesine ekle.
    const lastBrace = src.lastIndexOf("}");
    if (lastBrace === -1) {
      console.warn("[withTvRemoteKeys] Beklenmeyen MainActivity yapısı, atlandı.");
      return cfg;
    }

    src = src.slice(0, lastBrace) + KOTLIN_BLOCK + "\n" + src.slice(lastBrace);
    file.contents = src;
    return cfg;
  });
};

module.exports = withTvRemoteKeys;
