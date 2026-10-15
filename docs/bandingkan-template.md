# Bandingkan jastip vs template-svelte-convex-starter

Tanggal: 15 Okt 2026. Baseline jastip: `main` @ `e9a58a9` (akun sudah pindah ke Convex, PR #11).
Template: `rahmanef63/template-svelte-convex-starter` @ `0.6.1` (clone `/tmp/opencode/tpl-svelte`).

## Ringkas

| | jastip | template |
|---|---|---|
| Tujuan | produk nyata, satu domain (jastip) | starter umum, contoh banyak kapabilitas |
| Kode app | **satu flat folder** `src/lib/titip/` (33 file) | **feature slices** `slices/<slug>/` + route tipis |
| Routing | route tebal per halaman (`/meja`, `/titip`, …) | route tipis + satu registry (`slices/app-shell/registry.ts`) |
| Registry nav | ada: `src/lib/titip/nav.ts` ✅ | ada: registry + `types.ts` + spec |
| Contract tertulis | `AGENTS.md`, `DESIGN.md`, `docs/konteks.md`, `docs/progress.md` | `CONTRACT.md`, `AGENTS.md`, `UIUX.md`, `docs/*.md` (17 berkas, ~1.6k baris) |
| Test | `node --test` (57 tes) + playwright smoke | **vitest** (unit) + **playwright** (e2e) + convex-test |
| Lint | eslint + prettier | eslint + prettier + **boundary rule** (`eslint-boundaries.mjs`) + **convex rule** + **svelte5 guard** |
| Brand config | tersebar (token di `styles.css`, nama di layout) | **satu sumber** `src/lib/config/app.ts` + `metadata.ts` |
| Aset | manual (`scripts/brand-assets.mjs`) | `assets.config.ts` + generate/check/prompts |
| Auth | Better Auth + Convex (`@convex-dev/better-auth`) ✅ | Google OIDC + Convex (`auth.config.ts`) |
| AI | chat + **function calling** 15 tool ✅ | BYOK streaming (AI SDK) + MCP client |
| Payments/email | tidak ada | transport disabled (DOKU/Resend) |
| Versi | versi Convex deploy, tak ada di repo | `version.json` + `version.mjs --check` |
| Adapter | `@sveltejs/adapter-vercel` | vercel **dan** node |

## Yang jastip sudah lebih baik

- **Domain nyata & konsisten**: satu koridor, kalkulator yang benar-benar dipakai, bukan contoh.
- **AI lebih dalam**: function calling yang mengubah state aplikasi (15 tool) — template cuma streaming chat.
- **Navigasi bersih**: `nav.ts` sebagai satu sumber + aturan peran, sudah benar arahnya.
- **Dokumen produk**: `konteks.md` + `progress.md` jelas; template pandai soal *template*, bukan produk.
- **UI lebih matang**: arah visual "quiet instrument" (tasteskill), di-gate 0 FAIL/0 WARN. Template memakai shadcn default.
- **PWA lengkap**: manifest, SW update flow, ikon maskable, screenshot manifest.

## Yang jastip kalah / belum ada

1. **Tanpa feature slice.** 33 file dalam satu folder; `calc.ts` + `pricing.ts` + `titipan.ts` + `trips.ts` + `roles.ts` semua sejajar. Sulit tahu batas modul. Template memisahkan per kapabilitas dengan *barrel* (`$features/<slug>`).
2. **Tanpa boundary lint.** Tidak ada yang mencegah `calc.ts` mengimpor komponen Svelte. Template menegakkannya.
3. **Tanpa config terpusat.** Nama, warna, locale tersebar. Template punya `app.ts`.
4. **Test tanpa runner.** `node --test` jalan, tapi tak ada vitest/playwright test-runner, tak ada convex-test.
5. **Tanpa versi repo.** Tak ada `version.json`/`CHANGELOG.md`.
6. **Tanpa kontrak tunggal.** `AGENTS.md` jastip masih sisa "App Builder Workspace" (Grok) — bukan kontrak produk.
7. **Tanpa aset pipeline.** Ikon/screenshot dibuat ad-hoc.

## Rekomendasi (urut)

| # | Aksi | Alasan |
|---|---|---|
| 1 | Tulis `CONTRACT.md` jastip | satu peta invarian; ganti sisa `AGENTS.md` Grok |
| 2 | Pecah `src/lib/titip/` → `slices/<slug>/` (trip, titipan, akun, asisten, shell) + `$features` alias | batas modul nyata |
| 3 | Pindah brand ke `src/lib/config/app.ts` | satu sumber |
| 4 | Tambah boundary lint (adaptasi `eslint-boundaries.mjs`) | jaga pemisahan |
| 5 | Tambah `version.json` + `CHANGELOG.md` | rilis jelas |
| 6 | Pindah test ke vitest; tambah convex-test untuk fungsi Convex | cepat & dekat ke backend |
| 7 | Tambah e2e playwright (sudah ada smoke-nya, tinggal runner) | regresi UI |
| 8 | `assets:check` untuk ikon/PWA | cegah ikon beda warna (temuan review) |

**Jangan** ambil dari template: contoh dashboard/live-data/notes/settings, DOKU/Resend, MCP, Google OIDC. Itu beban tanpa nilai untuk jastip.

## Catatan penting

Template memakai **SvelteKit 2.70.3** + **Vite 8.2.2**; jastip sudah di SvelteKit ≥3 dan Vite 8.2. Selagi membranding, jangan turunkan versi. Boundary rule template bisa dipakai apa adanya (murni eslint).
