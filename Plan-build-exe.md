# Peringatan: jangan jalankan .exe langsung di dalam dist/

## Masalah

`dist/` adalah folder OUTPUT build (`npm run build:exe` /
`build:exe:linux`) — isinya cuma boleh `nxcloud.exe` (atau
`nxcloud` di Linux), `.tools/cloudflared*`, dan `SHA256SUMS.txt`.
Itu yang didistribusikan ke orang lain.

`build-exe.mjs` dan `build-exe-linux.mjs` SUDAH aman — keduanya
`rm -rf dist/` di awal setiap run, jadi script build sendiri tidak
pernah menyalin config/credential project ke situ.

**Sumber masalah nyata**: kalau `.exe` hasil build itu DIJALANKAN
langsung di dalam `dist/` (mis. untuk testing cepat), maka karena
mode SEA membuat `ROOT_DIR = folder tempat .exe berada`
(`src/utils/paths.js`), nxcloud akan membuat seluruh state
runtime-nya DI SITU JUGA:

```
dist/
  .credentials/   <- tunnel credentials (PRIVATE KEY!)
  .runtime/        <- pid files, state.json
  config/          <- nxcloud.json, routes.json (data project asli)
  logs/
  web/             <- (kalau masih ada versi lama sebelum Halaman Statis dihapus)
```

Ini pernah kejadian betulan (2026-09-12): `dist/.credentials/<tunnel-id>.json`
ternyata **identik** dengan kredensial tunnel production project ini
(`tirtamoolango.id`). Kalau folder `dist/` itu di-zip dan dikirim ke
orang lain apa adanya, private key tunnel Cloudflare ikut bocor.

## Aturan

- **Jangan pernah jalankan `.exe` langsung di dalam `dist/`** untuk
  testing/debug. Copy dulu ke folder terpisah di luar `dist/` (mis.
  `test-run/` atau folder temp), baru dijalankan di sana.
- Sebelum distribusi, pastikan `dist/` HANYA berisi:
  - `nxcloud.exe` (atau `nxcloud` di Linux)
  - `.tools/cloudflared.exe` (atau `.tools/cloudflared`)
  - `SHA256SUMS.txt`
  
  Tidak ada `.credentials/`, `.runtime/`, `config/`, `logs/`, `web/`.
- Kalau menemukan folder-folder itu ada di `dist/`: hapus manual
  (`rm -rf dist/.credentials dist/.runtime dist/config dist/logs dist/web`)
  sebelum build ulang atau sebelum distribusi — jangan asumsikan
  build script berikutnya akan membersihkannya kalau kamu belum
  sempat jalankan build lagi.
- Kalau kredensial tunnel sempat bocor ke folder yang sudah dibagikan
  (drive, chat, dsb): anggap tunnel itu comprised — revoke/rotate
  tunnel di dashboard Cloudflare, jangan cuma hapus filenya.

## Cara aman untuk uji coba .exe

```bash
mkdir -p ../nxcloud-test-run
cp dist/nxcloud.exe ../nxcloud-test-run/
cp -r dist/.tools ../nxcloud-test-run/
cd ../nxcloud-test-run
./nxcloud.exe start
```

State runtime yang ter-generate akan ada di `nxcloud-test-run/`,
bukan di `dist/` — folder build tetap bersih untuk distribusi
berikutnya.
