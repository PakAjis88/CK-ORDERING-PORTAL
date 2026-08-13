-- ============================================================================
-- CK Products Ordering Portal — catalogue seed data
-- Products: confirmed, final data from MIGRATION_BRIEF.md.
-- Outlets: the real 31 outlets (from the outlet login list), MBG001-MBG031.
-- The earlier 40-outlet placeholder list from the prototype has been
-- dropped entirely — do not reintroduce it. More outlets can be appended
-- later (continue the MBG0xx sequence) as the network grows.
-- Safe to re-run (upserts on the unique code).
-- ============================================================================

insert into products (code, name, category, unit_price, units_per_carton) values
  ('P01', 'Asam Boi Pedas 1Kg',               2, 21.81, 4),
  ('P02', 'Ck Sweet Spicy 1kg',                2, 15.21, 4),
  ('P03', 'Kuah Rojak (original) 490g',        1,  5.21, 12),
  ('P04', 'MBG CK Kuah Rojak 10L',              2, 150.01, 1),
  ('P05', 'Nuttybites Roasted Almond 40G',      1,  3.16, 30),
  ('P06', 'Nuttybites Roasted Cashew 40G',      1,  3.05, 30),
  ('P07', 'Nuttybites Roasted Mix 60G',         1,  4.35, 30),
  ('P08', 'Nuttybites Roasted Pistachio 40G',   1,  3.21, 30),
  ('P09', 'Serbuk Asam Boi Ori V2 150G',        1,  5.05, 20),
  ('P10', 'Serbuk Asam Boi Pedas V2 120G',      1,  5.27, 20),
  ('P11', 'Serbuk Asam boi (Original) 1Kg',     2, 15.53, 4),
  ('P12', 'Sos Asam Boi Tong 20L',              2, 503.10, 1),
  ('P13', 'Sos Asam Boi Dipping Sauce 250gn',   1,  5.50, 15)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  unit_price = excluded.unit_price,
  units_per_carton = excluded.units_per_carton;

insert into outlets (code, name) values
  ('MBG001', '163 Retail Park'),
  ('MBG002', 'AEON Mall Nilai'),
  ('MBG003', 'AEON Taman Maluri'),
  ('MBG004', 'AEON Shah Alam'),
  ('MBG005', 'Ampang Point'),
  ('MBG006', 'Bangi Avenue'),
  ('MBG007', 'Central i-City'),
  ('MBG008', 'Empire Subang'),
  ('MBG009', 'Great Eastern'),
  ('MBG010', 'Hartamas'),
  ('MBG011', 'Institut Jantung Negara (IJN)'),
  ('MBG012', 'IOI Putrajaya'),
  ('MBG013', 'Jaya 33'),
  ('MBG014', 'KLIA 2'),
  ('MBG015', 'LRT Bangsar'),
  ('MBG016', 'Melawati Mall'),
  ('MBG017', 'MRT HKL'),
  ('MBG018', 'NU Sentral'),
  ('MBG019', 'One Utama'),
  ('MBG020', 'Paradigm'),
  ('MBG021', 'Pantai Hospital'),
  ('MBG022', 'PPUM'),
  ('MBG023', 'Sunway Giza'),
  ('MBG024', 'Sunway Pyramid'),
  ('MBG025', 'Sunway Putra'),
  ('MBG026', 'Setapak Central'),
  ('MBG027', 'Setia City Mall'),
  ('MBG028', 'The Starling'),
  ('MBG029', 'The Garden'),
  ('MBG030', 'Wangsa Walk'),
  ('MBG031', 'Hospital Serdang')
on conflict (code) do update set
  name = excluded.name;
