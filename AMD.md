python3 << 'PYEOF'
content = '''# AMD — AI MODEL DIRECTIVE
# Binowo Kasir Project

Baca file ini sebelum melakukan apapun di project ini.

---

## IDENTITAS PROJECT
- Nama: Binowo Kasir (PWA Kasir Grosir Rokok)
- Repo: https://github.com/aifero20/binowo-point-2
- Live: https://496bd39f-binowo-point-2.aifero-muhammad202.workers.dev
- Supabase Project ID: bapgptjffhufykvoxtnq
- Supabase URL: https://bapgptjffhufykvoxtnq.supabase.co
- Google Spreadsheet ID: 1Hiqb0qfZBcC8vYK2CU3vqIyHN2uvDZIUG1VLkyZTx9s

---

## CATATAN TERBARU (2026-05-25)

### Google Sheets Sync (SUDAH JALAN)
- Edge Function: sync-sheets (deploy via npx supabase functions deploy)
- Trigger: Database Webhook pada INSERT ke sales_headers (otomatis)
- Manual sync: curl ke edge function dengan {"type":"sales"}
- Auth Google: pakai GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (bukan GOOGLE_SERVICE_ACCOUNT)
- Auth Supabase di edge function: pakai secret SERVICE_ROLE_KEY (legacy JWT eyJ...)
- Sheet Penjualan: kolom lengkap 16 kolom, timezone WIB, semua item per baris
- Webhook behavior: isWebhook = !!body.record, selalu overwrite sheet dari A1

### Diskon Per Produk Per Customer Type (SUDAH JALAN)
- Tabel: product_discounts (product_id, customer_type, discount_type, discount_pct)
- Customer type: RETAIL / GROSIR (kolom di tabel customers)
- UI: halaman Master Barang -> tombol "Diskon" per produk
- POS: auto-apply diskon saat produk ditambah ke cart sesuai customer type
- Re-apply otomatis saat customer diganti

### POS Kasir
- Default gudang: Gudang Utama (auto-select via useEffect)
- Hold transaksi: status HOLD, resume kembali ke tab POS
- Tab Riwayat: refetch otomatis saat tab dibuka
- Auto sync sheets setelah checkout selesai
- Diskon per item: support Per PCS dan Per Total
- Diskon header: persen dari subtotal keseluruhan

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
11. Untuk edit file panjang, gunakan line-based replacement (bukan replace string panjang)
12. Selalu cek kondisi file sebelum edit: grep -n "keyword" file | head -20

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
supabase/functions/sync-sheets/index.ts  <- edge function Google Sheets

---

## CARA BUAT FILE BARU

python3 << \'PYEOF\'
content = \'...isi file TSX...\'
with open(\'src/routes/_authenticated/namafile.tsx\', \'w\') as f:
    f.write(content)
print(\'OK\')
PYEOF

---

## CARA EDIT FILE

python3 << \'PYEOF\'
with open(\'src/components/app-shell.tsx\', \'r\') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if \'TEKS_LAMA\' in line:
        lines[i] = line.replace(\'TEKS_LAMA\', \'TEKS_BARU\')
with open(\'src/components/app-shell.tsx\', \'w\') as f:
    f.writelines(lines)
print(\'OK\')
PYEOF

---

## WORKFLOW STANDAR

Build check:
  npm run build 2>&1 | grep -E "error|built" | tail -5

Commit + push:
  git add . && git commit -m "feat: deskripsi" && git push origin main

Deploy edge function:
  npx supabase functions deploy sync-sheets --project-ref bapgptjffhufykvoxtnq

Test edge function manual:
  curl -s -X POST https://bapgptjffhufykvoxtnq.supabase.co/functions/v1/sync-sheets -H "Authorization: Bearer $(cat /tmp/anon.txt)" -H "Content-Type: application/json" -d \'{"type":"sales"}\'

Simpan anon key ke /tmp/anon.txt:
  echo \'LEGACY_ANON_KEY_eyJ...\' > /tmp/anon.txt

---

## SEMUA TABEL DATABASE

roles                     -> kode role (OWNER/ADMIN/SUPERVISOR/KASIR)
permissions               -> menu permissions
role_permissions          -> mapping role ke permission
users                     -> profil user (id sync dengan auth.users)
suppliers                 -> master supplier
customers                 -> master customer (+ customer_type: RETAIL/GROSIR)
warehouses                -> master gudang
products                  -> master barang
product_units             -> multi satuan per barang
product_discounts         -> diskon per produk per customer_type (RETAIL/GROSIR)
stock_movements           -> ledger stok (append-only)
purchase_headers          -> header pembelian
purchase_details          -> detail pembelian
purchase_returns          -> header retur pembelian
purchase_return_details   -> detail retur pembelian
sales_headers             -> header penjualan (+ transaction_date, hold_status)
sales_details             -> detail penjualan
cashier_shifts            -> shift kasir
stock_transfers           -> header transfer antar gudang
stock_transfer_details    -> detail transfer gudang
stock_adjustments         -> header adjustment stok
stock_adjustment_details  -> detail adjustment stok
price_history             -> riwayat perubahan harga (auto trigger)
activity_logs             -> log aktivitas user

---

## CATATAN DATABASE PENTING

- cashier_id di sales_headers -> referensi ke auth.users (bukan public.users)
  Untuk join nama kasir: query public.users terpisah lalu map by id
- RLS aktif di semua tabel dengan policy: auth.role() = \'authenticated\'
- Edge function harus pakai SERVICE_ROLE_KEY (legacy JWT) untuk bypass RLS
- SUPABASE_SECRET_KEYS di edge function formatnya {default: "sb_secret_..."} — TIDAK bisa bypass RLS
- product_discounts: UNIQUE(product_id, customer_type) — pakai upsert dengan onConflict

---

## SECRETS EDGE FUNCTION (sync-sheets)

Di Supabase Dashboard -> Edge Functions -> sync-sheets -> Secrets:
- GOOGLE_CLIENT_EMAIL: email service account Google
- GOOGLE_PRIVATE_KEY: private key PEM (dengan newline asli)
- SPREADSHEET_ID: 1Hiqb0qfZBcC8vYK2CU3vqIyHN2uvDZIUG1VLkyZTx9s
- SERVICE_ROLE_KEY: legacy anon/service role key (eyJ...) dari Supabase API settings

---

## ENV VARS CLOUDFLARE

VITE_SUPABASE_URL = https://bapgptjffhufykvoxtnq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJ... (anon key dari Supabase)
(Set di Cloudflare Dashboard, bukan di .env lokal)

---

## STATUS PHASE DEVELOPMENT

- [x] Phase 1 - Login, Master Data, POS, Pembelian, Stock Movement
- [x] Phase 2 - Shift Kasir, Transfer Stok, Retur Pembelian, Laporan
- [x] Phase 3 - Hold/Void Transaksi, Struk Print, Multi Metode Bayar
- [x] Phase 4 - Stock Adjustment, User Management
- [x] Phase 5 - Dashboard Alert Stok, Price History
- [x] Phase 6 - Offline Sync (IndexedDB/Dexie), Google Sheets Backup
- [x] Phase 7 - Diskon Per Produk Per Customer Type, Auto Sync Sheets

---

## FITUR YANG BELUM SELESAI / TODO

- [ ] Diskon per produk belum tersync ke Google Sheets (sheet Diskon belum ada)
- [ ] Nama kasir di sheet masih UUID 8 char (perlu join public.users)
- [ ] Customer type belum tampil di sheet Penjualan
- [ ] Fitur diskon per produk berdasarkan customer type di master barang perlu UI finalisasi

---

## CARA MEMULAI CHAT BARU

Sampaikan ke AI:
  Fetch dan baca AMD.md dari:
  https://raw.githubusercontent.com/aifero20/binowo-point-2/main/AMD.md
  lalu lanjutkan development Binowo Kasir.
'''

with open('AMD.md', 'w') as f:
    f.write(content)
print('OK')
PYEOF