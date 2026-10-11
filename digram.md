# Diagram Alur — nxcloud (kondisi saat ini)

> Menggambarkan alur request nyata setelah perbaikan `isLoopback()` di `src/server.js`
> dan penambahan subdomain `web.tirtamoolango.id` (static HTML server).
> Klasifikasi endpoint memakai prinsip: **akses ditentukan per-root/tujuan**, bukan cuma per method.

---

## 0. Peta tunnel & subdomain (gambaran besar saat ini)

```text
                         Cloudflare Tunnel: "nxcloud"
                         tunnel ID: 2153403b-e7ab-4d00-a81b-b8db497a37e4
                         (satu tunnel, banyak hostname ingress)

        ┌───────────────────────┬───────────────────────┬───────────────────────┐
        ▼                       ▼                       ▼
 nx.tirtamoolango.id     socket.tirtamoolango.id   web.tirtamoolango.id
        │                       │                       │
        ▼                       ▼                       ▼
 127.0.0.1:8787            127.0.0.1:7080           127.0.0.1:8789
 (nxcloud API/         (service lain,           (nxcloud static
  server.js + api/router)    di luar repo ini)         web server — BARU)
        │                                               │
        ▼                                               ▼
 JSON: /health /status                            HTML: web/index.html
 /api/config /api/tunnel                          (path-traversal-safe,
 /api/logs /api/routes                             folder web/ di root)
 /api/control/*
```

Status hidup (dites hari ini):
- `nx.tirtamoolango.id` → 200, tunnel connected
- `web.tirtamoolango.id` → 200, HTML tersaji, DNS CNAME dibuat via
  `cloudflared tunnel route dns nxcloud web.tirtamoolango.id`
- `socket.tirtamoolango.id` → di luar cakupan kerja sesi ini (service lain)

---

## 1. Alur request masuk — jalur API (nx.tirtamoolango.id)

```text
                         ┌───────────────────────┐
                         │        Client          │
                         │ (Desktop lokal / user   │
                         │   internet via domain)  │
                         └───────────┬─────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                         │
                 ▼                                         ▼
     http://127.0.0.1:8787                    https://nx.tirtamoolango.id
     (langsung ke Node.js)                       (lewat Cloudflare edge)
                 │                                         │
                 │                                         ▼
                 │                              ┌─────────────────────┐
                 │                              │ Cloudflare Tunnel    │
                 │                              │ (cloudflared)        │
                 │                              │ tambah header:       │
                 │                              │  cf-connecting-ip    │
                 │                              │  cf-ray              │
                 │                              └──────────┬───────────┘
                 │                                         │
                 │                              connect ke 127.0.0.1:8787
                 │                                         │
                 └──────────────────┬──────────────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   src/server.js          │
                        │   http.createServer()    │
                        └────────────┬──────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   isLoopback(req)         │
                        │                           │
                        │  socket=127.0.0.1 ?        │
                        │    │                      │
                        │    ├─ tidak → FALSE        │
                        │    │                      │
                        │    └─ ya → ada header      │
                        │        cf-connecting-ip /   │
                        │        cf-ray ?             │
                        │           ├─ ya → FALSE     │
                        │           │  (via tunnel,    │
                        │           │   bukan lokal)   │
                        │           └─ tidak → TRUE    │
                        │              (benar2 lokal)  │
                        └────────────┬──────────────┘
                                     ▼
                          loopback = true / false
                          (diteruskan ke handleApi)
```

**Kenapa perlu cek header, bukan cuma IP socket:**
`cloudflared` selalu menghubungi `127.0.0.1:8787` sebagai proses lokal —
jadi *socket* request dari internet pun terlihat `127.0.0.1`.
Header `cf-connecting-ip` / `cf-ray` cuma disisipkan Cloudflare untuk
trafik yang benar-benar lewat tunnel, jadi itu pembeda yang valid.

---

## 1b. Alur request — jalur Web statis (web.tirtamoolango.id)

```text
                         ┌───────────────────────┐
                         │        Client          │
                         │   (siapa saja/publik)   │
                         └───────────┬─────────────┘
                                     ▼
                       https://web.tirtamoolango.id
                                     │
                                     ▼
                        ┌─────────────────────┐
                        │ Cloudflare Tunnel    │
                        │ (cloudflared)        │
                        └──────────┬───────────┘
                                   │
                        connect ke 127.0.0.1:8789
                                   ▼
                    ┌─────────────────────────────┐
                    │ src/web/staticServer.js       │
                    │ createStaticServer()          │
                    └────────────┬──────────────────┘
                                 ▼
                    resolveSafePath(url.pathname)
                    - decode + normalisasi path
                    - tolak kalau keluar dari WEB_DIR (../.. dst)
                                 │
                    ┌────────────┴────────────┐
                    ▼                          ▼
             path valid                  path invalid
                    │                          │
        cek fs.stat(target)              403 Forbidden
                    │
        ┌───────────┴────────────┐
        ▼                         ▼
   file ada                  file tidak ada
        │                         │
   sendFile()               cek web/404.html
   (Content-Type              ├─ ada  → 404 + isi file itu
    sesuai ekstensi)          └─ tidak → 404 polos
```

**Beda penting dengan jalur API (`nx.`):**
tidak ada pengecekan `isLoopback` sama sekali di jalur ini — memang
didesain publik sepenuhnya (tujuannya menampilkan halaman HTML ke
siapa saja), proteksinya cukup di level filesystem (anti path-traversal),
bukan di level identitas pengakses.

Method selain `GET`/`HEAD` ditolak `405` — server ini murni penyaji
file statis, tidak ada endpoint tulis.

---

## 2. Klasifikasi endpoint — per tujuan (root), bukan per method

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js Server (src/server.js)                │
│                     src/api/router.js → handleApi()                │
└─────────────────────────────────────────────────────────────────┘
        │
        ├── PUBLIK MURNI (sesuai README §7 — memang untuk itu)
        │   ├── GET /
        │   ├── GET /health
        │   └── GET /status
        │       → tidak ada pengecekan loopback sama sekali
        │       → aman dibuka: cuma info hidup/mati, tanpa detail internal
        │
        ├── SEHARUSNYA LOKAL-ONLY (baca) — saat ini MASIH TERBUKA
        │   ├── GET /api/config     ⚠ bocorkan struktur config & path
        │   ├── GET /api/tunnel     ⚠ bocorkan hostname/mode tunnel
        │   ├── GET /api/logs       ⚠ bocorkan isi log (internal, IP, error)
        │   └── GET /api/routes     ⚠ bocorkan peta semua service internal PC
        │       → BELUM dijaga isLoopback — celah nyata dari internet
        │
        └── LOKAL-ONLY (tulis) — SUDAH dijaga & terverifikasi
            ├── POST   /api/routes
            ├── PATCH  /api/routes/:id
            ├── DELETE /api/routes/:id
            ├── POST   /api/control/stop
            └── POST   /api/control/restart
                → requireLoopbackWrite(loopback) → 403 jika bukan loopback
                → sudah dites: lewat domain publik = 403, lokal = lolos
```

---

## 3. Status verifikasi (terkini — setelah fix)

```text
Endpoint                          Lokal        Publik (tunnel)
────────────────────────────────  ───────────  ─────────────────
GET  /health                      200 OK       200 OK   (memang publik)
GET  /status                      200 OK       200 OK   (memang publik)
GET  /api/config                  200 OK       403       ✅ FIXED
GET  /api/tunnel                  200 OK       403       ✅ FIXED
GET  /api/logs                    200 OK       403       ✅ FIXED
GET  /api/routes                  200 OK       403       ✅ FIXED
PATCH /api/routes/:id             lolos guard  403       ✅ sudah benar
POST /api/control/stop            (allowControl=false → 403 di kedua sisi)
```

---

## 4. Gap yang sudah ditutup ✅ SUDAH DIEKSEKUSI

```text
        Endpoint                     Status sebelum    Status sekarang
        ──────────────────────────  ────────────────  ──────────────────
        GET /api/config              publik            loopback-only ✅
        GET /api/tunnel               publik            loopback-only ✅
        GET /api/logs                 publik            loopback-only ✅
        GET /api/routes (list+detail)  publik            loopback-only ✅

        Perubahan: src/api/router.js
        - tambah helper requireLoopbackRead(loopback)
        - dipasang di GET /api/config, /api/tunnel, /api/logs,
          /api/routes, /api/routes/:id
        - konsisten dengan §4.3 Plan-dashboard-api.md:
          "route publik hanya /health + /status baca-saja;
           sisanya localhost / Desktop."
```

---

## 5. Web static server — SUDAH DIEKSEKUSI ✅

```text
Dibangun:
- src/web/staticServer.js   (server statis baru, port 8789)
- web/index.html            (halaman contoh)
- src/index.js              (start/stop bareng server utama & tunnel)
- config/nxcloud.json  (blok "web": enabled/host/port/hostname)
- .credentials/config.yml   (ingress web.tirtamoolango.id → 127.0.0.1:8789)
- DNS CNAME dibuat via cloudflared CLI (bukan dashboard manual)

Diverifikasi:
- Lokal  http://127.0.0.1:8789/         → 200
- Publik https://web.tirtamoolango.id/  → 200, Content-Type text/html
- Path traversal (../../config/...)     → 404 (diblokir resolveSafePath)
- Method selain GET/HEAD                → 405
```

---

## 6. Belum dieksekusi (menunggu keputusan/implementasi)

- Token/Cloudflare Access — hanya untuk root yang sengaja dipublikasikan nanti (README §17, v0.4.0 Security / Plan-dashboard-api.md Fase P4).
- Rate limiting endpoint publik (`/health`, `/status`, dan sekarang `web.tirtamoolango.id`).
- Race condition ringan di `routes.js` saat write concurrent (belum prioritas).
- `web/404.html` belum dibuat — fallback saat ini polos "Not Found" tanpa styling.
- Belum ada halaman lain selain `web/index.html` — isi/struktur situs itu keputusan Anda.
