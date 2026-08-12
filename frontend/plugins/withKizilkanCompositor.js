/**
 * KIZILKAN PLAYER — Android compositor refresh native bridge
 * Sürüm: v1.0.0 (KIZILKAN Player v9.16.0)
 *
 * Homatics Box R 4K+ gerçek cihaz bulgusu:
 * - player'a kanal listesinden ilk girişte tema renginde tint/üst şerit,
 * - gerçek zap veya RN Modal paneli aç/kapatınca anında düzelme,
 * - SurfaceView/TextureView, Exo shutter, black cover ve source rebind tek
 *   başına çözmedi.
 *
 * Bu plugin Expo prebuild --clean sonrasında küçük bir Android NativeModule
 * üretir ve MainApplication'a idempotent olarak kaydeder. Modül stream/player
 * API'sine dokunmaz; yalnız Activity decor/root view traversal/composition
 * yenilemesi ister ve görünmez 1x1 View'i bir frame attach/detach ederek
 * ViewRootImpl'e gerçek bir hierarchy traversal tetikler.
 */

const { withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "com.kizilkan.player";

function kotlinDir(projectRoot) {
  return path.join(projectRoot, "android", "app", "src", "main", "java", ...PACKAGE.split("."));
}

const MODULE = `package ${PACKAGE}

import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KizilkanCompositorModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "KizilkanCompositor"

  @ReactMethod
  fun refreshPlayerWindow(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }

    activity.runOnUiThread {
      try {
        val window = activity.window
        val decor = window.decorView
        val root = decor.rootView

        // Player penceresinin altında tema rengi görünmesin.
        window.setBackgroundDrawableResource(android.R.color.black)
        decor.setBackgroundColor(Color.BLACK)

        decor.requestLayout()
        root.requestLayout()
        decor.invalidate()
        root.invalidate()
        decor.postInvalidateOnAnimation()
        root.postInvalidateOnAnimation()

        // Modal aç/kapatın yaptığı hierarchy traversal'ın görünmez ve
        // pencere oluşturmayan karşılığı: decor'a sıfır-alpha 1x1 child ekle,
        // sonraki frame kaldır. Video source/decoder'a dokunmaz.
        val host = decor as? ViewGroup
        if (host != null) {
          val pulse = View(activity).apply {
            alpha = 0f
            setBackgroundColor(Color.TRANSPARENT)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
          }
          host.addView(pulse, ViewGroup.LayoutParams(1, 1))
          host.requestLayout()
          host.postOnAnimation {
            try {
              host.removeView(pulse)
              host.requestLayout()
              host.invalidate()
              host.postInvalidateOnAnimation()
            } finally {
              promise.resolve(true)
            }
          }
        } else {
          promise.resolve(true)
        }
      } catch (_: Throwable) {
        promise.resolve(false)
      }
    }
  }
}
`;

const PKG = `package ${PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KizilkanCompositorPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(KizilkanCompositorModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

module.exports = function withKizilkanCompositor(config) {
  config = withDangerousMod(config, ["android", async (cfg) => {
    const dir = kotlinDir(cfg.modRequest.projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "KizilkanCompositorModule.kt"), MODULE);
    fs.writeFileSync(path.join(dir, "KizilkanCompositorPackage.kt"), PKG);
    return cfg;
  }]);

  config = withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (!src.includes("KizilkanCompositorPackage")) {
      // Expo/RN Kotlin template: packages = PackageList(this).packages.apply { ... }
      // Expo SDK 54 Kotlin template:
      // override fun getPackages(): List<ReactPackage> =
      //   PackageList(this).packages.apply { ... }
      // Bazı RN şablonlarında başında "packages =" olabilir; yalnız ortak ve
      // kararlı kısmı eşleştirerek iki biçimi de destekliyoruz.
      const applyPattern = /(PackageList\(this\)\.packages\.apply\s*\{)/;
      if (applyPattern.test(src)) {
        src = src.replace(
          applyPattern,
          `$1\n              add(KizilkanCompositorPackage()) // KIZILKAN v9.16.0 compositor refresh`
        );
      } else {
        throw new Error("KIZILKAN: MainApplication packages apply bloğu bulunamadı; native paket güvenli kaydedilemedi.");
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
};
