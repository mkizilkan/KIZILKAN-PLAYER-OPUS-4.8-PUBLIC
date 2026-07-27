# KIZILKAN PLAYER v4.9.0

## ⚠️ Bu build v4.8.3'ü de içerir (takılma düzeltmesi)
v4.8.3'ü kurmadıysan endişelenme: donanım hızlandırma düzeltmesi bu build'de var,
üstüne bir de AÇ/KAPA anahtarı eklendi.

## 1) Chromecast düzeltmesi — cihaz listesi artık açılıyor
İki gerçek hata vardı:
- Kendi butonumuzdan showCastDialog() çağrılıyordu; bazı cihazlarda SESSİZCE
  başarısız oluyordu (opsiyonel zincirleme yüzünden hata bile görünmüyordu).
  -> Artık Google'ın resmi NATIVE Cast butonu kullanılıyor, seçiciyi sistem açıyor.
- Diyalog açıldıktan HEMEN SONRA oturum kontrol ediliyordu; kullanıcı cihazı
  seçene kadar oturum kurulmadığı için içerik hiç gönderilmiyordu.
  -> onSessionStarted dinleyicisi eklendi: bağlanınca içerik yükleniyor.
- Eksik izinler eklendi: ACCESS_WIFI_STATE, CHANGE_WIFI_MULTICAST_STATE
  (Chromecast cihaz keşfi bunlar olmadan çalışmayabiliyor).
NOT: Chromecast cihazları ham .ts canlı yayınları çoğu zaman oynatamaz;
mp4/mkv film-dizi ve m3u8 yayınlar uyumludur. Hata olursa artık açıklama çıkıyor.

## 2) "Şununla aç" desteği (YENİ)
app.json'da intentFilters HİÇ YOKTU — bu yüzden Android'in "Şununla aç"
listesinde çıkmıyorduk. Eklendi:
- video/*, audio/*, HLS (m3u8), DASH, http/https, rtsp, rtmp
Başka bir uygulamadan video açıldığında KIZILKAN PLAYER listede çıkar ve
seçilince yayın doğrudan player'da açılır.

## 3) Oynatıcı motoru seçimi (YENİ) — IPTV Extreme'deki gibi
Player alt barında "Motor" butonu:
- Otomatik (önerilen): .ts yayınlarda VLC, diğerlerinde ExoPlayer
- VLC: en uyumlu, her codec
- ExoPlayer: hızlı, az pil
Seçim kaydedilir.
NEDEN 4 DEĞİL 2 MOTOR: IPTV Extreme'in FFPlay'i zaten FFmpeg'dir ve VLC de
içinde FFmpeg kullanır; Light Player ise Android MediaPlayer'dır (VLC'nin
altında kalır). Yani yeni native paket eklemeden aynı fayda sağlanıyor.

## 4) Donanım hızlandırma anahtarı (YENİ)
Motor menüsünde AÇIK/KAPALI. Kapatılırsa yazılım çözücü kullanılır
(donanım çözücüde bozuk görüntü/yeşil ekran yaşayan cihazlar için).
Takılma yaşarsan: önce Tampon'u 4 sn yap, düzelmezse donanımı kapatıp dene.

## 5) Liste yenileme (YENİ)
- Ana ekran başlığında "Yenile" butonu (aktif listeyi kaynağından çeker)
- Liste seçim ekranında her listenin yanında yenile butonu
Tamamen cihaz-içi, Xtream'de üç istek paralel gider.
(Stalker/MAC listeleri henüz yenilenemiyor — FAZ B2'de gelecek.)

## Test edilecekler
1. Görüntü/ses AKICI mı (v4.8.3 donanım hızlandırma düzeltmesi)
2. Chromecast: player'da cast simgesine bas -> CİHAZ LİSTESİ açılmalı
3. Başka uygulamadan bir videoya "Şununla aç" -> KIZILKAN görünmeli
4. Player > Motor -> VLC/ExoPlayer değiştir, donanımı aç/kapa
5. Ana ekranda yenile butonu, liste seçiminde yenile butonu

## NATİVE-RİSKSİZ
Yeni paket EKLENMEDİ (cast ve linking zaten kuruluydu). Sadece config + JS.
