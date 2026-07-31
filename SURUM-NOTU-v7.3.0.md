# KIZILKAN PLAYER v7.3.0 — TV + Player + İçerik

## A) TV DENEYİMİ — yarım kalanlar tamamlandı

### Odak-takipli kaydırma TÜM listelerde
Eskiden yalnızca ana kanal listesinde vardı. Artık:
  • Ana kanal listesi        (v7.2.0'da eklenmişti)
  • AFİŞ IZGARASI            (film/dizi) — YENİ
  • KATEGORİ PANELİ          — YENİ
Odaklanan öğe ekranın ORTASINA getirilir; hem üstünü hem altını görürsün.

### Kategori panelinde ilk odak (PDF Bulgu 8)
Panel açılınca ilk kategori otomatik odakta. Fork'a geçtiğimiz için
hasTVPreferredFocus artık gerçekten çalışıyor.

### Kategori satırlarına satır odak stili
Kategoriler de tam genişlik satır olduğu için 10px sol şerit + dolgu
(kanal listesindeki ile aynı, tutarlı görünüm).

## B) PLAYER — altyapı vardı, arayüz eklendi

### ⭐ MOTOR HAFIZASI (günlük kullanımda en çok fark eden özellik)
SORUN: "Otomatik" modda her açılışta aynı deneme-yanılma:
ExoPlayer dene -> olmadı -> VLC'ye düş. Her seferinde 3-5 saniye bekleme.

ÇÖZÜM: Kanal 2.5 saniye sorunsuz oynadıysa, çalışan motor kaydedilir.
Aynı kanal tekrar açıldığında DOĞRUDAN o motorla başlar — bekleme biter.
Kanal başına tutulur; elle motor seçtiysen ona saygı duyulur.

### DVR KAYDI
VLC record() hazırdı, arayüzü yoktu. Izgara menüsünde "Kaydet" düğmesi.
Tekrar basınca kayıt biter. (Yalnızca VLC motorunda; ExoPlayer kayıt yapamaz.)

### EKRAN GÖRÜNTÜSÜ
snapshot() hazırdı, arayüzü yoktu. "Görüntü Al" düğmesi.

### KANAL BAŞINA USER-AGENT
Bazı yayınlar belirli bir User-Agent olmadan açılmıyor ("başka oynatıcıda
çalışıyor ama burada çalışmıyor" durumunun sık sebebi). Artık kanal başına
özel UA tanımlanabiliyor; tanımlı değilse varsayılan kullanılır.

## C) İÇERİK ZENGİNLEŞTİRME — sunucudan geliyordu, alınmıyordu

Artık alınan ve gösterilen alanlar:
  • youtube_trailer  -> FRAGMAN düğmesi (YouTube'da açılır)
  • backdrop_path    -> gerçek geniş ARKA PLAN görseli
                        (eskiden afişin bulanık kopyası kullanılıyordu)
  • duration         -> SÜRE (eskiden yalnızca detay çağrısı dönerse görünüyordu)
  • age              -> YAŞ SINIRI rozeti (kırmızı, ebeveyn kontrolü için değerli)
  • country          -> ÜLKE
  • added, release_date -> ileride "yeni eklenenler" sıralaması için

Film ve dizi tarafının ikisinde de.

## DOĞRULAMA (bu pakette yapılanlar)
  • 4 denetleyici: tanımsız sembol / fonksiyon çağrısı / context value / bayat kapanış -> HEPSİ TEMİZ
  • Nokta-import denetimi -> TEMİZ
  • 21 özelliğin her biri kodda TEK TEK doğrulandı -> hepsi yerinde
  • 13 mantık testi (motor hafızası, UA, fragman, kaydırma, arka plan) -> 13/13 GEÇTİ
  • 13 dosyanın sözdizimi -> HEPSİ OK
  • 2 native plugin sözdizimi -> OK

## Test
1. TV: afiş ızgarasında gez -> odak ekranda kalmalı, afiş büyümeli
2. TV: kategori paneli aç -> ilk kategori odakta olmalı
3. Aynı kanalı iki kez aç -> İKİNCİSİ HIZLI açılmalı (motor hafızası)
4. Player > ızgara > Kaydet -> kayıt başlamalı (VLC motorunda)
5. Film detayı -> fragman düğmesi, yaş sınırı, süre, geniş arka plan
