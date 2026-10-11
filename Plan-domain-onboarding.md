# Rencana — Onboarding Domain & Pemisahan Web/API di GUI

> **Status:** rencana, belum dieksekusi. Ditulis sebelum menyentuh kode
> sesuai `AGENTS.md` §Plan (menyentuh arsitektur: alur baru + endpoint baru).

**Tanggal:** 2026-09-11

**Latar belakang:** Saat menambahkan kolom pembeda Web/API di menu
Pembelokan, ditemukan gap yang jauh lebih mendasar — GUI belum punya alur
sama sekali untuk 4 pertanyaan dasar yang user ajukan:

1. User sudah punya domain di Cloudflare — apakah ada halaman untuk
   menghubungkan/mendaftarkannya ke nxcloud?
2. Bagaimana menambahkan **domain baru** (root, bukan subdomain)?
3. Bagaimana membuat **subdomain baru**, dan diarahkan ke mana (web statis
   folder mana? API port berapa? app eksternal?)
4. Bagaimana mengelola semuanya **secara terpisah dan jelas** — saat
   membuat domain/subdomain baru, user harus bisa memilih kategorinya.

---

## 1. Kondisi nyata sekarang (diverifikasi langsung, bukan asumsi)

### 1.1 Bug ditemukan & sudah diperbaiki

`getPublicConfig()` di `src/api/router.js` **tidak pernah** menyertakan
blok `config.web` — jadi `GET /api/config` tidak pernah mengembalikan info
web statis sama sekali. Halaman Settings (`Desktop/templates/nxcloud/settings.js`)
yang dibuat sebelumnya menampilkan field ini tapi selalu kosong karena
datanya tidak pernah dikirim backend. **Sudah diperbaiki**: `web: { ...config.web }`
ditambahkan ke response.

### 1.2 Web statis (`web.tirtamoolango.id`) TIDAK tercatat di sistem Pembelokan

`GET /api/routes` (backend `routes.json`) hanya berisi 2 baris: `nxcloud`
(API, `nx.`) dan `socket` (eksternal). **`web.tirtamoolango.id` tidak ada
sama sekali** di sini — diatur sepenuhnya lewat `config.web.*` +
ingress `.credentials/config.yml` yang ditambah **manual** saat sesi
sebelumnya (lihat `Plan-dashboard-api.md` §6). Dua sistem terpisah yang
tidak saling tahu satu sama lain.

### 1.3 Membuat route baru TIDAK membuat DNS otomatis

Dites langsung: `POST /api/routes` dengan hostname baru →
`sync.written: true` (config.yml ingress ter-update) TAPI DNS CNAME
**tidak pernah dibuat**. Response bahkan eksplisit bilang:
`"Add DNS CNAME per hostname if missing"` — instruksi manual, bukan
otomatis. Diverifikasi dengan `nslookup` — hostname baru betul-betul
`Non-existent domain` sampai dijalankan manual
`cloudflared tunnel route dns <tunnel> <hostname>` (persis yang saya
lakukan manual untuk `web.tirtamoolango.id` sebelumnya).

### 1.4 Kemampuan `cloudflared` CLI yang bisa diprogram

- `cloudflared tunnel route dns [TUNNEL] [HOSTNAME]` — **bisa** dipanggil
  dari Node `spawn` (pola sama seperti `cloudflare/process.js` menjalankan
  tunnel), membuat CNAME otomatis. Ini yang dipakai manual kemarin.
- `cloudflared tunnel login` — **tidak bisa** diotomatisasi penuh, buka
  browser untuk OAuth ke akun Cloudflare. Wajar tetap manual, sekali per
  mesin/akun (prasyarat, bukan sesuatu yang diulang tiap domain baru).
- `cloudflared tunnel list` — bisa dipakai untuk menampilkan tunnel yang
  sudah ada (kalau lebih dari satu, atau untuk verifikasi tunnel aktif).
- **Tidak ada** command `cloudflared` untuk mendaftarkan **domain baru**
  ke akun Cloudflare (menambah zone) — itu murni operasi dashboard/API
  Cloudflare (perlu Cloudflare API Token dengan scope Zone, di luar
  cakupan `cloudflared` CLI). Lihat §4 untuk batasan ini.

---

## 2. Model konsep yang menjawab pertanyaan Anda

```text
                    Akun Cloudflare (1x setup manual)
                              │
                    cloudflared tunnel login (browser)
                              │
                    Domain terdaftar di Cloudflare
                    (root domain, mis. tirtamoolango.id)
                    — TIDAK bisa didaftarkan dari GUI ini,
                    harus lewat dashboard Cloudflare (§4)
                              │
              ┌───────────────┴───────────────┐
              │                                 │
    Domain sudah ada di akun          User mau subdomain baru
    Cloudflare (kasus umum)           dari domain yang sudah ada
              │                                 │
              ▼                                 ▼
    ┌─────────────────────────────────────────────────┐
    │         Menu baru: "Domain & Subdomain"           │
    │  (bukan lagi disatukan ke "Pembelokan")           │
    └─────────────────────────────────────────────────┘
              │
    Tambah subdomain baru → pilih KATEGORI:
              │
    ┌─────────┼─────────────┬─────────────────┐
    ▼         ▼             ▼                 ▼
  Web       API           Route            (nanti: Proses,
  statis    nxcloud  eksternal         P3 MENU-FITUR.md)
  baru      (sudah ada,   (app lain,
  (folder   1 saja)       port lain)
  baru di
  web/, ATAU
  subfolder)
```

**Jawaban ke 4 pertanyaan:**

1. **Halaman untuk domain yang sudah ada** — Ya, direncanakan: menu baru
   menampilkan hostname yang sudah dikenal tunnel ini (dari `routes.json`
   + `config.web.hostname` + `config.cloudflare.hostname`), bukan cuma
   "Pembelokan" yang sekarang campur aduk.
2. **Domain baru (root)** — **Di luar kemampuan `cloudflared` CLI**, harus
   tetap manual di dashboard Cloudflare (nameserver, verifikasi). GUI bisa
   memberi **instruksi/link**, tidak bisa mengeksekusi ini sendiri kecuali
   pakai Cloudflare API Token terpisah (keputusan besar, lihat §4).
3. **Subdomain baru** — **Bisa** diotomatisasi penuh: form baru →
   backend panggil `cloudflared tunnel route dns` (DNS) + tulis ingress
   (`syncCloudflaredIngress`, sudah ada) — keduanya digabung jadi satu
   aksi "Buat & Terbitkan", bukan dua langkah terpisah manual seperti
   sekarang.
4. **Kelola terpisah** — Saat membuat subdomain baru, user memilih target:
   - **Web statis** → tunjuk folder (default `web/`, atau subfolder baru)
     → nxcloud **menjalankan static server baru** di port bebas
     berikutnya (pola `staticServer.js` yang sudah ada, saat ini cuma satu
     instance hardcoded port `8789` — perlu digeneralisasi jadi multi-instance).
   - **API nxcloud** → sudah ada, cuma satu (`8787`) — tidak butuh
     "buat baru", cukup tunjuk yang sudah jalan.
   - **Route eksternal** → seperti sekarang (`routes.js` form yang sudah
     ada), isi origin manual.

---

## 3. Batasan yang HARUS jujur disampaikan ke user di UI

- Domain **root** baru tidak bisa didaftarkan dari GUI ini. GUI hanya bisa
  bekerja dengan domain yang **sudah** ada di akun Cloudflare pengguna
  (nameserver sudah diarahkan, status Active).
- `cloudflared tunnel login` (autentikasi akun) tetap manual sekali,
  di luar GUI — prasyarat sebelum GUI bisa berfungsi sama sekali.
- Multi-instance web statis (poin 4 di atas) adalah **perubahan arsitektur**
  di `src/web/staticServer.js` + `src/index.js` — saat ini didesain untuk
  satu instance saja (`config.web.port` tunggal). Perlu jadi daftar
  instance (mirip pola `routes.json`) sebelum "buat subdomain web baru"
  bisa berfungsi penuh.

---

## 4. Keputusan FINAL (2026-09-11)

1. **DNS otomatis**: ✅ **`cloudflared` CLI saja** (`tunnel route dns`) —
   tidak pakai Cloudflare API Token tambahan. Cukup untuk subdomain di
   domain yang sudah ada di akun Cloudflare.
2. **Web statis multi-domain**: ✅ **Instance server terpisah per
   subdomain** — tiap subdomain web dapat port sendiri + folder sendiri.
   Perlu refactor `staticServer.js` jadi multi-instance (lihat §5.2).
3. **Menu sidebar**: ✅ **Dipisah jadi 2 menu** — menu baru **"Domain"**
   khusus subdomain/web/API milik nxcloud sendiri (yang dikelola
   otomatis), menu **"Pembelokan"** tetap murni untuk route eksternal
   (app lain, origin manual, seperti sekarang).

---

## 5. Rencana eksekusi (urutan)

### 5.1 Model data baru — "Web Instances" (mirip pola `routes.json`)

File baru `config/web-instances.json`, tiap entri:
```json
{
  "id": "blog",
  "name": "Blog",
  "hostname": "blog.tirtamoolango.id",
  "folder": "web-blog",       // relatif ke ROOT_DIR, bukan port fisik
  "port": 8790,                 // dialokasikan otomatis (increment dari 8789)
  "enabled": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```
- Modul baru `src/web/instances.js` (pola sama `src/api/routes.js`):
  `listWebInstances`, `createWebInstance`, `updateWebInstance`,
  `deleteWebInstance`, alokasi port otomatis (port bebas berikutnya mulai
  `8789`).
- `src/index.js`: alih-alih start 1 static server hardcoded dari
  `config.web`, baca `web-instances.json` dan start **N** instance
  `createStaticServer()` (fungsi `staticServer.js` sudah generik,
  menerima `{host, port}` — tinggal dipanggil berulang, folder root
  perlu ditambah sebagai parameter, sekarang hardcode `WEB_DIR`).
- **`config.web.*` yang ada sekarang** (untuk `web.tirtamoolango.id`,
  port 8789, folder `web/`) dimigrasi jadi entri pertama di
  `web-instances.json` (id mis. `"default"`), supaya tidak putus.

### 5.2 `src/web/staticServer.js` — generalisasi folder root

Saat ini `WEB_DIR` hardcode dari `utils/paths.js`. Ubah
`createStaticServer({host, port, rootDir})` menerima `rootDir` sebagai
parameter (bukan konstanta global), supaya bisa dipanggil untuk folder
berbeda per instance.

### 5.3 Endpoint API baru — "Domain" (terpisah dari `/api/routes`)

- `GET /api/domains` — gabungan tampilan: API nxcloud (1, tetap),
  semua Web Instance (`web-instances.json`), + status DNS masing-masing
  (reachable via `nslookup`/`dns.resolve` dari Node, opsional — lihat §5.5).
- `POST /api/domains/web` — buat web instance baru: `{name, hostname, folder}`
  → alokasi port otomatis → `mkdir` folder (dengan `index.html` placeholder)
  → tulis `web-instances.json` → **panggil `cloudflared tunnel route dns`**
  (DNS) → tulis ingress (`syncCloudflaredIngress`, sudah ada, generalisasi
  supaya baca dari `web-instances.json` juga, bukan cuma `routes.json`) →
  return hasil lengkap (DNS dibuat / gagal, ingress ditulis, perlu restart).
- `DELETE /api/domains/web/:id` — hapus instance (stop server-nya juga,
  index.js perlu API untuk stop 1 instance tanpa restart semua).
- Semua endpoint loopback-only, pola sama seperti `/api/routes`.

### 5.4 Backend: panggil `cloudflared tunnel route dns` dari Node

Modul baru `src/cloudflare/dns.js`:
```js
export async function addDnsRoute(tunnelName, hostname) {
  const binary = await findCloudflared();
  // spawnAttached / execFile: cloudflared tunnel route dns <tunnelName> <hostname>
  // parse stdout/stderr untuk sukses vs "already exists" vs error
}
```
Dipanggil sinkron (await) dalam alur `POST /api/domains/web` sebelum
respons dikirim — user langsung tahu hasilnya (DNS jadi atau gagal),
bukan proses background tersembunyi.

### 5.5 Verifikasi DNS (opsional, nice-to-have — bukan blocker P0)

Setelah `addDnsRoute`, DNS butuh waktu propagasi (detik-menit). UI bisa
menampilkan status "DNS diminta, mungkin perlu beberapa menit untuk aktif"
alih-alih klaim instan berhasil. Cek status via `dns.promises.resolveCname`
dari Node, dipanggil manual (tombol "Cek DNS") — bukan polling otomatis.

### 5.6 Desktop UI — menu baru "Domain"

`Desktop/templates/nxcloud/domain.js` (baru), didaftarkan di
`index.js` sidebar. Isi:
- Kartu **API nxcloud** (read-only: hostname `nx.`, port 8787, status).
- Tabel **Web Instances** — daftar + tombol **Tambah Web Baru** (form:
  nama, hostname, folder) yang menjalankan alur §5.3 dalam satu aksi.
- Tiap baris: status DNS (kalau dicek), tombol Hapus, link buka di browser.

`routes.js` (Pembelokan) **tidak berubah scope** — tetap murni untuk
route eksternal, tidak lagi menampilkan `nxcloud`/web sebagai baris
campur aduk (baris `kind: internal` untuk API bisa tetap ada di
`routes.json` sebagai warisan/referensi read-only, atau dipindah — perlu
dicek saat eksekusi, jangan hapus data tanpa migrasi jelas).

---

## 6. Batasan yang tetap berlaku (dari draft awal §3)

- Domain **root** baru tetap tidak bisa didaftarkan dari GUI ini — itu
  operasi dashboard Cloudflare (nameserver, zone verification), di luar
  cakupan `cloudflared` CLI. UI cukup beri instruksi/link, bukan eksekusi.
- `cloudflared tunnel login` tetap prasyarat manual sekali per mesin/akun.

---

## 6b. Insiden ditemukan saat investigasi — data-loss di ingress config

Saat menguji `POST/DELETE /api/routes` (route `test`, dibuat & dihapus
untuk verifikasi DNS-otomatis di §1.3), `syncCloudflaredIngress()`
menulis ulang **seluruh** blok `ingress:` di `.credentials/config.yml`
**hanya dari isi `routes.json`** — dan karena `web.tirtamoolango.id` tidak
pernah tercatat di `routes.json` (lihat §1.2), baris ingress untuk `web.`
**terhapus tanpa sengaja**. Akibatnya `https://web.tirtamoolango.id`
sempat **404 di production** sampai ditemukan dan baris itu ditambahkan
kembali manual + tunnel di-restart.

**Ini mengonfirmasi §1.2 sebagai bug serius, bukan cuma gap kerapian UI**:
selama `web.tirtamoolango.id` tidak tercatat di `routes.json`, SETIAP
create/update/delete route lewat UI Pembelokan berisiko menghapus ingress
`web.` lagi tanpa peringatan apapun. Ini alasan kuat kenapa §5.1 (migrasi
`config.web` jadi entri di model data terpadu) harus jadi prioritas
tinggi, bukan sekadar "nice to have".

**Mitigasi sementara** (belum permanen): baris `web.tirtamoolango.id`
sudah dikembalikan manual ke `.credentials/config.yml`. Tidak ada
perlindungan otomatis — risiko yang sama akan terulang bila ada
create/update/delete route lain sebelum §5.1 dieksekusi.

---

## 7. Status

### §5.2 — ✅ SUDAH DIEKSEKUSI (2026-09-11)
`src/web/staticServer.js`: `createStaticServer()` sekarang menerima
`rootDir` (default `WEB_DIR`, backward-compatible) dan `label` opsional
untuk log. Diverifikasi: tidak ada regresi ke `web.tirtamoolango.id`.

### §5.1 — ✅ SUDAH DIEKSEKUSI (2026-09-11)
- `src/utils/paths.js`: tambah `WEB_INSTANCES_FILE` (`config/web-instances.json`).
- `src/web/instances.js` — baru. CRUD lengkap (`listWebInstances`,
  `getWebInstance`, `createWebInstance`, `updateWebInstance`,
  `deleteWebInstance`), alokasi port otomatis (`nextFreePort`, mulai 8789),
  seeding migrasi satu-kali dari `config.web.*` (kalau `web-instances.json`
  belum ada). `createWebInstance` juga membuat folder + `index.html`
  placeholder otomatis.
- `src/api/routes.js` `syncCloudflaredIngress()`: **diperbaiki** —
  sekarang menggabungkan `routes.json` + `listWebInstances()` saat menulis
  ulang blok ingress, bukan cuma `routes.json`. Ini **memperbaiki bug
  data-loss** dari §6b.

**Diverifikasi:**
- Seeding migrasi: `listWebInstances()` dipanggil pertama kali →
  `web-instances.json` terisi otomatis dari `config.web` (id `default`,
  hostname `web.tirtamoolango.id`, folder `web`, port `8789`) — cocok
  persis dengan config lama, tidak ada data hilang.
- **Regresi bug §6b dites ulang dan TERBUKTI SUDAH TERTUTUP**: create +
  delete route test lain (`POST`/`DELETE /api/routes`) dijalankan setelah
  fix — `web.tirtamoolango.id` **tetap ada** di `.credentials/config.yml`
  sesudahnya (sebelumnya ini yang terhapus dan menyebabkan downtime).
- `https://web.tirtamoolango.id` dan `https://nx.tirtamoolango.id` tetap
  `200` sepanjang proses.

### §5.3 — ✅ SUDAH DIEKSEKUSI (2026-09-11)

Endpoint baru di `src/api/router.js` (semua loopback-only, pola sama
seperti `/api/routes`):
- `GET /api/domains` — ringkasan gabungan: `api` (nxcloud sendiri,
  read-only), `web` (semua web instance), `rootDomain` (dari `dns.js`).
- `GET /api/domains/web`, `GET /api/domains/web/:id` — baca.
- `POST /api/domains/web` — **satu aksi gabungan**: `createWebInstance()`
  (alokasi port + buat folder + index.html placeholder) → `addDnsRoute()`
  (validasi + panggil `cloudflared`) → `syncCloudflaredIngress()` (tulis
  ingress dari routes + web instances gabungan). Response berisi
  `{instance, dns, sync}` lengkap — user langsung tahu hasil tiap langkah.
- `PATCH /api/domains/web/:id`, `DELETE /api/domains/web/:id` — ubah/hapus
  + re-sync ingress (folder & port instance tidak bisa diubah lewat PATCH,
  sesuai desain `updateWebInstance` di §5.1 — hindari listener nyasar).

**Diverifikasi end-to-end (dengan izin eksplisit user untuk 1x tes DNS
nyata lagi, hostname `test-api.tirtamoolango.id` — root domain valid):**
- `POST /api/domains/web {name, hostname}` → instance dibuat (port
  auto `8790`), folder + `index.html` dibuat, DNS CNAME dibuat
  (`created:true`), ingress ditulis dengan **`web.tirtamoolango.id` tetap
  ada** (bukti fix §5.1 juga berlaku lewat jalur endpoint baru, bukan cuma
  saat dites langsung via modul).
- `DELETE /api/domains/web/test-api` → instance hilang dari data + ingress,
  `web.tirtamoolango.id` tetap ada.
- Folder `test-api/` dihapus manual setelah tes (tidak ada endpoint hapus
  folder otomatis — by design, supaya konten user tidak hilang tanpa
  sengaja hanya karena instance dihapus).
- ✅ DNS record `test-api.tirtamoolango.id` sudah dihapus manual oleh user,
  dikonfirmasi bersih via `nslookup` (`Non-existent domain`).
- Loopback guard dites: akses publik ke `/api/domains` dan
  `/api/domains/web` → `403`, konsisten dengan endpoint lain.

### §5.3b — Multi-instance startup — ✅ SUDAH DIEKSEKUSI (2026-09-11)

Gap yang ditemukan di akhir §5.3 (server tidak otomatis jalan untuk
instance baru) ditutup:
- `src/index.js`: `webServer` (tunggal) → `webServers` (array
  `{instance, handle}`). Saat start, baca `listWebInstances()` (bukan lagi
  `config.web`) dan jalankan `createStaticServer()` untuk **setiap**
  instance enabled, masing-masing dengan `rootDir` sendiri
  (`resolveInstanceDir`) dan `host:port` sendiri.
- `printBanner()` dan `shutdown()` diperbarui mengikuti array, bukan
  variabel tunggal — tiap instance ditampilkan/ditutup satu per satu,
  error salah satu instance tidak menghentikan yang lain.

**Diverifikasi:** restart penuh — log startup menunjukkan
`Web static server (web.tirtamoolango.id) listening on :8789` (diambil
dari `web-instances.json`, bukan hardcode `config.web` lagi). Endpoint
lokal (`8787`, `8789`) dan publik (`nx.`, `web.`) semua tetap `200` —
tidak ada regresi dari refactor.

**Implikasi:** `config.web.*` di `config/nxcloud.json` sekarang
**deprecated/tidak dipakai lagi** oleh `index.js` (cuma dipakai sekali
saat seeding migrasi pertama kali `web-instances.json` dibuat, di
`src/web/instances.js`). Belum dihapus dari `DEFAULTS`/`CONFIG_KEYS` di
`config.js` — perlu keputusan terpisah apakah dibersihkan atau dibiarkan
untuk kompatibilitas mundur.

### §5.6 — ✅ SUDAH DIEKSEKUSI (2026-09-11)

- `client/nxcloudApi.js`: tambah `getDomains`, `listWebInstances`,
  `getWebInstance`, `createWebInstance`, `updateWebInstance`,
  `deleteWebInstance`. Disinkron ke `Desktop/lib/nxcloudApi.js`.
  Header komentar sumber utama juga diperbaiki (masih menyebut "Mirror of
  Teritip" — sisa dari sebelum perubahan arah di `Plan-dashboard-api.md`).
- `Desktop/templates/nxcloud/domain.js` — baru. Kartu **API**
  (read-only, satu instance tetap), tabel **Subdomain Web** + form buat
  baru (nama, hostname, folder opsional), tombol hapus per baris.
- `Desktop/templates/nxcloud/index.js` — menu **Domain** ditambah ke
  sidebar (antara Ringkasan dan Pembelokan).

**Keputusan desain penting** (langsung merespons insiden §5.4/§6c):
- Form "Buat Subdomain Web" dan tombol "Hapus" **keduanya** minta
  konfirmasi eksplisit (`confirm()`) dengan teks yang jujur menyebut aksi
  DNS **tidak bisa dibatalkan otomatis** dan harus dibersihkan manual di
  dashboard Cloudflare bila salah — bukan tombol yang langsung jalan
  tanpa peringatan.
- Pesan hasil sukses selalu mengingatkan **"Restart nxcloud agar
  server-nya aktif"** — jujur soal keterbatasan saat ini (§5.3b: instance
  baru butuh restart proses, belum ada hot-reload/spawn-on-demand).
- Menu **Domain** dan **Pembelokan** ditegaskan terpisah lewat teks lead:
  Domain untuk yang dikelola nxcloud sendiri (API+Web), Pembelokan
  untuk app eksternal — sesuai keputusan §4 poin 3.

**Diverifikasi:**
- `node --check` semua file baru/ubah — OK.
- `GET /api/domains` dicek ulang cocok persis dengan bentuk data yang
  dikonsumsi `domain.js` (field `api`, `web[]`, `rootDomain`).
- Desktop GUI di-restart bersih, menu Domain termuat.

---

## 8. Klarifikasi batas Domain vs Routes (2026-09-11, sesi lanjutan)

Muncul dari pertanyaan user: form "Buat Subdomain Web" di menu Domain
sebelumnya mengasumsikan folder yang dituju **selalu di dalam
`ROOT_DIR`** (`D:\Framework\CLI\nxcloud\`). User menunjukkan ini
janggal — sistem ini adalah gateway, proyek yang mau dipublikasikan tidak
harus dibuat di dalam nxcloud sendiri.

**Ditelusuri sampai ketemu batas yang jelas:**

1. Backend `createWebInstance()` (§5.1) selalu memanggil
   `createStaticServer()` — **nxcloud sendiri yang `listen()`** di
   port itu untuk serve file dari folder tsb. Ini cuma masuk akal untuk
   **konten statis polos** (HTML/CSS/JS siap pakai, hasil build) yang
   belum punya server sendiri sama sekali.
2. Kalau app sudah punya **server sendiri** yang sudah `listen()` di
   port tertentu (dev server, backend framework apa pun) — nxcloud
   **tidak bisa** ikut `listen()` di port yang sama (`EADDRINUSE`).
   Kasus ini **bukan** domain menu Domain — itu domain **Routes**
   (`origin: http://host:port` yang sudah ada, sudah lengkap sejak
   §5.1 versi awal, field `projectPath` sudah generik menerima path apa
   saja di disk).

**Keputusan final: dua menu punya tanggung jawab berbeda dan saling
melengkapi, bukan tumpang tindih:**

| Menu | Untuk apa | Siapa yang `listen()` |
| ---- | --------- | ---------------------- |
| **Domain** (Subdomain Web) | Konten statis baru dari nol | nxcloud sendiri (`createStaticServer`) |
| **Routes** | App yang SUDAH punya server sendiri | App itu sendiri; nxcloud cuma proxy/ingress |

**Perubahan yang dieksekusi:**
- `src/web/instances.js`: `resolveInstanceDir()` + `normalizeInstance()`
  diperluas mendukung `folder` berupa path **absolut** (di luar
  `ROOT_DIR`), bukan cuma path relatif — untuk kasus konten statis yang
  **sudah ada filenya** di folder proyek lain (mis. `dist/` hasil build)
  dan memang mau nxcloud yang serve langsung, tanpa disalin.
  Backward-compatible penuh — path relatif tetap join ke `ROOT_DIR`
  seperti sebelumnya. Diverifikasi via test script sekali pakai
  (dijalankan dari dalam folder proyek untuk menghindari masalah ESM
  path resolution di Windows, dihapus setelah tes) — path absolut
  dipertahankan apa adanya, path relatif tetap ter-join dengan benar.
- **Field "Folder" DIHAPUS dari form utama Desktop** (`domain.js`) —
  setelah didiskusikan lebih lanjut, disadari bahwa mayoritas kasus nyata
  ("saya sudah punya proyek, tinggal daftarkan") itu domainnya **Routes**
  (cukup port, bukan folder filesystem), bukan Domain. Menonjolkan field
  Folder di form utama Domain jadi berpotensi menyesatkan — user diarahkan
  isi field yang salah untuk kasus mereka. Form sekarang minimal (Nama +
  Hostname saja), `folder` di backend tetap auto-default dari `id` seperti
  semula. Paragraf penjelasan di atas form kini eksplisit mengarahkan:
  *"Sudah punya proyek/app sendiri? ... daftarkan sebagai Route"*.
- Kemampuan folder absolut di backend **tidak dihapus** (masih bisa
  dipakai lewat panggilan API langsung kalau suatu saat dibutuhkan),
  cuma tidak lagi diekspos sebagai input di form Desktop — sesuai
  `AGENTS.md` (jangan hapus fitur tanpa alasan kuat; ini backward-compat
  murni, tidak mengubah perilaku default).

**Diverifikasi:** `node --check` semua file — OK. Backend & Desktop
di-restart, form Domain sekarang tampil sederhana (Nama + Hostname),
tanpa regresi ke endpoint yang sudah ada.

---

## 8b. Penyederhanaan lebih jauh: satu form, satu tabel (2026-09-11)

Setelah §8 (klarifikasi Domain vs Routes), user menunjuk satu tingkat
lagi: dari sudut pandang orang yang memakai, **tidak perlu ada
pembedaan "API" vs "Web" secara eksplisit** — user cuma tahu "saya mau
hostname ini menuju ke sana", dan yang membedakan sebenarnya cuma satu
hal: **sudah ada yang jalan di suatu port atau belum**.

**Desain baru — satu form terpadu di `domain.js`:**
```
Nama, Hostname, Port (opsional)
   │
   ├─ Port diisi   → createRoute({origin: http://127.0.0.1:<port>, autoDns:true})
   └─ Port kosong  → createWebInstance({name, hostname})  (nxcloud buatkan halaman baru)
```
Tabel di bawah form juga digabung — menampilkan Routes DAN Web Instances
sebagai satu daftar (kolom "Tujuan" menunjukkan origin atau
"halaman statis (port N)"), dengan Hapus yang otomatis memanggil
`deleteRoute`/`deleteWebInstance` sesuai jenis barisnya. Kartu "API
nxcloud" (bawaan, tidak bisa dihapus) tetap tampil terpisah di atas
sebagai info, bukan bagian dari tabel yang bisa diedit.

**Gap ditemukan & ditutup sekalian**: `POST /api/routes` (dipakai jalur
"Port diisi") **tidak pernah memanggil `addDnsRoute()`** — beda dari
`POST /api/domains/web` yang sudah otomatis DNS sejak §5.3. Kalau
dibiarkan, form terpadu ini akan berjanji "satu langkah" tapi diam-diam
DNS tetap manual untuk jalur Route. Diperbaiki: `src/api/router.js`
endpoint `POST /api/routes` sekarang menerima flag **opt-in**
`body.autoDns` — hanya kalau `true`, jalankan
`assertHostnameIsManaged()` + `addDnsRoute()` setelah `createRoute()`
berhasil. **Sengaja opt-in, bukan default** — supaya route lintas-domain
lain (kasus lama seperti `socket` yang mungkin bukan subdomain root
terkelola) atau yang sengaja mau DNS manual, tetap tidak dipaksa lewat
`cloudflared`. Form Routes yang terpisah (`routes.js`) tidak mengirim
flag ini, jadi perilakunya persis seperti sebelum perubahan ini.

**Diverifikasi (tanpa membuat DNS sampah baru — dua insiden sebelumnya
cukup jadi pelajaran):**
- `POST /api/routes` TANPA `autoDns` → `dns: null`, tidak memanggil
  `cloudflared` sama sekali (dites dengan route sekali pakai, dihapus
  bersih setelahnya) — perilaku lama utuh, tidak ada regresi.
- `POST /api/routes` DENGAN `autoDns: true` + hostname **domain lain**
  (`test.some-other-domain-xyz.com`) → ditolak `400` SEBELUM route
  dibuat sama sekali (`0` kemunculan di data setelahnya) — validasi
  jalan duluan, `cloudflared` tidak sempat dipanggil. Jalur sukses
  (`autoDns:true` + hostname valid) TIDAK dites ulang dengan DNS
  sungguhan — sudah cukup terbukti benar lewat kombinasi: (a) logika
  `addDnsRoute()` sendiri sudah diverifikasi tuntas di §5.4, (b) jalur
  `createWebInstance` yang identik polanya sudah diverifikasi tuntas di
  §5.3.
- `node --check` semua file — OK. Backend & Desktop di-restart bersih,
  tidak ada regresi ke endpoint publik (`nx.`, `web.` tetap `200`).

---

## 8c. Koreksi arah: Domain vs Routes tumpang tindih materi (2026-09-11)

Setelah §8b (form terpadu Port), user menunjukkan masalah lebih mendasar:
bukan bug teknis, tapi **materi 3 halaman jadi tumpang tindih dan tidak
konsisten** — bukan cuma soal desain form:

1. **Dua tempat bisa `createRoute()`** dengan kelengkapan berbeda:
   form Domain (§8b) cuma bisa `origin: http://127.0.0.1:<port>`, sementara
   form Routes yang sudah ada bisa origin bebas + Description + Path
   Proyek + Command. Route yang sama bisa dibuat dari dua tempat dengan
   hasil tidak setara.
2. **Route yang sama tertampil di dua tabel berbeda** (Domain dan Routes)
   dengan kolom/aksi yang tidak sama — tidak jelas mana rujukan utama.
3. **`proses.js`** hanya mengenali route yang py `projectPath`+`command`
   (field yang cuma bisa diisi lewat form Routes) — route yang dibuat dari
   form Domain (§8b) tidak akan pernah muncul di Proses meski secara
   konsep sama (app yang sudah jalan di port tertentu).

**Keputusan final: pembagian tanggung jawab yang jelas, tidak simetris**
(dipilih dari beberapa opsi yang didiskusikan):

| Halaman | Peran |
| ------- | ----- |
| **Domain** | Ringkasan/overview murni — status login+root domain, kartu API, tabel ringkas SEMUA hostname (read-only, tanpa Edit/Hapus untuk Route). SATU-SATUNYA aksi tulis yang tersisa di sini: buat **Halaman Statis baru** (Web Instance) — karena itu fitur unik yang tidak ada tempat lain. |
| **Routes** | SATU-SATUNYA tempat CRUD Route (app dengan server sendiri) — form lengkap (Origin bebas, Description, Path Proyek, Command) sudah benar sejak awal, tidak diubah. |
| **Proses** | Tidak berubah — tetap baca `projectPath`+`command` dari Routes, konsisten karena field itu memang cuma diisi di satu tempat sekarang. |

**Perubahan yang dieksekusi:**
- `Desktop/templates/nxcloud/domain.js` — **ditulis ulang total**.
  Form "Port opsional → createRoute" dari §8b **dihapus sepenuhnya**
  (bukan cuma disembunyikan — form createRoute yang lebih sederhana ini
  akan selalu kalah lengkap dari form Routes, jadi lebih baik tidak ada
  daripada ada dua versi berbeda). Yang tersisa: banner login/domain
  (tidak berubah), kartu API (tidak berubah), **tabel ringkas read-only**
  gabungan Route+Web (tanpa tombol aksi kecuali link "Kelola di Routes →"),
  dan form **Buat Halaman Statis** (cuma `createWebInstance`, sama seperti
  sebelum §8b — field Port yang sempat ditambahkan di §8b dihapus dari
  form ini karena jalurnya sendiri yang dihapus).
- `src/api/router.js` — endpoint `POST /api/routes` **dikembalikan** ke
  bentuk sebelum §8b (tanpa parameter `autoDns`/pemanggilan `addDnsRoute`)
  — karena tidak ada lagi UI yang memanggilnya dengan flag itu, kode itu
  jadi mati (dead code) kalau dipertahankan. `assertHostnameIsManaged`
  tetap dipakai di endpoint `createWebInstance` (tidak terpengaruh).
- `routes.js`, `proses.js` — **tidak diubah sama sekali**, keduanya sudah
  benar sebagai satu-satunya tempat kelola Route dan Proses.

**Diverifikasi:** `node --check` semua file — OK. Backend & Desktop
di-restart penuh. Sempat terlihat `502` sesaat di `web.tirtamoolango.id`
tepat setelah restart tunnel (transient, pulih sendiri ~5 detik kemudian,
dikonfirmasi ulang `200`) — bukan regresi dari perubahan kode, wajar
terjadi setiap kali proses `cloudflared` baru selesai reconnect.

---

## 8d. Rombak total + istilah baku (2026-09-11, iterasi final)

Setelah §8c masih dinilai keliru — bukan cuma soal pembagian halaman,
tapi **istilah yang berubah-ubah** di dalam satu halaman saja ("Semua
Hostname", "nxcloud API", "Halaman Statis Baru" — tiga label
berbeda untuk konsep yang saling tumpang tindih, bahkan sebelum
dibandingkan lintas halaman). Dihentikan dulu, disusun ulang dari
definisi entitas data (bukan istilah UI), baru diberi nama SEKALI dan
dipakai konsisten selamanya.

### Tiga entitas data (fakta backend, sumber kebingungan sebelumnya)

| # | Sumber | Ciri |
| - | ------ | ---- |
| 1 | `GET /api/routes` → 1 baris tetap (`id: "nxcloud"`) | Bawaan, TIDAK bisa dihapus/diedit |
| 2 | `GET /api/routes` → baris lain | App eksternal, origin bebas |
| 3 | `GET /api/domains/web` (`web-instances.json`) | Statis, nxcloud sendiri yang serve |

### Istilah baku (dikonfirmasi eksplisit, dipakai final)

| Entitas | Istilah |
| ------- | ------- |
| #1 | **nxcloud API** (bawaan) |
| #2 | **Route** |
| #3 | **Halaman Statis** |

### Alur bisnis final — satu pintu masuk, satu tempat kelola

```
Domain (TAMBAH BARU SAJA, tanpa tabel)
   │  Port diisi   → createRoute()        (jadi Route)
   │  Port kosong  → createWebInstance()  (jadi Halaman Statis)
   ▼
Routes (SATU-SATUNYA tempat LIHAT + KELOLA semua yang sudah ada)
   │  1 tabel gabungan: nxcloud API (baris info, tanpa aksi)
   │                  + Route (Edit/Uji/Hapus)
   │                  + Halaman Statis (Hapus saja)
   ▼
Proses (tidak berubah — baca command+projectPath dari Route)
```

**`domain.js` ditulis ulang total** — HANYA form (Nama, Hostname, Port
opsional) + banner login/root-domain. **Tidak ada tabel sama sekali** di
halaman ini lagi (§8c masih punya tabel ringkas, itu salah satu sumber
tumpang-tindih — dihapus). Pesan sukses submit berisi link "kelola di
Routes →".

**`routes.js` ditulis ulang total** — kartu "nxcloud API" terpisah
(dari §8c) **dihapus**, digabung jadi baris tabel biasa dengan kolom
Jenis = "Bawaan", tanpa tombol aksi apapun. Form yang ada sekarang MURNI
mode edit (disembunyikan sampai tombol Edit sebuah Route diklik, judul
form "Edit route: <id>") — tidak ada lagi mode "tambah baru" di halaman
ini, konsisten dengan alur "Domain = satu pintu masuk". Tabel
menggabungkan ketiga jenis entitas dengan kolom Jenis eksplisit
(Bawaan/Route/Halaman Statis) dan aksi yang sesuai per jenis (Bawaan:
tanpa aksi; Route: Uji+Edit+Hapus; Halaman Statis: Hapus saja).

**Bug ditemukan saat penulisan ulang**: sisa referensi ke `apiCardEl`
(elemen yang sudah dihapus dari HTML saat kartu API digabung ke tabel)
masih dipanggil di blok `catch` — akan jadi `ReferenceError` kalau
`loadList()` gagal. Diperbaiki sebelum sempat dites di GUI.

**Diverifikasi:** `node --check` kedua file — OK. Backend tidak diubah
di iterasi ini (murni Desktop UI), tetap sehat (`health: 200`). Desktop
di-restart, kedua halaman termuat tanpa error.

| Tahap | Status |
| ----- | ------ |
| §5.2 Generalisasi `staticServer.js` | ✅ |
| §5.1 Model data `web-instances.json` + fix bug data-loss | ✅ |
| §5.4 Modul `cloudflare/dns.js` (validasi + panggil cloudflared) | ✅ |
| §5.3 Endpoint `/api/domains/*` | ✅ |
| §5.3b Multi-instance startup di `src/index.js` | ✅ |
| §5.6 Menu Desktop "Domain" | ✅ |

**Semua 6 tahap rencana selesai.** Backend dan Desktop UI untuk
onboarding domain/subdomain sudah terhubung penuh dan diverifikasi
end-to-end (termasuk 2 kali tes DNS nyata dengan izin eksplisit user,
keduanya dibersihkan tuntas — data lokal maupun DNS record).

### Batasan yang tetap berlaku (tidak berubah, lihat §6 dokumen ini)
- Domain **root** baru tetap tidak bisa didaftarkan dari GUI ini.
- `cloudflared tunnel login` tetap prasyarat manual sekali per mesin.
- Instance web baru butuh **restart nxcloud** untuk server-nya aktif
  (tidak ada hot-reload proses berjalan).
- DNS yang terlanjur dibuat **tidak bisa dihapus dari GUI/CLI** — selalu
  perlu dashboard Cloudflare manual (dikomunikasikan jujur di UI).

### §5.4 — ⚠️ INSIDEN saat riset, desain direvisi (2026-09-11)

Saat menguji perilaku `cloudflared tunnel route dns` untuk desain modul
ini, dites hostname sembarang untuk lihat pesan error:
`test-verify.domain-tidak-ada-xyz123.com.tirtamoolango.id`. **Ekspektasi
salah** — dikira `cloudflared` akan menolak domain yang tidak valid/tidak
dikenal akun. Kenyataan: `cloudflared` **selalu menambahkan CNAME apa pun
yang diberi** sebagai subdomain dari zone yang sudah dikenal akun
(di sini: `tirtamoolango.id`), **tanpa validasi format**, dan **tidak
ada command untuk menghapusnya** dari CLI. Record sampah nyata dibuat
di DNS production (dikonfirmasi via `nslookup`), harus dihapus manual
oleh user di dashboard Cloudflare — **belum dikonfirmasi bersih di
sesi ini**.

**Ini mengubah desain §5.4 wajib:**
- Backend **harus** memvalidasi hostname ketat di sisi nxcloud
  SEBELUM memanggil `cloudflared tunnel route dns` — minimal: hostname
  harus diakhiri dengan salah satu domain yang **sudah dikenal** (mis.
  hostname existing di `routes.json`/`web-instances.json`, atau domain
  eksplisit yang di-set user di config), BUKAN diterima mentah dari input
  form. `assertValidRoute`/`assertValidInstance` yang ada sekarang cuma
  cek format umum (`/^[a-z0-9.-]+\.[a-z]{2,}$/`), tidak cek domain induk.
- Perlu langkah **konfirmasi eksplisit** di UI sebelum aksi DNS dieksekusi
  (bukan langsung jalan saat form disubmit) — mis. preview "akan membuat
  CNAME `X` di zone `Y`, lanjutkan?" — karena aksi ini **tidak bisa
  di-undo dari GUI/CLI** sama sekali.
- Modul `dns.js` sendiri belum ditulis — desain di atas jadi syarat
  sebelum implementasi jalan, bukan sekadar nice-to-have.

**Tindak lanjut:** ✅ Record sampah sudah dihapus manual oleh user di
dashboard Cloudflare (2026-09-11), dikonfirmasi bersih via `nslookup`
(`Non-existent domain`).

### §5.4 — ✅ SUDAH DIEKSEKUSI (2026-09-11, dengan validasi ketat)

`src/cloudflare/dns.js` (baru):
- `getManagedRootDomain()` — ambil root domain (2 label terakhir) dari
  `config.cloudflare.hostname` yang sudah ada (mis. `nx.tirtamoolango.id`
  → `tirtamoolango.id`). Ini satu-satunya domain yang dipercaya.
- `assertHostnameIsManaged(hostname)` — tolak (`BAD_REQUEST`) kalau
  hostname bukan `root` itu sendiri atau bukan `*.root` (pengecekan pakai
  `===`/`.endsWith('.' + root)`, BUKAN `.includes()`, supaya tahan
  suffix-trick seperti `tirtamoolango.id.evil.com`).
- `addDnsRoute(hostname)` — panggil validasi DULU, baru kalau lolos,
  `execFile(cloudflaredBinary, ['tunnel','route','dns',tunnelName,hostname])`.
  Parse output: `alreadyExisted: true` kalau pesan mengandung
  "already configured" (idempotent, aman dipanggil ulang), `created: true`
  kalau baris baru dibuat.

**Diverifikasi (tanpa menyentuh DNS production lagi):**
- `assertHostnameIsManaged` dites 5 skenario tanpa memanggil `cloudflared`
  sama sekali: subdomain valid → allowed; root domain sendiri → allowed;
  domain lain (`evil.com`) → rejected; suffix-trick
  (`tirtamoolango.id.evil.com`) → rejected dengan benar (bukti fix suffix
  bug bekerja); domain mirip tapi beda (`nottirtamoolango.id`) → rejected.
- `addDnsRoute('web.tirtamoolango.id')` — hostname **yang sudah ada**,
  dipakai sebagai satu-satunya cara aman menguji jalur sukses tanpa
  membuat record baru: hasil `alreadyExisted: true, created: false`,
  tidak ada DNS baru dibuat.
- `addDnsRoute('sneaky.evil.com')` — ditolak dengan `BAD_REQUEST`
  **sebelum** `cloudflared` sempat dipanggil (dibuktikan: tidak ada
  network call, error muncul instan dari validasi lokal).

---

## 10. Keputusan final Domain/Routes/Proses (2026-09-11, setelah beberapa iterasi)

Setelah beberapa putaran revisi (§8b–§8e, tidak dirinci ulang di sini —
intinya: coba gabung form, coba pisah lagi, coba taruh field detail di
Domain, ternyata janggal, coba taruh Edit di Routes, ternyata Hostname
di form Edit menyesatkan karena tidak sinkron dengan DNS, akhirnya
diputuskan dihapus total), berikut **kondisi final yang dikonfirmasi
sesuai oleh user**:

**Istilah baku** (dipakai konsisten di semua halaman):
- **nxcloud API** — baris bawaan (`id: "nxcloud"`), tanpa aksi.
- **Route** — app eksternal dengan server sendiri, origin bebas.
- **Halaman Statis** — file statis yang nxcloud sendiri jalankan.

**Domain** (`domain.js`) — SATU-SATUNYA tempat ADA FORM:
- Form: Nama, Hostname, Port (opsional). TIDAK ADA field lain (Origin
  custom/Description/Path Proyek/Command sengaja tidak ada di sini).
- Port diisi → `createRoute()` (origin selalu `http://127.0.0.1:<port>`).
- Port kosong → `createWebInstance()`.
- TIDAK ADA tabel di halaman ini.

**Routes** (`routes.js`) — MURNI tabel baca-saja, TIDAK ADA form sama
sekali (termasuk tidak ada Edit):
- Satu tabel gabungan: nxcloud API (info saja) + Route (Uji, Hapus)
  + Halaman Statis (Hapus saja).
- Untuk "mengubah" data Route yang sudah ada (Origin, Description, Path
  Proyek, Command): **hapus lalu buat ulang dari Domain** — bukan
  edit in-place. Trade-off yang disengaja demi satu pintu masuk yang
  jelas, dikonfirmasi eksplisit oleh user.

**Proses** (`proses.js`) — tidak diubah sama sekali sepanjang semua
iterasi ini.

**Yang TIDAK dihapus dari backend** (tetap valid dipanggil via API
langsung, hanya tidak ada tombol UI untuk itu lagi): `updateRoute()` di
`client/nxcloudApi.js` dan endpoint `PATCH /api/routes/:id`.

**Pelajaran untuk sesi berikutnya**: kalau diminta ubah alur/istilah
UI lagi di area ini, mulai dari menyusun rancangan sebagai TEKS dulu
(bukan langsung kode), minta konfirmasi eksplisit per keputusan kecil
sebelum tulis kode — proses coba-coba langsung di kode adalah yang
membuat sesi sebelumnya berputar-putar berkali-kali.

---

## 11. Tambahan setelah §10: Edit port dikembalikan (2026-09-11)

User klarifikasi: dari aksi yang tersisa di Routes (Uji, Hapus), yang
benar-benar "mengubah" data cuma Hapus — dan diputuskan tambah kembali
**satu** kemampuan edit yang sempit: **ubah Port saja** untuk Route
(bukan field lain).

**Perubahan**: `routes.js` — tombol **Ubah Port** muncul di baris Route
(tidak untuk Halaman Statis — portnya dialokasikan otomatis, tidak boleh
diubah sembarangan). Form kecil satu field (Port baru), submit memanggil
`updateRoute(id, { origin: newOrigin })` — origin baru dihitung dengan
regex ganti angka port di string origin lama, host/protokol tetap sama.

**Diverifikasi**: dicek `updateRoute()` backend (`{...prev, ...body}`)
— mengirim `origin` saja TIDAK menghapus field lain (`projectPath`,
`description`, `command` tetap ada). Dibuktikan nyata via `PATCH
/api/routes/socket` dengan body `{origin: ...}` saja — `projectPath`
route `socket` tetap utuh sebelum/sesudah. `node --check` OK, Desktop
di-restart, tidak ada regresi ke data production (port dikembalikan ke
nilai semula setelah tes).

---

## 12. Penghapusan total "Halaman Statis" / Web Instance (2026-09-11)

**Keputusan arsitektur final dari user**, dikonfirmasi eksplisit dengan
"Ya, ini benar" untuk pernyataan:

> nxcloud = murni pengelola pemetaan hostname→origin. Tidak
> pernah ada "proyek yang dibangun di dalam nxcloud" untuk
> di-publish (folder `web/`, static server internal dihapus). Origin
> SELALU proses eksternal yang sudah ada duluan.

Konsep "Halaman Statis" (nxcloud menjalankan static file server
sendiri untuk melayani HTML) dinilai KELIRU secara fundamental — sistem
ini hanya boleh menjadi penyedia manajemen rute (hostname → origin
eksternal), bukan tempat proyek/asset dibangun.

**Dihapus total:**
- `src/web/instances.js`, `src/web/staticServer.js` (file + folder
  `src/web/`)
- Folder `web/` di root (isi `index.html` static site
  `web.tirtamoolango.id`)
- `config/web-instances.json` (data instance, termasuk entry
  `web.tirtamoolango.id` yang sedang live) — dihapus sesuai keputusan
  eksplisit user: "Hapus juga entry Web Instance-nya (data) sekaligus"
- Endpoint `GET/POST/PATCH/DELETE /api/domains/web*` di `router.js`
- Method client API: `listWebInstances`, `getWebInstance`,
  `createWebInstance`, `updateWebInstance`, `deleteWebInstance` (di
  `client/nxcloudApi.js`, disinkronkan ke `Desktop/lib/`)
- Field `web.*` di `config.js` (`DEFAULTS`, `CONFIG_KEYS`, validasi)
  dan `WEB_INSTANCES_FILE`/`WEB_DIR` di `utils/paths.js`
- `Desktop/templates/nxcloud/domain.js`: cabang "Port kosong →
  buat Halaman Statis" dihapus, Port jadi field wajib, form selalu
  panggil `createRoute()`
- `Desktop/templates/nxcloud/routes.js`: kolom "Jenis", baris
  `kind: 'web'`, tombol Hapus untuk Web dihapus — tabel sekarang
  murni daftar Route eksternal

**Tambahan koreksi arah yang sama** (ditemukan dari screenshot user
setelah cleanup di atas): baris "nxcloud" (API bawaan, id
`nxcloud`, hostname `nx.tirtamoolango.id` → `127.0.0.1:8787`)
JUGA salah karena disimpan sebagai *route record* di `routes.json`
yang bisa diedit/dihapus lewat CRUD yang sama dengan route eksternal —
ini mengulang pola yang sama (sistem mengelola dirinya sendiri sebagai
data terkelola). User memilih: **hapus baris ini dari UI Routes sama
sekali** — halaman itu murni untuk route eksternal.

**Perubahan `src/api/routes.js`:**
- `ensureStore()` tidak lagi seed route `id: 'nxcloud'` — dimulai
  dari `{routes: []}` kosong (lalu diisi user via Domain)
- Fungsi baru `builtinApiIngress()` — menghitung hostname+origin API
  sendiri langsung dari `config.cloudflare`, TIDAK disimpan sebagai
  data route
- `syncCloudflaredIngress()` selalu menyisipkan baris ingress builtin
  ini di awal (sebelum route user), jadi tunnel tetap expose API-nya
  sendiri — tanpa API itu jadi entry yang bisa diedit/dihapus user
- `assertValidRoute()` menolak user membuat/mengubah route dengan
  hostname yang sama dengan hostname API bawaan (reserved)
- `config/routes.json` entry `id: "nxcloud"` dihapus, hanya
  tersisa route eksternal (`socket`)

**Diverifikasi:** `node --check` semua file OK. Backend di-restart
(taskkill proses lama + child `cloudflared`, start ulang) —
`/api/health` OK, `/api/routes` hanya menampilkan `socket`,
`/api/domains` tetap tampilkan info API (read-only, bukan dari
`routes.json`). Ingress `.credentials/config.yml` diverifikasi: baris
stale `web.tirtamoolango.id` hilang, baris `nx.tirtamoolango.id` tetap
ada (dari `builtinApiIngress()`, bukan data tersimpan). Log tunnel
menunjukkan 4 koneksi registered sukses, tanpa error ingress.

---

## 13. Penghapusan hostname publik nxcloud API sepenuhnya (2026-09-11, lanjutan §12)

User menghapus DNS `nx.tirtamoolango.id` di Cloudflare secara manual,
dengan alasan eksplisit: *"sengaja aku hapus karena itu proyek pertama
yang salah — rute ada di dalam sistem"*. Ini memperluas prinsip §12:
bukan cuma "jangan simpan API sebagai route record", tapi **API
nxcloud tidak boleh punya hostname publik sama sekali** — hanya
diakses dari localhost (`127.0.0.1:8787`). Tunnel hanya untuk
meng-expose route eksternal (app lain), bukan untuk mempublish
nxcloud sendiri.

**Perubahan:**
- `builtinApiIngress()` di `src/api/routes.js` dihapus total (bukan
  cuma dikosongkan) — `syncCloudflaredIngress()` sekarang murni dari
  route eksternal tersimpan, tanpa baris tambahan apapun untuk API
- Field `cloudflare.hostname` dihapus dari seluruh config (`DEFAULTS`,
  `CONFIG_KEYS`, `getPublicConfig()`, `getTunnelPayload()`,
  `buildStatus()`, banner CLI, `cli/status.js`, `cli/tunnel.js`)
- Field baru **`cloudflare.rootDomain`** menggantikan peran hostname
  untuk validasi keamanan (`getManagedRootDomain()` di `dns.js`) —
  sebelumnya root domain diturunkan dari `hostname` (mis.
  `nx.tirtamoolango.id` → `tirtamoolango.id`), sekarang diisi manual
  dan eksplisit karena tidak ada lagi hostname API untuk diturunkan
  darinya. `validateConfig()` mewajibkan `rootDomain` (bukan lagi
  `hostname`) saat `mode === 'named'`
- `resolvePublicUrl()` di `cloudflare/config.js` disederhanakan —
  tidak ada lagi fallback `https://${hostname}`, hanya
  `tunnelResult.url` (untuk quick mode). Named mode sekarang selalu
  `url: null` karena API memang tidak publik
- `startCloudflaredProcess()` di `cloudflare/process.js` tidak lagi
  menerima/menyimpan parameter `hostname`
- Desktop: `overview.js`, `tunnel.js`, `settings.js` — baris
  "Hostname" API dihapus dari tampilan (sudah tidak ada di payload);
  `settings.js` sekalian dibersihkan dari sisa tabel "Web Statis" yang
  terlewat di §12; instruksi CLI di `domain.js` diganti dari
  `config set cloudflare.hostname ...` ke
  `config set cloudflare.rootDomain ...`
- `config/nxcloud.json`: `cloudflare.hostname` diganti
  `cloudflare.rootDomain: "tirtamoolango.id"` (tetap sama root domain-
  nya, field-nya saja yang dipisah dari konsep hostname publik)

**Diverifikasi:** semua file `node --check` OK. Backend di-restart 2x
(sekali untuk config baru, sekali lagi untuk resync ingress final).
`/api/domains` → `{rootDomain: "tirtamoolango.id"}` (tanpa field
`api` lagi). `/api/tunnel` → `url: null` (benar, API tidak publik).
Ingress `.credentials/config.yml` final hanya berisi
`socket.tirtamoolango.id` dan `model.tirtamoolango.id` — tidak ada
baris untuk `nx.tirtamoolango.id` sama sekali. Log tunnel: 4 koneksi
registered sukses tanpa error.

---

## 14. Bug: form Domain tidak pernah membuat DNS sungguhan (2026-09-11)

Ditemukan saat user membuat `model.tirtamoolango.id` lewat Domain: route
jalan lokal (ping OK) tapi hostname-nya TIDAK muncul di dashboard
Cloudflare — hanya `socket.tirtamoolango.id` yang terdaftar (dibuat
manual dari sesi lama). Dialog konfirmasi Domain mengklaim "Ini akan
membuat DNS CNAME baru di Cloudflare", tapi `createRoute()` di backend
cuma menulis `routes.json` + ingress `config.yml` — tidak pernah
memanggil `addDnsRoute()`. Pesan hasil (`dnsNote`) juga salah baca
`result.sync?.written` (status tulis ingress) seolah itu status DNS.

**Perbaikan** (`src/api/routes.js`):
- `createRoute()` sekarang `async`, memanggil
  `assertHostnameIsManaged()` lalu `addDnsRoute()` (fungsi yang sudah
  ada di `cloudflare/dns.js` dari histori lama, tidak pernah dipakai)
  SEBELUM menulis route ke disk — konsisten dengan pelajaran §5.4:
  validasi/aksi eksternal dulu, baru tulis data, supaya tidak ada data
  yatim kalau DNS gagal
- Return value `createRoute()` sekarang punya field `dns` (hasil asli
  dari `addDnsRoute()`) selain `route` dan `sync`
- `router.js`: `await createRoute(body)` di handler POST /api/routes
- `Desktop/templates/nxcloud/domain.js`: `dnsNote` dibaca dari
  `result.dns` (created/alreadyExisted/error) yang sekarang benar-benar
  merepresentasikan status DNS, bukan status ingress

**Diverifikasi**: route `model` lama (tanpa DNS asli) dihapus, dibuat
ulang lewat `POST /api/routes` — response `dns.created: true`, output
cloudflared: *"Added CNAME model.tirtamoolango.id which will route to
this tunnel"*. User konfirmasi hostname muncul di dashboard Cloudflare
setelah ini ("berhasil").

---

## 15. Penghapusan total menu Proses (2026-09-11)

User menunjuk menu **Proses** (start/stop app eksternal via
`command`+`projectPath` per route) sebagai bagian yang masih keliru
dalam alur Domain → Routes → Proses. Investigasi: field
`command`/`projectPath` tidak pernah bisa diisi dari UI manapun (form
Domain cuma Nama/Hostname/Port; tidak ada form Edit lain sejak §10
"hapus bodok") — jadi menu Proses secara praktis SELALU kosong untuk
siapapun yang memakai alur normal. Ini juga bertentangan langsung
dengan prinsip arsitektur final (§12): *"Origin SELALU proses
eksternal yang sudah ada duluan"* — nxcloud tidak seharusnya
menjadi process manager untuk app lain, itu tugas eksternal (PM2,
systemd, atau dijalankan manual). Menu Proses mengulang pola yang sama
dengan Halaman Statis: fitur yang membuat nxcloud "mengelola
sesuatu di dalam dirinya" alih-alih murni memetakan hostname→origin.

**Keputusan user**: hapus total, bukan diperbaiki dengan menambah form
pengisian command/projectPath.

**Dihapus:**
- `src/api/processes.js` (seluruh logic spawn/kill child process)
- `Desktop/templates/nxcloud/proses.js`
- Endpoint `GET/POST/DELETE /api/routes/:id/process`,
  `GET /api/routes/:id/process/logs` di `router.js`
- Field `command`, `projectPath`, `description` di
  `normalizeRoute()` (`src/api/routes.js`) — `description` ikut
  dihapus karena sama-sama tidak pernah punya form pengisian di UI
  manapun, alasan yang sama persis
- `ROUTE_PROCESSES_DIR`, `ROUTE_LOGS_DIR`, `routeProcessPidFile()`,
  `routeProcessLogFile()` di `utils/paths.js`
- Method client API: `getRouteProcess`, `startRouteProcess`,
  `stopRouteProcess`, `getRouteProcessLogs`
  (`client/nxcloudApi.js`, disinkronkan ke `Desktop/lib/`)
- Menu "Proses" di sidebar `Desktop/templates/nxcloud/index.js`
  dan baris terkait di `README.md`

**Diverifikasi**: `node --check` semua file OK. Backend di-restart —
`/api` self-description tidak lagi mencantumkan endpoint process apapun,
`/api/routes` menunjukkan data `socket`/`model` sudah otomatis
ternormalisasi ulang (field `command`/`projectPath`/`description`
hilang dari output tanpa perlu migrasi manual, karena `normalizeRoute()`
dipanggil ulang tiap `readAll()`).

---

## 16. Edit rootDomain dari UI Pengaturan (2026-09-12)

User bertanya: di UI mana `cloudflare.rootDomain` (§13) bisa diatur?
Jawaban: tidak ada — halaman Pengaturan sengaja read-only, satu-
satunya cara sebelumnya adalah CLI (`nxcloud config set
cloudflare.rootDomain ...`). Diputuskan untuk menambah kemampuan edit
lewat UI, dengan endpoint backend **sempit** (bukan generic config-set
menerima key apapun) — permukaan API dari Desktop sebaiknya sekecil
mungkin.

**Ditambahkan:**
- `PATCH /api/config/root-domain` di `router.js` — hanya menerima
  `{rootDomain}`, validasi format domain (regex sederhana), panggil
  `setConfigValue('cloudflare.rootDomain', ...)` yang sudah ada di
  `config.js` (dipakai CLI `config set`, sekarang dipakai juga dari
  HTTP). Loopback-write only, seperti endpoint tulis lainnya.
- Client API: `setRootDomain(rootDomain)` di
  `client/nxcloudApi.js` (disinkronkan ke `Desktop/lib/`)
- `Desktop/templates/nxcloud/settings.js`: bagian "Root domain"
  sekarang form (input + Simpan) alih-alih baris read-only. Bagian
  lain (Server, Nama Tunnel, Service, Control API) tetap read-only —
  hanya rootDomain yang dibuka karena itu satu-satunya field yang
  user butuh ubah rutin (tiap kali pindah/tambah domain terkelola)

**Diverifikasi**: `node --check` OK. Backend di-restart. `PATCH
/api/config/root-domain` dengan `tirtamoolango.id` (nilai sama, no-op
aman untuk data production) → 200, config reload benar. Dicoba juga
input tidak valid (`"bukan domain valid"`) → 400 dengan pesan error
yang jelas. `/api/domains` dan `/api/routes` tetap normal setelahnya,
tidak ada regresi ke `socket`/`model`.

---

## 17. Root domain jadi banyak (multi-domain) (2026-09-12)

User tanya: kalau punya banyak domain terkelola, gimana? Saat itu
`cloudflare.rootDomain` masih string tunggal (§16) — form Domain di
UI cuma bisa suffix 1 domain tetap. Diputuskan: bangun sekarang,
bukan ditunda, karena user eksplisit minta "selektor domain" untuk
kasus banyak domain.

**Perubahan schema**: `cloudflare.rootDomain` (string) →
`cloudflare.rootDomains` (array of string) di seluruh backend:
- `config.js`: `DEFAULTS.cloudflare.rootDomains: []`, `CONFIG_KEYS`
  update, `validateConfig()` cek array non-kosong (bukan string
  non-kosong) untuk mode named, `coerceConfigValue()` untuk CLI
  parse comma-separated (`config set cloudflare.rootDomains
  a.com,b.com`) jadi array
- `cloudflare/dns.js`: `getManagedRootDomain()` → jamak
  `getManagedRootDomains()` (return array) + fungsi baru
  `matchRootDomain(hostname)` (cari domain mana yang cocok, dipakai
  `assertHostnameIsManaged()` untuk pesan error yang menyebut semua
  domain terkelola bila tidak ada yang cocok)
- `router.js`: `GET /api/domains` return `{rootDomains: [...]}`
  (jamak). Endpoint tulis diganti dari `PATCH
  /api/config/root-domain` (replace satu string, dari §16) jadi DUA
  endpoint sempit: `POST /api/config/root-domains` (tambah satu,
  409 kalau duplikat) dan `DELETE
  /api/config/root-domains/:domain` (hapus satu, 404 kalau tidak
  ada) — pola add/remove-item, bukan replace-seluruh-list, supaya
  race condition antar dua tab Desktop tidak saling menimpa
- Client API: `setRootDomain()` (§16) diganti `addRootDomain()` +
  `removeRootDomain()` (`client/nxcloudApi.js`, sync ke
  `Desktop/lib/`)
- `Desktop/templates/nxcloud/settings.js`: bagian Root domain
  sekarang daftar (`<ul>`) dengan tombol Hapus per item + form
  tambah satu domain baru, bukan satu input replace
- `Desktop/templates/nxcloud/domain.js`: suffix subdomain (§16,
  awalnya `<span>` teks tetap satu domain) diganti `<select>`
  dropdown berisi semua `rootDomains` — user pilih root domain saat
  menghubungkan hostname baru, bukan diketik
- `config/nxcloud.json`: migrasi manual
  `"rootDomain": "tirtamoolango.id"` → `"rootDomains":
  ["tirtamoolango.id"]`

**Diverifikasi**: `node --check` semua file OK. Backend di-restart —
`/api/domains` → `{rootDomains: ["tirtamoolango.id"]}`. Diuji
`POST /api/config/root-domains` menambah `contohlain.test` (berhasil,
array jadi 2 item), lalu `DELETE
/api/config/root-domains/contohlain.test` (berhasil, kembali ke 1
item — state production dipulihkan). Diuji tambah domain duplikat
(`tirtamoolango.id` lagi) → 409 dengan pesan jelas. `/api/routes` dan
`/api/tunnel` tetap normal sepanjang pengujian, tidak ada regresi ke
`socket`/`model`.

---

## 18. Audit akhir + CLI `route` ditambahkan (2026-09-12)

Sebelum masuk tahap styling GUI, dijalankan audit menyeluruh (fork
agent, read-only) terhadap seluruh backend/client/Desktop UI/data
files. Hasil: tidak ada bug fungsional, aman lanjut styling. 5 temuan
ringan — semua dibereskan: `config/web-instances.json` yang sempat
muncul lagi dihapus, `config/routes.json` di-trigger self-heal (field
skema lama `command`/`projectPath`/`description` hilang dari file
fisik), `home.js` (halaman Tentang) ditulis ulang supaya sinkron
dengan menu aktual (sebelumnya masih menyebut `nx.tirtamoolango.id`
dan urutan pemula tidak menyebut Domain sama sekali), import
`clearState` tak terpakai di `index.js` dihapus, komentar stale
`web/` di `paths.js` diperbarui.

**Temuan baru dari user**: CLI (`bin/nxcloud.js`) sama sekali
tidak punya perintah untuk Domain/Routes — hanya
start/stop/restart/status/tunnel/config/logs. Padahal fitur inti
(hubungkan hostname baru, lihat/uji/ubah-port/hapus route) cuma bisa
lewat GUI Desktop atau `curl` manual ke API. User minta ditambahkan
setara CLI.

**Ditambahkan**: `src/cli/route.js` — subcommand baru
`nxcloud route`:
- `route list` — daftar route tersimpan (id, hostname, origin, status)
- `route add <hostname|subdomain> <port> [--root <domain>] [--name <nama>]`
  — kalau argumen pertama tidak mengandung titik, dianggap subdomain
  dan digabung dengan `--root`, atau root domain tunggal kalau cuma
  ada 1 root domain terkelola (auto-pick), atau error kalau ambigu
  (>1 root domain, tidak ada `--root`). Reuse `createRoute()` dari
  `src/api/routes.js` — jalur yang SAMA dengan Desktop Domain (§14 DNS
  fix ikut berlaku, DNS CNAME sungguhan dibuat)
- `route ping <id>` — reuse `pingRouteOrigin()`
- `route set-port <id> <port>` — reuse `updateRoute()`, ganti angka
  port di origin lewat regex (pola sama dengan tombol Ubah Port di
  Desktop `routes.js`)
- `route remove <id>` — reuse `deleteRoute()`, dengan pesan pengingat
  DNS tidak ikut terhapus otomatis (sama dengan konfirmasi di Desktop)
- Semua subcommand memanggil fungsi `src/api/routes.js` LANGSUNG
  (baca/tulis filesystem), bukan lewat HTTP ke backend — konsisten
  dengan pola `config.js` CLI yang sudah ada, jadi CLI tetap berfungsi
  meskipun backend (`nxcloud start`) tidak sedang berjalan
- Didaftarkan di `bin/nxcloud.js` (`case 'route'`) dan
  `src/cli/help.js` (seksi baru dengan contoh)

**Diverifikasi**: `node --check` semua file OK. `nxcloud route
list` dijalankan nyata terhadap data production — menampilkan
`socket`/`model` dengan benar, identik dengan yang ditampilkan GUI
Desktop. `nxcloud route ping socket` berhasil (reachable). Uji
error path: `route add` tanpa argumen → exit 1 dengan pesan usage
yang jelas. `nxcloud help` menampilkan seksi Route baru dengan
benar. `route add`/`set-port`/`remove` sungguhan TIDAK dites langsung
(akan membuat/mengubah DNS asli di domain production) — tapi memakai
fungsi backend yang sama persis dengan yang sudah divalidasi lewat
GUI (§14 fix DNS, §11 Ubah Port).
