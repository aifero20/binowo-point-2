# AMD — AI MODEL DIRECTIVE
# Binowo Kasir Project

Baca file ini sebelum melakukan apapun di project ini.

---

## IDENTITAS PROJECT
- Nama: Binowo Kasir (PWA Kasir Grosir Rokok)
- Repo: https://github.com/aifero20/binowo-point-2
- Live: https://binowo-point-2.prim3.workers.dev
- Supabase URL: https://bapgptjffhufykvoxtnq.supabase.co

---

## CATATAN TERBARU (2026-05-30)
- Environment pindah dari GitHub Codespaces ke LOCAL (Windows + Google Antigravity IDE)
- Python3 TIDAK tersedia di environment lokal — JANGAN gunakan python3
- PowerShell TIDAK support heredoc << 'EOF' — JANGAN gunakan sintaks itu
- Gunakan PowerShell $lines = Get-Content / Set-Content untuk edit file
- Gunakan node script .cjs untuk manipulasi file kompleks jika diperlukan
- Google Sheets sync via Supabase Edge Function sync-sheets. Tombol ada di halaman Laporan.
- Secrets: GOOGLE_SERVICE_ACCOUNT + SPREADSHEET_ID=1Hiqb0qfZBcC8vYK2CU3vqIyHN2uvDZIUG1VLkyZTx9s

---

## ATURAN WAJIB AI

1. ENVIRONMENT LOKAL WINDOWS — bukan Codespaces/Linux
2. JANGAN gunakan python3 — tidak tersedia
3. JANGAN gunakan heredoc << 'EOF' — tidak support di PowerShell
4. Untuk edit file gunakan PowerShell $lines array (lihat CARA EDIT FILE)
5. Build check WAJIB sebelum commit
6. JANGAN gunakan && untuk chain command di PowerShell — jalankan satu per satu
7. JANGAN gunakan bun — pakai npm
8. JANGAN edit routeTree.gen.ts manual — file ini auto-generate
9. SQL HANYA dijalankan di Supabase SQL Editor, bukan terminal
10. Minta user paste output error sebelum menulis solusi
11. Gunakan Bahasa Indonesia untuk label UI, pesan toast, dan placeholder
12. Setiap memberikan kode perubahan, SELALU sertakan kode build dan push
13. Baca isi file terlebih dahulu sebelum mengedit — jangan menebak konten file
14. Berikan perintah satu per satu, tunggu konfirmasi output dari user

---

## STACK TEKNIS

- Frontend: TanStack Start + Vite + React 19 + TypeScript
- UI: shadcn/ui + TailwindCSS
- Routing: TanStack Router (file-based, auto-generate)
- Server State: TanStack Query
- Backend: Supabase (PostgreSQL + Auth + RLS)
- Deploy: Cloudflare Workers (auto via GitHub push)
- Package Manager: npm
- Environment: LOCAL Windows + Google Antigravity IDE (berbasis VS Code)
- Node.js: v24.x (terinstall lokal)
- Git: v2.54.0 (terinstall lokal)

---

## STRUKTUR FOLDER PENTING

src/routes/_authenticated/ berisi semua halaman protected:
  dashboard.tsx     <- dashboard + alert stok
  sales.tsx         <- POS kasir (keranjang, checkout, struk)
  purchases.tsx     <- pembelian + edit + delete
  returns.tsx       <- retur pembelian & penjualan
  debts.tsx         <- hutang supplier
  customers.tsx     <- master customer
  suppliers.tsx     <- master supplier
  products.tsx      <- master barang (tab: master, harga, movement, transfer)
  warehouses.tsx    <- master gudang
  shifts.tsx        <- shift kasir
  transfers.tsx     <- transfer stok antar gudang
  adjustments.tsx   <- stock adjustment
  reports.tsx       <- laporan + export CSV + sync Google Sheets
  users.tsx         <- manajemen user
  price-history.tsx <- riwayat harga
  permissions.tsx   <- permission matrix per role
  master-inventory.tsx <- master inventory lengkap

src/components/app-shell.tsx  <- sidebar + layout utama
src/integrations/supabase/client.ts  <- supabase client
src/hooks/use-auth.tsx  <- auth hook
src/lib/format.ts  <- formatRp() dll

---

## CARA BACA FILE (PowerShell)

# Baca seluruh file
$lines = Get-Content "src/routes/_authenticated/namafile.tsx"

# Lihat baris tertentu (0-indexed)
$lines[0..20]

# Cari pattern
Select-String -Path "src/routes/_authenticated/namafile.tsx" -Pattern "keyword" | Select-Object LineNumber, Line

# Lihat baris ke-N sampai M (skip N baris, ambil M baris)
Select-String -Path "src/routes/_authenticated/namafile.tsx" -Pattern "." | Select-Object -Skip 100 -First 30

---

## CARA EDIT FILE (PowerShell)

# Edit baris tertentu (0-indexed, baris 5 = index 4)
$lines = Get-Content "src/routes/_authenticated/namafile.tsx"
$lines[4] = 'konten baru baris 5'
$lines | Set-Content "src/routes/_authenticated/namafile.tsx" -Encoding utf8
Write-Host "Done"

# Insert baris baru setelah baris N
$lines = Get-Content "src/routes/_authenticated/namafile.tsx"
$insert = @('baris baru 1', 'baris baru 2')
$newLines = $lines[0..N] + $insert + $lines[(N+1)..($lines.Length-1)]
$newLines | Set-Content "src/routes/_authenticated/namafile.tsx" -Encoding utf8
Write-Host "Done - total lines: $($newLines.Length)"

---

## CARA BUAT FILE BARU (PowerShell)

$content = @'
import { createFileRoute } from "@tanstack/react-router";
// ... isi file
'@
$content | Out-File -FilePath "src/routes/_authenticated/namafile.tsx" -Encoding utf8 -NoNewline
Write-Host "Done"

---

## WORKFLOW STANDAR

Build check (PowerShell):
  npm run build 2>&1 | Select-String -Pattern "error|built" | Select-Object -Last 5

Commit + push (PowerShell — satu per satu):
  git add .
  git commit -m "feat: deskripsi"
  git push origin main

Trigger redeploy:
  git commit --allow-empty -m "chore: trigger redeploy"
  git push origin main

---

## SEMUA TABEL DATABASE

roles                     -> kode role (OWNER/ADMIN/SUPERVISOR/KASIR)
permissions               -> menu permissions
role_permissions          -> mapping role ke permission
users                     -> profil user
suppliers                 -> master supplier (soft delete)
customers                 -> master customer (soft delete, ada customer_type: RETAIL/GROSIR)
warehouses                -> master gudang
products                  -> master barang (soft delete, ada current_buy_price, current_retail_price, current_wholesale_price)
product_units             -> multi satuan per barang (retail_price, wholesale_price)
product_discounts         -> diskon per produk per customer_type
stock_movements           -> ledger stok (append-only, qty_in/qty_out)
purchase_headers          -> header pembelian (soft delete via deleted_at, payment_status: LUNAS/HUTANG)
purchase_details          -> detail pembelian (product_id, warehouse_id, qty, buy_price, retail_price, wholesale_price)
purchase_returns          -> header retur pembelian
purchase_return_details   -> detail retur pembelian
supplier_debts            -> hutang ke supplier (amount, paid_amount, remaining, status, due_date)
supplier_debt_payments    -> riwayat pembayaran hutang
sales_headers             -> header penjualan (transaction_status: SELESAI/VOID, hold_status)
sales_details             -> detail penjualan
cashier_shifts            -> shift kasir
stock_transfers           -> header transfer antar gudang
stock_transfer_details    -> detail transfer gudang
stock_adjustments         -> header adjustment stok
stock_adjustment_details  -> detail adjustment stok
price_history             -> riwayat perubahan harga (auto trigger)
activity_logs             -> log aktivitas user

---

## FITUR YANG SUDAH SELESAI

- [x] Phase 1 - Login, Master Data, POS, Pembelian, Stock Movement
- [x] Phase 2 - Shift Kasir, Transfer Stok, Retur Pembelian, Laporan
- [x] Phase 3 - Hold/Void Transaksi, Struk Print, Multi Metode Bayar
- [x] Phase 4 - Stock Adjustment, User Management
- [x] Phase 5 - Dashboard Alert Stok, Price History
- [x] Phase 6 - Offline Sync (IndexedDB/Dexie), Google Sheets Backup
- [x] Phase 7 - Edit & Delete Pembelian (dengan stock reversal + update hutang supplier)
- [x] Phase 8 - Struk Retur Pembelian & Penjualan
- [x] Phase 9 - Harga POS otomatis GROSIR/RETAIL sesuai tipe customer
- [x] Phase 9b - Auto-update harga keranjang saat ganti customer

---

## LOGIKA BISNIS PENTING

### Harga POS
- Customer RETAIL -> pakai current_retail_price
- Customer GROSIR -> pakai current_wholesale_price
- Umum/Walk-in -> default RETAIL
- Saat customer berubah, harga di keranjang otomatis update via useEffect

### Edit Pembelian
- Reverse stock movement lama (transaction_type: purchase_edit_reverse)
- Update purchase_headers + hapus purchase_details lama + insert baru
- Insert stock movement baru
- Update current_buy/retail/wholesale_price di products
- Update supplier_debts (amount, remaining, status, due_date) jika ada

### Delete Pembelian
- Reverse stock movement (transaction_type: purchase_delete_reverse)
- Soft delete purchase_headers (set deleted_at)

### Hutang Supplier
- Di-insert ke supplier_debts saat pembelian HUTANG
- Tabel: supplier_debts (purchase_id FK ke purchase_headers)
- Edit pembelian -> update amount + remaining + due_date di supplier_debts

---

## ENV VARS CLOUDFLARE

VITE_SUPABASE_URL = https://bapgptjffhufykvoxtnq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJ... (anon key dari Supabase)

---

## CARA MEMULAI CHAT BARU

Sampaikan ke AI:
  Fetch dan baca AMD.md dari:
  https://raw.githubusercontent.com/aifero20/binowo-point-2/main/AMD.md
  mintalah pada saya untuk memberikan isi file terlebih dahulu jika dibutuhkan
  (berikan command PowerShell untuk membuka filenya), jangan menebak-nebak.
  Setiap memberikan kode perubahan, sertakan juga kode build dan push PowerShell-nya.
