# KIZILKAN PLAYER v7.7.0 — 9 maddenin kod incelemesi

## 🔴 1) KUMANDA TUŞLARI HİÇ ÇALIŞMIYORDU — ASIL KÖK SEBEP BULUNDU

Native eklentimiz React context'e şöyle erişiyordu:
    reactInstanceManager?.currentReactContext

Bu API ESKİ MİMARİYE aittir. Projede newArchEnabled = TRUE (Yeni Mimari).
Yeni Mimari'de reactInstanceManager YOKTUR -> her zaman null -> olaylar JS'e
HİÇ GÖNDERİLMEDİ.

Bu TEK HATA şunların hepsini açıklıyor:
  • CH+/- çalışmıyor
  • Sağ/sol ile kanal değişmiyor
  • Yukarı/aşağı çalışmıyor
  • Uzun-bas geri çalışmıyor

DÜZELTME: ReactApplication üzerinden reactHost (Yeni Mimari) veya
reactNativeHost (Eski Mimari) — hangisi varsa o kullanılıyor. Her iki
mimaride de çalışır.

## ✅ 2) HESAP YENİLEME "hesap bilgisi bulunamadı" HATASI
SEBEP: Kodum `activePlaylist.xtream` nesnesini arıyordu. Böyle bir alan YOK.
Kimlik bilgisi DÜZ alanlarda: xtreamServer / xtreamUsername / xtreamPassword.
DÜZELTİLDİ.

## ✅ 3) KAYDIRMA İLE SES KONTROLÜ
Ekranın SAĞ yarısında yukarı/aşağı kaydırma sesi ayarlar (MX Player deseni).
Anlık seviye göstergesi çıkar.
DÜRÜST NOT: PARLAKLIK için expo-brightness paketi gerekiyor, projede kurulu
DEĞİL. Paket eklemek native derleme riski; şimdilik ses uygulandı.
Sol yarı parlaklık için ayrıldı — istersen ayrı adımda eklerim.

## ✅ 4-5) TV'DE ÇERÇEVE + KIRMIZI RENK + AZ KANAL — TEK SEBEP
v6.4.0'da eklediğim TvSafeArea TÜM UYGULAMAYI 24px iç boşlukla sarıyordu.
ÜÇ yan etkisi vardı:
  1. Video tam ekran olamıyordu -> kenarda ÇERÇEVE
  2. Çerçeveden tema arka planı görünüyordu -> Türk Bayrağı temasında
     (surface: #1A0205 kırmızımsı siyah) görüntü KIRMIZILAŞIYORDU
  3. Liste alanı daralıyordu -> ekrana AZ KANAL sığıyordu (9 değil 3)
KALDIRILDI. Video ve listeler artık tam alanı kullanıyor.

## ✅ 6) KAYIT YAPMIYORDU
SEBEP 1: Kaydı durdurmak için record() PARAMETRESİZ çağrılmalı
  (paket belgesi: "undefined to stop recording"). Ben ikinci kez de dizin
  geçiriyordum -> kayıt hiç durmuyordu.
SEBEP 2: Sarmalayıcıda .catch(() => {}) hataları YUTUYORDU -> başarısızlığın
  sebebi hiç görünmüyordu.
İKİSİ DE DÜZELTİLDİ. Hatalar artık ekranda görünür.
NOT: Kayıt uygulamanın kendi klasörüne yazıyor, bu yüzden depolama izni
GEREKMİYOR (verdiğin izinler zaten gerekli değildi).

## ✅ 7) KUMANDA YAVAŞLIĞI
SEBEP 1: Odak kaydırması ANİMASYONLU idi -> her tuşta ~300ms bekleme.
SEBEP 2: getItemLayout yoktu -> liste her satırı ölçmek zorundaydı.
DÜZELTME: TV'de animasyon kapatıldı + getItemLayout eklendi + batch ayarları.
Kumanda artık anında tepki vermeli.

## ✅ 8) TAMPON "YOK" SEÇENEĞİ
0 ms ve 300 ms seçenekleri eklendi (feed/canlı yayın gecikmesi için).
DÜRÜST NOT: libVLC'de tampon TAMAMEN sıfırlanamaz; 0 verilince kütüphane
kendi asgarisine (~100-200ms) düşer. Bu yüzden seçeneğin adı "Tampon yok"
değil "En düşük" — gerçekleşmeyecek bir vaat vermiyorum.

## ⏳ 9) CHROMECAST
v7.4.0'daki düzeltmeler (Promise await + contentType) bu pakette duruyor.
Kumanda sorunları çözüldüğü için artık test edilebilir.

## DOĞRULAMA
7 denetleyici TEMİZ • 6 dosya + native plugin sözdizimi OK

## Test önceliği
1. CH+/- ve SAĞ/SOL ile kanal değişimi (asıl düzeltme)
2. TV'de görüntü tam ekran mı, çerçeve/kırmızılık gitti mi
3. Ekrana kaç kanal sığıyor
4. Kumanda hızı
5. Kayıt (hata olursa artık sebebini yazacak)
