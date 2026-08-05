# KIZILKAN PLAYER v9.6.0 Test Raporu

## Otomatik/statik kontroller
- ZIP bütünlük kontrolü
- JSON parse: `frontend/app.json`, `frontend/package.json`
- Python sözdizimi: `backend/server.py`
- TypeScript/TSX parse kontrolü
- Proje içi `tools/denetle.js` denetimi
- Göreli import hedef kontrolü
- Sürüm tutarlılığı

## Fiziksel cihazda yapılması gerekenler
Bu ortamda Android SDK/Gradle bağımlılıkları ve fiziksel TV Box bulunmadığı için APK kurulumu yapılmadı. Aşağıdakiler APK üzerinde doğrulanmalıdır:
1. İlk açılış cihaz seçimi ve kalıcı kayıt.
2. D-pad odak geçişleri ve CH+/CH−.
3. EPG verisi olan/olmayan listeler.
4. ExoPlayer → VLC fallback.
5. Oynatıcıdan çıkışta TV'nin yatay kalması.
6. 2 saat kesintisiz oynatma ve bellek davranışı.

## Bu pakette çalıştırılan sonuçlar
- JSON parse: BAŞARILI
- Python `py_compile`: BAŞARILI
- 88 TypeScript/TSX dosyası sözdizimi parse: BAŞARILI
- Göreli ve `@/` alias import hedef kontrolü: BAŞARILI
- Proje içi 8 denetim aracı: BAŞARILI
- ZIP CRC bütünlük testi: BAŞARILI
