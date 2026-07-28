# KIZILKAN PLAYER v5.3.0

## YENİ: "Süreye Git / Atla" (film ve diziler için)
Player alt barında yeni "Süreye Git" butonu (sadece film/dizide görünür,
canlı yayında gizli).

### 1) Tam süreye git
Kutuya yazıp "Git": "1:23:45" (sa:dk:sn) veya "23:45" (dk:sn) veya "90" (sn)
- Geçersiz girdi reddedilir (video bozulmaz)
- Videodan uzun süre reddedilir

### 2) Hızlı atla
−10dk  −5dk  −1dk  +1dk  +5dk  +10dk
(Çift dokunuşla gelen ±10 sn'ye ek olarak, uzun filmlerde büyük sıçramalar)

### 3) Filmin neresi (yüzde)
%10  %25  %50  %75  %90 — süre biliniyorsa görünür

Her üçü de İKİ MOTORDA da çalışır (VLC ve ExoPlayer).
TV Box'ta tüm düğmeler kumanda ile gezilebilir.

## (v5.2.0'dan gelenler)
TV Box kumanda desteği (odak göstergesi her yerde, player'da D-pad, iki
aşamalı geri tuşu, TV modu ayarı, overscan), ilk açılışta profil oluşturma,
ses senkronu (A/V).

## Test
1. Bir film aç → alt barda "Süreye Git"
2. "1:00:00" yaz → Git → o dakikaya atlamalı
3. Hızlı atla: +5 dk / −10 dk
4. Yüzde: %50 → filmin ortası
5. Canlı kanalda bu buton GÖRÜNMEMELİ

## Değişen dosyalar
- app/player.tsx (Süreye Git arayüzü + zaman ayrıştırma)
- app.json (v5.3.0)
