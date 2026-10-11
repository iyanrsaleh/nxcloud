# nxcloud

**nxcloud** adalah server Node.js lokal yang dirancang untuk menjalankan layanan di PC dan menyediakan akses jaringan melalui **Cloudflare Tunnel**.

nxcloud berdiri sebagai proyek mandiri.

## Instalasi (sama pola Teritip)

nxcloud pakai JavaScript murni — **tidak ada dependency npm runtime**, jadi folder `node_modules/` biasanya **tidak muncul** (itu normal, bukan kurang install). Dependency opsional hanya jika nanti ditambah; CLI jalan tanpa `npm install`.

Jalankan langsung:

```bash
node bin/nxcloud.js <perintah> [argumen]
```

Atau daftarkan command `nxcloud` secara global lewat `npm link` (di dalam folder proyek):

```bash
cd D:\Framework\CLI\nxcloud
npm link
nxcloud <perintah> [argumen]
```

Contoh:

```bash
nxcloud start
nxcloud status
nxcloud config show
```

Cabut link global:

```bash
npm unlink -g nxcloud
```

---

## 1. Tujuan

Tujuan utama nxcloud:

* Menjalankan server Node.js di PC.
* Menyediakan CLI untuk mengelola server.
* Menghubungkan server lokal dengan Cloudflare Tunnel.
* Menyediakan akses HTTPS dari Internet ke server lokal.
* Tidak membutuhkan port forwarding pada router.
* Tidak membutuhkan IP publik pada PC.
* Menyediakan konfigurasi sederhana.
* Menyediakan monitoring status server dan tunnel.

Konsep utamanya:

```text
Internet
    │
    ▼
Cloudflare
    │
    │ Tunnel
    ▼
PC
    │
    ▼
nxcloud
    │
    ▼
Node.js Application
```

---

# 2. Konsep nxcloud

nxcloud terdiri dari dua bagian utama:

```text
nxcloud
│
├── Node.js Server
│
└── Cloudflare Tunnel
```

Node.js menjalankan aplikasi lokal.

Cloudflare Tunnel menyediakan koneksi antara server lokal dan Cloudflare.

Contoh:

```text
https://app.example.com
          │
          ▼
     Cloudflare
          │
          ▼
   Cloudflare Tunnel
          │
          ▼
 localhost:3000
```

---

# 3. Prinsip Desain

nxcloud harus:

1. Sederhana.
2. Ringan.
3. Mudah diinstal.
4. Mudah dikonfigurasi.
5. Berjalan di Windows.
6. Dapat dikembangkan ke Linux kemudian.
7. Tidak bergantung pada framework frontend.
8. Menggunakan Node.js.
9. Memisahkan server lokal dan Cloudflare Tunnel.
10. Tidak menyimpan kredensial secara sembarangan.

---

# 4. Teknologi

Teknologi awal:

| Teknologi         | Fungsi                   |
| ----------------- | ------------------------ |
| Node.js           | Runtime                  |
| JavaScript        | Bahasa utama             |
| HTTP/HTTPS        | Server                   |
| Cloudflare Tunnel | Publikasi server         |
| cloudflared       | Connector Tunnel         |
| JSON              | Konfigurasi              |
| CLI               | Pengelolaan nxcloud |

Target sistem:

```text
Windows
Linux
```

Tahap pertama difokuskan pada:

```text
Windows + Node.js
```

---

# 5. Struktur Folder

Struktur awal:

```text
nxcloud/
│
├── bin/
│   └── nxcloud.js
│
├── src/
│   ├── index.js
│   ├── server.js
│   ├── config.js
│   ├── logger.js
│   │
│   ├── cloudflare/
│   │   ├── tunnel.js
│   │   ├── process.js
│   │   └── config.js
│   │
│   ├── cli/
│   │   ├── start.js
│   │   ├── stop.js
│   │   ├── status.js
│   │   ├── tunnel.js
│   │   └── config.js
│   │
│   └── utils/
│       ├── platform.js
│       ├── process.js
│       └── paths.js
│
├── config/
│   └── nxcloud.json
│
├── logs/
│
├── package.json
└── README.md
```

---

# 6. Komponen

## 6.1 Node.js Server

Server lokal menjadi inti nxcloud.

Contoh:

```text
127.0.0.1:8787
```

Server harus dapat:

* menerima HTTP request;
* memberikan response;
* menyediakan endpoint status;
* menyediakan informasi konfigurasi;
* menjalankan middleware dasar;
* menangani error;
* melakukan graceful shutdown.

---

# 7. API Dasar

Endpoint awal:

```text
GET /
GET /health
GET /status
```

Contoh:

```text
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "nxcloud"
}
```

Endpoint:

```text
GET /status
```

Contoh response:

```json
{
  "server": {
    "status": "running",
    "host": "127.0.0.1",
    "port": 8787
  },
  "cloudflare": {
    "status": "connected"
  }
}
```

---

# 8. Cloudflare Tunnel

Cloudflare Tunnel menjadi komponen untuk menghubungkan server lokal dengan jaringan Cloudflare.

Konsep:

```text
nxcloud
     │
     ▼
cloudflared
     │
     ▼
Cloudflare
     │
     ▼
Internet
```

nxcloud tidak menggantikan `cloudflared`.

nxcloud bertugas mengelola proses dan konfigurasi Tunnel.

---

# 9. Mode Tunnel

nxcloud memiliki dua mode.

## Development

Untuk pengujian cepat:

```text
nxcloud
      │
      ▼
Quick Tunnel
      │
      ▼
*.trycloudflare.com
```

Digunakan untuk:

* development;
* testing;
* demo;
* debugging.

---

## Production

Untuk penggunaan dengan domain sendiri:

```text
example.com
     │
     ▼
Cloudflare
     │
     ▼
Tunnel
     │
     ▼
nxcloud
```

Contoh:

```text
https://server.example.com
```

diteruskan ke:

```text
http://127.0.0.1:8787
```

---

# 10. Konfigurasi

File:

```text
config/nxcloud.json
```

Contoh:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 8787
  },
  "cloudflare": {
    "enabled": true,
    "hostname": "server.example.com",
    "service": "http://127.0.0.1:8787"
  }
}
```

Konfigurasi harus dapat diubah melalui CLI.

---

# 11. CLI

Command utama:

```bash
nxcloud
```

Menampilkan bantuan:

```bash
nxcloud --help
```

---

## Start

```bash
nxcloud start
```

Menjalankan:

```text
Node.js Server
+
Cloudflare Tunnel
```

---

## Stop

```bash
nxcloud stop
```

Menghentikan service nxcloud.

---

## Restart

```bash
nxcloud restart
```

Menghentikan dan menjalankan kembali server.

---

## Status

```bash
nxcloud status
```

Contoh:

```text
nxcloud
----------------------------
Server      : RUNNING
Host        : 127.0.0.1
Port        : 8787

Cloudflare
----------------------------
Tunnel      : CONNECTED
Hostname    : server.example.com
----------------------------
```

---

## Tunnel

```bash
nxcloud tunnel
```

Menampilkan informasi Tunnel.

---

## Config

```bash
nxcloud config
```

Menampilkan konfigurasi aktif.

---

## Logs

```bash
nxcloud logs
```

Menampilkan log server dan Tunnel.

---

# 12. Lifecycle

Ketika menjalankan:

```bash
nxcloud start
```

proses:

```text
1. Membaca konfigurasi
        │
        ▼
2. Validasi konfigurasi
        │
        ▼
3. Menjalankan Node.js Server
        │
        ▼
4. Memeriksa cloudflared
        │
        ▼
5. Menjalankan Cloudflare Tunnel
        │
        ▼
6. Memeriksa koneksi
        │
        ▼
7. Menampilkan status
```

---

# 13. Dependency Check

nxcloud memeriksa dependency saat `start` (bukan command terpisah).

Yang dicek antara lain:

```text
cloudflared (jika tunnel diaktifkan)
konfigurasi
```

Jika `cloudflared` tidak ditemukan saat tunnel dibutuhkan, `start` menampilkan error jelas dan dapat lanjut lokal saja (atau gagal, tergantung opsi).

Tidak ada command `doctor` — diagnosa lewat `status`, `logs`, dan pesan error `start`.

---

# 14. Logging

nxcloud menyediakan logging:

```text
logs/
├── server.log
├── tunnel.log
└── error.log
```

Level:

```text
INFO
WARN
ERROR
DEBUG
```

Contoh:

```text
[INFO] nxcloud started
[INFO] Server listening on 127.0.0.1:8787
[INFO] Cloudflare Tunnel starting
[INFO] Tunnel connected
```

---

# 15. Process Manager

nxcloud harus mengetahui proses yang sedang berjalan.

Contoh:

```text
nxcloud
│
├── Node.js PID
└── cloudflared PID
```

Status proses:

```text
RUNNING
STOPPED
FAILED
UNKNOWN
```

Jika salah satu proses mati, nxcloud dapat mendeteksinya.

---

# 16. Graceful Shutdown

Ketika:

```text
Ctrl + C
```

nxcloud harus:

```text
1. Menghentikan penerimaan request baru
2. Menunggu request aktif selesai
3. Menghentikan Tunnel
4. Membersihkan process
5. Menutup server
6. Menulis log
```

---

# 17. Keamanan

Keamanan menjadi bagian penting dari nxcloud.

Hal yang harus diperhatikan:

```text
Cloudflare Access
Authentication
Token
HTTPS
Session
Rate Limit
Logging
```

Jangan membuat endpoint administratif terbuka ke Internet tanpa perlindungan.

Contoh endpoint yang nantinya perlu perlindungan:

```text
/admin
/config
/process
/command
```

Tahap pertama cukup menyediakan fondasi keamanan.

---

# 18. Localhost Security

Default server:

```text
127.0.0.1
```

bukan:

```text
0.0.0.0
```

Tujuannya agar aplikasi tidak otomatis terbuka langsung ke jaringan lokal.

Cloudflare Tunnel menjadi jalur yang dikontrol untuk akses eksternal.

---

# 19. Domain

nxcloud mendukung hostname Cloudflare.

Contoh:

```text
server.example.com
api.example.com
app.example.com
```

Konsep konfigurasi:

```text
Hostname
    │
    ▼
Cloudflare Tunnel
    │
    ▼
Local Service
```

---

# 20. Multiple Service

Pada tahap berikutnya nxcloud dapat mendukung beberapa service.

Contoh:

```text
server.example.com
        │
        ▼
localhost:8787

api.example.com
        │
        ▼
localhost:3000

dev.example.com
        │
        ▼
localhost:5173
```

Konfigurasi:

```json
{
  "routes": [
    {
      "hostname": "server.example.com",
      "service": "http://127.0.0.1:8787"
    },
    {
      "hostname": "api.example.com",
      "service": "http://127.0.0.1:3000"
    }
  ]
}
```

---

# 21. Dashboard

Dashboard bukan bagian wajib versi pertama.

Versi awal cukup CLI.

Roadmap:

```text
CLI
 │
 ▼
Web Dashboard
```

Dashboard nantinya dapat menampilkan:

```text
Server
Tunnel
Domain
Traffic
Logs
Processes
Configuration
```

---

# 22. Auto Start

Fitur lanjutan:

```bash
nxcloud install
```

Memasang nxcloud sebagai Windows service atau mekanisme startup.

Kemudian:

```text
Windows Boot
     │
     ▼
nxcloud
     │
     ├── Node.js Server
     └── Cloudflare Tunnel
```

---

# 23. Health Monitoring

nxcloud dapat melakukan pemeriksaan berkala:

```text
Server
   │
   ├── HTTP Health
   ├── Process
   └── Tunnel
```

Contoh:

```text
Every 30 seconds

Server     ✓
Tunnel     ✓
Network    ✓
```

Jika Tunnel terputus:

```text
Tunnel ✗
```

nxcloud dapat melakukan reconnect.

---

# 24. Recovery

Target:

```text
Tunnel mati
    │
    ▼
nxcloud mendeteksi
    │
    ▼
Restart Tunnel
    │
    ▼
Connected
```

Jika Node.js mati:

```text
Node.js mati
    │
    ▼
nxcloud mendeteksi
    │
    ▼
Restart Server
```

Fitur automatic recovery dapat diaktifkan melalui konfigurasi.

---

# 25. Package

Contoh `package.json`:

```json
{
  "name": "nxcloud",
  "version": "0.1.0",
  "description": "Local Node.js server manager with Cloudflare Tunnel",
  "type": "module",
  "bin": {
    "nxcloud": "./bin/nxcloud.js"
  },
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  }
}
```

---

# 26. Versi Pengembangan

## v0.1.0 — Core

Fokus:

```text
Node.js Server
CLI
Config
Logging
Status
```

---

## v0.2.0 — Cloudflare

Tambahkan:

```text
cloudflared
Quick Tunnel
Named Tunnel
Hostname
Tunnel Status
```

---

## v0.3.0 — Process Manager

Tambahkan:

```text
PID management
Restart
Recovery
Health Check
```

---

## v0.4.0 — Security

Tambahkan:

```text
Authentication
Token
Access integration
Rate Limit
Security configuration
```

---

## v0.5.0 — Multi Service

Tambahkan:

```text
Multiple hostname
Multiple local service
Routing
Service management
```

---

## v0.6.0 — Dashboard

Tambahkan:

```text
Web Dashboard
Server monitoring
Tunnel monitoring
Logs
Configuration
```

---

# 27. Roadmap

```text
                    nxcloud
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
      Local Server                 Cloudflare
          │                             │
          ▼                             ▼
       Node.js                    cloudflared
          │                             │
          └──────────────┬──────────────┘
                         ▼
                      Internet
```

Roadmap keseluruhan:

```text
[1] Core Server
      │
      ▼
[2] CLI
      │
      ▼
[3] Cloudflare Tunnel
      │
      ▼
[4] Process Manager
      │
      ▼
[5] Security
      │
      ▼
[6] Multi Service
      │
      ▼
[7] Monitoring
      │
      ▼
[8] Dashboard
      │
      ▼
[9] Production
```

---

# 28. Target Akhir

Target akhir nxcloud adalah memberikan cara sederhana untuk membuat server Node.js lokal menjadi layanan yang dapat diakses melalui Internet.

Perintah utama:

```bash
nxcloud start
```

Hasil:

```text
Local Server
     │
     ▼
nxcloud
     │
     ▼
Cloudflare Tunnel
     │
     ▼
Public HTTPS
```

Contoh:

```text
Local:

http://127.0.0.1:8787

Public:

https://server.example.com
```

---

# 29. Prinsip Penting

nxcloud **bukan hosting VPS**.

nxcloud menjalankan service di komputer lokal.

Cloudflare menyediakan jaringan/Tunnel di depannya.

```text
PC sendiri
    +
Node.js
    +
nxcloud
    +
Cloudflare Tunnel
```

sehingga PC dapat berfungsi sebagai **origin server** yang dapat diakses melalui hostname Cloudflare.

---

# 30. Status Proyek

```text
Project      : nxcloud
Type         : Node.js CLI / Server
Status       : Planning
Target       : Local Server + Cloudflare Tunnel
Platform     : Windows (first)
Language     : JavaScript
License      : TBD
```

## Prioritas pertama

Implementasi awal hanya:

```text
1. Node.js Server
2. CLI
3. Configuration
4. Start / Stop
5. Status
6. cloudflared detection
7. Cloudflare Tunnel
8. Logs
```

Setelah fondasi tersebut stabil, fitur lain dikembangkan secara bertahap.

---

# Rencana: Status login Cloudflare di halaman Domain

Status: **SUDAH DIEKSEKUSI ✅** (2026-10-07)

## Masalah

User sudah approve login Cloudflare di browser, tetapi halaman Domain tetap menampilkan
"Akun Cloudflare belum terhubung" dan tombol cek ulang menjawab "Belum terdeteksi login".

Penyebab:

1. Server hanya mengecek keberadaan `~/.cloudflared/cert.pem`, padahal cloudflared bisa
   gagal menulis sertifikat setelah approve (`ERR Failed to write the certificate ...
   error="Failed to fetch resource"`). Approve berhasil, tapi `cert.pem` tidak pernah
   terbentuk, jadi API selalu balas `loggedIn:false`.
2. `triggerCloudflaredLogin()` menjalankan cloudflared dengan `stdio:'ignore'`, sehingga
   URL login dan error cloudflared dibuang. UI tidak pernah menerima alasan kegagalan,
   dan tombol login bisa menumpuk banyak proses `cloudflared tunnel login`.

## Keputusan desain

* State login ditahan di server (`src/cloudflare/auth.js`): `pending`, `url`, `error`,
  `message`, `startedAt`, `finishedAt`.
* Output stdout/stderr cloudflared ditangkap dan diparsing (URL `argotunnel`, baris `ERR`
  beserta instruksi manual-copy berikutnya).
* `GET /api/auth/status` ikut mengembalikan objek `login`; `POST /api/auth/login` menolak
  spawn ganda bila login masih berjalan dan mengembalikan state yang sama.
* Polling `cert.pem` tiap 1 detik selama login berjalan, agar status "terhubung" terdeteksi
  walau proses cloudflared belum keluar.
* UI (`Desktop/templates/nxcloud/domain.js`) memilih banner berdasarkan state:
  `pending` → tautan URL + polling otomatis tiap 3 detik; `error` → pesan cloudflared
  ditampilkan apa adanya (termasuk path tujuan manual copy); selain itu → banner lama.

## Perubahan file

* `src/cloudflare/auth.js` — tangkap output login, state, tolak spawn ganda, poll cert.pem.
* `src/api/router.js` — `/api/auth/status` menyertakan `login`; import `getLoginState`.
* `Desktop/templates/nxcloud/domain.js` — banner pending/error, auto-poll, escaping.

---

# Rencana: Tunnel jalan tanpa cert.pem + DNS via API token

Status: **SUDAH DIEKSEKUSI ✅** (2026-10-07)

## Masalah

`cloudflared tunnel login` gagal total di akun ini — approve di browser tidak
pernah tercatat, selalu `Waiting for login...` ×10 lalu `Failed to fetch
resource` (bug upstream terbuka: cloudflare/cloudflared#1252). Dampaknya dua:

1. `src/index.js` **mematikan named tunnel** hanya karena `cert.pem` tidak ada,
   padahal file kredensial tunnel (`.credentials/<uuid>.json`) valid dan cukup
   untuk `tunnel run`.
2. Halaman Domain menolak submit karena `isLoggedIn=false`, dan
   `cloudflared tunnel route dns` (satu-satunya jalur buat CNAME) juga butuh
   cert.

## Keputusan desain

* **Tunnel**: start selama `mode=named` — cert.pem tidak lagi syarat; cert
  hanya untuk perintah manajemen. Bila cert & token sama-sama kosong, cukup
  log warning (jangan skip).
* **DNS**: `addDnsRoute()` memakai **REST Cloudflare dengan API token**
  (`cloudflare.apiToken`) bila tersedia — `GET /zones?name=` → cek record →
  `POST /dns_records` (CNAME → `<tunnel-uuid>.cfargotunnel.com`, proxied).
  Tanpa token, jatuh ke jalur CLI lama (cert) plus pesan bantuan.
* **Status**: `/api/auth/status` menambah `tokenSet` dan `ready`
  (`loggedIn || tokenSet`); `/api/config` menambah `apiTokenSet`
  (nilai token tidak pernah dibocorkan).
* **UI**: `domain.js` menganggap form siap saat `ready`; banner punya 3 state —
  hijau (cert / token), kuning (login pending), merah (belum terhubung, dengan
  instruksi langkah API token + tombol alternatif cert).

## Perubahan file

* `src/config.js` — key baru `cloudflare.apiToken` (default kosong).
* `src/cloudflare/api.js` (baru) — `hasApiToken()`, `findZoneId()`,
  `resolveTunnelTarget()`, `createCnameRecord()`.
* `src/cloudflare/dns.js` — `addDnsRoute()` pakai REST bila token ada.
* `src/index.js` — tidak lagi skip tunnel saat cert hilang.
* `src/api/router.js` — `tokenSet`/`ready` di auth status, `apiTokenSet`
  di config publik.
* `Desktop/templates/nxcloud/domain.js` — banner 3 state + `ready`.

### Diverifikasi (2026-10-07, end-to-end nyata)

- `GET /api/auth/status` → `tokenSet:true, ready:true`; tunnel `connected` (4 koneksi QUIC) **tanpa** `cert.pem`.
- Token diuji langsung: `user/tokens/verify` → `active`; `GET /zones?name=tirtamoolango.id` → zone ditemukan.
- `POST /api/routes` (`nx.tirtamoolango.id` → `127.0.0.1:8787`) → respons `dns.via:"api-token"`,
  `dns.created:true` (CNAME → `2153403b-….cfargotunnel.com`), ingress config.yml tertulis ulang (3 hostname).
- Restart tunnel → `https://nx.tirtamoolango.id/health` → **200** `{status:ok}` (sebelumnya NXDOMAIN).
- Regresi: `model.tirtamoolango.id` → 200, `socket.tirtamoolango.id` → 502 (origin mati, tunnel tetap jalan).
