# Rencana — API + Client untuk Dasbor (Pendekatan Teritip)

> **Status:** rencana awal. Dasbor UI = tugas Anda nanti.  
> **Sekarang:** siapkan fondasi API + client, dan daftar repo yang harus dibangun.  
> **Referensi pendekatan:** `D:\Framework\CLI\Teritip\engine\README.md` + `Analsis.md` (sebagai POLA/REFERENSI saja)  
> **Domain publik:** `https://nx.tirtamoolango.id` (NxCloudflare + Named Tunnel)

> **⚠️ Perubahan arah (2026-09-11):** Rencana awal di §1/§5/§8 menempatkan
> `Teritip Desktop` sebagai shell GUI final ("satu pintu kelola semua app",
> client diletakkan di `Teritip/Desktop/lib/`). Keputusan itu **berubah**:
> **NxCloudflare akan punya Desktop/GUI pengelola sendiri** (proyek/folder
> terpisah, belum dibangun). Teritip Desktop sekarang berstatus **referensi
> pola saja** (contoh struktur template, cara `NEXA.*Api` bekerja), bukan
> tempat integrasi permanen NxCloudflare. Stub yang sudah terlanjur dibuat di
> `Teritip/Desktop/templates/nxcloudflare/` (Fase P1/P2, lihat §7) TETAP ADA
> apa adanya sebagai referensi — tidak disentuh/disinkronkan lagi dari sesi
> NxCloudflare ini, termasuk gap yang diketahui: mirror client di
> `Teritip/Desktop/lib/nxcloudflareApi.js` belum punya dukungan
> `controlToken` (Fase P4) dan README stub-nya menyebut menu Pembelokan
> sebagai "mock" padahal kodenya sudah memanggil `/api/routes` sungguhan.
> Desktop pengelola NxCloudflare yang sesungguhnya akan direncanakan
> terpisah saat dikerjakan.

**Tanggal:** 2026-09-10 (direvisi 2026-09-11)

---

## 1. Prinsip (ikut Teritip)

Sama seperti `teritip serve` + Desktop:

| Lapisan | Peran | Bukan peran |
| ------- | ----- | ----------- |
| **Engine / CLI** | Logika nyata (start/stop/status/tunnel/…) | Bukan UI |
| **HTTP API** | Lapisan tipis di atas engine (`http` bawaan, JSON) | Bukan Express wajib |
| **Client API** | Modul JS yang memanggil endpoint (dipakai Desktop) | Bukan halaman visual |
| **Desktop** | Shell GUI — menu, halaman, tombol | Tidak menduplikasi logika engine |
| **NxCloudflare** | Gateway PC ↔ Internet (tunnel + reverse ke service lokal) | Bukan tempat isi bisnis app |

```text
User (browser / Desktop)
        │
        ▼
┌───────────────────────────┐
│  Teritip Desktop          │  ← satu pintu kelola semua app
│  (templates per-app)      │
└─────────────┬─────────────┘
              │ HTTP (client API)
              ▼
┌───────────────────────────┐
│  App APIs (localhost)     │
│  • teritip serve :7331    │
│  • nxcloudflare API :8787 │
│  • app lain nanti         │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│  NxCloudflare + Tunnel    │  ← nx.tirtamoolango.id
│  (publik / remote akses)  │
└───────────────────────────┘
```

**Keputusan akses dasbor:**

- **Lokal (utama untuk kelola):** Desktop → `http://127.0.0.1:…` (aman, seperti Teritip).
- **Publik (opsional nanti):** lewat `https://nx.tirtamoolango.id/...` — **wajib** auth/token sebelum diekspos (jangan buka admin mentah ke internet).

---

## 2. Apa yang *bukan* dikerjakan sekarang

- Desain visual dasbor (layout, brand, halaman) — **tugas Anda**
- Fitur container Teritip baru (sudah ada API + GUI Teritip)
- Multi-tenant / billing

---

## 3. Daftar repo / proyek yang harus dibangun

Urutan prioritas. Satu baris = satu “unit kerja” yang bisa jadi folder/repo terpisah atau modul dalam monorepo.

| # | Proyek / modul | Lokasi usulan | Status sekarang | Harus dibangun? | Fungsi |
| - | -------------- | ------------- | --------------- | --------------- | ------ |
| 1 | **NxCloudflare Core** | `D:\Framework\CLI\NxCloudflare` | Ada (server+CLI+tunnel) | **Perkuat API** | Gateway, status, tunnel, health |
| 2 | **NxCloudflare API (REST)** | `NxCloudflare/src/api/` (baru) | Belum (hanya `/` `/health` `/status`) | **Ya — prioritas** | Kontrak HTTP untuk dasbor/Desktop |
| 3 | **NxCloudflare Client** | `NxCloudflare/client/` atau `Teritip/Desktop/lib/nxcloudflare-api.js` | Belum | **Ya — prioritas** | Fungsi `getStatus()`, `getTunnel()`, … untuk template Desktop |
| 4 | **NxCloudflare Desktop plugin** | `Teritip/Desktop/templates/nxcloudflare/` | Belum | **Ya (setelah API+client)** | Halaman GUI — **Anda konsepkan** |
| 5 | **Teritip Engine + serve** | `D:\Framework\CLI\Teritip` | Sudah lengkap | Tidak (pakai existing) | Runtime app/container + API `:7331` |
| 6 | **Teritip Desktop shell** | `D:\Framework\CLI\Teritip\Desktop` | Sudah ada (teritip pages) | **Integrasi saja** | Pintu masuk semua app |
| 7 | **App packages** (nanti) | Desktop templates + service API masing-masing | — | Menyusul | App bisnis di belakang Nx/Teritip |

### Ringkas: yang *wajib* dibangun dulu (sebelum dasbor Anda)

```text
[A] NxCloudflare REST API  (perluas server)
[B] Client API JS          (konsumsi A)
[C] Daftarkan di Desktop   (stub halaman + NEXA.nxApi) — UI kosong/minimal OK
```

Dasbor penuh (wireframe, UX) = setelah A–C siap.

---

## 4. Kontrak API NxCloudflare (siapkan dulu)

Ikuti pola Teritip: **endpoint = mirror CLI**, JSON, error `{ "error": "..." }`.

### 4.1 Endpoint inti (v1 dasbor)

| Method | Path | Setara CLI | Dipakai dasbor untuk |
| ------ | ---- | ---------- | -------------------- |
| `GET` | `/health` | — | Health badge |
| `GET` | `/status` | `status` | Kartu server + tunnel |
| `GET` | `/api/config` | `config show` | Tampil konfigurasi (tanpa secrets) |
| `GET` | `/api/tunnel` | `tunnel` | Detail tunnel / hostname / URL |
| `GET` | `/api/logs?source=server\|tunnel\|error&lines=N` | `logs` | Panel log |
| `POST` | `/api/control/stop` | `stop` | Tombol stop (**lokal saja / auth**) |
| `POST` | `/api/control/restart` | `restart` | Tombol restart (**lokal saja / auth**) |

### 4.2 Sengaja ditunda

| Path | Alasan |
| ---- | ------ |
| Proxy penuh ke Teritip `:7331` | Bisa belakangan; Desktop bisa panggil Teritip API langsung di localhost |
| Auth Cloudflare Access | Wajib sebelum buka `/api/control/*` ke publik |
| Multi-hostname CRUD | Setelah satu hostname stabil |

### 4.3 Keamanan (wajib di rencana)

- Default bind tetap `127.0.0.1`.
- Endpoint **kontrol** (`stop`/`restart`) **jangan** dipublikasikan lewat tunnel tanpa token/Access.
- Opsi: route publik hanya `/health` + `/status` baca-saja; sisanya localhost / Desktop.

---

## 5. Client API (untuk Desktop)

> Lihat catatan perubahan arah di kepala dokumen. Update 2026-09-11:
> Desktop NxCloudflare mandiri **sudah ada** — `NxCloudflare/Desktop/`
> (scaffold, identitas dibersihkan, `npm install` selesai). Lihat
> `Plan-desktop.md` §6 untuk detail lengkap.

File client API, per status keaktifan:

```text
NxCloudflare/client/nxcloudflareApi.js    ← sumber utama, terus di-update (mis. Fase P4 controlToken)
NxCloudflare/Desktop/lib/nxcloudflareApi.js ← salinan aktif, dipakai Desktop mandiri (NEXA.nxcloudflareApi)
Teritip/Desktop/lib/nxcloudflareApi.js    ← mirror lama, TIDAK disinkronkan lagi (referensi historis)
```

`NxCloudflare/Desktop/lib/nxcloudflareApi.js` disinkronkan **manual**
(disalin ulang) dari `NxCloudflare/client/nxcloudflareApi.js` per
2026-09-11 — termasuk dukungan `controlToken`/`X-Nx-Token`. Tidak ada
mekanisme sinkronisasi otomatis; kalau client sumber utama diupdate lagi,
salinan di `Desktop/lib/` perlu disalin ulang manual.

Pola (seperti `NEXA.teritipApi`):

```js
// Contoh kontrak client — implementasi nanti
NEXA.nxcloudflareApi = {
  baseUrl: "http://127.0.0.1:8787",
  getHealth: () => fetch(...),
  getStatus: () => fetch(...),
  getTunnel: () => fetch(...),
  getConfig: () => fetch(...),
  getLogs: (source, lines) => fetch(...),
  stop: () => fetch(...),   // hanya jika diizinkan
  restart: () => fetch(...)
};
```

Template dasbor nanti hanya:

```text
Desktop/templates/nxcloudflare/
  index.js      ← sidebar entry "NxCloudflare"
  overview.js   ← status/tunnel (Anda desain)
  logs.js       ← opsional
```

---

## 6. Domain & routing

| Hostname | Target | Catatan |
| -------- | ------ | ------- |
| `nx.tirtamoolango.id` | NxCloudflare `:8787` | Sudah jalan (named tunnel) |
| `socket.tirtamoolango.id` | `127.0.0.1:7080` | Service lain, di luar cakupan repo ini |
| `web.tirtamoolango.id` | NxCloudflare static web `:8789` | ✅ SUDAH DIEKSEKUSI (2026-09-11) — di luar cakupan asli Plan ini, ditambah langsung sesuai permintaan; lihat `digram.md` §0/§1b/§5 untuk detail arsitektur. Server: `src/web/staticServer.js`, konten: `web/`, config: `web.*` di `config/nxcloudflare.json`. DNS CNAME dibuat via `cloudflared tunnel route dns`. Publik penuh (tanpa loopback-guard) — anti path-traversal di level filesystem. |
| Lokal Desktop NxCloudflare | `127.0.0.1:8787` (API) + `127.0.0.1:7801` (Desktop Electron) | Kelola NxCloudflare tanpa internet — lihat `Plan-desktop.md` |
| `www` / apex | Terpisah | Bukan panel kelola (kecuali diputuskan nanti) |

**Alur user kelola aplikasi (rencana awal, SUDAH BERUBAH — lihat catatan di kepala dokumen):**

~~1. Buka Teritip Desktop~~
~~2. Menu NxCloudflare → status tunnel / domain~~
~~3. Menu Teritip → images/containers~~
~~4. Menu app lain → masing-masing template Desktop~~

**Alur baru (✅ scaffold-nya sudah ada, lihat `Plan-desktop.md` §6):**
NxCloudflare dikelola lewat Desktop/GUI miliknya sendiri —
`NxCloudflare/Desktop/` (Electron, port `7801`, identitas sudah dibersihkan
dari sisa Teritip, `npm install` selesai). Teritip Desktop kembali murni
mengelola Teritip saja; stub yang tersisa di
`Teritip/Desktop/templates/nxcloudflare/` berstatus referensi historis
(lihat catatan di kepala dokumen), tidak disinkronkan lagi.

---

## 7. Fase eksekusi (teknis — sebelum konsep dasbor Anda)

### Fase P0 — API NxCloudflare

- [x] Router `/api/*` di `src/api/router.js` + `src/server.js`
- [x] Implement endpoint §4.1 (read-only: health/status/config/tunnel/logs)
- [x] Control endpoints dilindungi `api.allowControl: false` default + localhost-only
- [x] Uji lewat `https://nx.tirtamoolango.id/status` (read-only) — opsional saat tunnel nyala

### Fase P1 — Client

- [x] `NxCloudflare/client/nxcloudflareApi.js` — sumber utama, terus di-update (mis. Fase P4 controlToken)
- [x] ~~`Teritip/Desktop/lib/nxcloudflareApi.js`~~ — mirror awal, sekarang referensi historis (lihat catatan di kepala dokumen)
- [x] `NxCloudflare/Desktop/lib/nxcloudflareApi.js` + `nxcloudflareApi` di `Desktop/config.js` (`NEXA.nxcloudflareApi`, base `http://127.0.0.1:8787`) — ✅ lokasi aktif sekarang, lihat `Plan-desktop.md` §6
- [x] Smoke test Node: `getHealth` / `getTunnel` OK

### Fase P2 — Stub Desktop

- [x] Folder `templates/nxcloudflare/` + sidebar (“NxCloudflare”) — ✅ di `NxCloudflare/Desktop/templates/nxcloudflare/` (lokasi aktif); folder sama di `Teritip/Desktop/` tersisa sebagai referensi historis
- [x] Halaman stub Overview / Pembelokan / Tunnel / Logs / Settings (JSON mentah, wiring API live — bukan mock)
- [x] Identitas Desktop app dibersihkan dari sisa Teritip + `npm install` (2026-09-11, lihat `Plan-desktop.md` §6)
- [x] **Stop di sini untuk UI** — Anda ambil alih konsep dasbor (visual/UX, §3 `Plan-desktop.md`)

### Fase P3 — (Anda) Konsep dasbor

- Wireframe halaman Overview / Tunnel / Logs / Settings  
- Aturan apa yang publik vs lokal  
- Integrasi visual dengan shell Desktop yang ada  

### Fase P4 — Pengamanan publik ✅ SUDAH DIEKSEKUSI (2026-09-11, sebagian)

- [x] Token untuk `/api/control/stop` dan `/api/control/restart` — header `X-Nx-Token`, dicek pakai `timingSafeEqual` di `src/api/router.js` (`handleControl`)
- [x] Config baru `api.controlToken` (default kosong = fitur nonaktif, backward compatible — tidak mengubah perilaku default)
- [x] `GET /api/config` melaporkan `controlTokenSet: true/false` tanpa membocorkan nilai token itu sendiri
- [x] Client `client/nxcloudflareApi.js`: `createNxCloudflareApi(baseUrl, { controlToken })` mengirim header otomatis untuk `stop()`/`restart()`
- [x] Diverifikasi: tanpa token → 401, token salah → 401, token benar → 202 + aksi terpanggil
- [ ] Cloudflare Access — belum (token cukup untuk kebutuhan localhost saat ini; Access baru relevan kalau endpoint sensitif suatu saat sengaja dibuka lewat tunnel)
- [ ] Dokumentasi terpisah "jangan expose control API" — belum ditulis sebagai dokumen, baru tercatat di sini + `digram.md`

Catatan: proteksi utama tetap `loopback`-check (lihat `digram.md`) — token ini lapisan tambahan (defense-in-depth) untuk `/api/control/*` saja, bukan pengganti loopback-guard.

---

## 8. Kepemilikan tugas

| Tugas | Siapa |
| ----- | ----- |
| Rencana ini + API + client | Agent / eksekusi teknis |
| Stub Desktop di Teritip (Fase P1/P2) | Sudah dibuat, kini berstatus referensi pola — tidak dikembangkan lagi dari sini |
| Konsep & desain Desktop/GUI NxCloudflare sendiri | **Anda** (belum direncanakan detail — proyek/folder terpisah) |
| App bisnis di belakang Teritip | Menyusul per app (di luar cakupan NxCloudflare) |

---

## 9. Keputusan yang diminta sebelum coding P0

1. Client API diletakkan di **`Teritip/Desktop/lib/`** (disarankan) atau di dalam repo NxCloudflare?  
2. Endpoint kontrol (`stop`/`restart`) **localhost-only** dulu — OK?  
3. Stub Desktop (P2) boleh JSON mentah dulu sebelum Anda desain — OK?

Setelah “OK / jawab 1–3”, eksekusi dimulai dari **Fase P0** (API saja), tanpa mendesain dasbor.
