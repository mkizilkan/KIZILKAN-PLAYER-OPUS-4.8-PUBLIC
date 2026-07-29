# KIZILKAN PLAYER v6.4.0 — TV Box (A+B+C)

## A) ✅ KUMANDA ODAĞI ARTIK HER YERDE
SORUN: Odak göstergesi SADECE liste bileşenlerine (kanal satırı, afiş
ızgarası) eklenmişti. Liste ekleme, ayarlar, arama, detay, istatistik gibi
EKRANLARIN kendi düğmeleri kapsam dışındaydı -> kumandayla gezerken nerede
olduğun belli olmuyordu.

ÇÖZÜM: Evrensel "FocusButton" bileşeni yazıldı ve 13 ekranda 116 DÜĞMEYE
uygulandı:
  add-playlist, onboarding, playlist-select, settings, ana ekran, arama,
  favoriler, detay, istatistik, tanılama, profil seçme, PIN ekranları

ODAK GÖSTERGESİ GÜÇLENDİRİLDİ (2-3 metreden net):
  • 4 px kalın marka renginde çerçeve
  • Hafif marka rengi dolgu
  • Güçlü parlama (glow)
  • %8 büyüme

## A2) ✅ AFİŞ BÜYÜTMESİ (hatırladığın özellik)
Film/dizi afişleri odaklanınca %16 büyür + güçlü parlama.
"Hangi afişteyim" sorusu tereddütsüz yanıtlanır.

## A3) ✅ EKRAN DIŞINA TAŞMA (overscan)
Menüler ve içerik TV'de ekran dışında kalıyordu. Tüm uygulama tek noktadan
(TvSafeArea) güvenli alana çekildi. Telefonda hiçbir etkisi yok.

## A4) ✅ UZUN-BAS MENÜSÜ TV'DE ÇALIŞIYOR (kontrol edildi)
Kumandada OK tuşunu basılı tutmak uzun-bas tetikler; açılan menü de
kumandayla gezilebiliyor (her satır odaklanabilir, ilk satır otomatik odakta).

## B) ✅ CHROMECAST DÜZELTİLDİ
SORUN: TV'ye gönderince sadece Chromecast logosu geliyordu, görüntü/ses yoktu;
telefonda "Medya seçilmedi" yazıyordu.

SEBEP: Chromecast SINIRLI format destekler.
  DESTEKLER   : MP4 (H.264/AAC), WebM, HLS (.m3u8), DASH
  DESTEKLEMEZ : ham MPEG-TS (.ts), MKV, AVI
Kod .ts için "video/mp2t", .mkv için "video/x-matroska" gönderiyordu.
Cihaz reddediyordu.

ÇÖZÜM:
  • CANLI KANALLAR: adres .ts -> .m3u8 (HLS) çevriliyor -> ARTIK ÇALIŞIR
  • MP4 filmler: zaten çalışıyordu
  • MKV filmler: Chromecast DONANIMSAL olarak oynatamaz. Artık sessizce
    başarısız olmuyor, net açıklama gösteriyor.

## C) ⚠️ CH+/- KUMANDA TUŞLARI (NATIVE — RİSKLİ ADIM)
Yeni config plugin: plugins/withTvRemoteKeys.js
MainActivity.kt dosyasına onKeyDown enjekte eder; yakalanan tuşları JS'e
gönderir. Player'da bağlandı:
  CH+ / MEDIA_NEXT      -> sonraki kanal
  CH- / MEDIA_PREVIOUS  -> önceki kanal
  PLAY/PAUSE            -> oynat/duraklat
  STOP                  -> durdur
  FF / REW              -> +30sn / -30sn
  INFO                  -> yayın bilgisi
  GUIDE                 -> catch-up

GÜVENLİK ÖNLEMLERİ (build kırılmasın diye):
  • Enjeksiyon imza ile kontrol edilir, ASLA iki kez yapılmaz
  • MainActivity'de zaten onKeyDown varsa DOKUNULMAZ
  • Kotlin değilse veya yapı beklenmedikse SESSİZCE ATLANIR
  • Native tarafta try/catch — olay gönderilemezse varsayılana düşer
5 uç durum izole test edildi, hepsi doğru davrandı.

## BUILD KIRMIZI OLURSA
İlk şüpheli C adımıdır. app.json içindeki "./plugins/withTvRemoteKeys"
satırını silmek yeterlidir; A ve B etkilenmez.

## 4 DENETLEYİCİ — HEPSİ TEMİZ
1. Tanımsız sembol  2. Tanımsız fonksiyon çağrısı
3. Context value    4. Bayat kapanış

## Test (TV Box)
1. Kumandayla gez -> HER EKRANDA nerede olduğun BELLİ olmalı
2. Film/dizi afişlerinde odaklanınca AFİŞ BÜYÜMELİ
3. Menüler ekran dışına TAŞMAMALI
4. Kanal listesinde OK'u BASILI TUT -> uzun-bas menüsü, kumandayla gezilebilmeli
5. CH+ / CH- -> kanal değişmeli (Homatics/Fire TV)
6. Chromecast: CANLI kanal gönder -> görüntü GELMELİ
7. Chromecast: MKV film gönder -> net uyarı mesajı çıkmalı
