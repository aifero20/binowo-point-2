
-- Fix: view harus pakai security_invoker (mengikuti RLS pemanggil)
drop view if exists public.v_stock_balance;
create view public.v_stock_balance
  with (security_invoker = on) as
select
  product_id,
  warehouse_id,
  sum(qty_in - qty_out) as balance
from public.stock_movements
group by product_id, warehouse_id;

-- Fix: set search_path untuk set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Revoke execute dari public/anon untuk fungsi SECURITY DEFINER
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.has_any_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_any_role(uuid, public.app_role[]) to authenticated;
