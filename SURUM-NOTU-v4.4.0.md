# KIZILKAN PLAYER v4.4.0 — Sürüm Notu

## Bu sürümde düzelenler / eklenenler

### ✅ Liste kalıcılığı (Bölüm 0) — CİHAZDA TEST EDİLDİ
- Liste artık dosya sistemine kaydediliyor (2MB AsyncStorage limiti aşıldı)
- Her açılışta onboarding gelmiyor, liste duruyor
- Eski veri otomatik migrate ediliyor

### ✅ Favori çoklu-seçim bug'ı düzeltildi
- ESKİ: TRT2 seçince HD/SD/4K hepsi favoriye ekleniyordu (aynı tvg-id)
- YENİ: ID artık tvg-id + url'den türetiliyor -> her varyant ayrı, tek tek seçilir
- Aynı kanal hâlâ kalıcı (favoriler kaybolmaz)

### ✅ Emergent logosu kaldırıldı -> KIZILKAN ikonu
- icon.png, adaptive-icon.png, favicon.png = KIZILKAN hilal+yıldız (kırmızı)
- Açılıştaki mavi "e" (emergent) simgesi gitti

### ✅ Ana menüde Favoriler sekmesi
- "Kütüphane" -> "Favoriler" (kalp ikonu), favoriler öne çıktı
- Kütüphaneye girince varsayılan Favoriler sekmesi açılıyor
- Devam Et / İzleyeceğim / Son alt sekmeleri korundu

### ✅ Hızlı yükleme (IPTV Extreme gibi)
- Kanallar + Filmler + Diziler ARTIK PARALEL yükleniyor (~3x hız)
- ESKİ: sırayla (kanallar bitmeden filmler başlamıyordu)

### ✅ Xtream portal otomatik algılama
- M3U alanına get.php/player_api.php linki yapıştırılırsa algılanıyor
- Kullanıcıya soruluyor: "Xtream olarak mı ekleyelim?"
- Evet derse kategoriler + EPG + hesap bilgisi ile zengin yükleme

### ✅ Sunucu bilgileri görünür oldu
- Ayarlar -> Hesap Bilgileri -> SUNUCU BİLGİLERİ bölümü eklendi
- Sunucu, port, protokol, saat dilimi, sürüm gösteriliyor

### ✅ Sürüm dinamikleşti
- "Sürüm 4.0.0 Ultimate" -> app.json'dan otomatik (artık 4.4.0)

## Bu sürümde OLMAYAN (bir sonraki: v4.5.0)
- Player motoru değişimi (expo-libvlc-player) — codec gücü, gerçek hata mesajı
  Bu ayrı ve dikkatli test edilecek (native paket değişimi riskli)

## KRİTİK: Kurmadan önce eski uygulamayı KALDIR
Paket adı com.kizilkan.player. Yeni ikon için temiz kurulum gerekir.

## Değişen dosyalar (12)
- src/store/PlaylistContext.tsx (v2.0.0 - dosya depolama)
- src/utils/iptv.ts (kalıcı ID + Xtream algılama)
- src/types/index.ts (ServerInfo tipi)
- src/utils/storage/bigStore.* (4 yeni dosya)
- app/add-playlist.tsx (paralel yükleme + Xtream algılama)
- app/(tabs)/_layout.tsx (Favoriler sekmesi)
- app/(tabs)/favorites.tsx (varsayılan Favoriler)
- app/(tabs)/settings.tsx (server_info + dinamik sürüm)
- assets/images/icon.png, adaptive-icon.png, favicon.png (KIZILKAN ikon)
- app.json (v4.4.0)
