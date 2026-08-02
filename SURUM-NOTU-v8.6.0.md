# KIZILKAN PLAYER v8.6.0

## 🔴 1) PROFİLLER BİRBİRİNİ ETKİLİYORDU — KÖK SEBEP
Ayar profile özel yapılmıştı AMA ortak (LEGACY) anahtar SİLİNMİYORDU.
Sonuç: HER PROFİL aynı eski değeri devralıyordu.
  Ahmet açar  -> LEGACY'den "columns" devralır
  Mehmet açar -> AYNI LEGACY'den yine "columns" devralır
Bu yüzden ayrı görünmüyordu.

DÜZELTME: Devralma artık TEK SEFERLİK. Devralan profil işaretleniyor ve
ortak anahtar TEMİZLENİYOR. Sonraki profiller varsayılan başlar.

(Aynı hatayı liste taşımasında yapıp v5.9.0'da düzeltmiştim; burada
tekrarlamışım. Bu sefer aynı çözümü uyguladım.)

## 🔴 2) GÜVENLİK AÇIĞI: PIN'SİZ PROFİL GEÇİŞİ
Ayarlar > profil yanındaki "değiştir" düğmesi PIN SORMADAN geçiş yapıyordu.
PIN'li profillere (yönetici dahil) doğrudan girilebiliyordu.

DÜZELTME: PIN'li profile geçiş artık PIN ekranı üzerinden yapılıyor.
PIN'siz profillerde doğrudan geçiş devam ediyor.

## ✅ 3) SOL SÜTUNDA ANA BÖLÜMLER YOKTU
CANLI KANALLAR / FİLMLER / DİZİLER sol sütunun EN ÜSTÜNE eklendi
(TiviMate'te de orada). Sayıları yanında görünüyor, seçili olan vurgulanıyor.
Üst şeritteki eski sekmeler kaldırıldı (artık gereksiz).

## ✅ 4) KONTROL PANELİ HER KANALDA AÇILIYORDU
SORUN: Her kanal açılışında ayar paneli (Exo/Ses/Altyazı/Tampon...) ekrana
geliyordu. Hızlı kanal geçişinde kullanıcı yayını değil menüyü görüyordu.

DÜZELTME:
  • TV'de KAPALI başlar (telefonda açık — dokunmatik için gerekli)
  • OK tuşu artık AÇ/KAPAT yapıyor (eskiden yalnızca açıyordu)

## DOĞRULAMA
  • 8 denetleyici -> HEPSİ TEMİZ
  • 13 mantık testi -> 13/13 GEÇTİ
    (devralma hatası, izolasyon, güvenlik, panel davranışı)

## Test
1. Ahmet: Sütunlu seç -> Mehmet'e geç -> KLASİK olmalı
2. Mehmet: Sütunlu yap -> Ahmet'e dön -> Ahmet'inki DEĞİŞMEMELİ
3. Ayarlar > PIN'li profilin "değiştir" düğmesi -> PIN İSTEMELİ
4. Sütunlu ekranda sol üstte CANLI/FİLMLER/DİZİLER görünmeli
5. Kanal aç -> ayar paneli ÇIKMAMALI, OK'a basınca açılıp kapanmalı
