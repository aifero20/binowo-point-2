# AMD — AI MODEL DIRECTIVE
# Binowo Kasir Project

Baca file ini sebelum melakukan apapun di project ini.

---

## IDENTITAS PROJECT
- Nama: Binowo Kasir (PWA Kasir Grosir Rokok)
- Repo: https://github.com/aifero20/binowo-point-2
- Live: https://496bd39f-binowo-point-2.aifero-muhammad202.workers.dev
- Supabase URL: https://bapgptjffhufykvoxtnq.supabase.co

---

## CATATAN TERBARU (2026-05-18)
Google Sheets sync via Supabase Edge Function sync-sheets. Tombol ada di halaman Laporan. Secrets: GOOGLE_SERVICE_ACCOUNT + SPREADSHEET_ID=1Hiqb0qfZBcC8vYK2CU3vqIyHN2uvDZIUG1VLkyZTx9s di Supabase Edge Function secrets.

---

## ATURAN WAJIB AI

1. SELALU gunakan python3 untuk membuat/edit file, JANGAN paste code langsung ke terminal
2. SELALU build check sebelum commit: npm run build 2>&1 | grep -E "error|built" | tail -5
3. SELALU commit + push setelah setiap perubahan berhasil
4. JANGAN gunakan bun — pakai npm
5. JANGAN edit routeTree.gen.ts manual — file ini auto-generate
6. SQL HANYA dijalankan di Supabase SQL Editor, bukan terminal
7. Berikan perintah terminal satu per satu, tunggu konfirmasi user
8. Jika ada error, minta user paste output error sebelum menulis solusi
9. Gunakan Bahasa Indonesia untuk label UI, pesan toast, dan placeholder
10. JANGAN tulis ulang step yang sudah berhasil

---

## STACK TEKNIS

- Frontend: TanStack Start + Vite + React 19 + TypeScript
- UI: shadcn/ui + TailwindCSS
- Routing: TanStack Router (file-based, auto-generate)
- Server State: TanStack Query
- Backend: Supabase (PostgreSQL + Auth + RLS)
- Deploy: Cloudflare Workers (auto via GitHub push)
- Package Manager: npm
- Environment: GitHub Codespaces

---

## STRUKTUR FOLDER PENTING

src/routes/_authenticated/ berisi semua halaman protected:
  dashboard.tsx, sales.tsx, purchases.tsx, products.tsx,
  suppliers.tsx, customers.tsx, warehouses.tsx, stock.tsx,
  shifts.tsx, transfers.tsx, returns.tsx, reports.tsx,
  adjustments.tsx, users.tsx, price-history.tsx

src/components/app-shell.tsx  <- sidebar + layout utama
src/integrations/supabase/client.ts  <- supabase client
src/hooks/use-auth.tsx  <- auth hook
src/lib/format.ts  <- formatRp() dll

---

## CARA BUAT FILE BARU

python3 - << 'EOF'
content = '...isi file TSX...'
with open('src/routes/_authenticated/namafile.tsx', 'w') as f:
    f.write(content)
print('OK')
EOF

---

## CARA EDIT FILE

python3 - << 'EOF'
with open('src/components/app-shell.tsx', 'r') as f:
    content = f.read()
content = content.replace('TEKS_LAMA', 'TEKS_BARU')
with open('src/components/app-shell.tsx', 'w') as f:
    f.write(content)
print('OK')
EOF

---

## WORKFLOW STANDAR

Build check:
  npm run build 2>&1 | grep -E "error|built" | tail -5

Commit + push:
  git add . && git commit -m "feat: deskripsi" && git push origin main

Trigger redeploy:
  git commit --allow-empty -m "chore: trigger redeploy" && git push origin main

---

## SEMUA TABEL DATABASE

roles                     -> kode role (OWNER/ADMIN/SUPERVISOR/KASIR)
permissions               -> menu permissions
role_permissions          -> mapping role ke permission
users                     -> profil user
suppliers                 -> master supplier
customers                 -> master customer
warehouses                -> master gudang
products                  -> master barang
product_units             -> multi satuan per barang
stock_movements           -> ledger stok (append-only)
purchase_headers          -> header pembelian
purchase_details          -> detail pembelian
purchase_returns          -> header retur pembelian
purchase_return_details   -> detail retur pembelian
sales_headers             -> header penjualan
sales_details             -> detail penjualan
cashier_shifts            -> shift kasir
stock_transfers           -> header transfer antar gudang
stock_transfer_details    -> detail transfer gudang
stock_adjustments         -> header adjustment stok
stock_adjustment_details  -> detail adjustment stok
price_history             -> riwayat perubahan harga (auto trigger)
activity_logs             -> log aktivitas user

---

## ENV VARS CLOUDFLARE

VITE_SUPABASE_URL = https://bapgptjffhufykvoxtnq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJ... (anon key dari Supabase)

---

## STATUS PHASE DEVELOPMENT

- [x] Phase 1 - Login, Master Data, POS, Pembelian, Stock Movement
- [x] Phase 2 - Shift Kasir, Transfer Stok, Retur Pembelian, Laporan
- [x] Phase 3 - Hold/Void Transaksi, Struk Print, Multi Metode Bayar
- [x] Phase 4 - Stock Adjustment, User Management
- [x] Phase 5 - Dashboard Alert Stok, Price History
- [x] Phase 6 - Offline Sync (IndexedDB/Dexie), Google Sheets Backup

---

## CARA MEMULAI CHAT BARU

Sampaikan ke AI:
  Fetch dan baca AMD.md dari:
  https://raw.githubusercontent.com/aifero20/binowo-point-2/main/AMD.md
  lalu lanjutkan development Binowo Kasir dari phase X.

---

## UPDATE AMD.md

Gunakan script update-amd.py:
  python3 update-amd.py phase 6 done
  python3 update-amd.py table "nama_table -> deskripsi"
  python3 update-amd.py note "catatan penting"
  python3 update-amd.py url "https://url-baru"
  git add AMD.md && git commit -m "docs: update AMD" && git push origin main
