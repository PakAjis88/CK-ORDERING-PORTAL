-- ============================================================================
-- Reorder the product catalogue to match the physical/counting sequence
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Every screen that groups products by category (Laporan Stok, order form,
-- Catalogue, Production, PDFs) just takes whatever order listProducts()
-- returns within each category. This gives that a real, intentional order
-- instead of alphabetical-by-code.
-- ============================================================================

alter table products add column if not exists display_order smallint;

update products set display_order = case code
  when 'P03' then 1   -- Kuah Rojak (original) 490g
  when 'P09' then 2   -- Serbuk Asam Boi Ori V2 150G
  when 'P10' then 3   -- Serbuk Asam Boi Pedas V2 120G
  when 'P06' then 4   -- Nuttybites Roasted Cashew 40G
  when 'P05' then 5   -- Nuttybites Roasted Almond 40G
  when 'P08' then 6   -- Nuttybites Roasted Pistachio 40G
  when 'P07' then 7   -- Nuttybites Roasted Mix 60G
  when 'P13' then 8   -- Sos Asam Boi Dipping Sauce 250gn
  when 'P11' then 9   -- Serbuk Asam boi (Original) 1Kg
  when 'P01' then 10  -- Asam Boi Pedas 1Kg
  when 'P02' then 11  -- Ck Sweet Spicy 1kg
  when 'P04' then 12  -- MBG CK Kuah Rojak 10L
  when 'P12' then 13  -- Sos Asam Boi Tong 20L
  else display_order
end;
