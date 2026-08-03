# KIZILKAN PLAYER v8.8.0 — Test geri bildiriminin karşılığı

## 🔴 25) TV ARAYÜZÜ SEÇİLEMİYORDU (en kritik)
Seçim listesinde kumanda yukarı/aşağı çalışmıyordu -> sütunlu arayüze
GEÇİLEMİYORDU.
SEBEP: Modal'ın arka plan Pressable'ları odağı yakalıyordu ve ilk seçenekte
otomatik odak yoktu.
DÜZELTME: Arka plan katmanları focusable={false}, ilk seçenek otomatik odakta.

## 🔴 30) ODAK HER KANALDA BİRAZ DAHA DIŞARI ÇIKIYORDU
SEBEP: Listede ListHeaderComponent (kategori şeridi) var ama getItemLayout
yalnızca SATIRLARI hesaplıyordu — başlık yüksekliği sayılmıyordu.
Her satırda kayma birikiyor, sonunda odak tamamen dışarı taşıyordu.
DÜZELTME: getItemLayout KALDIRILDI. FlatList kendi ölçümünü yapıyor.

## ✅ 32) GEZİNME AĞIR ÇEKİM + AFİŞLER YAVAŞ
Afiş ızgarasında aynı anda çizilen kart sayısı düşürüldü
(initialNumToRender 12->6, windowSize 7->3, batch sınırı eklendi).
TV Box GPU'ları onlarca büyük görseli aynı anda kaldıramıyordu.

## ✅ 36) UZUN BASTAN SONRA KANAL AÇILIYORDU
OK'u basılı tutunca menü çıkıyor, eli çekince kanal da açılıyordu.
Android TV'de tuş bırakılınca onPress de tetikleniyor.
DÜZELTME: Uzun bas işaretleniyor; sonraki 800 ms içindeki basış yok sayılıyor.

## ✅ 40) OK TUŞU PANELİ KAPATMIYORDU
Odak katmanı YALNIZCA kontroller kapalıyken render ediliyordu; panel açıkken
OK'a basacak öğe kalmıyordu.
DÜZELTME: Katman her zaman var; açıkken paneli kapatıyor.

## ✅ 41) KISA GERİ BASIŞI LİSTEYE ATIYORDU
repeatCount güvenilir değilmiş — bazı kumandalar kısa basışta bile
tekrar gönderiyor.
DÜZELTME: Artık BASILI KALMA SÜRESİ ölçülüyor (700 ms üzeri = uzun bas).

## ✅ 47) ÜST KISIMDA TEMA RENGİNDE ŞERİT
Stack'in varsayılan arka planı tema rengiydi; video yüklenene kadar
üstte şerit görünüyordu (Türk Bayrağı temasında kırmızı).
DÜZELTME: Oynatıcı ekranının arka planı SİYAH sabitlendi.

## ✅ 12) KAYIT DÜĞMESİ KAYBOLMUŞTU + KAYITLAR GÖRÜNMÜYORDU
• Düğme yalnızca VLC motorundayken gösteriliyordu -> ExoPlayer'dayken
  "kayboldu" sanılıyordu. ARTIK HER ZAMAN GÖRÜNÜR; ExoPlayer'daysa sebebi
  açıklanıp VLC'ye geçmesi öneriliyor.
• Kayıtlar İNDİRİLENLER ekranında listelenmiyordu. Artık kayıt klasörü
  taranıp gösteriliyor: dosya adı, boyut, dokununca oynat, çöp kutusuyla sil.

KAYIT ZATEN ÇALIŞIYOR (senin mesajın bunu doğruladı):
  /data/user/0/com.kizilkan.player/files/recordings/vlc-record-...ts (6.7 MB)
Sorun dosyanın OLUŞMAMASI değil, GÖRÜNMEMESİYDİ. Artık görünüyor.

## DENETLEYİCİLER İŞ BAŞINDA
Bu pakette 8 denetleyici, indirilenler ekranındaki İKİ EKSİK IMPORT'u
(useState, useEffect) derlemeden ÖNCE yakaladı.

## ⏳ BU PAKETTE ÇÖZÜLMEYENLER (dürüstlük)
• 20) Chromecast canlı yayın — hâlâ görüntü yok
• 21-24) Cast kontrolleri ve TV'de oynatma düğmeleri
• 34) Ekrana sığan kanal sayısı (30'un düzelmesiyle iyileşebilir, ölçülmeli)
• 27/43-46) Sütunlu arayüz — 25 düzeldiği için artık TEST EDİLEBİLİR

## TEST
1. Ayarlar > TV Arayüzü -> kumandayla SEÇEBİLMELİSİN (25)
2. "Sütunlu" seç -> Canlı TV -> üç sütunlu ekran (27)
3. Kanal listesinde aşağı in -> odak İÇERİDE kalmalı (30)
4. Uzun bas -> menü çıkmalı, el çekince KANAL AÇILMAMALI (36)
5. Geri tuşuna KISA bas -> listeye ATMAMALI (41)
6. Kanal aç -> üstte renkli şerit OLMAMALI (47)
7. Ayarlar > İndirilenler -> KAYITLAR görünmeli (12)
