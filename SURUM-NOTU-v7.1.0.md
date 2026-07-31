# KIZILKAN PLAYER v7.1.0

## CH+/- DURUMU: YAPILDI ✅ (v6.4.0'da eklenmişti, fork geçişinde korundu)
Doğrulandı:
  • plugins/withTvRemoteKeys.js         VAR (MainActivity'ye onKeyDown enjekte eder)
  • app.json plugin kaydı               KAYITLI
  • src/hooks/useRemoteKeys.ts          VAR
  • app/player.tsx bağlantısı           VAR
  • Tuşlar: CH+ / CH- / oynat-duraklat / durdur / ileri / geri / bilgi / rehber

⚠️ DÜRÜST NOT: Fork'a geçtiğimiz için react-native-tvos'un MainActivity'sinde
zaten bir onKeyDown olabilir. Eklentimiz çakışma riskine karşı BİLEREK "zaten
varsa dokunma" davranışında. O durumda CH+/- çalışmaz ama BUILD DE KIRILMAZ.
Test edip söylersen, çakışma varsa farklı yöntemle (dispatchKeyEvent) ekleriz.

## ✅ TEMA ARTIK PROFİLE ÖZEL (senin bildirdiğin hata)
SORUN: Bir profil temayı değiştirince TÜM profillerin teması değişiyordu.
SEBEP: Tema tek ortak anahtarda saklanıyordu ('kizilkan.theme'), profil
kimliği yoktu.

ÇÖZÜM:
  • Anahtar artık profil kimliğini içeriyor: kizilkan.theme.<profil-id>
  • Profil değişince o profilin teması otomatik yüklenir
  • ESKİ TERCİH KAYBOLMAZ: ortak anahtardaki tema, kaydı olmayan profile
    tek seferlik devredilir

YAPISAL DEĞİŞİKLİK: ProfileProvider artık ThemeProvider'ın DIŞINDA
(tema, aktif profili bilmek zorunda). ProfileContext temayı kullanmadığı
için bu sıra değişimi güvenli.

7 senaryo izole test edildi (devralma, profile özel değişim, yeni profil) — hepsi geçti.

## v7.0.0'dan gelenler (bu pakette)
react-native-tvos fork geçişi, TV odak altyapısı, PDF bulguları düzeltmeleri,
Chromecast MKV düzeltmesi, CH+/- kumanda tuşları.

## ⚠️ BUILD KIRMIZI OLURSA — GERİ ALMA
package.json:  "react-native": "npm:react-native-tvos@0.81.5-2"  ->  "0.81.5"
               "@react-native-tvos/config-tv" satırını SİL
app.json:      plugins'ten ["@react-native-tvos/config-tv", ...] SİL

## Test
1. TELEFON: uygulama açılıyor mu, simge duruyor mu (fork geçişi sonrası KRİTİK)
2. TV BOX: kumandayla gez -> ODAK GÖRÜNÜYOR MU (asıl sınav)
3. Profil A'da temayı değiştir -> Profil B'nin teması DEĞİŞMEMELİ
4. CH+/- ile kanal değiştirme
