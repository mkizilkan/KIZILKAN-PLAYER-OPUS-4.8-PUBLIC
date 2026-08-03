# KIZILKAN PLAYER v9.2.0 — Arama performansı

## ✅ 1) AYAR KUTUSU — EVET, DÜZELTİLDİ (v9.1.0'da)
Doğruladım: showControls artık HER CİHAZDA false ile başlıyor.
Kanal açılışında ve zap sırasında ayar kutusu ÇIKMIYOR.
Ekrana dokununca (TV'de OK ile) açılıyor, tekrar dokununca kapanıyor.

## 🔴 2) ARAMA "GEÇ TEPKİ VERİYORDU" — İKİ SEBEP

### SEBEP A: Her tuşta 40.000+ öğede bulanık arama
Listende 7.265 kanal + 27.761 film + 5.486 dizi var. Her harfte üçü birden
bulanık aramadan geçiyordu.

ÇÖZÜM — İKİ KATMAN:
  1) GECİKME: yazmayı bıraktıktan 220 ms sonra aranır (ara sonuçlar
     hesaplanmaz). Yazma akıcı kalır.
  2) ÖN ELEME: önce hızlı "içeriyor mu" süzgeciyle aday küme daraltılır
     (en fazla 400), bulanık arama YALNIZCA bu küçük kümede çalışır.
     40.000 öğe -> genelde birkaç yüz aday.

CANLI ARAMA ZATEN VARDI ve KORUNDU: yazdıkça sonuçlar süzülür.
Artık takılmadan.

### SEBEP B: Gizli içerik kontrolü dizi taramasıydı
isItemHidden ve isGroupHidden .includes() kullanıyordu — bu bir DİZİ
TARAMASIDIR. 40.000 öğeyi süzerken her öğe için baştan sona tarama
yapılıyordu (O(n×m)). Sekme değiştirmenin (Tümü/Kanallar/Diziler) geç tepki
vermesinin sebebi buydu.

ÇÖZÜM: Set kullanımı -> arama sabit zamanlı.
Bu düzeltme yalnızca aramayı değil, ANA LİSTEYİ ve FAVORİLERİ de hızlandırır.

## v9.1.0'ın işleri bu pakette
MAC/Stalker cihaz içi, User-Agent birleştirme, ayar kutusu, sütunlu arayüzün
"deneysel" işaretlenmesi.

## DOĞRULAMA
8 denetleyici TEMİZ

## TEST
1. Arama: yazarken takılma OLMAMALI, sonuçlar yazdıkça süzülmeli
2. Tümü / Kanallar / Filmler / Diziler sekmeleri HIZLI geçmeli
3. Kanal aç / zap -> ayar kutusu ÇIKMAMALI
4. MAG portalı ekle -> kanallar yüklenmeli, kanal oynamalı
