# KIZILKAN PLAYER v4.8.0 — Player Motoru ADIM 1 (DERLEME TESTİ)

## ⚠️ BU BUILD'İN TEK AMACI
"expo-libvlc-player paketi bu projede DERLENİYOR MU?" sorusunu yanıtlamak.
Bu yüzden yeni motor HENÜZ BAĞLANMADI — sadece paket eklendi ve derleme test
ediliyor. Video oynatma şu an expo-video (exo) motoruyla çalışıyor (eskisi gibi).

## Bu adımda yapılanlar
- ESKİ paket kaldırıldı: react-native-vlc-media-player (1.0.98)
- YENİ paket eklendi: expo-libvlc-player (7.1.6)
- Config plugin eklendi (PiP + yerel ağ izni)
- pickFirst native koruma eklendi (libc++_shared.so çakışma önleme)
- VLC wrapper geçici stub (null) — VLC yolu devre dışı, exo aktif

## NASIL TEST EDİLİR
1. Build'i çalıştır (GitHub Actions)
2. SADECE ŞUNA BAK: Build YEŞİL mi KIRMIZI mı?
   - YEŞİL ✓ -> paket uyumlu, ADIM 2'ye geçeriz (motoru bağlama)
   - KIRMIZI ✗ -> derleme logunu bana gönder, çözelim
3. APK açılıyor mu, video oynuyor mu (exo ile oynamalı - eskisi gibi)

## ADIM 2'de gelecek (bu build yeşilse)
- expo-libvlc-player'ı gerçekten bağlama
- libVLC options (codec gücü - IPTV Extreme'in açamadıklarını açma)
- Gerçek hata mesajları (onEncounteredError)
- Buffer göstergesi (onBuffering)
- Ses/altyazı parça seçimi
- Gerçek DVR kaydı (record)

## Değişen dosyalar
- package.json (paket değişimi)
- app.json (plugin + pickFirst + v4.8.0)
- src/native/vlc.native.ts (geçici stub)

## ÖNEMLİ NOT
Bu build native paket değiştirdiği için, önceki build'lerden farklı olarak
derleme sorunu ÇIKMA İHTİMALİ VAR. Bu yüzden ADIM 1 olarak ayrı test ediyoruz.
Sorun çıkarsa sadece bu 3 dosyada olacağı için çözmesi kolay.
