# Rencana — Desktop/Dasbor nxcloud (mandiri, bukan di Teritip)

> **Status:** scaffold awal SUDAH ADA & sudah diberi identitas (lihat §6).
> Halaman/desain isi tetap menunggu arahan detail dari Anda.
> Dicatat sesuai `AGENTS.md` §Plan poin 5 — riwayat keputusan tetap
> tercatat di folder ini sebelum eksekusi kode dimulai.

**Tanggal:** 2026-09-11 (diperbarui 2026-09-11 — scaffold ditemukan sudah ada)

**Latar belakang:** `Plan-dashboard-api.md` (2026-09-11, revisi) mencatat
perubahan arah — nxcloud akan punya Desktop/GUI pengelola sendiri,
bukan lagi terintegrasi permanen ke `Teritip Desktop`. Dokumen ini awalnya
menyiapkan riset pola dari Teritip Desktop sebagai **referensi rute saja**
(§1–2 di bawah). Sesi berikutnya menemukan folder `nxcloud/Desktop/`
**sudah ada** (hasil scaffold sebelumnya, kemungkinan salinan langsung dari
Teritip Desktop) — lihat §6 untuk apa yang sudah dikerjakan terhadapnya.

---

## 1. Yang sudah dipelajari dari `D:\Framework\CLI\Teritip\Desktop\`

### Arsitektur (untuk referensi pola, BUKAN untuk disalin mentah)

- **Electron app** — `electron.js`, `index.html`, `App.js` sebagai entry SPA.
- Router internal milik Teritip: `NXUI.Tatiye` (dari `assets/modules/nxdom.js`,
  bagian dari framework `nxdom`/NEXA), **bukan** router generik yang mudah
  dipisah dari Electron app itu.
- Konfigurasi endpoint disuntik lewat `window.__NEXA_ENDPOINT__` (dari
  `index.html`), dibaca `App.js` — pola khas Electron+SPA gabungan.
- Struktur `templates/<nama-package>/`: satu package = satu folder.
  - `index.js` — wajib, render shell (sidebar + `#nxpackage` container).
  - File lain (`overview.js`, `routes.js`, `tunnel.js`, `logs.js`,
    `settings.js`, dst.) — satu file per halaman/rute, masing-masing
    `export async function <namaRute>(page, route) { route.register(...) }`.
  - Rute diakses via hash: `#package/<nama-package>/<nama-rute>`.
  - `route.register(page, callback)` — callback menerima `(routeName, container, routeMeta, style, nav)`, bertanggung jawab isi `container.innerHTML` dan pasang event listener.
- Client API dipanggil dari dalam halaman via `import { createXApi } from '/lib/xApi.js'`, base URL dari `globalThis.NEXA.<namaApi>` (contoh nyata: `NEXA.nxcloudApi`, lihat `Teritip/Desktop/lib/nxcloudApi.js`).

### Yang TIDAK ikut jadi acuan (spesifik-Electron/Teritip, bukan pola umum)

- `NXUI.Tatiye`, `nxdom.js`, service worker/PWA config di `App.js` —
  bagian dari framework internal Teritip, tidak portable begitu saja.
- `node_modules/` Desktop Teritip sangat besar (Electron + electron-builder
  + banyak dependency native) — **bukan** indikasi nxcloud Desktop
  harus sebesar itu; ukurannya spesifik kebutuhan Teritip (build installer
  Windows, dsb).

---

## 2. Pola yang RELEVAN diambil (independen dari Electron)

Ini pola desain, bukan kode yang harus disalin:

1. **Satu halaman = satu file/module**, dengan fungsi render yang menerima
   container dan mengisi HTML + pasang listener sendiri.
2. **Sidebar shell terpisah dari isi halaman** — shell (`index`) merender
   navigasi + container kosong, tiap link mengarah ke rute lain yang
   render kontennya sendiri saat diklik.
3. **Client API sebagai lapisan terpisah** — halaman tidak `fetch()`
   langsung, tapi lewat modul client (`createnxcloudApi()`, sudah ada
   di `nxcloud/client/nxcloudApi.js`) yang tahu base URL + kontrak endpoint.
4. **Base URL dikonfigurasi dari luar** (global var/config), bukan
   hardcode di tiap halaman — memudahkan pindah lokal ↔ publik.

Pola ini **teknologi-agnostik** — bisa diterapkan baik di Electron, web app
statis biasa, maupun framework lain apa pun yang Anda pilih untuk Desktop
nxcloud.

---

## 3. Keputusan (status terkini — sebagian sudah terjawab oleh scaffold di §6)

1. **Teknologi shell**: ✅ **Electron** — `nxcloud/Desktop/` sudah
   scaffold Electron app (sama pola Teritip: `electron.js`, `electron-builder`).
2. **Lokasi folder**: ✅ **Monorepo** — `nxcloud/Desktop/` (bukan repo
   terpisah).
3. **Router**: ✅ **Pakai ulang framework `NXUI`/`nxdom`** — scaffold-nya
   memuat `assets/modules/nxdom.js` dan pola `App.js` yang sama seperti
   Teritip Desktop (lihat §1 untuk detail pola).
4. **Cakupan halaman v1**: ✅ **Sama seperti stub Teritip** — Overview,
   Pembelokan (routes), Tunnel, Logs, Settings sudah ter-scaffold di
   `Desktop/templates/nxcloud/*.js` (lihat §6).
5. **Auth**: ✅ **Localhost-trusted, tanpa token** — dikonfirmasi lewat
   pengujian: Desktop selalu memanggil dari `127.0.0.1` (Electron di mesin
   yang sama), jadi guard `loopback`-only di server (`src/api/router.js`)
   otomatis lolos tanpa perlu `X-Nx-Token`. Token (`api.controlToken`,
   Fase P4) baru relevan kalau kontrol dipanggil dari luar mesin.

**Masih terbuka:** desain visual/UX tiap halaman (isi `container.innerHTML`
di tiap file `templates/nxcloud/*.js` saat ini masih JSON mentah/stub)
— ini yang dimaksud "Anda ambil alih konsep dasbor" di README stub.

---

## 4. Aset yang sudah siap dipakai (dari sisi nxcloud, tidak perlu dibuat ulang)

- `client/nxcloudApi.js` — client API lengkap (health, status, config,
  tunnel, logs, routes CRUD, control stop/restart + token opsional).
- Semua endpoint REST sudah ada & aman (`Plan-dashboard-api.md` §4.1 lengkap,
  §7 P0–P4 lengkap kecuali Cloudflare Access).
- `digram.md` — diagram alur akses (loopback vs publik) sebagai referensi
  desain "apa yang boleh halaman Desktop panggil langsung vs lewat token".

---

## 6. Scaffold ditemukan & identitas diperbaiki — ✅ SUDAH DIEKSEKUSI (2026-09-11)

`nxcloud/Desktop/` ditemukan sudah berisi struktur lengkap (Electron
app, `templates/nxcloud/*.js` dengan 5 halaman stub, `templates/explorer/`,
`lib/`, `assets/`) — kemungkinan hasil `xcopy`/scaffold manual dari
`Teritip/Desktop/` sebelum sesi ini, belum pernah di-`npm install` dan
identitasnya (`package.json`, dsb.) masih menempel milik Teritip.

**Perbaikan identitas yang diterapkan:**

| File | Perubahan |
| ---- | --------- |
| `Desktop/package.json` | `name` → `nxcloud-desktop`; `version` → `0.1.0`; `build.appId`: `(com.teritip.desktop)` (format rusak) → `com.nxcloud.desktop`; `build.productName` → `nxcloud`; `nsis.shortcutName` → `nxcloud`; `nsis.artifactName` → `nxcloud-desktop-setup-*`; script `stop` port `7800`→`7801` |
| `Desktop/config.js` | Port Express shell `7800` → `7801` (hindari bentrok kalau Teritip Desktop jalan bersamaan di mesin yang sama); baris `teritipApi` (integrasi ke Teritip API, referensi ke `templates/teritip/*.js` yang tidak ada di scaffold ini) dihapus atas permintaan eksplisit |
| `Desktop/electron/kill-nexa-packaged.js` | Target `taskkill /IM teritip.exe` → `nxcloud.exe` (sesuai `productName` baru) |
| `Desktop/electron/build-fresh.js`, `clean-dist.js` | Pesan teks "teritip" → "nxcloud Desktop" |
| `Desktop/templates/nxcloud/index.js` | Link menu mati `#package/teritip/index` dihapus (package `teritip` tidak ter-scaffold di sini) |
| `Desktop/templates/nxcloud/README.md` | Judul & instruksi "di Teritip Desktop" → Desktop mandiri; baris "Pembelokan: mock" diperbaiki jadi "live" (kodenya sudah memanggil `/api/routes` sungguhan); ditambah pointer ke `digram.md` & `Plan-dashboard-api.md` §4.1 |
| `Desktop/lib/nxcloudApi.js` | Komentar header "untuk Teritip Desktop" diperbaiki; file disinkronkan ulang (disalin) dari `nxcloud/client/nxcloudApi.js` — sekarang termasuk dukungan `controlToken`/`X-Nx-Token` (Fase P4) yang sebelumnya ketinggalan |
| `Desktop/templates/nxcloud/home.js` | **Ditemukan terlewat** dari sweep identitas awal — isinya 100% konten Teritip (judul "Teritip — Ringkasan", menjelaskan Images/Containers/Registry/Templates/System), tidak direferensikan menu manapun. Ditulis ulang jadi konten nxcloud (Ringkasan/Pembelokan/Tunnel/Log/Pengaturan) dan didaftarkan ke sidebar (`index.js`, menu "Tentang") |

**Sengaja tidak diubah:** isi `templates/explorer/`, `assets/modules/nxdom.js`,
dan mekanisme router `NXUI.Tatiye` — komponen framework generik, bukan
identitas Teritip.

**`npm install`**: selesai, 537 packages. 20 vulnerability (2 critical, 16
high) di devDependencies (`electron-builder`, `firebase`, `adm-zip`) —
warisan `package.json` asli, fix butuh breaking change major version,
**belum dijalankan** (`npm audit fix --force`) atas keputusan eksplisit:
belum diprioritaskan, di luar scope permintaan identitas+install.

---

## 6b. Halaman diubah dari stub JSON-mentah jadi UI fungsional — ✅ SUDAH DIEKSEKUSI (2026-09-11)

Audit terhadap `docs/MENU-FITUR.md` §3 menemukan seluruh halaman stub cuma
menampilkan `JSON.stringify(...)` di dalam `<pre>` + tombol Refresh —
bukan "mengelola", cuma "melihat data mentah". Ditulis ulang:

| File | Sebelum | Sesudah |
| ---- | ------- | ------- |
| `overview.js` | JSON mentah | Kartu status (Server/Tunnel/Pembelokan), badge warna, tombol Stop/Restart nyata, pintasan ke Pembelokan & Tunnel |
| `routes.js` | JSON mentah | Form tambah/edit (nama, hostname, origin, keterangan, path proyek, aktif), tabel dengan kolom Tipe (Internal/Eksternal), tombol Salin URL publik, tombol **Uji** (ping origin), indikasi hasil sync ke config tunnel |
| `tunnel.js` | JSON mentah | Tabel status dengan badge warna, ditambah baris Config path |
| `logs.js` | Sudah cukup fungsional | Ditambah pilihan jumlah baris + auto-refresh 5 detik |
| `settings.js` | JSON mentah | Tabel terstruktur per bagian (Server/Tunnel/Web/Control API) |

**Perubahan backend yang menyertainya** (field & endpoint yang sebelumnya
tidak ada, dibutuhkan UI di atas):
- `src/api/routes.js` — `normalizeRoute()` sekarang menyimpan field
  `description` (sebelumnya dibuang diam-diam kalau dikirim); fungsi baru
  `pingRouteOrigin(id)` — fetch origin dari sisi server (hindari CORS),
  timeout 5 detik, kembalikan `{reachable, status/error, durationMs}`.
- `src/api/router.js` — endpoint baru `POST /api/routes/:id/ping`
  (loopback-only, sama seperti endpoint baca lain).
- `client/nxcloudApi.js` + `Desktop/lib/nxcloudApi.js` (disinkron
  ulang) — method `pingRoute(id)`.

**Diverifikasi:**
- `node --check` semua file yang diubah — sintaks valid.
- `POST /api/routes/:id/ping` dites langsung: origin reachable (200),
  origin merespons non-200 (404, tetap `reachable:true` — sesuai desain
  "cek origin merespons", bukan "cek 200 OK"), ID tidak ada → 404, lewat
  domain publik → 403 (loopback-guard konsisten).
- Desktop GUI di-restart bersih (proses Electron lama ditutup dulu) untuk
  memuat semua perubahan.

**Masih belum ada** (di luar cakupan §3 MENU-FITUR.md, tidak diminta):
menu **Domain** terpisah (sengaja digabung ke Pembelokan sesuai dokumen),
form ubah config langsung dari UI (Pengaturan tetap read-only + arahkan ke
CLI, sesuai §3.6).

### 6c. Tunnel — ditambah aksi (di luar §3.3 MENU-FITUR.md, atas permintaan)

`tunnel.js` awalnya cuma tabel baca-saja + Refresh (sesuai §3.3 yang memang
hanya minta field, tanpa aksi). Ditambah:
- Tombol **Restart Tunnel** (pakai `api().restart()` — sama endpoint dengan
  tombol Restart di Ringkasan, karena tidak ada endpoint restart tunnel-saja
  terpisah di backend).
- Link **Lihat Log →** langsung ke menu Log (sebelumnya cuma teks
  "cek menu Log" tanpa link).
- **Auto-refresh 5 detik** (checkbox, pola sama seperti `logs.js`).

Diverifikasi: `node --check` OK, Desktop di-restart bersih dan memuat
perubahan.

---

## 6d. Menu baru: Proses (start/stop app eksternal) — ✅ SUDAH DIEKSEKUSI (2026-09-11)

Melengkapi field `projectPath` yang sudah ada di data route sejak awal
tapi tidak pernah dipakai untuk apapun — sesuai `docs/MENU-FITUR.md` §2/§7
yang menandai "Proses" sebagai menu opsional P3 (start/stop app di
`projectPath`).

**Backend:**
- `src/api/routes.js`: field baru `command` di `normalizeRoute()` (user
  isi manual, mis. `"npm start"` — TIDAK ditebak otomatis, sesuai prinsip
  README "sederhana, sedikit dependency").
- `src/utils/paths.js`: `ROUTE_PROCESSES_DIR`, `ROUTE_LOGS_DIR`, helper
  `routeProcessPidFile(id)`/`routeProcessLogFile(id)`.
- `src/api/processes.js` (baru): `startRouteProcess`, `stopRouteProcess`,
  `getRouteProcessStatus`, `readRouteProcessLogTail` — pola PID tracking
  sama seperti server/tunnel yang sudah ada (`writePid`/`readPid`/
  `isProcessRunning`/`killProcess` dari `utils/process.js`), spawn dengan
  `shell:true` (command string bebas, bukan array command+args) dan cwd
  = `projectPath`, stdout/stderr proses ditulis ke log file per-route
  (bukan pipe yang tergantung ke proses nxcloud).
- `src/api/router.js`: endpoint `GET/POST/DELETE /api/routes/:id/process`
  + `GET /api/routes/:id/process/logs`, semua loopback-only.

**Client & Desktop UI:**
- `client/nxcloudApi.js` + `Desktop/lib/nxcloudApi.js`
  (disinkron): `getRouteProcess`, `startRouteProcess`, `stopRouteProcess`,
  `getRouteProcessLogs`.
- `Desktop/templates/nxcloud/proses.js` (baru) — daftar route yang
  punya `command`+`projectPath` terisi (route lain tidak muncul, sesuai
  teks penjelasan di halaman), tiap kartu: badge status
  Berjalan/Berhenti, tombol Run/Stop (disabled sesuai state), tombol
  Lihat Log (expand/collapse `<pre>` di tempat, bukan pindah halaman).
- `Desktop/templates/nxcloud/routes.js`: form Pembelokan ditambah
  input **Command** (baru), plus perbaikan bug kecil yang ditemukan
  sekalian — `colspan` salah (5, seharusnya 7) di pesan error `catch`
  block `loadList()`, sudah lama ada sejak field Tipe+Keterangan
  ditambahkan sebelumnya, baru ketahuan sekarang.
- `Desktop/templates/nxcloud/index.js`: menu **Proses** ditambah ke
  sidebar (antara Pembelokan dan Tunnel).

**Diverifikasi end-to-end** dengan route uji terpisah (bukan `socket` yang
data production — dibuat, dites, dihapus bersih):
- `POST .../process` → proses OS sungguhan ter-spawn (dikonfirmasi lewat
  `tasklist`, bukan cuma percaya response API), PID tercatat.
- `GET .../process` (dipanggil ulang) → status `running:true` persisten
  dengan PID sama.
- `GET .../process/logs` → berisi output stdout proses nyata
  (`"test process running"`).
- `DELETE .../process` → proses OS **benar-benar mati** (dikonfirmasi
  `tasklist` kosong), bukan cuma status API yang bilang berhenti.
- Loopback guard: akses publik ke `GET`/`POST` `.../process` → `403`,
  konsisten dengan endpoint lain.
- `node --check` semua file baru/ubah — OK. Desktop di-restart bersih,
  menu Proses termuat.

**Batasan yang disadari, belum ditangani** (di luar cakupan permintaan
saat ini — dicatat untuk referensi kalau diperlukan nanti):
- Proses yang di-start **tidak otomatis mati** saat nxcloud
  di-restart/stop (dibuat independen secara sengaja — hidup mati app
  eksternal bukan tanggung jawab siklus hidup nxcloud, sesuai
  `docs/MENU-FITUR.md` §4: "Dikelola hidup-mati oleh nxcloud? Tidak
  wajib" untuk origin eksternal). Kalau user lupa stop lalu tutup
  nxcloud, proses app itu **tetap jalan** di background — bukan bug,
  tapi perlu diketahui.
- Tidak ada validasi bahwa `command` yang diisi user aman/tidak berbahaya
  — sama seperti field lain yang bergantung pada kepercayaan
  localhost-only (loopback guard sudah menutup akses dari luar).

---

## 6e. Istilah menu "Pembelokan" → "Routes" — ✅ SUDAH DIEKSEKUSI (2026-09-11)

Ditemukan lewat feedback langsung: istilah terjemahan "Pembelokan" (dari
`docs/MENU-FITUR.md`, definisi asli 2026-09-10) membingungkan pengguna.
Diganti jadi istilah teknis standar **"Routes"** (tidak diterjemahkan) di
seluruh UI Desktop yang aktif:

- `index.js` (sidebar), `home.js`, `overview.js`, `domain.js`, `proses.js`,
  `routes.js` — semua kemunculan "Pembelokan"/"pembelokan" diganti "Routes".
- `README.md` (stub) — tabel menu diperbarui, sekalian dilengkapi 2 baris
  yang sudah lama tertinggal (menu Domain dan Proses belum pernah tercatat
  di sana sejak ditambahkan).
- `docs/CHECKLIST-SIAP.md`, `docs/ENDPOINTS-DASHBOARD.md` — referensi
  langsung diperbarui (bukan dokumen sumber definisi, aman diedit).
- `docs/MENU-FITUR.md` — **TIDAK diedit isinya** (ini dokumen sumber
  definisi asli istilah lama) — ditambah catatan revisi di kepala dokumen
  yang menjelaskan penggantian istilah, isi asli dibiarkan utuh sebagai
  riwayat keputusan (kapan & kenapa fitur ini pertama dirancang).

**Diverifikasi:** `node --check` semua file JS — OK. `grep` memastikan
tidak ada sisa "Pembelokan" di kode Desktop aktif. Desktop di-restart
bersih, sidebar menampilkan "Routes".

---

## 7. Status

✅ **Scaffold ada, identitas bersih, dependency terpasang.** Desktop bisa
dijalankan (`npm run dev` di `nxcloud/Desktop/`) dan sudah bisa
memanggil API nxcloud secara live (Overview, Tunnel, Logs, Settings,
Pembelokan/routes — semua sudah wiring ke endpoint asli, bukan mock).

⏳ **Masih menunggu Anda**: desain visual/UX tiap halaman (§3 poin
terbuka) — markup saat ini masih `JSON.stringify(...)` mentah di dalam
`<pre>`, bukan tampilan dasbor sungguhan.
