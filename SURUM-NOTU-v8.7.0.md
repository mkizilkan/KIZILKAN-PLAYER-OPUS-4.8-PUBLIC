# KIZILKAN PLAYER v8.7.0 — Küçük eksiklerin toplandığı paket

## ✅ 1) ÖZEL GRUPLARDA SAYI 0 GÖRÜNÜYORDU
Kendi oluşturduğun gruplarda kanal olmasına rağmen yanında (0) yazıyordu.
Grup bilgisi hem override haritasında hem öğenin kendisinde bulunabiliyor;
artık İKİSİ BİRLEŞTİRİLİP tekrarsız sayılıyor.

## ✅ 2) TELEFONDA ÇOKLU EKRAN BİLDİRİM ÇUBUĞUYLA ÇAKIŞIYORDU
Güvenli alan ayarı edges={[]} idi — hiçbir kenar korunmuyordu.
Artık üst ve alt kenarlar korunuyor, yatayda tam genişlik kalıyor.

## ✅ 3) PERFORMANS: BÜYÜK LİSTELERDE KAYDIRMA
7.000+ kanallık listede her kaydırmada TÜM görünür satırlar yeniden
çiziliyordu. ChannelRow artık React.memo ile sarılı: yalnızca gerçekten
değişen satır çizilir. Senin 7265 kanallık listende belirgin fark eder.

## v8.6.0'ın düzeltmeleri bu pakette
Profil izolasyonu (tek seferlik devralma), PIN'siz profil geçişi açığı,
sol sütunda ana bölümler, kontrol panelinin TV'de kapalı başlaması.

## DOĞRULAMA
8 denetleyici TEMİZ • 3 dosya sözdizimi OK

## ════════════════════════════════════════════════════════
## KALAN İŞLER (kod-doğrulanmış envanter)
## ════════════════════════════════════════════════════════

### 🔴 ÇÖZÜLMEMİŞ SORUNLAR
1. KAYIT ÇALIŞMIYOR
   file:// düzeltmesi yapıldı ama sende hâlâ dosya oluşmuyor.
   v7.8.0'daki doğrulama artık SEBEBİ EKRANDA YAZIYOR — bir dahaki
   denemende çıkan mesajı bana ilet, kesin teşhis koyayım.

2. CHROMECAST CANLI YAYIN
   streamType düzeltmesi (v8.1.0) ve senkron (v8.2.0) yapıldı ama sende
   çalışmadı. Cihaza özel bir durum olabilir; ayrı ele alınmalı.

3. TV BOX'TA TEST EDİLEMEYENLER
   Sütunlu arayüzde kumanda, küçük ekran önizleme, TiviMate tarzı tuşlar.

### 🟠 GÜVENLİK (küçük iş, yüksek değer)
4. PIN'LER DÜZ METİN saklanıyor (pin?: string).
   SecureStore altyapısı VAR ama PIN'ler kullanmıyor.
5. Xtream şifresi de düz metin.

### 🟡 ÖZELLİK EKSİKLERİ (orta)
6. Zamanlı + EPG kayıt (başlangıç/bitiş saati, program boyunca)
7. Kanal başına Referer (UA var, Referer arayüzü yok)
8. expo-image (afiş yüklemede bellek/hız kazancı)

### 🟢 BÜYÜK İŞLER (ayrı paket)
9. MAC/Stalker cihaz-içi — hâlâ backend'e bağımlı (son emergent kalıntısı)
10. Yerel medya oynatma (video + müzik)
11. Toplu kanal sağlık taraması (ölü kanal tespiti)
12. Ülke/VPN hafızası (karar bekliyor: IP servisi mi, manuel mi)

## ÖNERİM
Sıradaki turda 4+5 (PIN güvenliği) ve 7 (Referer) küçük ve risksiz —
tek pakette yapılabilir. 9 (Stalker) tek başına bir paket olmalı.
