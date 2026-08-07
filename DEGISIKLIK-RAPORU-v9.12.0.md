# KIZILKAN PLAYER v9.12.0 — Değişiklik ve Doğrulama Raporu

## Değiştirilen ana alanlar

- `frontend/app/(tabs)/search.tsx` + `frontend/src/utils/fuzzy.ts`: gerçek fuzzy arama, ön-normalize indeks.
- `frontend/app/tv-home.tsx`: TV fuzzy arama, `TVFocusGuideView`, görünürlük-tabanlı liste kaydırma bağlantıları.
- `frontend/src/hooks/useFocusScroll.ts`: görünür öğeye ikinci scroll gönderilmemesi.
- `frontend/app/player.tsx` + `frontend/src/components/VlcPlayerView.tsx`: native video yüzeyi Gesture/Animated ağacından ayrıldı; opak siyah video sahnesi ve kanal-bazlı taze surface key.
- `frontend/src/components/FocusButton.tsx`: ref forwarding; TV input/düğme odak zincirine uygun.
- `frontend/app/add-playlist.tsx`: M3U URL submit sonrası gerçek focus devri.
- `frontend/src/utils/iptv.ts`, `frontend/app/catchup.tsx`, `frontend/app/epg-timeline.tsx`: tek merkezli Xtream timeshift URL üretimi, credential encoding, archive kontrolü ve kullanıcıya hata bildirimi.
- `backend/requirements.txt`, `backend/tests/test_kizilkan_api.py`: aktif Emergent paket/URL bağımlılıklarının kaldırılması.
- `tools/*`: Claude makinesine özel TypeScript yolu kaldırıldı; taşınabilir çözümleyici.
- `.github/workflows/build-apk.yml`: build öncesi TypeScript + KIZILKAN statik denetim kapısı.
- `frontend/app.json`, `frontend/package.json`: v9.12.0 / versionCode 91200.

## Yerel doğrulamalar

1. 86 adet `.ts/.tsx` dosyası TypeScript `transpileModule` ile sözdizimi kontrolünden geçti: **0 syntax error**.
2. 8 KIZILKAN statik denetleyicisinin tamamı çalıştırıldı: **8/8 temiz**.
3. `app.json`, `package.json` ve workflow YAML parse edildi: **geçti**.
4. `tools/` altında `/home/claude/verify` hardcode taraması: **0 aktif eşleşme**.
5. `frontend/` + `backend/` aktif alanda eski Emergent prod/preview URL ve Emergent-hosted paket taraması: **0 aktif eşleşme**. Tarihsel raporlardaki metinler arşiv olduğu için bilerek korunmuştur.

## Build doğrulaması hakkında

Teslim edilen kaynak ZIP `node_modules` içermediği için burada tam `yarn typecheck` ve Android Gradle APK derlemesi çalıştırılamadı. Bunun yerine sözdizimi + 8 statik denetim çalıştırıldı. v9.12.0 workflow'u bağımlılıklar GitHub runner'da kurulduktan sonra **`yarn typecheck` ve `yarn denetle` başarısızsa APK derlemesini durduracak** şekilde güncellendi.

## Şerit / renklenme problemi

Player'ın tüm özelliklerini atıp sıfırdan küçültmek yerine, soruna en yatkın katman yeniden tasarlandı: native `VideoView`/LibVLC artık `GestureDetector` ve `Animated.View` altında render edilmiyor. Düz, opak siyah native video katmanı ve onun üzerinde bağımsız gesture overlay var. Bu, mevcut motor/fallback/kumanda/kayıt/cast özelliklerini korur.

GPU/decoder davranışı cihaz modeline bağlı olduğu için şerit/tint düzeltmesinin son doğrulaması gerçek TV Box APK testiyle yapılmalıdır. Sorun devam ederse artık izole edilmiş mimari sayesinde bir sonraki adım yüzey/decoder bazında doğrudan teşhis edilebilir; player işlevleri azaltılmadan ilerlenir.
