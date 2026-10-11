# Mulai di sini — `nx.tirtamoolango.id`

Domain diganti dari `motali.online` → **`tirtamoolango.id`** (registrar/panel: IndoWebHoster).

---

## Keputusan

| Item | Nilai |
| ---- | ----- |
| Zone Cloudflare | `tirtamoolango.id` |
| Hostname nxcloud | `nx.tirtamoolango.id` |
| Panel ganti NS | IndoWebHoster (akun yang sudah Anda punya) |
| `motali.online` | **Tidak dipakai** untuk nxcloud (boleh biarkan / batalkan di Cloudflare) |

---

## Langkah 1 — Cloudflare: Connect domain baru

1. Di Cloudflare: **Add domain** / **Add a site** → **Connect a domain**
2. Isi: `tirtamoolango.id` (bukan motali)
3. Paket **Free** → Review DNS → **Continue to activation**
4. Salin **2 nameserver Cloudflare** yang muncul (beda per akun; jangan pakai NS motali lama)

Jika `motali.online` sudah terlanjur ditambahkan: boleh dihapus/abaikan di Cloudflare. Fokus ke `tirtamoolango.id`.

---

## Langkah 2 — Ganti nameserver di IndoWebHoster

Di panel yang screenshot Anda (Manage Services → `tirtamoolango.id`):

**Sekarang (lama):**
- `ns1.indowebhoster.com`
- `ns2.indowebhoster.com`

**Ganti jadi (dari Cloudflare, setelah Langkah 1):**
- NS1 Cloudflare (contoh bentuk: `xxxx.ns.cloudflare.com`)
- NS2 Cloudflare

1. Edit Name Server 1 & 2 → isi 2 NS Cloudflare  
2. Kosongkan NS 3 & 4 jika tidak dipakai  
3. **Save** / Simpan  
4. Matikan DNSSEC jika ada  

**Jangan** isi NS Cloudflare milik `motali.online` (`eleanor` / `stanley`) — itu untuk zone lain. Pakai NS yang Cloudflare berikan khusus untuk `tirtamoolango.id`.

---

## Langkah 3 — Tunggu Active

Di Cloudflare untuk `tirtamoolango.id` → Check nameservers / tunggu **Active**.

---

## Langkah 4 — Tunnel + nxcloud

Setelah Active:

```powershell
cd D:\Framework\CLI\nxcloud
.\.tools\cloudflared.exe tunnel login
.\.tools\cloudflared.exe tunnel create nxcloud
```

Copy credentials ke `.credentials\`, buat `config.yml` dari example (hostname `nx.tirtamoolango.id`), lalu:

```powershell
node bin/nxcloud.js config set cloudflare.mode named
node bin/nxcloud.js config set cloudflare.hostname nx.tirtamoolango.id
node bin/nxcloud.js config set cloudflare.tunnelName nxcloud
node bin/nxcloud.js start
```

Uji: `https://nx.tirtamoolango.id/health`

---

## Di mana Anda sekarang?

1. **Jangan** simpan ganti NS dulu di IndoWebHoster sampai dapat NS dari Cloudflare untuk `tirtamoolango.id`.  
2. Kerjakan **Langkah 1** di Cloudflare (Connect `tirtamoolango.id`).  
3. Kirim screenshot nameserver Cloudflare yang baru — baru kita isi di IndoWebHoster.
