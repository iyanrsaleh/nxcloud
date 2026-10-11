# Menu & Fitur — nxcloud

> nxcloud = **tool pengelola pembelokan (routing)** antara internet/Cloudflare Tunnel dan origin di PC/LAN — bukan hanya server internal sendiri.  
> Dokumen ini: **nama menu + fitur**. Desain visual dasbor = tugas terpisah.

**Tanggal:** 2026-09-10 (revisi istilah 2026-09-11)

> **⚠️ Revisi istilah (2026-09-11):** nama menu **"Pembelokan"** di seluruh
> dokumen ini diganti jadi **"Routes"** di UI Desktop — istilah terjemahan
> dianggap membingungkan pengguna, istilah teknis standar (tidak
> diterjemahkan) dipilih sebagai gantinya. Isi dokumen di bawah ini
> **dibiarkan apa adanya** sebagai riwayat keputusan asli (kapan &
> kenapa fitur ini dirancang) — baca "Pembelokan" = "Routes" saat
> membandingkan dengan UI yang berjalan sekarang.

---

## 1. Peran produk

```text
Internet / LAN user
        │
        ▼
  Cloudflare Tunnel          ← dikelola nxcloud
        │
        ├──→ Internal   http://127.0.0.1:8787     (API/panel nxcloud)
        ├──→ Eksternal  http://127.0.0.1:7080     (contoh: NxSocket, same PC)
        ├──→ Eksternal  http://127.0.0.1:7331     (contoh: Teritip serve)
        └──→ … banyak pembelokan tersebar
             (LAN IP hanya jika origin di mesin lain)
```

| Jenis origin | Contoh | Arti |
| ------------ | ------ | ---- |
| **Internal** | `127.0.0.1:8787` | Layanan bawaan nxcloud |
| **Eksternal** | `127.0.0.1:7080`, `127.0.0.1:7331`, … | App di **PC yang sama**, port lain |
| **Eksternal (LAN)** | `192.168.x.x:port` | Hanya jika app di **mesin lain** di jaringan |

**Istilah baku di UI/API:**

| Istilah | Meaning |
| ------- | ------- |
| **Route / Pembelokan** | Satu aturan: hostname publik → URL origin |
| **Origin / Upstream** | Target (`http://host:port`) |
| **Hostname** | Nama publik (mis. `socket.tirtamoolango.id`) |
| **Tunnel** | Koneksi Cloudflare (`cloudflared`) |

---

## 2. Peta menu (nama resmi)

Urutan sidebar yang disarankan:

| # | Nama menu | ID route (stub/Desktop) | Fokus |
| - | --------- | ----------------------- | ----- |
| 1 | **Ringkasan** | `overview` | Status tool + tunnel + jumlah route |
| 2 | **Pembelokan** | `routes` | **Fitur inti** — daftar/kelola banyak route |
| 3 | **Tunnel** | `tunnel` | Mode, koneksi, hostname tunnel |
| 4 | **Domain** | `domains` | Zone / hostname Cloudflare terkait |
| 5 | **Log** | `logs` | server / tunnel / error |
| 6 | **Pengaturan** | `settings` | Config tool, bind, control API |

Opsional nanti (jangan di v1 UI kecuali perlu):

| Nama menu | Kapan |
| --------- | ----- |
| **Proses** | Start/stop app di `path` folder (setelah fitur projects jalan) |
| **Akses** | Token / siapa boleh ubah route (publik vs lokal) |

**Tidak ada menu Doctor.**

---

## 3. Fitur per menu

### 3.1 Ringkasan (`overview`)

| Fitur | Keterangan | Data (sekarang / nanti) |
| ----- | ---------- | ----------------------- |
| Status server nxcloud | Hidup/mati, host:port | `GET /api/status` |
| Status tunnel | Connected / stopped, URL publik default | `GET /api/tunnel` |
| Jumlah pembelokan | Berapa route aktif (internal + eksternal) | nanti `GET /api/routes` |
| Pintasan | Link ke Pembelokan / Tunnel | UI saja |

---

### 3.2 Pembelokan (`routes`) — fitur utama

Ini menu yang menjawab kasus **NxSocket `http://127.0.0.1:7080`** (same PC) dan origin tersebar lainnya.

| Fitur | Keterangan |
| ----- | ---------- |
| **Daftar route** | Semua pembelokan: hostname → origin |
| **Tambah route** | Form: nama, hostname, URL origin (internal/eksternal) |
| **Edit / hapus route** | Ubah target atau matikan |
| **Tipe origin** | Label: Internal / Eksternal (otomatis dari host origin) |
| **Aktifkan di tunnel** | Pasang/lepas hostname di Cloudflare ingress + DNS |
| **Uji origin** | Cek origin merespons (health ping opsional) |
| **Salin URL publik** | `https://hostname/...` |

**Field form Tambah pembelokan (usulan):**

| Field UI | Contoh | Wajib |
| -------- | ------ | ----- |
| Nama | `NxSocket` | ya |
| Hostname publik | `socket.tirtamoolango.id` | ya |
| URL origin | `http://127.0.0.1:7080` | ya |
| Keterangan | opsional | tidak |
| Path proyek di disk | `D:\Framework\CLI\NxSocket` | tidak (untuk start nanti) |

**Contoh baris tabel:**

| Nama | Hostname | Origin | Tipe | Status |
| ---- | -------- | ------ | ---- | ------ |
| nxcloud | `nx.tirtamoolango.id` | `http://127.0.0.1:8787` | Internal | Aktif |
| NxSocket | `socket.tirtamoolango.id` | `http://127.0.0.1:7080` | Eksternal | Aktif |

---

### 3.3 Tunnel (`tunnel`)

| Fitur | Keterangan |
| ----- | ---------- |
| Mode | `named` / `quick` |
| Status / PID | Connected atau tidak |
| Config path | File credentials / config.yml |
| Hostname default | mis. `nx.tirtamoolango.id` |
| Service default | Origin bawaan (sering internal `:8787`) |

Bukan tempat daftar semua app — itu **Pembelokan**.

---

### 3.4 Domain (`domains`)

| Fitur | Keterangan |
| ----- | ---------- |
| Zone aktif | mis. `tirtamoolango.id` |
| Daftar hostname | Yang sudah di-route |
| Catatan NS / Cloudflare | Baca saja / link dokumentasi |

Bisa digabung ke Pembelokan di v1 UI kalau ingin lebih sederhana (menu Domain ditunda).

---

### 3.5 Log (`logs`)

| Fitur | Keterangan |
| ----- | ---------- |
| Tab server / tunnel / error | `GET /api/logs?source=` |
| Refresh | Manual (polling opsional nanti) |

---

### 3.6 Pengaturan (`settings`)

| Fitur | Keterangan |
| ----- | ---------- |
| Lihat config | `GET /api/config` |
| allowControl | Apakah stop/restart diizinkan (lokal) |
| Bind host/port | Panel internal |
| Ubah via CLI | Arahkan ke `nxcloud config set` sampai ada form tulis aman |

---

## 4. Internal vs eksternal (aturan produk)

| | Internal | Eksternal |
| --- | -------- | --------- |
| Origin | Proses / port milik nxcloud | App lain (NxSocket, Teritip, …) |
| Dikelola hidup-mati oleh nxcloud? | Ya (start/stop tool) | Tidak wajib (hanya belokkan); start opsional nanti |
| Contoh | `:8787` | `:7080` (same PC via `127.0.0.1`) |
| Menu | Ringkasan + Pembelokan (satu baris) | **Pembelokan** (banyak baris) |

### Aturan origin (disepakati)

- App di **PC yang sama** dengan cloudflared → pakai **`http://127.0.0.1:<port>`** (bukan IP LAN).
- IP `192.168.x.x` hanya jika origin di **mesin lain**.

---

## 5. Mapping ke API (sekarang → nanti)

| Menu / fitur | API sekarang | API nanti |
| ------------ | ------------ | --------- |
| Pembelokan daftar/tambah | `GET/POST/PATCH/DELETE /api/routes` | sync ingress config.yml |
| Ringkasan | `/api/status` (+ `routes.count`) | |
| Tunnel | `/api/tunnel` | sama + detail |
| Log | `/api/logs` | sama |
| Pengaturan | `/api/config` | + PATCH aman |
| Stop tool | `/api/control/*` (lokal) | sama |

Nama resource API disarankan **`routes`** (selaras menu **Pembelokan**), field:

```json
{
  "id": "nxsocket",
  "name": "NxSocket",
  "hostname": "socket.tirtamoolango.id",
  "origin": "http://127.0.0.1:7080",
  "kind": "external",
  "projectPath": "D:\\Framework\\CLI\\NxSocket",
  "enabled": true
}
```

`kind`: `"internal"` | `"external"` (bisa dihitung otomatis dari host origin).

---

## 6. Stub Desktop — sesuaikan nama menu

Target folder: `Teritip/Desktop/templates/nxcloud/`

| File | Menu |
| ---- | ---- |
| `overview.js` | Ringkasan |
| `routes.js` | Pembelokan *(baru — ganti fokus utama)* |
| `tunnel.js` | Tunnel |
| `logs.js` | Log |
| `settings.js` | Pengaturan |

`domains.js` opsional / digabung ke Pembelokan dulu.

---

## 7. Prioritas bangun fitur

| Prioritas | Item |
| --------- | ---- |
| P0 | Menu + copy UI sesuai dokumen ini (stub) |
| P1 | API `GET/POST/PATCH/DELETE /api/routes` + tulis ingress tunnel | **Selesai** |
| P2 | Kasus nyata: route → `http://127.0.0.1:7080` (NxSocket) + DNS hostname | Sebagian (route + ingress; DNS manual/restart tunnel) |
| P3 | `projectPath` + start/stop proses (opsional) |
| P4 | Auth jika dikelola dari luar localhost |

---

## 8. Satu kalimat positioning

**nxcloud** mengelola **banyak pembelokan tersebar** (internal & eksternal) lewat Cloudflare Tunnel — dari panel/API lokal maupun hostname publik — sehingga app seperti NxSocket di LAN bisa dipublikasikan tanpa mengubah app itu sendiri.
