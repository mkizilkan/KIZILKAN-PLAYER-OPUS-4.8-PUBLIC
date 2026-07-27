# KIZILKAN PLAYER v4.8.2 — VLC Motoru Kritik Düzeltmeler

## KÖK SEBEP BULUNDU: tek bir hata, üç belirti

Paketin Android kaynak kodunu inceledim (Tracks.kt / LibVlcPlayerView.kt):

    class Tracks(audio: Int = 0, video: Int = 0, subtitle: Int = 0)
    audioTrack?.let { selectTrack(it, Audio) }   -> player.setAudioTrack(0)
    videoTrack?.let { selectTrack(it, Video) }   -> player.setVideoTrack(0)

v4.8.1'de `tracks={{audio: undefined, subtitle: undefined}}` gönderiyordum.
JS'ten gelen undefined alanlar Kotlin'de 0'a düşüyor ve native taraf
setAudioTrack(0) / setVideoTrack(0) çağırıyor. libVLC'de 0 diye bir track
ID'si YOKTUR. Sonuç:
  - SES YOK (audio track devre dışı kaldı)
  - SİYAH EKRAN / oynatma hatası (video track devre dışı kaldı)
  - Etkileşimde çökme

### ✅ Düzeltme 1 (KRİTİK): tracks prop kaldırıldı
Artık gönderilmiyor. Ayrıca bileşene kalıcı koruma eklendi: kısmi tracks
objesi ASLA native'e geçmiyor (safeTracks).

### ✅ Düzeltme 2: exo motoru tam serbest bırakılıyor
VLC'ye geçerken sadece pause yetmiyordu; expo-video player ses odağını
tutmaya devam ediyordu (sessiz oynatma sebebi). Artık kaynak boşaltılıyor.

### ✅ Düzeltme 3: .ts yayınlarda doğrudan VLC
ExoPlayer HTTP .ts canlı yayınları açamıyor. Önce exo denenip hata verip
sonra VLC'ye düşülüyordu. Artık .ts kaynaklar baştan VLC ile açılıyor
(daha hızlı açılış, hata ekranı yok).

### ✅ Düzeltme 4: Anlamlı hata mesajı
"VLC: Player encountered an error" -> Türkçe, sebep listeli, eyleme dönük
mesaj (403 bağlantı sınırı, 404 liste eski, sunucu yanıt vermiyor vb).

### ✅ Düzeltme 5: Seek çökme koruması
Canlı/sarılamayan yayında seek çağrısı yapılmıyor (isSeekable kontrolü,
onFirstPlay'den geliyor) + try/catch. Film/dizide sarma çalışır.

### ✅ Düzeltme 6: "Tekrar Dene" VLC modunda çalışıyor
Önceden exo'yu yeniden başlatıyordu (VLC modunda etkisizdi).

## Test edilecekler
1. Kanalda SES geliyor mu (asıl bug)
2. TRT HABER / TR BİLGİ gibi .ts kanallar açılıyor mu
3. Film/dizide ileri/geri sarma çalışıyor, UYGULAMA ÇÖKMÜYOR
4. Açılmayan kanalda Türkçe anlamlı hata mesajı
5. Eskiden açılmayan bir kanal şimdi açılıyor mu

## Değişen dosyalar
- app/player.tsx (tracks kaldırıldı, exo release, .ts->VLC, hata, seek, retry)
- src/components/VlcPlayerView.tsx (safeTracks koruması, seekable)
- app.json (v4.8.2)
