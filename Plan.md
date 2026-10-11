# Plan Kerja — NxCloudflare

> Dokumen ini adalah rencana eksekusi. `README.md` dianggap **draft awal** (gambaran arah), bukan spesifikasi mutlak. Keputusan teknis dapat disesuaikan saat implementasi.

**Status proyek saat ini:** hanya `README.md` — belum ada kode, `package.json`, atau struktur folder.

**Tanggal rencana:** 2026-09-10

---

## 1. Ringkasan analisis

### Apa itu NxCloudflare

Server Node.js lokal + CLI yang mengelola **Cloudflare Tunnel** (`cloudflared`) agar layanan di PC bisa diakses lewat HTTPS publik tanpa port forwarding / IP publik.

### Temuan dari workspace

| Item | Status |
| ---- | ------ |
| Kode sumber (`src/`, `bin/`) | Belum ada |
| `package.json` | Belum ada |
| Konfigurasi | Belum ada |
| `README.md` | Draft konsep lengkap |
| Platform fokus pertama | Windows + Node.js |

### Inti yang harus dibangun (prioritas README §30)

1. Node.js Server (localhost)
2. CLI (`start` / `stop` / `status` / …)
3. Configuration (JSON)
4. Deteksi `cloudflared`
5. Integrasi Cloudflare Tunnel
6. Logging

### Yang ditunda (bukan v0.1)

Dashboard, multi-service routing, Windows service / auto-start, auth penuh, recovery otomatis lanjutan — masuk backlog setelah fondasi stabil.

---

## 2. Asumsi & keputusan terbuka

Karena README draft, keputusan berikut perlu dikunci sebelum/saat coding. Default rencana:

| Topik | Default rencana | Alternatif |
| ----- | --------------- | ---------- |
| Modul | ESM (`"type": "module"`) | CJS |
| HTTP server | Node `http` bawaan (ringan) | Express / Fastify |
| CLI parsing | Argumen manual / minim dependency | `commander` / `yargs` |
| Proses CLI | Foreground dulu (Ctrl+C = shutdown) | Background + PID file lebih awal |
| Tunnel v0.1 | Quick Tunnel (`*.trycloudflare.com`) dulu | Named Tunnel langsung |
| Kredensial named tunnel | File lokal di luar repo / path di config | Env var |
| Bahasa | JavaScript murni | TypeScript nanti |

**Prinsip:** tetap sederhana, sedikit dependency, Windows-first.

---

## 3. Cakupan versi

### Fase A — Bootstrap proyek

- Inisialisasi `package.json` (name, bin, scripts, type module)
- Buat struktur folder sesuai README §5 (disesuaikan bila perlu)
- Entry `bin/nxcloudflare.js` → router CLI
- `config/nxcloudflare.json` default (`127.0.0.1:8787`)
- Folder `logs/` (+ `.gitignore` untuk log & secrets)

**Hasil:** `node bin/nxcloudflare.js --help` berjalan.

---

### Fase B — Core server + config + logger (v0.1 core)

| Modul | Tanggung jawab |
| ----- | -------------- |
| `src/config.js` | Baca/validasi `config/nxcloudflare.json` |
| `src/logger.js` | Level INFO/WARN/ERROR/DEBUG → console + file |
| `src/server.js` | HTTP server localhost |
| `src/index.js` | Orkestrasi start server |

**Endpoint awal:**

- `GET /` — info singkat
- `GET /health` — `{ status, service }`
- `GET /status` — server (+ placeholder cloudflare nanti)

**Perilaku:** bind `127.0.0.1` (bukan `0.0.0.0`), graceful shutdown dasar.

**Hasil:** `npm start` → server hidup di `http://127.0.0.1:8787`.

---

### Fase C — CLI dasar

Command:

| Command | Perilaku Fase C |
| ------- | --------------- |
| `--help` / tanpa arg | Bantuan |
| `start` | Jalankan server (tunnel menyusul Fase D) |
| `stop` | Stop proses terkelola (PID file sederhana) |
| `restart` | stop + start |
| `status` | Baca status server / PID |
| `config` | Tampilkan konfigurasi aktif |
| `logs` | Tampilkan / tail log (versi sederhana dulu) |

Utils: `paths.js`, `platform.js`, `process.js` (PID, cek proses Windows).

**Hasil:** alur CLI lokal tanpa Cloudflare sudah usable.

---

### Fase D — Cloudflare Tunnel (v0.2 ringkas di jalur kritis)

| Modul | Tanggung jawab |
| ----- | -------------- |
| `src/cloudflare/process.js` | Spawn / stop `cloudflared` |
| `src/cloudflare/tunnel.js` | Mode quick vs named |
| `src/cloudflare/config.js` | Mapping config → args / config cloudflared |

Urutan implementasi tunnel:

1. **Detect** — cek binary `cloudflared` di PATH / `.tools/`
2. **Quick Tunnel** — `cloudflared tunnel --url http://127.0.0.1:8787`
3. Parse / tampilkan URL `*.trycloudflare.com`
4. (Opsional di fase ini) Named tunnel + hostname jika config lengkap

`nxcloudflare start` lifecycle (README §12):

```text
baca config → validasi → start HTTP → cek cloudflared → start tunnel → status
```

**Hasil:** layanan lokal punya URL HTTPS publik (dev).

---

### Fase E — Stabilisasi proses & observasi

- PID tracking (Node + cloudflared)
- Status tunnel di `/status` dan `nxcloudflare status` / `tunnel`
- Log terpisah: `server.log`, `tunnel.log`, `error.log`
- Shutdown: stop tunnel dulu, lalu HTTP server

**Hasil:** operasi harian (start/stop/status/logs) jelas dan dapat diuji di Windows.

---

### Fase F — Backlog (setelah fondasi)

Urutan usulan (selaras README §26–27, bisa diubah):

1. Named tunnel production + credentials aman
2. Recovery / health poll / reconnect
3. Security foundation (jangan expose admin; token / Access nanti)
4. Multi-service routes
5. `install` sebagai Windows service
6. Web dashboard

---

## 4. Struktur target (Fase A–E)

```text
NxCloudflare/
├── bin/
│   └── nxcloudflare.js
├── src/
│   ├── index.js
│   ├── server.js
│   ├── config.js
│   ├── logger.js
│   ├── cloudflare/
│   │   ├── tunnel.js
│   │   ├── process.js
│   │   └── config.js
│   ├── cli/
│   │   ├── start.js
│   │   ├── stop.js
│   │   ├── status.js
│   │   ├── tunnel.js
│   │   ├── config.js
│   │   ├── logs.js
│   │   └── help.js
│   └── utils/
│       ├── platform.js
│       ├── process.js
│       └── paths.js
├── config/
│   └── nxcloudflare.json
├── logs/                 # runtime, di-gitignore
├── package.json
├── .gitignore
├── README.md             # draft konsep
└── Plan.md               # dokumen ini
```

---

## 5. Urutan eksekusi (checklist)

Kerjakan **berurutan**; jangan lompat ke tunnel sebelum server + CLI lokal stabil.

- [x] **A1** `package.json` + `.gitignore` + folder kosong inti
- [x] **A2** CLI stub + `--help`
- [x] **B1** config loader + default JSON
- [x] **B2** logger
- [x] **B3** HTTP server + `/`, `/health`, `/status`
- [x] **C1** `start` / `stop` / `restart` + PID
- [x] **C2** `status` / `config` / `logs`
- [x] **D1** deteksi `cloudflared` saat start (tanpa doctor)
- [x] **D2** Quick Tunnel terintegrasi di `start`
- [x] **D3** status tunnel + log tunnel
- [x] **E1** graceful shutdown end-to-end
- [x] **E2** uji manual Windows (checklist §6) — lokal OK; tunnel perlu `cloudflared` di PATH
- [x] **F1** Build standalone `.exe` (Node SEA) — ✅ SUDAH DIEKSEKUSI (2026-09-11)
- [ ] **F\*** backlog sesuai kebutuhan (sisanya)

### F1 — Detail: Build standalone `.exe`

Mengikuti pola persis `D:\Framework\CLI\Teritip` dan `D:\Framework\CLI\nxdom`
(Node.js SEA — Single Executable Applications, bukan `pkg`/`nexe`).

**Perubahan file:**
- `src/utils/paths.js` — `ROOT_DIR` sekarang `isSea() ? path.dirname(process.execPath) : sourcePackageRoot()`, supaya `config/`, `logs/`, `.runtime/`, `.credentials/`, `web/` tetap portable di sebelah `.exe` alih-alih ikut ke path virtual blob.
- `scripts/build-exe.mjs` — baru, adaptasi dari `nxdom/scripts/build-exe.mjs`: esbuild bundle (`bin/nxcloudflare.js` → CJS) + `node --experimental-sea-config` + `postject` inject blob + strip Windows signature + checksum SHA-256.
- `package.json` — tambah `devDependencies` (`esbuild`, `postject`) dan `scripts.build:exe`.
- `.gitignore` — tambah `dist/` dan `.nxcloudflare-exe-build/`.

**Diverifikasi (2026-09-11):**
- `npm run build:exe` → `dist/nxcloudflare.exe` berhasil dibuat.
- `dist/nxcloudflare.exe config path` → resolve ke `dist/config/...` (bukan source folder) — path resolution SEA benar.
- `dist/nxcloudflare.exe start --no-tunnel` → server + web static jalan normal; `web/` yang belum disalin → 404 graceful (bukan crash).
- Setelah menyalin `web/`, `.tools/cloudflared.exe`, `.credentials/`, `config/nxcloudflare.json` ke `dist/`: `dist/nxcloudflare.exe start` (tunnel penuh) → tunnel `named` connect ke `nx.tirtamoolango.id`, endpoint publik (`/health`, `web.tirtamoolango.id`) 200, endpoint loopback-only (`/api/config`) tetap 403 dari publik — perilaku keamanan konsisten dengan mode `node src/index.js`.

**Yang perlu diingat untuk distribusi `.exe` ke PC lain:**
- `.tools/cloudflared.exe` **tidak** ikut ter-bundle di dalam `.exe` — harus disalin manual ke `dist/.tools/cloudflared.exe`.
- `.credentials/` (kredensial tunnel) juga tidak boleh ikut ter-bundle/dibagi — tiap instalasi/PC idealnya punya tunnel & kredensial sendiri, bukan menyalin punya PC ini.
- `config/nxcloudflare.json` default masih `mode: quick`, `hostname: ""` — untuk instalasi baru, konfigurasi ulang lewat `nxcloudflare config set` sebelum `start` mode `named`.

### F2 — Kesiapan lintas platform (Windows exe + Linux, sesuai README §4) — ✅ SUDAH DIEKSEKUSI (2026-09-11)

Audit menyeluruh terhadap asumsi Windows-only di kode, dilakukan sebelum
proyek benar-benar dijalankan di Linux (README §4 menyebut Linux sebagai
target sistem kedua, README §29 & Plan §3 menyatakan tahap pertama fokus
Windows dulu — bagian ini menyiapkan fondasinya).

**Bug ditemukan & diperbaiki:**
- `src/config.js` `getLocalCloudflaredPath()` — sebelumnya **hardcode**
  `.tools/cloudflared.exe`. Di Linux binary `cloudflared` tidak punya
  ekstensi, jadi fallback lokal ini tidak akan pernah ketemu. Diperbaiki
  jadi `isWindows() ? 'cloudflared.exe' : 'cloudflared'`.

**Sudah diverifikasi platform-safe (tidak perlu diubah):**
- `src/utils/process.js` — `killProcess`/`which`/`spawnAttached` sudah
  bercabang `isWindows()` dengan benar (`taskkill` vs `process.kill`,
  `where` vs `which`, `shell: isWindows()`).
- `src/web/staticServer.js`, `src/index.js` — path traversal guard &
  path normalization sudah pakai `path.sep` generik, bukan hardcode `\`.
- `src/cloudflare/config.js`, `src/utils/paths.js` — semua pakai
  `path.join`/`path.resolve`, tidak ada separator hardcode.

**Build Linux ditambahkan (sebelumnya cuma ada untuk Windows di F1):**
- `scripts/build-exe-linux.mjs` — baru, adaptasi persis dari
  `Teritip/scripts/build-exe-linux.mjs`: sama seperti `build-exe.mjs`
  tapi tanpa `stripWindowsSignature`, output tanpa ekstensi (`dist/nxcloudflare`),
  `chmod 755`. **Belum dijalankan/dites** — perlu Linux x64 asli atau WSL2
  (batasan Node SEA: builder harus jalan di platform yang sama dengan target,
  tidak bisa cross-compile Windows→Linux).
- `package.json` — tambah `scripts.build:exe:linux`.

**Diverifikasi ulang di Windows setelah perubahan (regresi check):**
- Dev server (`node src/index.js`) — tetap jalan normal, tunnel `named`
  connect, semua endpoint publik/loopback-only berperilaku sama seperti
  sebelum perubahan.
- `.exe` Windows di-rebuild ulang (`npm run build:exe`) dengan fix ini
  ikut ter-bundle — dites penuh sekali lagi (`dist/nxcloudflare.exe start`
  dengan `web/`, `.tools/cloudflared.exe`, `.credentials/`, `config/`
  disalin ke `dist/`): semua endpoint 200/403 sesuai ekspektasi, tidak ada
  regresi dari perubahan cross-platform.

**Belum dieksekusi / catatan untuk migrasi Linux nanti:**
- `scripts/build-exe-linux.mjs` belum pernah benar-benar dijalankan (perlu
  akses Linux x64/WSL2) — logikanya mengikuti pola Teritip yang sudah
  terbukti berhasil, tapi NxCloudflare-nya sendiri belum diuji nyata di Linux.
- `.credentials/config.yml.example` sudah diubah ke path relatif
  (portable Windows/Linux), TAPI `.credentials/config.yml` **asli/aktif**
  (dipakai tunnel live sekarang) sengaja **tidak** diubah — masih absolut
  Windows (`D:\Framework\...`). Kalau proyek ini dipindah ke Linux nanti,
  path itu harus disesuaikan manual saat migrasi (bukan otomatis).
- Belum ada CI/pengujian otomatis lintas platform — semua verifikasi di
  atas manual.

---

## 6. Kriteria selesai per fase

### Fase A–C selesai jika

- Server bind `127.0.0.1:8787`
- `/health` mengembalikan JSON ok
- CLI `start` / `stop` / `status` / `config` berfungsi di Windows
- Log tertulis di `logs/`

### Fase D–E selesai jika

- Tanpa `cloudflared` → pesan jelas dari `start`
- Dengan `cloudflared` → Quick Tunnel naik bersama server
- `status` menampilkan server + tunnel
- Ctrl+C / `stop` membersihkan kedua proses

---

## 7. Risiko & mitigasi

| Risiko | Mitigasi |
| ------ | -------- |
| `cloudflared` tidak terpasang / tidak di PATH | pesan jelas di `start` + opsi `.tools/cloudflared.exe` |
| Quick Tunnel URL berubah tiap run | Tampilkan URL di stdout + log; named tunnel untuk stabil |
| Proses zombie di Windows | PID file + verifikasi proses sebelum start ulang |
| Kredensial bocor ke git | `.gitignore` untuk secrets / credentials; path di config |
| Scope creep (dashboard, multi-route) | Patuhi checklist Fase A–E dulu |

---

## 8. Cara kerja setelah Plan disetujui

1. Setujui / revisi keputusan terbuka (§2).
2. Eksekusi mulai **Fase A** sesuai checklist (§5).
3. Setelah tiap fase: uji singkat di Windows, baru lanjut.
4. Update `README.md` hanya jika perilaku nyata sudah menyimpang dari draft dan perlu diselaraskan.

---

## 9. Keputusan yang diminta sebelum coding

Mohon konfirmasi singkat:

1. **HTTP:** Node `http` bawaan (tanpa Express) — OK?
2. **Tunnel v0.1:** Quick Tunnel dulu, named tunnel menyusul — OK?
3. **CLI proses:** foreground dulu (mudah debug), background/PID service kemudian — OK?
4. Ada nama hostname / domain production yang sudah pasti, atau fokus lokal + trycloudflare dulu?

Setelah jawaban di atas (atau “ikut default plan”), eksekusi dimulai dari Fase A.
