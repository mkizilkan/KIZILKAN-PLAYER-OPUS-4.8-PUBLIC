# KIZILKAN PLAYER v5.8.0 — Catch-up düzeltmesi

## ✅ GERÇEK BİR HATA BULUNDU: Catch-up hiç çalışmıyordu

Sunucudan çekilen verileri denetlerken ortaya çıktı:
  • Channel tipinde `tv_archive` TANIMLI
  • player.tsx ve uzun-bas menüsü bu alanı KONTROL EDİYOR
  • AMA sunucudan HİÇ ALINMIYORDU (eşlemede yoktu)

Sonuç: `tv_archive` her zaman undefined -> `=== 1` kontrolü hep false ->
Catch-up düğmesi HİÇBİR kanalda görünmüyordu. (Test edememenin sebebi buydu.)

DÜZELTME: Artık alınıyor:
  • tv_archive           (geriye dönük izleme var mı)
  • tv_archive_duration  (kaç gün geriye gidilebilir)
  • num                  (sağlayıcının kanal numarası)

Catch-up'ı destekleyen kanallarda artık:
  - Player'da "Catch-up" düğmesi
  - Uzun-bas menüsünde "Geriye Dönük İzle"
görünecek.

## Bu sürüm v5.7.0'ı da içerir
Profil izolasyonu, donma düzeltmesi, her girişte PIN, ızgara konumu.

## Test
1. Catch-up destekleyen bir kanal aç -> "Catch-up" düğmesi görünmeli
2. (v5.7.0) Listen duruyor mu, profiller ayrı mı, yeni profil donmuyor mu
