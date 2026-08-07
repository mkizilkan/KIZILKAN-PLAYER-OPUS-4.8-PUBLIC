# Denetleyiciler

Her paket öncesi çalıştır:

```bash
cd frontend
node ../tools/denetle.js
```

Çıktı `✅ TÜM DENETİMLER TEMİZ` değilse **paketleme.**

## Gereksinim

TypeScript, `frontend/package.json` içindeki geliştirme bağımlılığıdır. Sabit
makine yolu yoktur. Önce:

```bash
cd frontend
yarn install
```

Ardından denetleyici `frontend/node_modules/typescript` paketini otomatik bulur.

## Araçlar
| Dosya | Yakaladığı |
|---|---|
| checkdefs.js | Tanımsız hook / JSX bileşeni |
| checkcalls.js | Tanımsız fonksiyon çağrısı |
| checkctx.js | Tanımsız context value alanı |
| checkdeps.js | Bayat kapanış (stale closure) |
| checkjsx.js | Tanımsız JSX prop değişkeni |
| checktdz.js | Kullanım-önce-tanım (const hoisting) |
| checkhooksrc.js | Yanlış hook kaynağı |
| checkimports.js | Eksik nokta-import (Modal/Alert/Pressable…) |

Her biri gerçek bir çökmeden sonra yazıldı — ayrıntı: `../DEVIR-NOTU.md`
