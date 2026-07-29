# KIZILKAN PLAYER v6.1.0 — Yönetici Profili (Seçenek C)

## SENİN SORUNUN: Ali PIN kilitli, Veli nasıl Mert profili oluşturur?

Çözüm: YÖNETİCİ (ana profil) sistemi.

### İlk profil = Yönetici
İlk oluşturulan profil otomatik YÖNETİCİ olur. Ayarlar'da "YÖNETİCİ" rozetiyle
görünür. (Eski kullanıcılarda ilk profil geriye dönük yönetici yapılır.)

### Profil EKLEME artık korumalı
"Kim izliyor?" ekranında + Profil Ekle'ye basınca:
  • Yöneticinin PIN'i VARSA -> YÖNETİCİ PIN'i istenir
  • Yöneticinin PIN'i YOKSA -> doğrudan ekleme (koruma yok)

Yani: Veli, + butonuna basar, YÖNETİCİ (Ali) PIN'i istenir. Ali evdeyse
PIN'i girer, Mert profili oluşur. Ali PIN'ini vermezse profil eklenemez.
Ali'nin KENDİ profiline girmeye gerek yok, listesi görünmez.

### Profil SİLME artık korumalı (kritik açık kapatıldı)
ESKİ: Ayarlar'da çöp kutusuna basan herkes profili silebiliyordu (PIN yok!).
YENİ:
  • Yönetici profil SİLİNEMEZ (çöp kutusu görünmez)
  • Diğer profilleri silmek YÖNETİCİ PIN'i ister

### Maymuncuk + kurtarma kodu burada da geçerli
Yönetici PIN'ini unutursan 4224422442 veya kurtarma kodun da çalışır.

## AYRICA DÜZELTİLDİ
Profil giriş PIN ekranı 4 haneye sabitti (v5.5.0'da atlanmış) -> 4-10 rakam.

## Test
1. Uygulamayı kaldırıp kur (temiz test)
2. İlk profil "Ali" + PIN oluştur -> Ali YÖNETİCİ olur
3. "Kim izliyor?" -> + Profil Ekle -> YÖNETİCİ PIN'i istemeli
4. Yanlış PIN -> eklenmemeli; Ali'nin PIN'i -> Mert eklenebilmeli
5. Ayarlar -> Ali'de çöp kutusu OLMAMALI (yönetici silinemez)
6. Mert'te çöp kutusu -> basınca YÖNETİCİ PIN'i istemeli
7. Ali'nin profiline hiç girmeden Mert oluşturulabilmeli
