# KIZILKAN PLAYER v9.0.0 — TiviMate düzeni (senin tarifine göre)

## YENİ SÜTUNLU ARAYÜZ — 4 SÜTUN

  ┌──────────┬──────────────┬─────────────┬──────────┐
  │ SÜTUN 1  │  SÜTUN 2     │  SÜTUN 3    │ SÜTUN 4  │
  │  %25     │   %25        │   %25       │  %25     │
  ├──────────┼──────────────┼─────────────┼──────────┤
  │ ANA      │ IPTV         │ ÖNİZLEME    │ EPG      │
  │ BÖLÜMLER │ LİSTELERİ    │ (küçük ekran)│ (kanal   │
  │          │   ↓ akordiyon │             │ karşılık-│
  │ Canlı    │ KATEGORİLER  │ + KANALLAR  │ ları)    │
  │ Filmler  │              │             │          │
  │ Diziler  │              │             │          │
  └──────────┴──────────────┴─────────────┴──────────┘

VOD / DİZİ modunda: SÜTUN 3 ve 4 BİRLEŞİK -> afiş ızgarası (4 sütunlu)

## ÖLÇÜ DOĞRULAMASI (dp cinsinden, bu sefer doğru)
  1080p TV = 960 x 540 dp
  Her sütun %25 -> 240 dp genişlik
  Önizleme 16:9 -> 240 x 135 dp
  Kanal listesine kalan: 365 dp -> 44 dp satırla **8 kanal**

## AKORDİYON DAVRANIŞI (tarif ettiğin gibi)
Sütun 2'de IPTV listeleri alt alta. Bir listeye tıklayınca ALTINDA o listenin
kategorileri açılıyor. O liste bitince diğer listenin adı geliyor.
Sol sütundan "Diziler" seçtiysen, listelerin altında dizi kategorileri;
"Canlı" seçtiysen kanal kategorileri çıkıyor.

## EPG SÜTUNU
Cihaz-içi EPG önbelleğinden okunuyor (getNowNext) — ağ çağrısı YOK,
bu yüzden kumanda gezinmesini yavaşlatmaz. Seçili kanalın satırı vurgulanıyor.

## v8.9.x DÜZELTMELERİ BU PAKETTE
• dp hesabı düzeltmesi (satır 53 dp, üst kısım ve sekme çubuğu kompakt)
• Kaydırma çakışması giderildi (react-native-tvos #296 bulgusu)
• Odak yakalayıcı geri alma, sonsuz döngü (çökme), siyah taban katmanı
• Uzun bas 1500 ms, EPG geri getirme

## DOĞRULAMA
8 denetleyici TEMİZ

## TEST
1. Ayarlar > TV Arayüzü > "Sütunlu"
2. Sol sütun: Canlı / Filmler / Diziler
3. 2. sütun: liste adına bas -> ALTINDA kategoriler açılmalı
4. Kategori seç -> 3. sütunda kanallar, üstte küçük ekran
5. 4. sütunda EPG bilgileri
6. Filmler'e geç -> 3+4 birleşip AFİŞ IZGARASI olmalı
