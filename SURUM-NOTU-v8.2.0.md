# KIZILKAN PLAYER v8.2.0 — Yayın senkronu (VOD/dizi)

## 🔴 "TV KAFASINA GÖRE GİDİYOR" — İKİ AYRI SEBEP VARDI

### SEBEP 1: İKİ OYNATICI AYNI ANDA ÇALIŞIYORDU
Yayın başlayınca telefondaki oynatıcı DURDURULMUYORDU.
  • Telefonda VLC/ExoPlayer oynatıyor
  • TV'de Chromecast oynatıyor
  • İkisi BİRBİRİNDEN HABERSİZ
Senkron zaten imkânsızdı; ikisi farklı yerlerde ilerliyordu.

DÜZELTME: Yayın açılınca yerel oynatma DURAKLATILIR.
Yayın kapanınca kaldığı yerden DEVAM EDER.

### SEBEP 2: TV -> TELEFON GERİ BİLDİRİMİ HİÇ YOKTU
Telefondan TV'ye komut gidiyordu ama TV'nin DURUMU telefona dönmüyordu.
TV kumandasıyla duraklatınca telefon hâlâ "oynatılıyor" gösteriyordu;
ilerleyen konum da telefona yansımıyordu.

DÜZELTME: onMediaStatusUpdated dinleniyor (paket tipinden doğrulandı):
  playerState "playing"    -> telefon "oynatılıyor" gösterir
  playerState "paused"     -> telefon "duraklatıldı" gösterir
  playerState "buffering"  -> telefon tampon göstergesi
  streamPosition           -> ilerleme çubuğu TV ile AYNI yeri gösterir

## ✅ KALDIĞI YERDEN DEVAM (yeni)
Film/diziyi yayınlarken telefondaki konumdan başlar (startTime).
  • Film 5:40'taysa TV 5:40'tan açar
  • Canlı yayında uygulanmaz (anlamsız)
  • İlk 5 saniyedeyse baştan başlar
Alan paket tipinden doğrulandı: MediaLoadRequest.startTime

## ARTIK NASIL ÇALIŞIYOR
  Telefondan oynat/duraklat  -> TV'ye gider
  Telefondan ileri/geri      -> TV'de sarar (canlıda engellenir)
  Telefondan ses             -> TV'nin sesi
  TV kumandasından değişiklik-> TELEFONA YANSIR (yeni)
  Yayın kapat                -> telefon kaldığı yerden devam eder

## DOĞRULAMA
  • 7 denetleyici -> HEPSİ TEMİZ
  • 10 mantık testi -> 10/10 GEÇTİ
  • Tüm API imzaları paket kaynağından doğrulandı

## v8.1.0'ın düzeltmeleri bu pakette
Canlı yayın streamType düzeltmesi, ses/sarma yönlendirmesi.

## Test
1. Film yayınla -> telefondaki oynatıcı DURMALI (çift ses olmamalı)
2. Telefondan duraklat -> TV duraklamalı
3. TV kumandasıyla duraklat -> TELEFON da "duraklatıldı" göstermeli
4. İlerleme çubuğu TV ile aynı yeri göstermeli
5. Filmi 5. dakikada yayınla -> TV 5. dakikadan başlamalı
6. Yayını kapat -> telefon kaldığı yerden devam etmeli
