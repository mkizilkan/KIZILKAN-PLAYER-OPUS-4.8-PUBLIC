# KIZILKAN PLAYER v7.3.1 — ÇÖKME DÜZELTMESİ

## Hata: "Property 'autoFocusOnTv' doesn't exist"

### SEBEP (benim hatam)
v7.3.0'da kategori paneline "ilk odak" eklerken, hasTVPreferredFocus satırı
YANLIŞ YERE gitti: CategoryRow bileşeninin İÇİNE değil, panelin sekme
düğmesine yazıldı. Orada autoFocusOnTv değişkeni TANIMLI DEĞİL -> çökme.

### ASIL İRONİ
CategoryRow'da ZATEN doğru mekanizma vardı:
    hasTVPreferredFocus={first}
Yani eklediğim prop hem gereksizdi hem de hatalıydı. Kaldırıldı; mevcut
'first' mekanizması kullanılıyor (ilk kategori odakta).

## YENİ DENETLEYİCİ (6. araç) — bu boşluğu kapatıyor

Mevcut 5 denetleyicim bunu GÖREMİYORDU:
  • Tanımsız sembol      -> sadece useXxx() ve JSX BİLEŞEN adları
  • Fonksiyon çağrısı    -> sadece foo() biçimi
  • Context value        -> sadece provider value nesnesi
  • Bayat kapanış        -> sadece useCallback bağımlılıkları
  • Nokta-import         -> sadece Alert. gibi kullanımlar

Hiçbiri JSX PROP DEĞERLERİNE bakmıyordu. autoFocusOnTv bir prop değeriydi.

YENİ: "JSX Prop Değişken Denetleyicisi"
prop={degisken} biçimindeki TÜM JSX niteliklerini tarar; o kapsamda tanımlı
olmayan değişkenleri bulur.

DOĞRULAMA: Denetleyiciyi bu hatanın birebir kopyasıyla test ettim —
yakaladı. Sonra tüm projeyi taradı: TEMİZ.

## ARTIK 6 DENETİM (hepsi bu pakette TEMİZ)
1. Tanımsız sembol (hook/JSX bileşen)
2. Tanımsız fonksiyon çağrısı
3. Tanımsız context value
4. Bayat kapanış (stale closure)
5. Tanımsız JSX prop değişkeni   <-- YENİ
6. Eksik nokta-import

## v7.3.0'ın TÜM özellikleri bu pakette
TV odak tamamlama, motor hafızası, DVR kaydı, ekran görüntüsü,
kanal başına UA, fragman, yaş sınırı, süre, arka plan görseli.

## Test
1. Uygulama AÇILMALI (çökme olmamalı)
2. Kategori paneli aç -> ilk kategori odakta
3. Aynı kanalı iki kez aç -> ikincisi HIZLI (motor hafızası)
4. Film detayı -> fragman, yaş sınırı, süre, geniş arka plan
