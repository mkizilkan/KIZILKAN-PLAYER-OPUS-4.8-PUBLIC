# GPT KIZILKAN Player v10.6.1 — Ortak Release Signing

Claude ve GPT aynı repository üzerinde geliştirme yaptığı için APK kimliği iki
şeyle sabitlenmiştir:

1. Android package: `com.kizilkan.player`
2. Ortak release sertifikası SHA-256:
   `91:C8:40:EF:9A:2D:22:99:6E:9A:54:7D:1F:8C:61:E2:95:D1:17:C0:D7:F6:F1:CE:5D:65:CC:86:27:8D:8B:C3`

GitHub → Repository → Settings → Secrets and variables → Actions altında:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

tanımlanmalıdır.

PRIVATE `.jks` dosyası veya şifreler repository'ye commit EDİLMEZ.

Workflow release build öncesinde keystore fingerprint'ini, APK build sonrasında
package ID + versionCode + APK imzasını doğrular. Yanlış key ile build Release'e
çıkamaz.

Ayrıca workflow bir önceki commit'in `frontend/app.json` versionCode değeri ile
yenisini karşılaştırır. Yeni versionCode eski değerden büyük değilse build
durdurulur. Böylece Claude/GPT arasında sürüm numarası çakışması engellenir.
