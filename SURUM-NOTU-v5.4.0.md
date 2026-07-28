# KIZILKAN PLAYER v5.4.0

## Senin sorun: "Uygulamadan mı, sağlayıcıdan mı?"

### ✅ YENİ: "Kanalı Test Et (sorun kimde?)"
Bir kanal açılmadığında hata ekranında yeni buton. Yayın adresine doğrudan
istek atar ve sunucunun ne dediğini raporlar:

| Sunucu yanıtı | Anlamı | Sorumlu |
|---|---|---|
| 200 / 206 | Sunucu yayını VERİYOR | OYNATICI — VLC motorunu/donanımı/tamponu değiştir |
| 401 / 403 | Sunucu REDDETTİ | SAĞLAYICI — eş zamanlı bağlantı sınırı veya abonelik |
| 404 | Kanal sunucuda YOK | SAĞLAYICI — listeyi yenile |
| 5xx | Sunucu arızalı | SAĞLAYICI |
| zaman aşımı | Ulaşılamıyor | AĞ / sunucu kapalı |

Artık tahmin etmeye gerek yok — uygulama sana kimin sorunu olduğunu söylüyor
ve ne yapman gerektiğini yazıyor.

### ✅ GERÇEK BİR EKSİK DÜZELTİLDİ: İstemci kimliği (User-Agent)
Xtream API çağrılarımız "VLC/3.0.16 LibVLC/3.0.16" kimliğini gönderiyordu ama
OYNATMA tarafı HİÇBİR User-Agent göndermiyordu.

Birçok IPTV sağlayıcısı istekleri User-Agent'a göre süzer ve kimliksiz
istekleri reddeder. Bu, "başka player'da açılıyor bende açılmıyor" durumunun
bilinen sebeplerinden biridir.

Artık oynatma da kimlik gönderiyor: --http-user-agent=VLC/3.0.20 LibVLC/3.0.20
Bu düzeltme, senin gönderdiğin kanal gibi açılmayan bazı yayınları AÇABİLİR.

## Ayrıca (v5.3.1'den)
- "Property 'useTv' doesn't exist" çökmesi düzeltildi
- Yeni TANIMSIZ SEMBOL DENETLEYİCİSİ: bu pakette de çalıştırıldı, TEMİZ

## Test
1. Açılmayan kanalı aç -> "Kanalı Test Et" -> sonucu bana söyle
   (Bu bana da sorunun kaynağını kesin gösterir)
2. Bazı kanallar artık User-Agent sayesinde açılabilir — kontrol et
3. Ayarlar ekranı çökmüyor mu
