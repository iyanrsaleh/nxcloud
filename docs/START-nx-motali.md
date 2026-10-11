# Mulai di sini — `nx.motali.online`

Ikuti urutan ini. Langkah 1–4 Anda kerjakan di browser; langkah 5 di PC ini.

---

## Langkah 1 — Akun Cloudflare

1. Buka https://dash.cloudflare.com dan login (atau daftar).
2. Klik **Add a domain** / **Add site**.
3. Masukkan: `motali.online`
4. Pilih paket **Free** → Continue.
5. Cloudflare akan menampilkan **2 nameserver** (contoh: `xxx.ns.cloudflare.com`).
6. **Salin** kedua nameserver itu.

---

## Langkah 2 — Ubah nameserver domain

Di tempat DNS `motali.online` dikelola sekarang (seringnya **registrar** atau **CyberPanel DNS**):

1. Cari pengaturan **Nameservers**.
2. Ganti ke 2 nameserver dari Cloudflare (hapus NS lama).
3. Simpan.
4. Kembali ke Cloudflare → tunggu status domain menjadi **Active**  
   (bisa beberapa menit sampai 24 jam).

> Root `motali.online` masih bisa mengarah ke CyberPanel lewat record A lama, selama Anda belum menghapusnya. Yang kita pakai nanti hanya subdomain `nx`.

---

## Langkah 3 — Buat Tunnel

Setelah domain **Active**:

1. Di Cloudflare: **Zero Trust** → **Networks** → **Tunnels**  
   (atau cari “Tunnels” di dashboard).
2. **Create a tunnel** → tipe **Cloudflared**.
3. Nama tunnel: `nxcloud` → Save.
4. Pilih OS **Windows** → unduh/install connector **atau** pakai binary yang sudah ada di proyek (`.tools/cloudflared.exe`).
5. Cloudflare akan menampilkan perintah / token. Cara yang lebih rapi untuk nxcloud:

### Opsi yang disarankan (credentials file)

Di PowerShell, dari folder proyek:

```powershell
cd D:\Framework\CLI\nxcloud
.\.tools\cloudflared.exe tunnel login
```

Browser terbuka → pilih zona `motali.online` → Authorize.

Lanjut:

```powershell
.\.tools\cloudflared.exe tunnel create nxcloud
```

Ini membuat file credentials JSON (biasanya di `%USERPROFILE%\.cloudflared\<TUNNEL-ID>.json`).

Salin file itu ke:

```text
D:\Framework\CLI\nxcloud\.credentials\<TUNNEL-ID>.json
```

Catat **Tunnel ID** (nama file tanpa `.json`).

---

## Langkah 4 — Public hostname `nx.motali.online`

**A. File config** — salin contoh lalu edit:

```powershell
copy .credentials\config.yml.example .credentials\config.yml
```

Isi `tunnel:` dan `credentials-file:` dengan Tunnel ID / path yang benar.  
Hostname sudah diset: `nx.motali.online` → `http://127.0.0.1:8787`.

**B. DNS di Cloudflare** (pilih satu):

- Di halaman tunnel → **Public Hostname** → Add:
  - Subdomain: `nx`
  - Domain: `motali.online`
  - Service: `http://127.0.0.1:8787`
- Atau buat CNAME manual: `nx` → `<TUNNEL-ID>.cfargotunnel.com` (Proxied).

---

## Langkah 5 — nxcloud mode named

Setelah file `.credentials/` siap, jalankan (atau minta agent menyesuaikan config):

```powershell
node bin/nxcloud.js config set cloudflare.mode named
node bin/nxcloud.js config set cloudflare.hostname nx.motali.online
node bin/nxcloud.js config set cloudflare.tunnelName nxcloud
node bin/nxcloud.js start
```

Uji di browser:

```text
https://nx.motali.online/health
```

Harus muncul: `{"status":"ok","service":"nxcloud"}`.

---

## CyberPanel

Untuk subdomain `nx` **tidak perlu** buat website di CyberPanel.  
Jangan buat vhost `nx.motali.online` di CyberPanel — DNS-nya lewat Cloudflare Tunnel.

Root `motali.online` di CyberPanel boleh tetap seperti sekarang.

---

## Di mana Anda sekarang?

Kerjakan **Langkah 1** dulu (add `motali.online` ke Cloudflare).  
Kalau sudah dapat nameserver / domain sudah Active, balas di chat: **“domain active”** atau kirim statusnya — nanti kita lanjut tunnel + config di PC.
