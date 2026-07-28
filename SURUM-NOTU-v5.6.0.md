# KIZILKAN PLAYER v5.6.0 — Senin 6 maddenin tamamı

## 1) ✅ Maymuncuk artık ekranda GÖRÜNMÜYOR
PIN kaydedilince çıkan pencerede ana anahtar yazıyordu — kaldırıldı.
Sadece kurtarma kodu gösteriliyor. Ana anahtar SESSİZCE çalışmaya devam ediyor.

## 2) ✅ İkinci profil oluştururken PIN alanı eklendi
"Kim izliyor?" ekranında artık PIN kutusu var (4-10 rakam, isteğe bağlı).
Boş bırakılırsa kilit olmaz.

## 3) ✅ Mevcut profile sonradan PIN konulabiliyor
Ayarlar > Aile Planı > her profilin yanında KİLİT simgesi:
  • PIN yoksa  -> PIN koy
  • PIN varsa  -> değiştir VEYA kaldır
  • Kaldırıp sonra tekrar koyabilirsin
PIN koyunca kurtarma kodu gösterilir.

## 4) ✅ KİLİT ile GİZLEME artık doğru çalışıyor
v5.5.0'da kilidi yanlışlıkla "gizleme" gibi davrandırmıştım. Düzeltildi:

  KİLİT   : Kategori LİSTEDE GÖRÜNÜR, açmak için PIN ister.
            (Hem kategoriye girerken hem kanalı açarken sorar.)
  GİZLEME : Kategori listede HİÇ görünmez.
  İKİSİ   : Gizli kalır; Gizli İçerikler'den PIN ile açılınca kilit devreye girer.

Çocuk profilinde kilitli kategoriler PIN ile bile açılamaz (tam koruma).

## 5) ✅ IPTV hesap bilgileri genişletildi
SUNUCUDAN OTOMATİK (Xtream standardı):
  • Desteklenen yayın formatları (allowed_output_formats)
  • Panel mesajı / duyuru (message)
  • SAĞLAYICININ GÖNDERDİĞİ EK BİLGİLER — panelin gönderdiği tüm özel alanlar
    artık atılmıyor, olduğu gibi listeleniyor. Bazı paneller APK linki, destek
    bağlantısı gibi alanları buradan gönderir; varsa görünecek.

DÜRÜST NOT: APK indirme linki, Telegram/WhatsApp ve oynatıcı listesi Xtream
standardında YOKTUR. Panel gönderiyorsa "Ek Bilgiler" bölümünde çıkar.
Göndermiyorsa uygulama uyduramaz — bu bilgiyi sağlayıcı ayrıca bildirir.

## 6) ✅ Player seçenekleri ORTA IZGARA oldu (IPTV Extreme Pro yerleşimi)
ESKİ: 12 seçenek yatay şeritte; sağdakiler ekran dışında kalıyordu (Motor
butonunu bu yüzden bulamamıştın).
YENİ: Ekranın ORTASINDA ızgara — hepsi tek bakışta görünür:
  Motor • Ses • Altyazı • Sığdır • Hız
  Senkron • Süreye Git • Tampon • Uyku • Bilgi • Catch-up • Yenile
TV'de kumandayla gezilebilir, odaklanan düğme belirginleşir.

## Test
1. PIN kaydet -> pencerede maymuncuk YAZMAMALI
2. Yeni profil -> PIN alanı olmalı
3. Ayarlar > profil yanındaki kilit -> PIN koy/kaldır
4. Kategori KİLİTLE -> listede GÖRÜNMELİ ama açarken PIN sormalı
5. Kategori GİZLE -> listede GÖRÜNMEMELİ
6. Ayarlar > Hesap Bilgileri -> formatlar + panel mesajı
7. Player -> ortada ızgara menü
