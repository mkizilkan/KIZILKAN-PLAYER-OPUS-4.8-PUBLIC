# KIZILKAN PLAYER v4.6.1

## Bu sürümde düzelenler (senin test bulguların)

### ✅ Film/Dizi uzun-bas menüsü ÇALIŞIYOR
- SORUN: Canlı kanallarda menü açılıyordu ama film/dizide açılmıyordu
- SEBEP: PosterGrid bileşeninde onLongPress desteği hiç yoktu
- ÇÖZÜM: PosterGrid'e uzun-bas eklendi, ana ekrana bağlandı

### ✅ İndirme hatası düzeltmesi
- SORUN: "Call to function 'ExponentFileSystem.downloadResumableStartAsync'"
- SEBEPLER (üçü de giderildi):
  1. İndirme klasörü sadece açılışta bir kez oluşturulmaya çalışılıyor,
     hatası sessizce yutuluyordu -> artık HER indirmeden önce garanti ediliyor
  2. Uzantı boş/geçersizse dosya adı bozuluyordu ("abc.") -> güvenli uzantı
  3. Geçersiz URL kontrolü yoktu -> eklendi
- Hata olursa artık GERÇEK sebebi gösteriyor (sessiz başarısızlık yok)

## (v4.6.0'dan gelenler)
- XMLTV EPG cihaz-içi, spinner düzeltmesi, çift dokunuş, uzun-bas menüsü

## Test edilecekler
1. FİLME/DİZİYE uzun bas -> menü açılmalı
2. Bir film indir -> çalışmalı; hata olursa anlaşılır mesaj vermeli
