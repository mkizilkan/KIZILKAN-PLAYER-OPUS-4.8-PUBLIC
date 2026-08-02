# KIZILKAN PLAYER v8.5.0 — TV arayüzü profile özel

## ✅ HAKLIYDIN: AYAR GLOBALDİ

TV Arayüzü ve sağ panel önizlemesi TEK ORTAK anahtarda saklanıyordu.
Ahmet "Sütunlu" seçse Mehmet'te de sütunlu oluyordu.
Tema v7.1.0'da profile özel yapılmıştı; bu ayar atlanmıştı.

DÜZELTİLDİ. Anahtarlar artık profil kimliğini içeriyor:
    kizilkan.tv.layout.<profil-id>
    kizilkan.tv.preview.<profil-id>

ESKİ TERCİH KAYBOLMAZ: ortak anahtardaki değer, kaydı olmayan profile
tek seferlik devredilir.

## YAPISAL DEĞİŞİKLİK
ProfileProvider artık EN DIŞTA:
    ProfileProvider > TvProvider > ThemeProvider > ...
Hem tema hem TV ayarı aktif profili bilmek zorunda.

DÖNGÜSEL BAĞIMLILIK KONTROLÜ YAPILDI:
  ProfileContext -> useTv        : YOK   (güvenli)
  TvContext -> useProfiles       : var   (beklenen, tek yönlü)

## DENETLEYİCİLER İŞE YARADI
Bu değişiklik sırasında 8 denetleyici İKİ GERÇEK HATA yakaladı:
  • useProfiles importu eklenmemişti
  • Anahtar fonksiyonları (layoutKey/previewKey) hiç tanımlanmamıştı
İkisi de derlemeden ÖNCE düzeltildi. Sana hatalı paket gitmedi.

## v8.4.0'ın düzeltmeleri bu pakette
Çökme (yanlış context), bayat useMemo bağımlılığı, seçenekli TV modu/arayüzü,
TV'de sabit satır yüksekliği.

## DOĞRULAMA
  • 8 denetleyici -> HEPSİ TEMİZ
  • 9 izolasyon testi -> 9/9 GEÇTİ
    (devralma, profile özellik, çapraz etkilenmeme, yeni profil)
  • Döngüsel bağımlılık -> YOK

## Test
1. Ahmet profilinde: TV Arayüzü > Sütunlu
2. Profil değiştir (Mehmet): arayüz KLASİK olmalı
3. Mehmet'te Sütunlu seç -> Ahmet'e dön -> Ahmet'inki DEĞİŞMEMELİ
