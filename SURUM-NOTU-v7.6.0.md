# KIZILKAN PLAYER v7.6.0 — Kumanda davranışı TiviMate seviyesinde

## 🔴 ÖNCE: CH+/- NEDEN ÇALIŞMIYORDU (kodda bulundu)

useRemoteKeys çağrısı satır 459'daydı AMA kullandığı fonksiyonlar AŞAĞIDA
tanımlıydı:
    zap           -> 430  ✓ hazır
    stopPlayback  -> 441  ✓ hazır
    togglePlay    -> 545  ✗ UNDEFINED
    seekBy        -> 570  ✗ UNDEFINED
    openCatchup   -> 717  ✗ UNDEFINED

JavaScript'te `const` YUKARI TAŞINMAZ (hoisting yok). Hook'umdaki try/catch
sayesinde uygulama ÇÖKMÜYOR ama tuşlar SESSİZCE ÇALIŞMIYORDU — CH+/- dahil.

DÜZELTİLDİ: useRemoteKeys artık satır 715'te, tüm bağımlılıklardan SONRA.
+ Bu hata sınıfı için 7. DENETLEYİCİ yazıldı (kullanım-önce-tanım).
  useEffect gibi geri çağırmaları ayırt ediyor -> yanlış alarm vermiyor.

## ARAŞTIRMA: TiviMate ve Android TV kılavuzu ile karşılaştırma

TiviMate'in 6 temel kısayolu ve Google'ın resmi TV navigasyon kılavuzu
incelendi. Eksiklerimizin TAMAMI bu pakette kapatıldı:

### ✅ 1. SOL/SAĞ İLE KANAL DEĞİŞTİRME (en kritik eksikti)
TiviMate'in en çok kullanılan kısayolu.
NEDEN KRİTİK: Chromecast ve Wanbo kumandalarında CH+/- TUŞU YOK.
O cihazlarda kanal değiştirmenin BAŞKA YOLU YOKTU.
KURAL: yalnızca kontroller GİZLİYKEN çalışır; kontroller açıkken sol/sağ
normal odak gezinmesi olarak kalır (düğme gezinmesi bozulmaz).

### ✅ 2. UZUN-BAS GERİ -> KANAL LİSTESİNE DÖN
TiviMate deseni: her yerden tek hamlede listeye çıkış.
Native tarafta repeatCount ile tespit ediliyor; KISA basış normal geri
davranışını (kontrolleri kapat / çık) aynen koruyor.

### ✅ 3. EPG'DE YUKARI/AŞAĞI -> 24 SAAT ATLAMA
Rehberde saatlerce yatay kaydırmak yerine tek tuşla gün değişir.
Başlıkta hangi günde olduğun yazıyor + atlarken bildirim baloncuğu çıkıyor.

### ✅ 4. OK -> KANAL ÖNİZLEME (TV'ye özel)
TV'de OK basınca doğrudan tam ekrana geçmek yerine önce kanal bilgisi +
yayın akışı (şimdi/sonra) gösteriliyor; "İzle" ile açılıyor.
Telefonda bu ara adım gereksiz olduğu için UYGULANMIYOR.

## KARŞILAŞTIRMA TABLOSU (v7.6.0 sonrası)

| Özellik                        | KIZILKAN | TiviMate      |
|--------------------------------|----------|---------------|
| Sol/sağ kanal değiştirme       | ✅       | ✅            |
| Uzun-bas OK -> favori          | ✅       | ✅            |
| Uzun-bas geri -> liste         | ✅       | ✅            |
| EPG 24 saat atlama             | ✅       | ✅            |
| Kanal önizleme                 | ✅       | ✅            |
| CH+/- tuşları                  | ✅       | ✅            |
| Medya tuşları (oynat/sar/dur)  | ✅       | ✗ (yok)       |
| DVR kaydı                      | ✅ ücretsiz | 💰 $20/yıl |
| Çoklu ekran                    | ✅ ücretsiz | 💰 Premium |
| Ekran görüntüsü                | ✅       | ✗ (yok)       |

## DOĞRULAMA
  • 7 denetleyici -> HEPSİ TEMİZ
    (yeni 7. araç bu pakette 3 eksik import da yakaladı, düzeltildi)
  • 12 mantık testi -> 12/12 GEÇTİ
  • 4 dosya + native plugin sözdizimi -> OK

## Test
1. Kanal izlerken CH+/- -> kanal değişmeli
2. Kontroller gizliyken SOL/SAĞ -> kanal değişmeli (asıl yenilik)
3. Geri tuşunu BASILI TUT -> kanal listesine dönmeli
4. TV Rehberi'nde YUKARI/AŞAĞI -> gün değişmeli
5. TV'de kanala OK -> önizleme paneli çıkmalı
