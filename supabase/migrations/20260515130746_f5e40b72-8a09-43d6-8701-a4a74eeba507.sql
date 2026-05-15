
-- ========== ENUM untuk roles ==========
create type public.app_role as enum ('owner', 'admin', 'supervisor', 'kasir');

-- ========== profiles ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_code varchar(20) unique not null,
  full_name varchar(100) not null,
  email varchar(100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.profiles enable row level security;

-- ========== user_roles ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- ========== has_role security definer ==========
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = any(_roles)
  )
$$;

-- ========== updated_at helper ==========
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========== auto-create profile + default role on signup ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code varchar(20);
  v_first_user boolean;
begin
  v_code := 'U' || to_char(now(), 'YYMMDDHH24MISS') || substr(new.id::text, 1, 4);
  insert into public.profiles (id, user_code, full_name, email)
  values (
    new.id,
    v_code,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );

  select count(*) = 0 into v_first_user from public.user_roles;
  if v_first_user then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'kasir');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== RLS policies: profiles ==========
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ========== RLS policies: user_roles ==========
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

create policy "user_roles_admin_manage" on public.user_roles
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- ========== suppliers ==========
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code varchar(20) unique not null,
  supplier_name varchar(200) not null,
  address text,
  city varchar(100),
  phone varchar(50),
  fax varchar(50),
  email varchar(100),
  supplier_type varchar(20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.suppliers enable row level security;
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create policy "suppliers_select_auth" on public.suppliers
  for select to authenticated using (true);
create policy "suppliers_write_admin" on public.suppliers
  for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "suppliers_update_admin" on public.suppliers
  for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "suppliers_delete_admin" on public.suppliers
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- ========== customers ==========
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code varchar(20) unique not null,
  customer_name varchar(200) not null,
  address text,
  city varchar(100),
  phone varchar(50),
  email varchar(100),
  customer_type varchar(20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.customers enable row level security;
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create policy "customers_select_auth" on public.customers
  for select to authenticated using (true);
create policy "customers_write_admin" on public.customers
  for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor','kasir']::public.app_role[]));
create policy "customers_update_admin" on public.customers
  for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "customers_delete_admin" on public.customers
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- ========== warehouses ==========
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  warehouse_code varchar(20) unique not null,
  warehouse_name varchar(100) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.warehouses enable row level security;
create trigger warehouses_updated_at before update on public.warehouses
  for each row execute function public.set_updated_at();

create policy "warehouses_select_auth" on public.warehouses
  for select to authenticated using (true);
create policy "warehouses_write_admin" on public.warehouses
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));

-- ========== products ==========
create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code varchar(50) unique not null,
  barcode varchar(100),
  product_name varchar(200) not null,
  group_code varchar(50),
  supplier_id uuid references public.suppliers(id),
  default_unit varchar(20) not null default 'PCS',
  current_buy_price numeric(18,2) not null default 0,
  current_retail_price numeric(18,2) not null default 0,
  current_wholesale_price numeric(18,2) not null default 0,
  minimum_stock numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_products_barcode on public.products(barcode);
create index idx_products_name on public.products(product_name);
alter table public.products enable row level security;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create policy "products_select_auth" on public.products
  for select to authenticated using (true);
create policy "products_write_admin" on public.products
  for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "products_update_admin" on public.products
  for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "products_delete_admin" on public.products
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- ========== product_units ==========
create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_name varchar(20) not null,
  conversion_qty numeric(18,2) not null default 1,
  retail_price numeric(18,2) not null default 0,
  wholesale_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, unit_name)
);
alter table public.product_units enable row level security;

create policy "product_units_select_auth" on public.product_units
  for select to authenticated using (true);
create policy "product_units_write_admin" on public.product_units
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));

-- ========== stock_movements ==========
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date timestamptz not null default now(),
  transaction_type varchar(50) not null,
  reference_number varchar(100),
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  qty_in numeric(18,2) not null default 0,
  qty_out numeric(18,2) not null default 0,
  balance_after numeric(18,2),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_sm_product_warehouse on public.stock_movements(product_id, warehouse_id, movement_date desc);
alter table public.stock_movements enable row level security;

create policy "sm_select_auth" on public.stock_movements
  for select to authenticated using (true);
create policy "sm_insert_auth" on public.stock_movements
  for insert to authenticated
  with check (auth.uid() is not null);
create policy "sm_delete_admin" on public.stock_movements
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- View untuk balance stok per produk per gudang
create or replace view public.v_stock_balance as
select
  product_id,
  warehouse_id,
  sum(qty_in - qty_out) as balance
from public.stock_movements
group by product_id, warehouse_id;

-- ========== purchase_headers ==========
create table public.purchase_headers (
  id uuid primary key default gen_random_uuid(),
  purchase_number varchar(50) unique not null,
  invoice_number varchar(50),
  supplier_id uuid not null references public.suppliers(id),
  transaction_date date not null default current_date,
  discount_percent numeric(18,2) not null default 0,
  tax_percent numeric(18,2) not null default 0,
  subtotal numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  payment_status varchar(20) not null default 'unpaid',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.purchase_headers enable row level security;
create trigger ph_updated_at before update on public.purchase_headers
  for each row execute function public.set_updated_at();

create policy "ph_select_auth" on public.purchase_headers
  for select to authenticated using (true);
create policy "ph_insert_auth" on public.purchase_headers
  for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "ph_update_admin" on public.purchase_headers
  for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));
create policy "ph_delete_admin" on public.purchase_headers
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- ========== purchase_details ==========
create table public.purchase_details (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_headers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  qty numeric(18,2) not null,
  unit_name varchar(20) not null,
  buy_price numeric(18,2) not null default 0,
  retail_price numeric(18,2) not null default 0,
  wholesale_price numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0
);
alter table public.purchase_details enable row level security;
create policy "pd_select_auth" on public.purchase_details
  for select to authenticated using (true);
create policy "pd_write_admin" on public.purchase_details
  for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));

-- ========== sales_headers ==========
create table public.sales_headers (
  id uuid primary key default gen_random_uuid(),
  sales_number varchar(50) unique not null,
  transaction_date timestamptz not null default now(),
  customer_id uuid references public.customers(id),
  cashier_id uuid references auth.users(id),
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  payment_method varchar(20) not null default 'cash',
  payment_amount numeric(18,2) not null default 0,
  change_amount numeric(18,2) not null default 0,
  transaction_status varchar(20) not null default 'completed',
  hold_status boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_sh_date on public.sales_headers(transaction_date desc);
alter table public.sales_headers enable row level security;
create trigger sh_updated_at before update on public.sales_headers
  for each row execute function public.set_updated_at();

create policy "sh_select_auth" on public.sales_headers
  for select to authenticated using (true);
create policy "sh_insert_auth" on public.sales_headers
  for insert to authenticated
  with check (auth.uid() is not null);
create policy "sh_update_owner_or_admin" on public.sales_headers
  for update to authenticated
  using (cashier_id = auth.uid() or public.has_any_role(auth.uid(), array['admin','owner','supervisor']::public.app_role[]));
create policy "sh_delete_admin" on public.sales_headers
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','owner']::public.app_role[]));

-- ========== sales_details ==========
create table public.sales_details (
  id uuid primary key default gen_random_uuid(),
  sales_id uuid not null references public.sales_headers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  qty numeric(18,2) not null,
  unit_name varchar(20) not null,
  selling_price numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0
);
alter table public.sales_details enable row level security;
create policy "sd_select_auth" on public.sales_details
  for select to authenticated using (true);
create policy "sd_write_auth" on public.sales_details
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
