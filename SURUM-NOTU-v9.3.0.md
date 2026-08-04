# KIZILKAN PLAYER v9.3.0 — Telefon istekleri

## ✅ 1) ALAN ARASI GEÇİŞ
Kullanıcı adı / şifre / portal / MAC girerken klavyedeki "İleri" tuşu
(TV'de kumanda OK) bir sonraki alana geçirir.
  Xtream: Sunucu -> Kullanıcı -> Şifre
  MAG   : Portal -> MAC -> Seri no
Son alanda "Bitti" görünür.

## ✅ 2) LİSTELERİN YANINDA HESAP ÖZETİ
Ayarlar > Oynatma Listeleri'nde her listenin altında:
  bitiş tarihi + kalan gün + max kullanıcı
Süresi dolmuşsa KIRMIZI "SÜRESİ DOLDU" yazar.
Xtream (saniye damgası) ve MAG (düz metin) biçimlerinin ikisi de desteklenir.

## ✅ 3) LİSTE KİLİDİ (yeni)
Her listeye ayrı PIN konabiliyor — PROFİL PIN'İNDEN BAĞIMSIZ.
Aynı profilde bazı listeler korumalı, bazıları serbest olabilir.
  • Ayarlar > liste satırındaki KİLİT simgesi -> PIN koy / değiştir / kaldır
  • Liste seçme ekranında kilitli listeye geçerken PIN sorulur
  • Ana anahtar ve kurtarma kodu burada da geçerli

## ✅ 4) AYAR KUTUSU DOKUNUNCA KAPANIYOR
Kanal açıkken ekrana dokununca panel açılıyordu ama kapatmak için kendiliğinden
kaybolmasını beklemek gerekiyordu. Artık aynı dokunuş kapatıyor da.

## DENETLEYİCİLER İŞ BAŞINDA
Bu pakette 7 GERÇEK HATA yakalandı ve derlemeden ÖNCE düzeltildi:
  • 3 eksik import (Modal, Pressable, TextInput)
  • 4 tanımsız ref (yanlış bileşene eklenmişti — bileşen adı AddPlaylist,
    ben AddPlaylistScreen sanmıştım)

## VPN DESTEĞİ HAKKINDA (sorduğun)
Bu, uygulama içinde VPN kurmak DEĞİLDİR — öyle bir şey Android'de ayrı bir
VPN servisi ve izin gerektirir, bizim kapsamımız dışında.
Kastedilen şuydu: bazı sağlayıcılar ülke kısıtlaması uyguluyor. Uygulama
hangi ülkeden bağlandığını hatırlayıp, kanal açılmadığında "bu kanal
bulunduğunuz ülkeden engellenmiş olabilir, VPN'inizi kontrol edin" gibi
AÇIKLAYICI bir uyarı gösterebilir. Ülke bilgisi için ya bir IP servisine
sorulur (IP'niz üçüncü tarafa gider) ya da kullanıcı elle seçer.
KARAR SENİN: hangisini istersin?

## v9.2.0'ın işleri bu pakette
MAC/Stalker cihaz içi, arama performansı (debounce + ön eleme + Set),
User-Agent birleştirme.

## TEST (telefon)
1. Liste ekle > Xtream/MAG -> klavye "İleri" ile alan geçişi
2. Ayarlar > listelerin altında bitiş tarihi + kullanıcı sayısı
3. Liste satırındaki kilit -> PIN koy -> liste seçmede PIN sorulmalı
4. Kanal aç > ekrana dokun (panel açılır) > tekrar dokun (KAPANMALI)
