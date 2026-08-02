# KIZILKAN PLAYER v8.3.0

## 🔴 TV ARAYÜZÜ NEDEN HİÇ GÖRÜNMEDİ — KÖK SEBEP

Yeni sütunlu ekrana YALNIZCA playlist-select üzerinden yönlendirme vardı.
Sen Ayarlar'dan "Sütunlu" seçtiğinde SEKME ÇUBUĞU İÇİNDE kalıyorsun ve o
ekrana HİÇ UĞRAMIYORSUN -> yeni arayüzü görmen imkânsızdı.

Yani ekran vardı, kod vardı, ama ULAŞILAMIYORDU. Benim tasarım hatam.

DÜZELTME: Yönlendirme yerine KOŞULLU RENDER.
Ana ekranın kendisi ayara bakıp doğrudan sütunlu içeriği gösteriyor.
Ayarı değiştirir değiştirmez etkili oluyor.

### EK GÜVENLİK: React hook kuralı
Koşullu "return" bir bileşenin içinde yapılırsa aşağıdaki hook'lar çağrılmaz
ve React ÇÖKER ("Rendered fewer hooks than expected").
Bu yüzden seçim, HİÇ HOOK KULLANMAYAN ayrı bir sarmalayıcıda yapılıyor.
Denetimle doğrulandı: sarmalayıcıda 0 hook.

## 🔴 TV'DE ODAK EKRAN DIŞINA TAŞIYORDU — KÖK SEBEP
EPG bilgisi olan satırlar daha UZUNDU, ama getItemLayout SABİT yükseklik
varsayıyordu. Hesap tutmayınca odak-takipli kaydırma yanlış yere gidiyor ve
seçili satır ekran dışında kalıyordu.

DÜZELTME: TV'de satır yüksekliği SABİTLENDİ (EPG olsun olmasın 52px).
getItemLayout değeri gerçek ölçüye eşitlendi (56 = 52 + 4 boşluk).

## 🔴 KAYIT: "kaydedildi" DİYORDU AMA DOSYA YOKTU
Artık kayıt bitince dosya GERÇEKTEN kontrol ediliyor:
  • Dosya var ve boyutu > 0  -> "Kayıt tamamlandı ✓ (12.4 MB)" + tam yol
  • Dosya yok/boş           -> "Kayıt dosyası oluşmadı" + beklenen yer
  • Yol hiç bildirilmedi    -> "Kayıt HİÇ BAŞLAMADI" + olası sebepler
Artık sessizce yalan söylemiyor.

DÜRÜST NOT: Kayıt yalnızca VLC motorunda çalışır (ExoPlayer kayıt yapamaz).
Kayıt hiç başlamıyorsa motoru VLC'ye almayı deneyin.

## DOĞRULAMA
7 denetleyici TEMİZ • hook kuralı doğrulandı • 4 dosya sözdizimi OK

## TEST ÖNCELİĞİ
1. Ayarlar > TV Arayüzü > "Sütunlu" -> ANA EKRANA DÖN
   -> Üç sütunlu ekran GELMELİ (asıl düzeltme)
2. TV'de kanal listesinde aşağı in -> odak EKRAN İÇİNDE kalmalı
3. Kaydet -> bitirince GERÇEK sonuç (başarılı/başarısız + sebep)

## HENÜZ ÇÖZÜLMEYENLER (dürüstlük)
• Grup sayılarının 0 görünmesi — sayım kodu doğru görünüyor, daha derin
  inceleme gerekiyor (override kimlik eşleşmesi şüpheli)
• Chromecast canlı yayın — v8.1/8.2 düzeltmeleri sende çalışmadı,
  cihaza özel bir durum olabilir; ayrı ele alınmalı
• Telefon 2/4 ekran bildirim çubuğuyla çakışması
