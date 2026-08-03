# KIZILKAN PLAYER — DEVİR NOTU

> **Bu dosya yeni bir sohbete geçerken okutulmak içindir.**
> Yeni sohbetteki asistan bu konuşmayı hatırlamaz. Bu belgeyi ve
> `tools/` klasörünü göstermek, kaldığımız yerden devam etmeyi sağlar.

---

## PROJE

**KIZILKAN PLAYER** — Türkçe IPTV oynatıcı (telefon + Android TV Box)
Expo / React Native, **react-native-tvos** fork'u (TV odağı için zorunlu).

- Kaynak: `frontend/`
- GitHub: `mkizilkan/KIZILKAN-PLAYER-OPUS-4.8-PUBLIC`
- Derleme: GitHub Actions "Run workflow" (~45-50 dk)
- Güncel sürüm: **v8.7.0** (versionCode 80700)

**Kullanıcının cihazları:** Homatics Box R 4K+ (ana test), Chromecast HD,
Fire TV 4K Max, Wanbo projeksiyon. Ortak payda: D-pad + OK + Geri + Ana.
Chromecast ve Wanbo'da **CH+/− tuşu YOK** (sol/sağ kanal değiştirme bu yüzden var).

---

## ÇALIŞMA SÖZLEŞMESİ (kullanıcının koyduğu kurallar)

1. **Gerileme yok** — hiçbir özellik sessizce çıkarılmaz, azaltılmaz
2. **Simülasyon yok** — olmayan şey "oluyor" gibi gösterilmez
3. Kod **çalışır** durumda olacak
4. Sonradan konan özellikler **sorulmadan** kaldırılmaz
5. **Her pakette sürüm artar** (app.json: version + versionCode)
6. **Yalan söylenmez**, "token yetmez" diye baştan savma yapılmaz
7. Acele edilmez, sıkıştırılmaz
8. **Kod öncesi plan sunulur**, onay alınır
9. Bahane üretilmez
10. Sınırlar zorlanarak, mükemmel yapılır
11. "İncele" denince **satır satır** incelenir, tablo ile anlatılır

**Ek olarak asistanın kendine koyduğu kural:** "hatasız garanti" verilmez;
API imzaları **paket kaynağından doğrulanır**, tahmin edilmez.

---

## 🔧 8 DENETLEYİCİ — EN DEĞERLİ VARLIK

`tools/` klasöründe. **Her paketten önce çalıştır:**

```bash
cd frontend && node ../tools/denetle.js
```

Her biri, GERÇEKTEN YAŞANMIŞ bir çökmeden sonra yazıldı:

| # | Araç | Yakaladığı hata | Doğduğu olay |
|---|------|-----------------|--------------|
| 1 | checkdefs | Tanımsız hook/JSX bileşeni | "useTv doesn't exist" çökmesi |
| 2 | checkcalls | Tanımsız fonksiyon çağrısı | "isValidPinFormat" donması |
| 3 | checkctx | Tanımsız context value alanı | "verifyAdminPin doesn't exist" çökmesi |
| 4 | checkdeps | Bayat kapanış (stale closure) | Liste kaybolması, profil karışması |
| 5 | checkjsx | Tanımsız JSX prop değişkeni | "autoFocusOnTv doesn't exist" çökmesi |
| 6 | checktdz | Kullanım-önce-tanım (const hoisting) | CH+/− tuşlarının sessizce çalışmaması |
| 7 | checkhooksrc | Yanlış hook kaynağı | "includes of undefined" çökmesi |
| 8 | checkimports | Eksik nokta-import | Modal/Pressable/Image import unutulması |

**Not:** TypeScript parser yolu `/home/claude/verify/node_modules/typescript`.
Yeni ortamda yoksa: `mkdir -p ~/verify && cd ~/verify && npm i typescript`

**Denetleyicilerin göremediği:** "Bu ekrana gidilebiliyor mu?" sorusu.
v8.0.0'da sütunlu TV ekranı yazıldı ama ulaşılamıyordu — bu yüzden
**yeni ekran eklenince yönlendirmeyi elle doğrula.**

---

## 🔴 ÇÖZÜLMEMİŞ SORUNLAR (öncelik sırasıyla)

### 1. KAYIT ÇALIŞMIYOR
- `file://` öneki temizlendi (libVLC düz yol ister) — yine de dosya oluşmuyor
- v7.8.0'da **doğrulama eklendi**: kayıt bitince dosya var mı, boyutu ne,
  yoksa sebebi ekranda yazıyor
- **Sıradaki adım:** kullanıcıdan o hata mesajını iste, kesin teşhis koy
- Kayıt yalnızca **VLC motorunda** çalışır (ExoPlayer yapamaz)

### 2. CHROMECAST CANLI YAYIN
- `streamType: "live"` eklendi (v8.1.0) — paket tipinden doğrulandı
- Çift oynatıcı sorunu çözüldü, TV→telefon senkronu eklendi (v8.2.0)
- **Sende hâlâ çalışmıyor** — cihaza özel olabilir, ayrı ele alınmalı

### 3. TV BOX'TA TEST EDİLEMEYENLER
Sütunlu arayüzde kumanda, önizleme, TiviMate tarzı tuşlar

---

## 🟠 GÜVENLİK (küçük iş, yüksek değer — ÖNERİLEN SIRADAKİ)

4. **PIN'ler DÜZ METİN** (`pin?: string`). SecureStore altyapısı
   `src/utils/storage/` içinde VAR ama PIN'ler kullanmıyor
5. **Xtream şifresi** de düz metin

---

## 🟡 ÖZELLİK EKSİKLERİ

6. Zamanlı + EPG kayıt (başlangıç/bitiş, program boyunca)
   — **sınır:** kayıt oynatıcı çalışırken yapılır, uygulama açık kalmalı
7. Kanal başına **Referer** (UA var, Referer arayüzü yok)
8. `expo-image` (afiş yükleme hız/bellek kazancı)

---

## 🟢 BÜYÜK İŞLER (ayrı paket)

9. **MAC/Stalker cihaz-içi** — hâlâ backend'e bağımlı (son emergent kalıntısı)
10. Yerel medya oynatma (video + müzik)
11. Toplu kanal sağlık taraması
12. Ülke/VPN hafızası — **karar bekliyor:** IP servisi mi, manuel mi

---

## ⚠️ TEKRARLANAN HATA DESENLERİ (aynı tuzağa düşme)

1. **Bayat kapanış:** `useCallback` bağımlılığına `activeProfile` eklemeyi
   unutma → yanlış profile yazar
2. **Tek seferlik taşıma:** eski (ortak) anahtardan devralırken **bayrak koy
   ve eski anahtarı sil**, yoksa HER profil aynı değeri devralır
   (bu hata liste taşımasında ve TV ayarında İKİ KEZ yapıldı)
3. **const hoisting yok:** hook'u, kullandığı fonksiyonlardan SONRA çağır
4. **Yeni ekran = yönlendirme kontrolü:** ekranı yazmak yetmez, ulaşılabilir mi?
5. **API tahmin etme:** paket kaynağından (`node_modules/.../*.d.ts`) doğrula

---

## PROFİLE ÖZEL OLANLAR (hepsi profil kimliğine göre saklanır)

- Oynatma listeleri: `kizilkan.playlists.meta.<pid>`
- Tema: `kizilkan.theme.<pid>`
- TV arayüzü: `kizilkan.tv.layout.<pid>`, `kizilkan.tv.preview.<pid>`
- Favoriler, son izlenenler, izleme geçmişi

**Sağlayıcı sırası (önemli):** `ProfileProvider > TvProvider > ThemeProvider > ...`
Tema ve TV ayarı aktif profili bilmek zorunda.

---

## PIN SİSTEMİ

- 4-10 rakam
- **Ana anahtar (maymuncuk):** `4224422442` — tüm PIN'leri açar, ekranda GÖSTERİLMEZ
- **Kurtarma kodu:** PIN kurulunca üretilen 10 haneli cihaza özel kod
- **Yönetici profili:** ilk profil; profil ekleme/silme onun PIN'iyle
