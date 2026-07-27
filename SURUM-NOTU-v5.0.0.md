# KIZILKAN PLAYER v5.0.0 — IPTV Extreme Seviyesi

## ⚠️ TEK YENİ NATİVE PAKET: expo-intent-launcher
"Şununla Oynat" (harici oynatıcıda açma) için gerekli. Build KIRMIZI olursa
ilk şüpheli budur — o durumda package.json'dan çıkarıp tekrar denenebilir.
Diğer her şey mevcut paketlerle yapıldı.

═══════════════════════════════════════════════════════════════
## BÖLÜM A — PLAYER (ekran görüntüsü 1 ve 2)
═══════════════════════════════════════════════════════════════

### ✅ ZAMAN ÇUBUĞU (Seek Bar) — YENİ
Player'da hiç zaman çubuğu YOKTU; filmde istediğin dakikaya atlamak imkânsızdı.
- Konum / toplam süre gösterimi (1:23:45)
- Parmakla SÜRÜKLEYEREK atlama
- Canlı yayında çubuk yerine "CANLI" rozeti
- Yeni paket eklenmedi (kendi çubuğumuzu çizdik)

### ✅ TRANSPORT KONTROLLERİ — YENİ
⏮ Önceki kanal • ⏪ -10s • ⏯ Oynat/Duraklat • ⏹ Durdur • ⏩ +10s • ⏭ Sonraki kanal
- Kanal geçişi (zapping) dairesel: son kanaldan sonra başa döner
- Film/dizide kanal geçişi devre dışı (gri görünür)

### ✅ SES / ALTYAZI SEÇİMİ ARTIK GERÇEKTEN ÇALIŞIYOR
Parçalar listeleniyordu ama seçilemiyordu.
SEBEP: native Tracks kaydı eksik alanları 0'a düşürüyor; video id'si
gönderilmeden seçim yapılınca VİDEO KAPANIYORDU.
ÇÖZÜM: ses + video + altyazı id'leri BİRLİKTE gönderiliyor. Altyazı kapatma
için -1 kullanılıyor.

═══════════════════════════════════════════════════════════════
## BÖLÜM B — ZENGİN UZUN-BAS MENÜSÜ (ekran görüntüsü 3)
═══════════════════════════════════════════════════════════════
Eklenenler:
- Şununla Oynat (harici) — MX Player, VLC vb. uygulamada açar
- Tekrar Oynat (baştan)
- Yeniden Adlandır — kendi ismini ver
- Kanal Simgesi / Afiş Değiştir — kendi logo adresini ver
- Gruba Ekle / Çıkar — kendi özel gruplarını oluştur

ÖNEMLİ: Bu özelleştirmeler kanalın KALICI ID'sine bağlı saklanır. Listeyi
yenilediğinde (sağlayıcıdan tekrar çektiğinde) KAYBOLMAZ.

Menü artık: Oynat • Bilgi • EPG • Catch-up • Çoklu Ekran • Favori •
İzleme listesi • İndir • Paylaş • Şununla Oynat • Tekrar Oynat •
Yeniden Adlandır • Simge Değiştir • Grup • Gizle

═══════════════════════════════════════════════════════════════
## BÖLÜM C — KATEGORİ GEZGİNİ (ekran görüntüsü 4)
═══════════════════════════════════════════════════════════════

### ✅ TAM EKRAN KATEGORİ PANELİ — YENİ
ESKİ SORUN: Kategoriler yatay şeritti; 50+ kategoride kaydırmak çok zordu,
TV Box'ta kumandayla neredeyse imkânsızdı.

YENİ (kategori şeridinin solundaki ☰ butonu):
- Üstte bölüm sekmeleri: CANLI / FİLMLER / DİZİLER (sayılarıyla)
- Altta DİKEY, kaydırılabilir kategori listesi
- Her kategoride öğe sayısı
- Kategori ARAMA kutusu (8'den fazla kategori varsa)
- Kumanda yön tuşlarıyla gezinme (her satır focusable)
- Kendi özel grupların da listede görünür

═══════════════════════════════════════════════════════════════
## TEST EDİLECEKLER
═══════════════════════════════════════════════════════════════
1. Filmde ZAMAN ÇUBUĞU — sürükleyip istediğin dakikaya atla
2. Transport: önceki/sonraki kanal, durdur, ±10s
3. Ses/Altyazı seçimi — çok dilli bir yayında ses parçası değiştir
   (video KAPANMAMALI — eski hatanın tekrarı olmamalı)
4. Kategori şeridinin solundaki ☰ butonu -> tam ekran panel
5. Uzun bas -> Yeniden Adlandır / Simge Değiştir / Gruba Ekle
6. Uzun bas -> Şununla Oynat (MX Player vb. çıkmalı)

## Değişen/yeni dosyalar
- src/components/SeekBar.tsx (YENİ)
- src/components/CategoryPanel.tsx (YENİ)
- src/components/InputDialog.tsx (YENİ)
- src/utils/overrides.ts (YENİ)
- app/player.tsx (seek bar, transport, zapping, parça seçimi)
- app/(tabs)/index.tsx (kategori paneli, zengin menü, özelleştirmeler)
- src/components/VlcPlayerView.tsx (tracks video alanı düzeltmesi)
- package.json (expo-intent-launcher)
- app.json (v5.0.0)
