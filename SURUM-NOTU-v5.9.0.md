# KIZILKAN PLAYER v5.9.0 — Donma + Karışma + Çakışma

## 1) ✅ DONMA — asıl kök sebep şimdi bulundu
v5.7.0'da setPin'i düzelttim ama AYNI HATA switchProfile'da da varmış:

    if (!profiles.some(p => p.id === id)) return;   // <-- BAYAT LİSTE

addProfile'dan hemen sonra çağrıldığında bu `profiles` dizisi YENİ PROFİLİ
HENÜZ İÇERMİYOR -> switchProfile SESSİZCE geri dönüyor -> profil değişmiyor,
ekran dönüp duruyor.

ÇÖZÜM: Bu hata sınıfı KÖKTEN kapatıldı. Artık her zaman güncel listeyi tutan
bir `ref` var; addProfile, switchProfile ve setPin onu kullanıyor.

## 2) ✅ LİSTELER PROFİLLERLE KARIŞIYORDU — sebep taşımaydı
v5.7.0'da ortak listeyi profile taşırken ortak anahtarı BİLEREK silmemiştim
("başka profiller de devralsın" diye). Bu YANLIŞTI: her yeni profil aynı
listeyi devralıyordu.

ÇÖZÜM: Taşıma artık TEK SEFERLİK ve TEK PROFİLE:
  • Bir bayrak konuyor (hangi profile taşındı)
  • Ortak anahtarlar temizleniyor
  • Sonraki profiller BOŞ başlıyor (senin istediğin davranış)

Mevcut listen ilk profile taşınır, kaybolmaz.

## 3) ✅ IZGARA ÇAKIŞMASI — sebep yanlış yerleşimdi
Izgara alt kontrol çubuğunun İÇİNDE duruyordu; "top: 0" alt bara göre
hesaplandığı için zaman çubuğu ve düğmelerin üstüne biniyordu.
ÇÖZÜM: Izgara ekran seviyesine taşındı; artık ekranın ÜST %55'inde duruyor,
alt kontroller tamamen serbest.

## Bu sürüm v5.8.0'ı da içerir (Catch-up düzeltmesi)

## Test
1. Yeni profil + PIN -> DONMAMALI
2. Uygulamadan çık-gir, profil değiştir -> listeler KARIŞMAMALI
   (İlk profil mevcut listeyi görür; yeni profiller BOŞ başlar)
3. Player -> ızgara ile alt kontroller ÇAKIŞMAMALI
4. Catch-up düğmesi (destekleyen kanalda)

## TV KUMANDA CH+/- HAKKINDA
Bunu bu pakete KOYMADIM — bilerek. MainActivity'ye native Kotlin kodu
enjekte etmeyi gerektiriyor ve build'i komple riske atabilir. VLC motorunda
yaptığımız gibi AYRI ve İZOLE bir adım olarak yapılmalı (önce sadece o,
derleniyor mu diye). Şu an öncelik yukarıdaki üç kritik hatanın çalışması.
