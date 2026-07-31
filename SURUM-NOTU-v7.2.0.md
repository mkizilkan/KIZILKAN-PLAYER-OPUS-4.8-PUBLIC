# KIZILKAN PLAYER v7.2.0 — Teşhis edilen 5 sorunun düzeltmesi

## 1a) ✅ PLAYER'DA ODAK GÖRÜNMÜYORDU — sebep: player'ı ATLAMIŞIM
13 ekranı FocusButton'a çevirmiştim ama app/player.tsx listede YOKTU.
Orada 21 ham TouchableOpacity kalmıştı.

Bu, senin 4 ve 5 numaralı ekran görüntülerindeki farkı tam açıklıyor:
  Resim 4 (ızgara menü)  -> GridBtn kendi odak kodunu taşıyor  -> GÖRÜNÜYORDU
  Resim 5 (transport)    -> ham TouchableOpacity                -> GÖRÜNMÜYORDU

DÜZELTİLDİ: 21 düğmenin tamamı dönüştürüldü (geri, cast, döndür, favori,
±10s, oynat/duraklat, önceki/sonraki kanal, durdur, tekrar dene, kanal testi).

## 1b) ✅ ODAK EKRAN DIŞINA KAÇIYORDU (1-2-3 nolu resimler)
SEBEP: Hiçbir listede odak-takipli kaydırma yoktu. Android odağı bir alt
satıra taşıyor ama LİSTE KAYDIRMIYORDU -> öğe ekran altında kalıyor,
"odak kayboldu" gibi görünüyordu. Aslında oradaydı.

DÜZELTİLDİ: useFocusScroll — odaklanan öğe listeyi kaydırıp EKRANIN ORTASINA
getiriyor. Böylece hem üstünü hem altını görüyorsun, sınırda kalma hissi yok.
Ölçüm hatalarına karşı onScrollToIndexFailed geri dönüşü de var.

## 2) ✅ CH+/- ÇALIŞMIYORDU — yöntem değişti
SEBEP (tahminim doğru çıktı): Eklentimiz "MainActivity'de zaten onKeyDown
varsa DOKUNMA" davranışındaydı (build kırılmasın diye). Fork'un MainActivity'si
kendi işleyicisini içerdiği için enjeksiyon ATLANIYORDU.

ÇÖZÜM: onKeyDown yerine dispatchKeyEvent kullanılıyor. Bu, olay zincirinin
EN BAŞINDA çalışır ve fork'un kendi işleyicisiyle ÇAKIŞMAZ — ilgilenmediğimiz
tuşlar (D-pad dahil) normal akışına devam eder.

## 3) ✅ CHROMECAST — KÖK SEBEP BULUNDU (tek satırlık hata)
    const current = sm?.getCurrentCastSession?.();   // PROMISE döndürür!
    if (current) { loadInto(current); }              // Promise hep "truthy"

Paket tipinden doğrulandı: getCurrentCastSession(): Promise<CastSession|null>

Kod Promise'i oturum sanıyordu -> session.client UNDEFINED -> loadInto sessizce
return ediyordu -> HİÇ MEDYA YÜKLENMİYORDU.
Bu yüzden TV'de sadece logo, telefonda "Medya seçilmedi" çıkıyordu.

DÜZELTİLDİ: await eklendi. Ayrıca hatalar artık YUTULMUYOR — sorun olursa
sebebi ekranda yazıyor (eskiden sessizdi, teşhis imkânsızdı).

NOT: Senin ekran görüntündeki yayın zaten M3U8'di; yani sorun formatta değil,
oturumun hiç kurulamamasındaydı.

## 5) ✅ AKTİF BAĞLANTI "YANLIŞ" GÖRÜNÜYORDU — haklıydın
active_cons yalnızca xtreamLogin anında alınıyor, o da sadece liste
eklerken/yenilerken çağrılıyor. Yani gördüğün değer CANLI DEĞİL, anlık görüntü.
Etiket "Aktif Bağlantı (son yenilemede)" olarak netleştirildi.

## 4) ✅ HESAP BİLGİLERİ — eksik olan özellik eklendi
Panelin göndermediği bilgileri uygulama uyduramaz (Xtream standardında APK
linki/Telegram ALANI YOK). Bu yüzden ÖNCEKİ PAKETLERDEN EKSİK KALAN özelliği
ekledim:

  SAĞLAYICI BİLGİLERİM (kullanıcının kendi girdiği)
  • APK / Güncelleme linki      • Web sitesi
  • Telegram                     • WhatsApp
  • İzin verilen oynatıcılar     • Yasaklı oynatıcılar
  • Notlar / Duyurular

Ayarlar > Hesap Bilgileri > kalem simgesi. Listeye kaydedilir, liste
yenilendiğinde KAYBOLMAZ.

## ⭐ ODAK GÖSTERGESİ YENİDEN TASARLANDI (senin isteğin)
HEDEF: 2-3 metreden, GÜNDÜZ aydınlıkta veya GECE karanlıkta, arka planda
hangi renk olursa olsun odak ANINDA görünsün.

SORUN: Tek renk çerçeve yetersizdi. Kırmızı çerçeve parlak bir video karesinde
kayboluyordu; koyu çerçeve karanlıkta kayboluyordu.

ÇÖZÜM — ÜÇ KATMANLI GÖRÜNÜRLÜK:
  1. Kalın marka çerçevesi (4-5 px)      -> kimlik ve yön
  2. Güçlü dış parlama/gölge              -> PARLAK arka planlarda ayırır
  3. Açık iç dolgu                        -> KARANLIK arka planlarda öne çıkarır
  + Belirgin büyüme                       -> hareket gözü anında çeker

ÜÇ AYRI STİL (her öğe tipine uygun):
  • Düğmeler : %10 büyüme + 4px çerçeve + dolgu + parlama
  • AFİŞLER  : %18 büyüme + 5px çerçeve + güçlü parlama (en belirgin)
  • SATIRLAR : 10px SOL ŞERİT + dolgu + %3 büyüme
    (Satırlar zaten geniş; büyütmek taşmaya yol açar. Sol şerit Netflix ve
     TiviMate'in kullandığı, gözün en hızlı yakaladığı desendir.)

## 4 DENETLEYİCİ — HEPSİ TEMİZ
Tanımsız sembol • Tanımsız fonksiyon çağrısı • Context value • Bayat kapanış

## Test
1. TV: kanal listesinde aşağı in -> odak EKRAN İÇİNDE kalmalı (ortalanmalı)
2. TV: player'da transport tuşları -> ODAK GÖRÜNMELİ (eskiden yoktu)
3. Afişlerde belirgin büyüme
4. CH+/- ile kanal değişimi
5. Chromecast: canlı kanal gönder -> GÖRÜNTÜ GELMELİ
6. Ayarlar > Hesap Bilgileri > kalem -> sağlayıcı bilgilerini kaydet
