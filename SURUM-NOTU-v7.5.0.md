# KIZILKAN PLAYER v7.5.0 — 7 sorunun yanıtı

## 1) ❤️ FAVORİ NASIL? — EKSİĞİMİ DÜZELTTİM
v7.4.0'da kalp düğmesini TV'de odak alamaz yaptım (odağı çalıp kanalın
açılmasını engelliyordu) AMA yerine bir yol sunmadım. Haklı olarak sordun.

ÇÖZÜM: Uzun-bas menüsüne "Favorilere ekle / Favorilerden çıkar" eklendi.
  • TV'de : kanal üzerinde OK'u BASILI TUT -> menüden favori
  • Telefonda: kalbe dokun (eskisi gibi) VEYA uzun bas
Menü favori durumuna göre metnini ve simgesini değiştirir.

## 2) EKRANA SIĞAN KANAL SAYISI (hesaplandı)
  Satır yüksekliği : 78 px  ->  66 px
  1080p TV'de sığan: 9 kanal -> 11 kanal   (+2 kanal, ~%22 artış)
Hesap: logo 44px + dolgu + kenarlık + satır arası; kullanılabilir alan
1080 - üst bar - sekme çubuğu - overscan ≈ 756 px.

## 3) YATAY ŞERİTLERDEN (kategori) ÇIKIŞ — EKLENDİ
Sadece sol/sağ değil, YUKARI/AŞAĞI tuşları da native tarafta dinleniyor.
Böylece yatay kategori şeritlerinde yukarı/aşağı ile şeritten çıkılabiliyor.
ÖNEMLİ: Bu tuşlar TÜKETİLMİYOR — normal odak gezinmesi aynen korunuyor.

## 4) CİHAZ 2 KEZ GÖRÜNÜYOR — bu bizim hatamız DEĞİL
Homatics kutusu kendini İKİ AYRI yayın alıcısı olarak duyuruyor
(yerleşik Chromecast + Google Cast alıcısı). Listeyi işletim sisteminin
yayın seçicisi oluşturuyor, uygulamamız değil — bu yüzden koddan
filtrelenemiyor. İkisi de aynı cihaza gider; hangisini seçersen çalışır.

## 5) ✅ HESAP BİLGİLERİNE "YENİLE" BUTONU EKLENDİ
Aktif bağlantı sayısı yalnızca liste eklenirken/yenilenirken alınıyordu,
bu yüzden bayat görünüyordu (haklıydın).
Artık Ayarlar > HESAP BİLGİLERİ başlığının yanında "Yenile" düğmesi var.
SADECE hesap bilgisini tazeler — kanalları yeniden indirmez, saniyeler sürer.

## 6) ✅ KAYITLAR NEREDE + DAHA DETAYLI BİLGİ
KAYIT YERİ: uygulama klasörü / recordings
Kayıt başlarken artık şunlar söyleniyor:
  • Hangi kanalın kaydedildiği
  • Nereye yazıldığı
  • Nasıl bitirileceği
  • Uygulamadan çıkılırsa kaydın duracağı
Bitince kayıt yerine nasıl ulaşılacağı açıklanıyor.
Ayrıca klasör yoksa otomatik oluşturuluyor (eskiden VLC sessizce
başarısız olabilirdi) ve KAYIT SÜRESİ bilgi panelinde canlı görünüyor.

## 7) ✅ CANLI TEKNİK BİLGİ PANELİ
Bilgi (ℹ) panelinde artık CANLI yenilenen bilgiler:
  • Durum (oynatılıyor / tamponlanıyor / duraklatıldı)
  • Motor (VLC / ExoPlayer)
  • Çözünürlük, format, süre/konum
  • Ses parçası, altyazı, hız
  • Kayıt süresi (kayıt varsa)
Panel açıkken saniyede bir yenilenir; kapalıyken zamanlayıcı durur (pil dostu).

DÜRÜST NOT — BİT HIZI (bitrate) ve FPS:
Bunları GÖSTEREMİYORUM. Kullandığımız oynatıcı kütüphanesi (expo-libvlc-player)
bu değerleri uygulamaya BİLDİRMİYOR — sağladığı olaylar yalnızca boyut, süre,
zaman, tampon ve parça bilgisi. Uydurma sayı göstermektense panelde bunu
açıkça yazdım. İleride kütüphane bu veriyi sunarsa eklenebilir.

## DOĞRULAMA
6 denetleyici TEMİZ • sözdizimi OK • native plugin OK

## Test
1. Kanal üzerinde OK BASILI TUT -> favori seçeneği çıkmalı
2. Ayarlar > Hesap Bilgileri > Yenile -> aktif bağlantı güncellenmeli
3. Player > Kaydet -> detaylı bilgi mesajı
4. Player > Bilgi -> canlı yenilenen panel
