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
  // React Native bu tuşları JS'e iletmez; burada yakalayıp olay olarak gönderiyoruz.
  override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
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
    return super.onKeyDown(keyCode, event)
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
    if (/override\s+fun\s+onKeyDown/.test(src)) {
      console.warn("[withTvRemoteKeys] MainActivity'de onKeyDown zaten var, atlandı.");
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
