# KIZILKAN PLAYER v4.8.1 — Player Motoru ADIM 2a (MOTOR BAĞLANDI)

## Bu sürümde: yeni VLC motoru GERÇEKTEN bağlandı

ADIM 1'de paketin derlendiğini doğruladık. Şimdi motoru bağladık.

### ✅ Güçlü libVLC options (codec + ağ gücü)
"Diğer player'ların açamadığını açma" hedefinin kalbi. Yeni motor şu
parametrelerle çalışıyor:
- --network-caching=1500 (ağ tamponu, donma azaltır)
- --http-reconnect + --http-continuous (kopan yayını yeniden kurar)
- --live-caching / --file-caching (canlı + dosya tamponu)
- --adaptive-maxwidth (adaptif akış uyumu)
VLC motoru HEVC, AV1, VP9 ve exotic ses/altyazı formatlarını açar.

### ✅ GERÇEK hata mesajı ([object Object] bitti)
- onEncounteredError ile anlamlı mesaj + Türkçe ipucu (403/404/timeout/http)

### ✅ Gerçek buffer göstergesi
- onBuffering ile gerçek yüzde (%100'de spinner kapanır)

### ✅ exo -> VLC otomatik geçiş korundu
- expo-video açamazsa otomatik VLC devreye girer (güçlü motor)
- play/pause/seek VLC modunda da çalışır

## NASIL TEST EDİLİR
1. Build YEŞİL mi? (native paket bağlandı)
2. IPTV Extreme'in açtığı ama eski KIZILKAN'ın AÇAMADIĞI bir kanalı dene
   -> yeni motor açmalı
3. Açılmayan bir kanalda anlamlı hata mesajı çıkmalı ([object Object] DEĞİL)
4. Kanal yüklenirken buffer spinner, açılınca kapanmalı
5. Film/dizide ileri/geri sarma (çift dokunuş) çalışmalı

## ADIM 2b'de gelecek (bu çalışırsa)
- Ses/altyazı parça seçim menüsü (parçalar zaten toplanıyor)
- Gerçek DVR video kaydı (record fonksiyonu hazır)
- Snapshot (ekran görüntüsü)
- Player içi ayarlar menüsü (IPTV Extreme gibi)

## Değişen dosyalar
- src/components/VlcPlayerView.tsx (YENİ - güçlü VLC sarmalayıcı)
- src/native/vlc.native.ts (gerçek motora bağlandı)
- app/player.tsx (yeni motor + VLC-aware play/pause/seek)
- app.json (v4.8.1)

## NOT
Motor bağlandığı için ilk kez GERÇEK VLC oynatma test edilecek.
Sorun olursa (native davranış) log/ekran görüntüsü gönder.
