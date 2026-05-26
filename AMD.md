# AMD — AI MODEL DIRECTIVE
# Binowo Kasir Project

Baca file ini sebelum melakukan apapun di project ini.

---

## IDENTITAS PROJECT
- Nama: Binowo Kasir (PWA Kasir Grosir Rokok)
- Repo: https://github.com/aifero20/binowo-point-2
- Live: https://496bd39f-binowo-point-2.aifero-muhammad202.workers.dev
- Supabase URL: https://bapgptjffhufykvoxtnq.supabase.co
- Supabase Edge Function Base URL: https://bapgptjffhufykvoxtnq.supabase.co/functions/v1/

---

## CATATAN TERBARU (2026-05-26)
- Git LFS aktif di repo. SELALU jalankan `git config lfs.locksverified false` sebelum push.
- Command push standar: `git config lfs.locksverified false && git push origin main`
- Google Sheets sync via Edge Function `sync-sheets`. Tombol ada di halaman Laporan. Secrets: GOOGLE_SERVICE_ACCOUNT + SPREADSHEET_ID=1Hiqb0qfZBcC8vYK2CU3vqIyHN2uvDZIUG1VLkyZTx9s
- User management pakai Edge Function `manage-user` untuk create/update akun Auth Supabase.
- Soft delete user pakai `deleted_at`, bukan hapus permanen. Restore: `UPDATE public.users SET deleted_at = NULL, is_active = true WHERE email = '...'`
- RLS aktif di tabel `permissions`, `role_permissions`, `users`. Jika sidebar kosong atau query frontend return kosong tanpa error, curiga RLS policy belum ada.
- Tombol hapus user sudah diganti jadi toggle aktif/nonaktif dengan konfirmasi input email.

---

## ATURAN WAJIB AI

1. SELALU gunakan python3 untuk membuat/edit file, JANGAN paste code langsung ke terminal
2. SELALU build check sebelum commit: `npm run build 2>&1 | grep -E "error|built" | tail -5`
3. Command push wajib: `git add . && git commit -m "..." && git config lfs.locksverified false && git push origin main`
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
- Server State: TanStack Query (@tanstack/react-query)
- Backend: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- Deploy: Cloudflare Workers (auto via GitHub push ke main)
- Package Manager: npm
- Environment: GitHub Codespaces
- Offline: Dexie.js (IndexedDB) — cache produk + antrian penjualan offline

---

## STRUKTUR FOLDER PENTING

src/
  components/
    app-shell.tsx          <- sidebar + layout utama + filter menu by permission
    offline-indicator.tsx  <- indikator status online/offline
  features/auth/LoginPage.tsx
  hooks/
    use-auth.tsx           <- AuthProvider, useAuth(), fetchRoles dari tabel users
    use-mobile.tsx
    use-offline.ts
  integrations/supabase/
    client.ts              <- supabase client (browser)
    client.server.ts       <- supabase client (server)
    types.ts
  lib/
    db.ts                  <- Dexie schema: offlineSales, offlineProducts
    offline-sync.ts        <- cacheProducts(), syncPendingSales(), saveOfflineSale(), isOnline()
    format.ts              <- formatRp()
    utils.ts
  routes/
    __root.tsx
    _authenticated.tsx     <- guard: redirect ke /login jika tidak ada session
    _authenticated/        <- semua halaman protected
    index.tsx
    login.tsx
    register.tsx
  stores/
    authStore.ts
    posStore.ts            <- state POS (cart, shift, dll)
  types/index.ts           <- User, Product, ProductUnit, Supplier, Customer, SaleItem, StockMovement
  routeTree.gen.ts         <- AUTO-GENERATE, jangan edit manual

---

## DAFTAR HALAMAN

Route                  | File                    | Menu Label          | menu_code
-----------------------|-------------------------|---------------------|------------------
/dashboard             | dashboard.tsx           | Dashboard           | DASHBOARD
/shifts                | shifts.tsx              | Shift Kasir         | SHIFT_KASIR
/sales                 | sales.tsx               | Penjualan (POS)     | PENJUALAN
/customers             | customers.tsx           | Customer            | CUSTOMER
/returns               | returns.tsx             | Retur               | RETUR
/purchases             | purchases.tsx           | Pembelian           | PEMBELIAN
/suppliers             | suppliers.tsx           | Supplier            | SUPPLIER
/debts                 | debts.tsx               | Hutang Supplier     | HUTANG_SUPPLIER
/master-inventory      | master-inventory.tsx    | Master Barang       | MASTER_BARANG
/warehouses            | warehouses.tsx          | Gudang              | GUDANG
/reports               | reports.tsx             | Laporan             | LAPORAN
/users                 | users.tsx               | Manajemen User      | MANAJEMEN_USER
/activity-logs         | activity-logs.tsx       | Activity Log        | ACTIVITY_LOG
/permissions           | permissions.tsx         | Permission Matrix   | PERMISSION_MATRIX
/stock                 | stock.tsx               | (legacy)            | -
/products              | products.tsx            | (legacy)            | -
/price-history         | price-history.tsx       | Riwayat Harga       | -
/adjustments           | adjustments.tsx         | Adjustment Stok     | -
/transfers             | transfers.tsx           | Transfer Stok       | -

---

## SISTEM PERMISSION (RBAC)

Roles: OWNER, ADMIN, SUPERVISOR, KASIR

Cara kerja:
1. Login -> use-auth.tsx fetch role_code dari tabel users
2. app-shell.tsx query role_permissions -> permissions untuk dapat list menu_code yang boleh diakses
3. Sidebar otomatis filter menu sesuai role
4. OWNER: selalu bisa akses semua menu (hardcoded true di permissions.tsx)
5. ADMIN: selalu bisa akses PERMISSION_MATRIX (hardcoded)
6. Halaman /permissions hanya bisa diakses OWNER & ADMIN (guard di komponen)

Tabel kunci:
- permissions: daftar menu (id, menu_code, menu_name)
- role_permissions: mapping (role_code, permission_id, is_active)

MENU_ORDER di permissions.tsx:
DASHBOARD, SHIFT_KASIR, PENJUALAN, CUSTOMER, RETUR, PEMBELIAN, SUPPLIER,
HUTANG_SUPPLIER, MASTER_BARANG, GUDANG, LAPORAN, MANAJEMEN_USER, ACTIVITY_LOG, PERMISSION_MATRIX

---

## SISTEM AUTH

- Provider: Supabase Auth
- Hook: useAuth() dari src/hooks/use-auth.tsx
- Returns: { user, session, roles, loading, hasRole, hasAnyRole, signOut }
- roles adalah array AppRole: ["owner"|"admin"|"supervisor"|"kasir"] (lowercase)
- Jika is_active = false di tabel users -> auto signOut
- Activity log otomatis saat LOGIN dan LOGOUT via onAuthStateChange
- Guard route: _authenticated.tsx cek session, redirect ke /login jika tidak ada

Edge Function manage-user:
- Endpoint: POST /functions/v1/manage-user
- Action "create": buat akun Auth + insert ke tabel users
- Action "update": update akun Auth + update tabel users
- Wajib kirim Authorization: Bearer {access_token} dari session aktif

---

## SISTEM OFFLINE (Dexie / IndexedDB)

Database lokal: binowo-db (Dexie v1)
- offlineSales: ++id, localId, synced, createdAt
- offlineProducts: id, product_code, barcode, cachedAt

Fungsi utama (src/lib/offline-sync.ts):
- cacheProducts(): fetch max 2000 produk aktif ke IndexedDB
- syncPendingSales(): kirim pending sales ke Supabase (sales_headers + sales_details + stock_movements)
- saveOfflineSale(payload): simpan transaksi ke antrian offline, return localId "OFL{timestamp}"
- isOnline(): cek navigator.onLine

---

## HALAMAN MASTER-INVENTORY (Tab System)

File master-inventory.tsx adalah halaman terpadu dengan 5 tab:
1. Master Barang  - CRUD produk, query dari VIEW product_stock_summary
2. Riwayat Harga  - read-only dari tabel price_history
3. Movement Stok  - read-only dari stock_movements join products + warehouses
4. Adjustment Stok - form + list, insert ke stock_adjustments + stock_adjustment_details + stock_movements
5. Transfer Stok  - form transfer antar gudang, insert ke stock_transfers + stock_transfer_details + stock_movements (2 rows: transfer_out + transfer_in)

Realtime subscription aktif untuk: stock_movements, sales_headers, purchase_headers
Adjustment: qty_system diisi otomatis dari current_stock saat barang dipilih

---

## HALAMAN DEBTS (Hutang Supplier)

- Query dari tabel supplier_debts join suppliers + purchase_headers
- Summary card: total hutang tersisa + jumlah jatuh tempo
- Bayar hutang: insert ke supplier_debt_payments, update supplier_debts (paid_amount, remaining, status)
- Status: LUNAS, BELUM_LUNAS, JATUH_TEMPO
- Metode bayar: TUNAI, TRANSFER, CEK

---

## HALAMAN LAPORAN

- Filter by tanggal (dateFrom, dateTo)
- Summary: total penjualan, jumlah transaksi, rata-rata transaksi
- Grafik harian: BarChart (recharts)
- Top 10 barang terlaris
- Tombol sync Google Sheets: POST ke Edge Function sync-sheets dengan { type: "all" }

---

## HALAMAN USERS (Manajemen User)

- Query: supabase.from("users").select("*").is("deleted_at", null)
- Tombol hapus SUDAH DIHAPUS, diganti toggle aktif/nonaktif (ikon PowerOff / Power)
- Nonaktifkan user: dialog konfirmasi dengan input email (harus cocok persis)
- Aktifkan user: langsung tanpa konfirmasi
- Soft delete: deleted_at terisi = tidak muncul di list UI
- Restore user via SQL: UPDATE public.users SET deleted_at = NULL, is_active = true WHERE email = '...'
- Create/update user via Edge Function manage-user

---

## SEMUA TABEL DATABASE

-- Auth & User
roles                     -> kode role (OWNER/ADMIN/SUPERVISOR/KASIR)
permissions               -> daftar menu (id, menu_code, menu_name)
role_permissions          -> mapping role ke permission (role_code, permission_id, is_active)
users                     -> profil user (id=auth.uid, user_code, full_name, email, role_code, is_admin, is_active, deleted_at)
activity_logs             -> log aktivitas (user_id, activity_type, table_name, description, activity_time)

-- Master Data
suppliers                 -> (supplier_code, supplier_name, address, city, phone, supplier_type, is_active, deleted_at)
customers                 -> (customer_code, customer_name, address, city, phone, customer_type, is_active)
warehouses                -> (warehouse_code, warehouse_name, is_active)
products                  -> (product_code, product_name, barcode, default_unit, current_buy_price, current_retail_price, current_wholesale_price, minimum_stock, supplier_id, is_active, deleted_at)
product_units             -> multi satuan per barang (product_id, unit_name, conversion_qty, retail_price, wholesale_price)

-- Inventory
stock_movements           -> ledger stok append-only (product_id, warehouse_id, transaction_type, reference_number, qty_in, qty_out, balance_after, movement_date, created_by)
price_history             -> riwayat harga via trigger otomatis (product_id, change_date, old/new buy/retail/wholesale price)
product_stock_summary     -> VIEW: stok aktual per produk (dipakai di master-inventory tab Master Barang)

-- Penjualan
sales_headers             -> (sales_number, transaction_date, grand_total, payment_method, transaction_status, cashier_id, deleted_at)
sales_details             -> (sales_id, product_id, qty, unit_name, selling_price, discount, total)
cashier_shifts            -> (shift_date, opened_at, closed_at, opening_balance, closing_balance, status)

-- Pembelian
purchase_headers          -> (purchase_number, purchase_date, supplier_id, grand_total, status)
purchase_details          -> (purchase_id, product_id, qty, unit_name, buy_price, total)
purchase_returns          -> header retur pembelian
purchase_return_details   -> detail retur pembelian

-- Hutang
supplier_debts            -> (debt_date, due_date, amount, paid_amount, remaining, status, supplier_id, purchase_id)
supplier_debt_payments    -> riwayat bayar hutang (debt_id, amount, payment_method, notes, created_by)

-- Stok
stock_transfers           -> (transfer_number, from_warehouse_id, to_warehouse_id, status, notes, created_by)
stock_transfer_details    -> (transfer_id, product_id, qty, unit_name)
stock_adjustments         -> (adjustment_number, adjustment_date, warehouse_id, notes, created_by)
stock_adjustment_details  -> (adjustment_id, product_id, qty_system, qty_actual, qty_difference)

---

## SUPABASE — KONFIGURASI & TROUBLESHOOTING

### Cek RLS aktif/tidak:
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

### Cek policy yang ada:
SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';

### Policy minimal yang harus ada:
-- users
CREATE POLICY "authenticated_all" ON public.users FOR ALL TO authenticated USING (auth.role() = 'authenticated'::text);

-- permissions
CREATE POLICY "authenticated can read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- role_permissions
CREATE POLICY "authenticated can read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert role_permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update role_permissions" ON public.role_permissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can delete role_permissions" ON public.role_permissions FOR DELETE TO authenticated USING (true);

### Reset password user via SQL:
UPDATE auth.users SET encrypted_password = crypt('password_baru', gen_salt('bf')) WHERE email = 'email@domain.com';

### Restore user soft-deleted:
UPDATE public.users SET deleted_at = NULL, is_active = true WHERE email = 'email@domain.com';

### Ubah role user:
UPDATE public.users SET role_code = 'OWNER' WHERE email = 'email@domain.com';

### Edge Functions yang aktif:
- manage-user: create/update user Auth + tabel users
- sync-sheets: sync data ke Google Sheets (Secrets: GOOGLE_SERVICE_ACCOUNT, SPREADSHEET_ID)

### Trigger otomatis:
- price_history diisi otomatis via trigger saat kolom harga produk di-update

---

## CLOUDFLARE WORKERS — KONFIGURASI

- Deploy otomatis via GitHub push ke branch main
- ENV Vars (set di Cloudflare Dashboard):
  VITE_SUPABASE_URL = https://bapgptjffhufykvoxtnq.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY = eyJ... (anon key dari Supabase)

---

## CARA BUAT FILE BARU

python3 - << 'EOF'
content = '''...isi file TSX...'''
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

# Build check
npm run build 2>&1 | grep -E "error|built" | tail -5

# Commit + push (SELALU pakai ini)
git add . && git commit -m "feat: deskripsi" && git config lfs.locksverified false && git push origin main

# Trigger redeploy tanpa perubahan kode
git commit --allow-empty -m "chore: trigger redeploy" && git config lfs.locksverified false && git push origin main

---

## STATUS PHASE DEVELOPMENT

- [x] Phase 1 - Login, Master Data, POS, Pembelian, Stock Movement
- [x] Phase 2 - Shift Kasir, Transfer Stok, Retur Pembelian, Laporan
- [x] Phase 3 - Hold/Void Transaksi, Struk Print, Multi Metode Bayar
- [x] Phase 4 - Stock Adjustment, User Management
- [x] Phase 5 - Dashboard Alert Stok, Price History
- [x] Phase 6 - Offline Sync (IndexedDB/Dexie), Google Sheets Backup
- [x] Phase 7 - Hutang Supplier, Master Inventory terpadu (tab system), Permission Matrix, Activity Log
- [x] Phase 8 - Toggle aktif/nonaktif user + konfirmasi email, fix RLS policies, fix Git LFS push

---

## CARA MEMULAI CHAT BARU

Sampaikan ke AI:
  Fetch dan baca AMD.md dari:
  https://raw.githubusercontent.com/aifero20/binowo-point-2/main/AMD.md
  lalu lanjutkan development Binowo Kasir.

---

## UPDATE AMD.md

python3 update-amd.py note "catatan penting"
git add AMD.md && git commit -m "docs: update AMD" && git config lfs.locksverified false && git push origin main
