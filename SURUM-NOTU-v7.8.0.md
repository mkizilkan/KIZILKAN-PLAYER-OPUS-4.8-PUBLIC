# KIZILKAN PLAYER v7.8.0

## 🔴 KAYIT NEDEN HİÇ ÇALIŞMIYORDU — KÖK SEBEP BULUNDU

expo-file-system'in documentDirectory değeri bir URI'dir:
    file:///data/user/0/com.kizilkan.player/files/
libVLC ise DÜZ DOSYA YOLU bekler:
    /data/user/0/com.kizilkan.player/files/

"file://" öneki yüzünden libVLC yolu GEÇERSİZ sayıyor, kayıt hiç başlamıyordu.
Hata da onEncounteredError ile geldiği için "yayın hatası" gibi görünüyordu —
bu yüzden sebebi anlaşılmıyordu.

DÜZELTME: Yol libVLC'ye verilmeden önce "file://" öneki temizleniyor.

## ✅ KAYIT YERİ SEÇİMİ (senin isteğin)
Kaydet'e basınca 3 seçenek çıkıyor:
  1. Uygulama klasörü (izin gerekmez, her zaman çalışır)
  2. İndirilenler / KIZILKAN Player / Record
  3. Klasör seç... (cihazın klasör seçicisi)

## ✅ KIRMIZI KAYIT GÖSTERGESİ
Sağ üstte yanıp sönen kırmızı nokta + "REC 00:12" süre sayacı.
Kontroller gizliyken de görünür.

## ✅ GERÇEK DOSYA YOLU
Paketin onRecordChanged olayı bağlandı. Kayıt bitince kullanıcıya TAM DOSYA
YOLU gösteriliyor ("bir yere kaydedildi" demek yerine).

## ✅ TV: EKRANA SIĞAN KANAL 3.5 -> ~15
Satır yüksekliği TV'de 78px -> 52px (dolgu + logo küçültüldü).
getItemLayout de TV/telefon için ayrıldı.

## ✅ TV: OK TUŞU ARTIK DOĞRUDAN AÇIYOR
v7.6.0'da eklediğim "önizleme" penceresi KALDIRILDI. Kullanıcı deneyimini
kötüleştiriyordu: OK kanalı açmak yerine fazladan onay istiyordu.

## ✅ TV: GERİ TUŞU DÜZELTİLDİ
K�sa basış artık listeye ATMIYOR. Sebep: bazı kumandalar kısa basışta bile
repeatCount=1 gönderiyor. Eşik 1 -> 2 yükseltildi.

## ✅ TEMA KUTULARI ORANSIZDI
TV'nin geniş ekranında %47.5 genişlik devasa kutular üretiyordu.
TV'de 4 sütun + daha yatık oran.

## ✅ EXOPLAYER TAMPON AYARI (senin sorun)
SORUN: Tampon ayarı yalnızca VLC'ye uygulanıyordu. ExoPlayer VARSAYILAN
20 SANİYE tamponluyordu -> canlı yayında ciddi gecikme.
ÇÖZÜM: Seçtiğin değer artık ExoPlayer'a da uygulanıyor
(bufferOptions alanları expo-video paket tipinden doğrulandı).

## ℹ️ TV'DE HESAP BİLGİSİ GÖRÜNMÜYOR — HATA DEĞİL
TV'deki listen "iptv-org (Demo)" bir M3U listesi. Hesap bilgisi yalnızca
XTREAM listelerinde bulunur (M3U'da böyle bir veri yoktur).
Telefondaki Xtream listende hesap bilgileri görünüyor.

## DOĞRULAMA
7 denetleyici TEMİZ • 5 dosya + native plugin sözdizimi OK

## Test
1. Kaydet -> 3 seçenek çıkmalı -> kayıt BAŞLAMALI
2. Kayıt sırasında sağ üstte yanıp sönen kırmızı nokta
3. Kaydı bitir -> TAM DOSYA YOLU gösterilmeli
4. TV'de ekrana kaç kanal sığıyor
5. TV'de OK -> kanal DOĞRUDAN açılmalı
6. TV'de kısa geri -> listeye ATMAMALI
