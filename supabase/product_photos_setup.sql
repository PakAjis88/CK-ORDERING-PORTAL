-- ============================================================================
-- Product photos — operator upload/delete
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Adds:
--   - a public "product-photos" storage bucket (images only, 5MB cap)
--   - storage RLS: anyone can read, only operators/admins can write/delete
--   - set_product_photo() RPC: the only way photo_url gets written,
--     consistent with every other mutation in this app (operator-only,
--     checked server-side, not just in the UI)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product photos public read" on storage.objects;
create policy "product photos public read" on storage.objects for select
  using (bucket_id = 'product-photos');

drop policy if exists "product photos operator insert" on storage.objects;
create policy "product photos operator insert" on storage.objects for insert
  with check (bucket_id = 'product-photos' and public.is_operator());

drop policy if exists "product photos operator update" on storage.objects;
create policy "product photos operator update" on storage.objects for update
  using (bucket_id = 'product-photos' and public.is_operator());

drop policy if exists "product photos operator delete" on storage.objects;
create policy "product photos operator delete" on storage.objects for delete
  using (bucket_id = 'product-photos' and public.is_operator());

create or replace function set_product_photo(p_product_id uuid, p_photo_url text)
returns products
language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
begin
  if not is_operator() then
    raise exception 'Operator only';
  end if;
  update products set photo_url = p_photo_url where id = p_product_id returning * into v_product;
  if not found then
    raise exception 'Product not found';
  end if;
  return v_product;
end;
$$;

grant execute on function set_product_photo(uuid, text) to authenticated;
