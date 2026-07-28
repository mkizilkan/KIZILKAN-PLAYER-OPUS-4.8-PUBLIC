# KIZILKAN PLAYER v5.5.0 — Performans + Güvenlik

## A) PERFORMANS: dokunmalara geç tepki sorunu ÇÖZÜLDÜ
K�K SEBEP: Kategori sayımı her kategori için TÜM listeyi tarıyordu.
  22.963 kanal x ~100 kategori = 2.296.300 işlem — hem de her değişimde.
ÇÖZÜM: Tek geçişte sayaç haritası -> 23.063 işlem.
  ~100 KAT daha hızlı. Profil açılışı ve dokunma tepkileri normale dönmeli.

## B) GÜVENLİK: kilit/gizleme artık gerçekten çalışıyor

### ✅ Kilitli içerik PIN sormuyordu
SEBEP: Uzun-bas menüsündeki "Oynat" PIN kontrolünü ATLIYORDU — doğrudan
player'a gidiyordu. Artık korumalı yoldan geçiyor.

### ✅ Kilitli kategori listede görünüyordu
SEBEP: Kilit yalnızca ÇOCUK profilinde gizliyordu. Artık kilitli kategori
oturumda PIN ile açılmadıkça HER profilde gizli. Çocuk profilinde PIN ile
bile açılamaz.

### ✅ Kategori GİZLEME arayüzü eklendi (daha önce hiç yoktu)
Ayarlar > Ebeveyn Kontrolü > "Kategorileri gizle"
Gizlenen kategori listede HİÇ görünmez; Gizli İçerikler ekranından PIN ile açılır.

Artık üçü de bağımsız:
  Kategoriler          : kilitlenebilir ve/veya gizlenebilir
  Kanal/film/dizi      : kilitlenebilir (kategori üzerinden) ve/veya gizlenebilir
  Özel gruplar         : kilitlenebilir ve/veya gizlenebilir (v5.1.0'dan)

## C) PIN SİSTEMİ

### ✅ 4-10 rakam
Eskiden 4 haneye sabitti. Artık en az 4, en fazla 10 rakam.

### ✅ ANA ANAHTAR (maymuncuk): 4224422442
Senin isteğin. Profil, içerik ve ebeveyn PIN'lerinin HEPSİNİ açar.
UYARI: Bu kod uygulamaya gömülüdür; APK'yı inceleyen bulabilir.

### ✅ KURTARMA KODU (ek güvence)
PIN oluşturduğunda uygulama sana cihaza özel 10 haneli bir kod verir ve
"not al" der. Ana anahtardan farkı: sadece sende olur, gömülü değildir.
Her iki yol da tüm PIN ekranlarında çalışır.

## D) ARAYÜZ

### ✅ Klavye giriş kutusunu kapatıyordu
Dikey modda "Süreye Git" kutusu klavyenin altında kalıyordu. Panel artık
klavyenin üstüne kayıyor.

### ✅ İstatistik/geçmiş silme
İstatistikler ekranının sağ üstünde çöp kutusu. İzleme süresi, devam edenler
ve son izlenenler sıfırlanır. Favoriler, izleme listesi ve gruplar SİLİNMEZ.

### ✅ Chromecast etiketi düzeltildi
"YAKINDA" -> "AKTİF" (cast v4.9.0'dan beri çalışıyor)

## HENÜZ YAPILMADI (sıradaki)
- Player alt seçeneklerinin IPTV Extreme gibi ORTA IZGARA olarak yerleşimi
  (bu, player arayüzünün yeniden düzenlenmesi — ayrı ve dikkatli iş)
- Profil PIN'ini ayarlardan ekleme/kaldırma arayüzü
  (şu an profil oluştururken konuluyor; ana anahtar/kurtarma ile açılabiliyor)

## Test
1. Uygulama HIZLI mı (profil açılışı, dokunmalar)
2. Kategori kilitle -> listede GÖRÜNMEMELİ; uzun-bas Oynat da PIN sormalı
3. Ayarlar > Kategorileri gizle -> gizlenen kategori kaybolmalı
4. PIN oluştur -> KURTARMA KODU çıkmalı (not al)
5. PIN ekranında 4224422442 dene -> açmalı
6. Süreye Git -> klavye kutuyu kapatmamalı
7. İstatistikler > çöp kutusu -> sıfırlanmalı
