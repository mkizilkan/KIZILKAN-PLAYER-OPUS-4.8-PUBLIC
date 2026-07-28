# KIZILKAN PLAYER v5.7.0 — Profil İzolasyonu (KRİTİK)

## 1) ✅ Yeni profil oluştururken DONMA — kök sebep bulundu
SEBEP (benim hatam): PIN, profil oluşturulduktan SONRA ayrı bir çağrıyla
veriliyordu. O çağrı kendi kapanışındaki (closure) ESKİ profil listesini
kullandığı için yeni profili bulamıyor ve ESKİ LİSTEYİ GERİ YAZIYORDU
-> yeni profil siliniyor, ekran dönüp duruyordu.

ÇÖZÜM: PIN artık profil oluşturulurken ATOMİK olarak veriliyor (tek işlem).
Ayrıca setPin'e koruma eklendi: profil listede yoksa hiçbir şey yazmıyor.

## 2) ✅ HER PROFİLİN LİSTESİ KENDİNE ÖZEL (senin isteğin)
SEBEP: Oynatma listeleri ORTAK bir anahtarda saklanıyordu; tüm profiller aynı
listeyi paylaşıyordu. "Test" profiline girince önceki profilin kanalları
görünmesinin sebebi buydu.

ÇÖZÜM: Depolama anahtarları artık profil kimliğini içeriyor:
  kizilkan.playlists.meta.<profil-id>
  kizilkan.activePlaylistId.<profil-id>
Profil değişince listeler yeniden yükleniyor ve önceki profilin listesi
ekranda kalmıyor.

VERİ KAYBI YOK: İlk açılışta mevcut (ortak) listeler o anki profile TAŞINIYOR.
22.963 kanallık listen kaybolmayacak.

## 3) ✅ Profilde şifre varsa HER GİRİŞTE soruluyor
SEBEP: "zaten aktif profil" kontrolü vardı; uygulamayı kapatıp açan biri
doğrudan içeri girebiliyordu.
ÇÖZÜM: Koşul kaldırıldı. PIN'li profile her girişte PIN sorulur.

## 4) ✅ Izgara menü çakışması düzeltildi
Izgara tam ekran ortasına hizalanıyordu ve zaman çubuğu + transport
düğmeleriyle üst üste biniyordu. Artık IPTV Extreme Pro'daki gibi ÜST-ORTA
bölgede (ekranın üst %55'i içinde) duruyor; alt kontroller serbest.

## Test
1. Yeni profil oluştur (PIN vererek) -> DONMAMALI, profil oluşmalı
2. Profiller arası geçiş -> her profil KENDİ listesini görmeli
3. Mevcut listen (22.963 kanal) KAYBOLMAMALI (ilk profile taşınır)
4. PIN'li profile gir -> HER SEFERİNDE PIN sormalı
5. Player -> ızgara ile alt kontroller ÇAKIŞMAMALI

## NOT
Yeni profil oluşturduğunda o profil BOŞ başlar (kendi listesini eklersin).
Bu, istediğin davranış: "Her profilin linkleri içerikleri kendine özeldir."
