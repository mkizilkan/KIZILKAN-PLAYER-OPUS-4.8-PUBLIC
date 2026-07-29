# KIZILKAN PLAYER v6.3.1 — PIN'li profil donması

## SENİN TESPİTİN ÇOK DEĞERLİYDİ
"PIN'siz anında oluşuyor, PIN'li dönüp duruyor, ilk kurulumda sorun yok"
Bu üç gözlem hatayı doğrudan gösterdi.

## KÖK SEBEP: eksik import
app/profile-select.tsx dosyasında isValidPinFormat ve ensureRecoveryCode
KULLANILIYOR ama IMPORT EDİLMEMİŞ.

Neden tam olarak bu davranış:
  PIN'siz  -> if (wantPin) bloğu hiç çalışmaz -> profil anında oluşur
  PIN'li   -> isValidPinFormat(...) çağrılır -> ReferenceError
              Bu satır try bloğunun DIŞINDA olduğu için finally de yok
              -> setBusy(false) asla çalışmaz -> SONSUZ DÖNME
  İlk kurulum -> welcome.tsx AYRI dosya, oradaki importlar doğru -> sorunsuz

## AYRICA BULUNAN İKİNCİ HATA (sen görmeden)
app/(tabs)/settings.tsx dosyasında fetchAndCacheEpg de import edilmemişti.
EPG yükle butonuna basınca sessizce "EPG yüklenemedi" diyordu — sebebi
anlaşılmıyordu. Düzeltildi.

## YENİ DENETLEYİCİ (5. araç) — bu boşluğu kapatıyor
Mevcut 4 denetleyicim bunu GÖREMİYORDU:
  - Tanımsız sembol: sadece useXxx() ve JSX bileşenleri
  - Eksik import: sadece Alert. gibi nokta kullanımları
isValidPinFormat(...) DÜZ bir fonksiyon çağrısı — hiçbirinin kapsamında değildi.

YENİ: "Tanımsız Fonksiyon Çağrısı" denetleyicisi. Çağrılan ama ne yerel tanımlı
ne import edilmiş HER fonksiyonu bulur. Tüm projeyi taradı, 2 hata buldu,
ikisi de düzeltildi, şimdi TEMİZ.

## ARTIK 5 DENETİM (hepsi bu pakette TEMİZ)
1. Tanımsız sembol (hook/JSX)
2. Tanımsız context value
3. Bayat kapanış (stale closure)
4. Tanımsız fonksiyon çağrısı   <-- YENİ
5. Eksik nokta-import (Alert/Platform vb.)

## Test
1. Yönetici profilinden veya ana ekrandan + Profil Ekle
2. PIN VEREREK profil oluştur -> DONMAMALI, oluşmalı
3. PIN'siz profil de oluşmalı (zaten çalışıyordu)
4. Ayarlar > EPG yükle -> artık çalışmalı

## SIRADAKİ: TV kumanda CH+/- (ayrı paket)
Onayınla, bir sonraki adımda SADECE kumanda eklentisini içeren ayrı bir paket
hazırlayacağım. Native (MainActivity) dokunuşu gerektirdiği için izole test
edilmeli — build kırılırsa bu düzeltmeler elimizden gitmesin.
