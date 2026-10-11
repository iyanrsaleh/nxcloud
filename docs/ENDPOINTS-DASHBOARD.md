# Materi Endpoint — Perencanaan Dasbor nxcloud

Dokumen ini merangkum **semua endpoint yang sudah ada** + mapping ke **widget/halaman dasbor**.  
Dasbor UI (konsep visual) = tugas Anda; data & client sudah siap.

| | |
| --- | --- |
| Base lokal | `http://127.0.0.1:8787` |
| Base publik | `https://nx.tirtamoolango.id` |
| Client Desktop | `Teritip/Desktop/lib/nxcloudApi.js` |
| Config Desktop | `NEXA.nxcloudApi` → `http://127.0.0.1:8787` |
| Error JSON | `{ "error": "pesan" }` |

> **Keamanan:** endpoint **kontrol** (`stop` / `restart`) hanya localhost + `api.allowControl: true`. Jangan andalkan untuk tombol di halaman publik tanpa auth.

---

## 1. Peta cepat: endpoint → isi dasbor

| Endpoint | Client method | Ide widget / halaman |
| -------- | ------------- | -------------------- |
| `GET /api/health` | `nx.getHealth()` | Badge hijau/merah “API hidup” |
| `GET /api/status` | `nx.getStatus()` | Kartu Overview: server + tunnel ringkas |
| `GET /api/tunnel` | `nx.getTunnel()` | Halaman / panel Tunnel (URL, hostname, PID) |
| `GET /api/config` | `nx.getConfig()` | Halaman Settings (baca saja) |
| `GET /api/logs` | `nx.getLogs({ source, lines })` | Panel Logs (tab server / tunnel / error) |
| `GET /api/routes` | `nx.listRoutes()` | **Routes** — daftar |
| `POST /api/routes` | `nx.createRoute(body)` | Tambah route (localhost) |
| `PATCH /api/routes/:id` | `nx.updateRoute(id, body)` | Edit (localhost) |
| `DELETE /api/routes/:id` | `nx.deleteRoute(id)` | Hapus (localhost) |
| `POST /api/control/stop` | `nx.stop()` | Tombol Stop (**lokal saja**) |
| `POST /api/control/restart` | `nx.restart()` | Tombol Restart (**lokal saja**) |

Alias legacy (sama data, tanpa prefix `/api`):

| Legacy | Sama dengan |
| ------ | ----------- |
| `GET /health` | `/api/health` |
| `GET /status` | `/api/status` |
| `GET /` | Indeks service + daftar path |

`GET /api` → katalog endpoint (berguna untuk debug, jarang ditampilkan di UI).

---

## 2. Katalog endpoint (detail)

### 2.1 `GET /api/health`

**Untuk:** heartbeat.

```json
{
  "status": "ok",
  "service": "nxcloud"
}
```

| Field | Tipe | UI |
| ----- | ---- | -- |
| `status` | string | `"ok"` → sehat |
| `service` | string | label |

---

### 2.2 `GET /api/status`

**Untuk:** Overview utama (satu request untuk server + cloudflare).

```json
{
  "server": {
    "status": "running",
    "host": "127.0.0.1",
    "port": 8787,
    "pid": 3996
  },
  "cloudflare": {
    "status": "connected",
    "mode": "named",
    "url": "https://nx.tirtamoolango.id",
    "hostname": "nx.tirtamoolango.id",
    "pid": 16336
  }
}
```

| Field | UI usulan |
| ----- | --------- |
| `server.status` | Badge RUNNING / STOPPED |
| `server.host` + `port` | Teks “Local: http://…” |
| `server.pid` | Detail teknis (opsional) |
| `cloudflare.status` | Badge CONNECTED / STOPPED / … |
| `cloudflare.mode` | Chip `named` / `quick` |
| `cloudflare.url` | Link klikable publik |
| `cloudflare.hostname` | Teks hostname |
| `cloudflare.pid` | Detail teknis (opsional) |

---

### 2.3 `GET /api/tunnel`

**Untuk:** halaman Tunnel lebih lengkap dari potongan di `/status`.

```json
{
  "enabled": true,
  "running": true,
  "status": "connected",
  "mode": "named",
  "url": "https://nx.tirtamoolango.id",
  "hostname": "nx.tirtamoolango.id",
  "pid": 16336,
  "service": "http://127.0.0.1:8787"
}
```

| Field | UI usulan |
| ----- | --------- |
| `enabled` | Toggle display (on/off di config) |
| `running` | Boolean → ikon hidup/mati |
| `status` | Status teks |
| `service` | Origin lokal yang di-tunnel |

---

### 2.4 `GET /api/config`

**Untuk:** Settings read-only (secrets tidak ikut).

```json
{
  "path": "D:\\Framework\\CLI\\nxcloud\\config\\nxcloud.json",
  "server": { "host": "127.0.0.1", "port": 8787 },
  "cloudflare": {
    "enabled": true,
    "mode": "named",
    "hostname": "nx.tirtamoolango.id",
    "tunnelName": "nxcloud",
    "service": "http://127.0.0.1:8787",
    "cloudflaredConfig": ".credentials/config.yml"
  },
  "logging": { "level": "INFO" },
  "api": { "allowControl": false }
}
```

| Field | UI usulan |
| ----- | --------- |
| `path` | Path file config (kecil, monospace) |
| `cloudflare.*` | Form baca / tabel key-value |
| `api.allowControl` | Indikator apakah tombol Stop boleh muncul |

---

### 2.5 `GET /api/logs?source=&lines=`

**Query**

| Param | Default | Nilai |
| ----- | ------- | ----- |
| `source` | `server` | `server` \| `tunnel` \| `error` |
| `lines` | `40` | 1–500 |

```json
{
  "source": "server",
  "file": "D:\\Framework\\CLI\\nxcloud\\logs\\server.log",
  "lines": [
    "[2026-09-10T05:21:40.765Z] [INFO] Server listening on http://127.0.0.1:8787"
  ]
}
```

| UI usulan |
| --------- |
| Tab: Server / Tunnel / Error |
| `<pre>` scroll + tombol Refresh |
| Select jumlah baris (40 / 100 / 200) |

---

### 2.6 `POST /api/control/stop` & `POST /api/control/restart`

**Syarat:** request dari localhost **dan** `api.allowControl === true`.

Sukses:

```json
{ "accepted": true, "action": "stop" }
```
Status HTTP: `202`

Gagal umum:

| Status | Body | Arti |
| ------ | ---- | ---- |
| `403` | Control API is localhost-only | Dipanggil lewat tunnel/publik |
| `403` | Control API disabled… | `allowControl` masih false |

**UI:** sembunyikan tombol jika `getConfig().api.allowControl === false` atau base URL bukan loopback.

---

## 3. Client Desktop (cara panggil)

```js
import { nx, createnxcloudApi } from '/lib/nxcloudApi.js';

// default → NEXA.nxcloudApi atau http://127.0.0.1:8787
await nx.getHealth();
await nx.getStatus();
await nx.getTunnel();
await nx.getConfig();
await nx.getLogs({ source: 'tunnel', lines: 100 });

// opsional base eksplisit
const api = createnxcloudApi('http://127.0.0.1:8787');
await api.getStatus();
```

| Method | HTTP |
| ------ | ---- |
| `getHealth()` | `GET /api/health` |
| `getStatus()` | `GET /api/status` |
| `getConfig()` | `GET /api/config` |
| `getTunnel()` | `GET /api/tunnel` |
| `getLogs({ source, lines })` | `GET /api/logs?…` |
| `stop()` | `POST /api/control/stop` |
| `restart()` | `POST /api/control/restart` |

---

## 4. Usulan struktur halaman dasbor (untuk Anda isi desain)

Berdasarkan data yang tersedia **sekarang** (tanpa endpoint baru):

```text
Desktop → menu "nxcloud"
│
├── Overview          ← getStatus() + getHealth()
│     • badge server / tunnel
│     • link publik (url)
│     • host:port lokal
│
├── Tunnel            ← getTunnel()
│     • mode, hostname, service, pid
│
├── Logs              ← getLogs()
│     • tab server | tunnel | error
│
├── Settings          ← getConfig()  (read-only v1)
│     • mode, hostname, allowControl
│
└── Actions (lokal)   ← stop/restart jika allowControl
      • hanya di Desktop localhost
```

**Tidak perlu endpoint baru** untuk v1 dasbor di atas.

---

## 5. Catatan publik vs lokal

| Dipakai di | Aman untuk read? | Kontrol? |
| ---------- | ---------------- | -------- |
| Desktop `127.0.0.1:8787` | Ya | Ya (jika `allowControl`) |
| `https://nx.tirtamoolango.id` | Ya untuk health/status/config/tunnel/logs | **Tidak** (403) |

Error 1033 di browser = **tunnel/cloudflared tidak jalan** di PC (bukan bug endpoint).

---

## 6. Referensi silang

| Dokumen | Isi |
| ------- | --- |
| `Plan-dashboard-api.md` | Rencana fase API/client/Desktop |
| `Plan-motali.md` / `docs/START-nx-tirtamoolango.md` | Domain & tunnel |
| Teritip `engine/README.md` | Pola API↔GUI yang sama |

---

## 7. Checklist perencanaan dasbor (untuk Anda)

- [ ] Halaman mana yang masuk v1? (Overview wajib?)
- [ ] Polling interval status? (mis. 5–10 dtk) atau tombol Refresh saja?
- [ ] Logs: auto-refresh atau manual?
- [ ] Tombol Stop tampil di Desktop saja — konfirmasi UX
- [ ] Apakah butuh endpoint **baru** di v2? (lihat §8)

Kalau konsep halaman sudah digambar, tinggal wiring ke method di §3.

---

## 8. Rancangan v2 — User daftar domain + lokasi proyek (BELUM ADA)

> **Status:** usulan perencanaan. **Belum diimplementasi.**  
> Sekarang hostname hanya di `config/nxcloud.json` + config cloudflared (manual).

### 8.1 Konsep

User (dasbor Desktop) mendaftarkan:

1. **Hostname** — mis. `toko.tirtamoolango.id`
2. **Lokasi proyek di PC** — path folder, mis. `D:\Framework\Apps\Toko`
3. **Port / cara jalan** — mis. `3000` + `npm start`

```text
Dasbor → POST /api/projects
              ↓
     simpan path + hostname + port
              ↓
     tunnel: hostname → http://127.0.0.1:PORT
              ↓
     (opsional) start app di folder path
              ↓
https://toko.tirtamoolango.id  →  PC lokal
```

Bukan upload ke CyberPanel/VPS — origin tetap **PC**.

### 8.2 Field data (usulan)

| Field | Wajib | Arti |
| ----- | ----- | ---- |
| `name` | ya | Nama di dasbor |
| `hostname` | ya | Domain publik |
| `path` | ya | Lokasi folder proyek di disk server/PC |
| `port` | ya | Port lokal app |
| `startCommand` | opsional | mis. `npm start` |
| `runtime` | opsional | `node` \| `static` \| `teritip` |

### 8.3 Endpoint usulan

| Method | Path | Fungsi form dasbor |
| ------ | ---- | ------------------ |
| `GET` | `/api/projects` | Daftar domain + proyek |
| `GET` | `/api/projects/:id` | Detail |
| `POST` | `/api/projects` | **Daftarkan** domain + `path` |
| `PATCH` | `/api/projects/:id` | Edit |
| `DELETE` | `/api/projects/:id` | Hapus |
| `POST` | `/api/projects/:id/start` | Jalankan app di `path` |
| `POST` | `/api/projects/:id/stop` | Stop app |
| `GET` | `/api/projects/:id/status` | Status + URL publik |

#### Body `POST /api/projects`

```json
{
  "name": "Toko",
  "hostname": "toko.tirtamoolango.id",
  "path": "D:\\Framework\\Apps\\Toko",
  "port": 3000,
  "runtime": "node",
  "startCommand": "npm start"
}
```

#### Response (usulan)

```json
{
  "id": "toko-1",
  "hostname": "toko.tirtamoolango.id",
  "path": "D:\\Framework\\Apps\\Toko",
  "publicUrl": "https://toko.tirtamoolango.id",
  "status": "registered"
}
```

Server wajib cek: `path` ada di disk, `hostname` unik, `port` tidak bentrok.

### 8.4 Form UI ↔ API

| Input dasbor | Field |
| ------------ | ----- |
| Nama aplikasi | `name` |
| Domain | `hostname` |
| Lokasi folder proyek | `path` |
| Port | `port` |
| Perintah start | `startCommand` |

### 8.5 Setelah daftar, sistem harus

1. Simpan metadata (`path`, hostname, port)
2. Pasang route tunnel DNS/ingress
3. (Opsional) `start` proses di `path`
4. Baru `https://hostname` hidup — kalau tidak → Error 1033 / connection error

### 8.6 Keputusan sebelum coding v2

1. Hanya subdomain zone `tirtamoolango.id`, atau domain bebas?
2. Single-tenant (satu PC owner) — OK?
3. DNS otomatis via API, atau user tambah manual di Cloudflare?
