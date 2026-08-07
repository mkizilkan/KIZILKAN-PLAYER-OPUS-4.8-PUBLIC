# KIZILKAN PLAYER — SÜRÜM NOTU v9.12.0

**Sürüm:** 9.11.0 → **9.12.0** (versionCode 91100 → 91200)

## Uygulanan düzeltmeler

- Arama: `includes()` ön elemesi kaldırıldı; liste değişiminde bir kez normalize edilen indeks + gerçek fuzzy skor bütün adaylarda çalışıyor. Türkçe toleransı, eksik harf ve sağlayıcı-sırasından bağımsız en iyi sonuç korunuyor.
- TV arama: canlı/film/dizi aynı indeksli fuzzy motorunu kullanıyor; placeholder sekmeye göre değişiyor.
- TV kaydırma: `useFocusScroll` görünür indeksleri izliyor; görünür satıra artık ikinci `scrollToIndex()` gönderilmiyor. Başarısızlık yolu animasyonsuz.
- TV odak: dört sütun `TVFocusGuideView` ile kapsandı; ilk/son sütunda ekran dışına kaçış engellendi, sütun içine yeniden girişte son odak hatırlanıyor.
- Player şerit/tint: native VideoView/LibVLC, GestureHandler + Animated.View ağacından çıkarılıp opak siyah `videoStage` içinde doğrudan çiziliyor. Gesture katmanı ayrı kardeş overlay oldu. Kanal değişiminde video yüzeyi temiz key ile yeniden bağlanıyor.
- VLC wrapper: dış style desteği + opak siyah native yüzey eklendi.
- Denetleyiciler: `/home/claude/...` hardcode kaldırıldı; TypeScript proje `frontend/node_modules` üzerinden taşınabilir çözülüyor.
- GitHub Actions: `yarn typecheck` + `yarn denetle` APK build öncesi zorunlu kalite kapısı oldu.
- Emergent aktif bağımlılıkları: kullanılmayan `emergentintegrations` ve Emergent-hosted `litellm` requirements'tan kaldırıldı; backend test varsayılanı localhost oldu. Tarihsel test raporları değiştirilmedi.
- Catch-up: Xtream timeshift URL tek `buildXtreamTimeshiftUrl()` fonksiyonunda merkezileştirildi; kullanıcı/parola/path encode ediliyor ve EPG arşiv kontrolü eklendi.
- M3U TV/IME: URL alanında Done yerine Next akışı ve demo düğmesine gerçek focus devri eklendi. `FocusButton` ref-forwarding destekli.
- TV mimari dokümanı: eski “react-native-tvos kullanmıyoruz” açıklaması gerçek SDK54 + react-native-tvos mimarisiyle düzeltildi.

## Şerit/tint için dürüst doğrulama notu

Kod tarafındaki en riskli kompozisyon katmanı yeniden düzenlendi; ancak GPU/decoder kaynaklı TV Box problemi yalnız gerçek cihazda kesin doğrulanabilir. Bu sürümde player işlevleri çıkarılmadı; motor, surface seçimi, Exo→VLC fallback, kumanda, gesture, kayıt, cast ve kontrol panelleri korunmuştur.
