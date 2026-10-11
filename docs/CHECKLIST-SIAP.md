# Checklist — apa yang sudah / belum siap

**Update:** 2026-09-10

## Sudah siap (boleh dipakai merancang dasbor)

| Item | Lokasi |
| ---- | ------ |
| Server + CLI + named tunnel | `nxcloud/` |
| Domain `nx.tirtamoolango.id` | Cloudflare + `.credentials/` |
| REST API + `/api/routes` (Routes) | CRUD + sync `.credentials/config.yml` |
| Client JS | `listRoutes`, `createRoute`, `updateRoute`, `deleteRoute` |
| Stub Desktop Routes | baca `listRoutes()` |
| Materi endpoint untuk UI | `docs/ENDPOINTS-DASHBOARD.md` |

## Disiapkan sekarang (P2 stub) — selesai

- Menu Overview / Tunnel / Logs / Settings (stub)
- Wiring fetch ke API

## Tugas Anda (bukan coding API)

- [ ] Konsep & desain dasbor (ganti stub)
- [ ] Putuskan field form “daftar domain + path proyek” (lihat ENDPOINTS §8)

## Belum dibangun (nanti, setelah konsep)

| Item | Keterangan |
| ---- | ---------- |
| `POST /api/projects` dkk | Registrasi hostname + `path` di PC |
| Auto DNS route per proyek | `cloudflared tunnel route dns` dari API |
| Start/stop proses app per `path` | Runtime node/static/teritip |
| Auth publik | Kalau control/API sensitif dibuka ke internet |
| Windows service / auto-start | PC boot → tunnel otomatis |

## Cara cek stub cepat

```text
1. nxcloud start
2. Desktop Teritip → #package/nxcloud/overview
3. Harus muncul JSON status (bukan error fetch)
```
