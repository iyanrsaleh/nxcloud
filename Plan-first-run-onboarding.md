# Rencana — Onboarding "Pertama Kali Buka" (Hubungkan Akun Cloudflare)

> **Status:** rencana, belum dieksekusi.

**Tanggal:** 2026-09-11

**Latar belakang:** Setelah `Plan-domain-onboarding.md` selesai (menu
Domain, buat subdomain otomatis), muncul pertanyaan mendasar: **di mana
user pertama kali menghubungkan akun Cloudflare mereka ke nxcloud?**

Dicek langsung:
- `cert.pem` (hasil `cloudflared tunnel login`) **sudah ada** di mesin
  developer ini — itu sebabnya semua fitur sejauh ini terasa "langsung
  jalan", padahal prasyaratnya diam-diam sudah terpenuhi sebelum sesi
  kerja ini dimulai.
- **Tidak ada satupun kode**, baik di backend (`src/`) maupun Desktop UI
  (`Desktop/templates/nxcloud/`), yang mengecek status login ini.
- Disimulasikan: kalau `cert.pem` tidak ada, `cloudflared` gagal dengan
  pesan `Cannot find a valid certificate... run the command: cloudflared
  login` — pesan mentah CLI, muncul di `logs/tunnel.log`, TIDAK pernah
  ditangkap/diterjemahkan nxcloud maupun ditampilkan di Desktop.

**Kesimpulan:** user yang baru pasang nxcloud di mesin baru (belum
pernah `cloudflared login`) akan mentok tanpa arahan — start gagal diam-diam
di background, Desktop menampilkan "Gagal memuat: ..." generik di semua
halaman, tidak ada yang bilang "hubungkan akun Cloudflare dulu, begini
caranya".

---

## 1. Yang perlu dibedakan: 3 prasyarat berbeda, 3 status berbeda

```text
1. cloudflared terinstall?     → sudah dicek (findCloudflared(), README §13)
2. Akun Cloudflare terhubung?  → BELUM dicek sama sekali (gap ini)
3. Domain sudah dikonfigurasi? → sebagian (cloudflare.hostname kosong
                                   ditolak validateConfig() saat mode=named,
                                   tapi pesannya generik)
```

Prasyarat #2 (login akun) adalah gap murni yang belum tersentuh sama
sekali — ini fokus rencana ini.

---

## 2. Kenapa ini tidak bisa "dibuat otomatis" sepenuhnya

`cloudflared tunnel login` **membuka browser** untuk OAuth ke akun
Cloudflare pengguna — tidak ada cara memprogram ini tanpa interaksi
manusia (user harus login & approve di browser). Jadi tujuan rencana ini
**bukan** menghilangkan langkah manual itu, tapi:
1. **Mendeteksi** dengan jelas apakah sudah login atau belum.
2. **Memandu** user pertama kali dengan instruksi yang jelas (bukan error
   mentah), idealnya dengan tombol yang men-trigger `cloudflared login`
   langsung dari Desktop (browser tetap yang buka, tapi user tidak perlu
   buka terminal manual).
3. **Mencegah** state rusak — kalau start gagal karena belum login,
   nxcloud tidak boleh terus-menerus retry/crash-loop tanpa pesan
   jelas.

---

## 3. Cara deteksi status login (opsi teknis)

`cloudflared` menyimpan `cert.pem` di `~/.cloudflared/cert.pem` (Windows:
`%USERPROFILE%\.cloudflared\cert.pem`) setelah `login` berhasil. Deteksi:
- **Opsi A (dipakai)**: cek keberadaan file `cert.pem` di path itu
  (`os.homedir() + '/.cloudflared/cert.pem'`). Sederhana, tidak perlu
  spawn proses tambahan, konsisten dengan cara `cloudflared` sendiri
  mengecek (lihat pesan error di §atas: "at the path ... .cloudflared/cert.pem").
- **Opsi B (ditolak, lebih berat)**: jalankan `cloudflared tunnel list`
  dan lihat apakah gagal dengan pesan cert — lebih lambat (spawn proses)
  dan sinyal yang sama sebenarnya bisa didapat dari cek file saja.

**Keterbatasan opsi A**: cert.pem ada ≠ cert masih valid (bisa
revoked/expired di sisi Cloudflare). Deteksi ini "optimistic" — false
positive mungkin terjadi (kolom status bilang "terhubung" padahal token
sudah invalid), baru ketahuan saat benar-benar start tunnel. Ini
batasan yang diterima demi kesederhanaan (README: "sedikit dependency,
sederhana") — bukan tujuan mendeteksi validitas real-time.

---

## 4. Rencana perubahan (jika disetujui)

### Backend

- **`src/cloudflare/dns.js` atau modul baru `src/cloudflare/auth.js`**:
  `isCloudflareLoggedIn()` — cek `fs.existsSync(path.join(os.homedir(), '.cloudflared', 'cert.pem'))`.
  `triggerCloudflaredLogin()` — spawn `cloudflared tunnel login` (proses
  terpisah, TIDAK attached/blocking — proses ini membuka browser sendiri
  dan keluar setelah user approve; nxcloud cukup men-trigger, tidak
  perlu menunggu hasilnya secara sinkron).
- **`src/api/router.js`**: endpoint baru `GET /api/auth/status` (loopback-only,
  baca-saja: `{loggedIn: boolean, certPath: string}`) dan
  `POST /api/auth/login` (loopback-only, trigger `cloudflared login`,
  balas `202 accepted` segera — tidak menunggu OAuth selesai).
- **`src/index.js`**: kalau `enableTunnel` tapi `!isCloudflareLoggedIn()`,
  jangan panggil `startTunnel()` yang akan gagal berantakan — log pesan
  jelas ("Cloudflare belum terhubung. Jalankan `cloudflared login` atau
  buka Desktop → Domain → Hubungkan Akun.") dan lanjut jalan **lokal saja**
  (`tunnelResult = {skipped: true, reason: 'not-logged-in'}`), bukan error
  keras yang menghentikan seluruh proses.

### Desktop UI

- **Halaman baru atau bagian di `domain.js`**: banner/kartu di paling atas
  kalau `!loggedIn` — "Akun Cloudflare belum terhubung" + tombol
  **Hubungkan Akun Cloudflare** yang memanggil `POST /api/auth/login`
  (browser terbuka otomatis untuk OAuth) + instruksi "setelah login di
  browser, klik Refresh di sini".
- Form "Buat Subdomain Web" di `domain.js` **dinonaktifkan** (disabled,
  dengan pesan) selama `!loggedIn` — mencegah user mencoba buat subdomain
  yang pasti gagal karena tunnel belum bisa jalan.
- `overview.js`: card Tunnel menunjukkan status khusus "Belum terhubung
  ke akun Cloudflare" (beda dari "Stopped" biasa) kalau ini penyebabnya.

---

## 5. Yang TIDAK dikerjakan (di luar cakupan/tidak mungkin)

- Tidak bisa membuat proses `cloudflared login` sepenuhnya headless/tanpa
  browser — itu keterbatasan OAuth Cloudflare, bukan pilihan desain.
- Tidak menyentuh domain/zone management (itu `Plan-domain-onboarding.md`,
  sudah selesai) — ini murni soal *login akun*, satu langkah sebelum itu.
- Tidak membuat wizard multi-langkah penuh (pilih domain, dsb) — cukup
  deteksi + tombol trigger + instruksi jelas, sesuai prinsip README
  "sederhana, sedikit dependency".

---

## 6. Keputusan yang perlu Anda ambil sebelum eksekusi

1. **Prioritas**: mau dikerjakan sekarang, atau dicatat dulu sebagai
   rencana (seperti dokumen ini) untuk nanti?
2. **Cakupan v1**: cukup deteksi + banner peringatan + link instruksi
   manual (`cloudflared login` di terminal), ATAU sekalian tombol yang
   men-trigger proses `cloudflared login` langsung dari Desktop (perlu
   `spawnDetached`, browser terbuka otomatis)?
3. **Behavior `src/index.js` saat belum login**: fallback ke lokal-saja
   (seperti rencana §4), atau tetap dianggap error/gagal start seperti
   sekarang (lebih ketat, tapi kurang ramah first-run)?

---

## 7. Status

✅ **SUDAH DIEKSEKUSI SELURUHNYA (2026-09-11)**

### Backend
- `src/cloudflare/auth.js` (baru): `getCertPath()`, `isCloudflareLoggedIn()`
  (cek `fs.existsSync`), `triggerCloudflaredLogin()` (`spawnDetached`,
  tidak menunggu OAuth selesai).
- `src/api/router.js`: `GET /api/auth/status` (loopback-only, baca),
  `POST /api/auth/login` (loopback-only, trigger).
- `src/index.js`: sebelum `startTunnel()`, kalau mode `named` DAN belum
  login → **tidak** mencoba start tunnel sama sekali (hindari error
  mentah cloudflared), langsung log pesan jelas + lanjut lokal-saja
  (`tunnelResult = {skipped:true, reason:'not-logged-in'}`). Mode `quick`
  sengaja **tidak** kena cek ini — Quick Tunnel memang tidak butuh akun
  (diverifikasi dari `cloudflare/config.js`: `--url` saja, tanpa
  referensi cert/tunnel ID).

### Desktop UI
- `client/nxcloudApi.js` + `Desktop/lib/nxcloudApi.js`
  (disinkron): `getAuthStatus()`, `triggerLogin()`.
- `domain.js`: banner merah di atas halaman kalau belum login — tombol
  **Hubungkan Akun Cloudflare** (trigger login, browser terbuka) +
  **Sudah Login, Cek Lagi** (re-check tanpa reload halaman). Form "Buat
  Subdomain Web" di-disable selama belum login. Fail-open kalau
  `/api/auth/status` sendiri gagal dipanggil (tidak memblokir halaman
  karena masalah jaringan/lainnya).
- `overview.js`: card Tunnel menunjukkan status khusus **"Akun Cloudflare
  belum terhubung"** (merah, beda dari "Stopped" abu-abu biasa) + link
  cepat ke menu Domain, alih-alih status generik yang membingungkan.

### Diverifikasi
- `node --check` semua file baru/ubah — OK.
- `GET /api/auth/status` di mesin ini (sudah login sebelumnya) →
  `{loggedIn: true, certPath: "C:\Users\...\.cloudflared\cert.pem"}` —
  cocok dengan kondisi nyata.
- Loopback guard: akses publik ke `/api/auth/status` → `403`, konsisten.
- Restart backend & Desktop penuh — tidak ada regresi (mesin ini sudah
  login, jadi behavior normal/tunnel connect tetap seperti biasa; banner
  peringatan **tidak muncul**, sesuai desain — hanya tampil kalau
  `cert.pem` benar-benar tidak ada).
- **Tidak disimulasikan dengan menghapus `cert.pem` asli** (akan memutus
  tunnel production yang sedang dipakai) — logic `isCloudflareLoggedIn()`
  sesederhana `fs.existsSync()` satu baris, dipercaya benar tanpa perlu
  simulasi destruktif; correctness lebih lanjut akan terlihat natural
  saat nxcloud dipasang di mesin baru yang belum pernah login.

### Batasan yang tetap berlaku (sesuai §2, tidak berubah)
- Proses OAuth di browser tetap manual sepenuhnya — nxcloud hanya
  men-trigger `cloudflared tunnel login`, tidak bisa otomatisasi approve.
- Deteksi "optimistic" (`cert.pem` ada ≠ pasti masih valid) — batasan
  yang diterima demi kesederhanaan, dicatat eksplisit di §3.

### Perbaikan lanjutan (2026-09-11, sesi sama — respons pertanyaan
"bagaimana alurnya di GUI" secara konkret)

Ditelusuri alur end-to-end langkah demi langkah, ditemukan 2 titik lemah:

1. **`spawnDetached()` tidak menangkap event `error`** — kalau binary
   `cloudflared` gagal dieksekusi (jarang, karena `findCloudflared()`
   sudah dicek dulu, tapi bisa terjadi karena sebab lain di OS), kegagalan
   itu hilang tanpa jejak. Diperbaiki: `child.on('error', ...)` sekarang
   log ke `logger.error` (terlihat di menu Log), di `triggerCloudflaredLogin()`.
2. **Setelah "Sudah Login, Cek Lagi" berhasil, user harus pindah menu**
   ke Ringkasan untuk klik Restart — satu langkah ekstra yang tidak perlu.
   Diperbaiki: banner di `domain.js` sekarang berubah jadi kartu hijau
   dengan tombol **Restart nxcloud** langsung di tempat begitu login
   terdeteksi berhasil — alur penuh (hubungkan → cek → restart) selesai
   tanpa pindah halaman.

**Diverifikasi:** `node --check` OK, backend di-restart penuh tanpa
regresi (tunnel tetap connect normal di mesin yang sudah login).

---

## 8. Pertanyaan lanjutan: bagaimana kasus user BENAR-BENAR BARU?

Ditelusuri ulang dengan asumsi config default murni (belum pernah
disentuh), bukan config mesin developer ini yang sudah dikustomisasi.
Ditemukan 2 hal:

### 8.1 Klarifikasi penting: default instalasi baru = mode `quick`, BUKAN `named`

`DEFAULTS` di `src/config.js` — `cloudflare.mode: 'quick'`, bukan
`'named'`. Config `nxcloud.json` di repo ini adalah hasil
kustomisasi mesin developer, BUKAN representasi instalasi baru.

**Konsekuensi:** cek login di `src/index.js` (§7, sengaja dibatasi ke
mode `named` saja) **tidak pernah terpicu** untuk instalasi default —
karena Quick Tunnel memang tidak butuh akun. User baru dengan config
default bisa langsung `nxcloud start` dan dapat URL publik
`*.trycloudflare.com` tanpa login sama sekali. Ini SESUAI DESAIN, bukan
bug — dikonfirmasi ulang dari `cloudflare/config.js` (mode quick =
`cloudflared tunnel --url <service>`, tanpa referensi cert/tunnel ID).

### 8.2 🔴 BUG DITEMUKAN & DIPERBAIKI: state orphan saat validasi domain gagal

Ditelusuri alur "user baru buka menu Domain, coba buat subdomain
pertama" — dan ditemukan **dua syarat berbeda** yang sebelumnya cuma satu
yang dicek di Desktop UI:
1. Sudah login Cloudflare? (`checkAuth()` di `domain.js` — sudah ada)
2. `cloudflare.hostname` sudah diisi (jadi ada root domain terkelola)?
   **BELUM PERNAH DICEK DI UI SAMA SEKALI.**

Root domain kosong (`getManagedRootDomain()` return `null` untuk
`cloudflare.hostname: ''`, kondisi default persis) menyebabkan
`assertHostnameIsManaged()` selalu menolak — tapi urutan pemanggilan di
`POST /api/domains/web` lama **salah**: `createWebInstance()` (tulis data
+ buat folder fisik) dipanggil SEBELUM `addDnsRoute()` (yang berisi
validasi). Akibatnya: **instance "gagal" tetap tersimpan penuh di
`web-instances.json` dan folder+`index.html` benar-benar dibuat**,
padahal response ke user adalah error dan DNS tidak pernah dibuat.
**Dibuktikan nyata** lewat tes (`POST .../web {hostname:"x.example.com"}`
→ error diterima, TAPI `GET .../web` menunjukkan instance `x` tetap ada
+ folder `x/index.html` tetap ada di disk) — dibersihkan manual setelah
ketahuan.

**Perbaikan** (`src/api/router.js`, endpoint `POST /api/domains/web`):
`assertHostnameIsManaged(body.hostname)` sekarang dipanggil **paling
awal**, sebelum `createWebInstance()` — kalau hostname tidak valid,
tidak ada apapun yang ditulis ke disk atau data. Diverifikasi ulang
dengan hostname invalid baru (`y.invalid-domain-test.com`): response
`400` (bukan lagi status keliru), instance **tidak muncul** di
`GET .../web`, folder **tidak dibuat** — bersih total.

### 8.3 — ✅ SUDAH DIEKSEKUSI (2026-09-11)

`domain.js` sekarang punya **dua flag independen** (`isLoggedIn`,
`hasRootDomain`) — form "Buat Subdomain Web" hanya aktif kalau
**keduanya** `true` (`updateFormEnabled()`, dipanggil konsisten di semua
titik yang mengubah salah satu flag, termasuk setelah submit form
gagal/berhasil — sebelumnya ada bug kecil tambahan: `finally` block
selalu set `disabled = false` tanpa peduli state, sudah diperbaiki juga).

Banner baru (`#nxcf-domain-banner`) muncul kalau `rootDomain` kosong —
warna kuning/oranye (beda dari merah untuk belum-login), isinya instruksi
konkret dua baris CLI yang bisa langsung disalin:
```
nxcloud config set cloudflare.hostname nx.namadomainanda.com
nxcloud config set cloudflare.mode named
```
plus penjelasan singkat dan arahan klik Refresh setelahnya.

**Ditemukan & diperbaiki sekalian**: halaman `domain.js` sebelumnya
**tidak punya tombol Refresh sama sekali** — padahal teks lain di halaman
(termasuk banner login) sudah menyuruh user "klik Refresh". Tombol
`#nxcf-domain-refresh` ditambahkan di bagian atas halaman, memanggil
`checkAuth()` + `loadDomains()` ulang.

**Diverifikasi:** `node --check` OK. Backend & Desktop di-restart penuh —
tidak ada regresi (mesin ini punya `cloudflare.hostname` terisi, jadi
banner domain-kosong tidak muncul, sesuai desain: hanya tampil untuk
kondisi kosong yang sesungguhnya).

---

## 9. Revisi 2026-10-07 — cert.pem tidak lagi satu-satunya jalan

`cloudflared tunnel login` terbukti rusak di akun ini (bug upstream terbuka
cloudflare/cloudflared#1252: approve tidak pernah tercatat → 10× "Waiting for
login..." → `Failed to fetch resource`). Akibatnya dua perilaku lama di §7
diubah:

- **`src/index.js` tidak lagi melewatkan start tunnel** hanya karena cert
  hilang — named tunnel cukup butuh file kredensial lokal (`.credentials/<uuid>.json`);
  cert hanya untuk perintah manajemen. Bila cert DAN token sama-sama kosong,
  cukup log warning (bukan skip).
- **Jalur kedua untuk "terhubung": API token** (`cloudflare.apiToken`) —
  dipakai `src/cloudflare/api.js` untuk membuat CNAME via REST, tanpa cert.
  `/api/auth/status` sekarang mengembalikan `tokenSet` + `ready`
  (`loggedIn || tokenSet`); `domain.js` menganggap form siap saat `ready`.

Deteksi cert (`isCloudflareLoggedIn()`, opsi A §3) tetap dipertahankan sebagai
jalur lama — tidak dihapus, hanya tidak lagi menjadi prasyarat tunggal.
Rincian implementasi & verifikasi: lihat `README.md` bagian
"Rencana: Tunnel jalan tanpa cert.pem + DNS via API token".
