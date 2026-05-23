begin;

with world_metros (
  city,
  country_code,
  min_lat,
  min_lng,
  max_lat,
  max_lng,
  priority
) as (
  values
    ('london', 'GB', 51.18, -0.55, 51.78, 0.28, 100),
    ('paris', 'FR', 48.64, 2.05, 49.05, 2.65, 98),
    ('berlin', 'DE', 52.33, 13.08, 52.68, 13.76, 96),
    ('madrid', 'ES', 40.25, -3.95, 40.62, -3.45, 94),
    ('rome', 'IT', 41.73, 12.32, 42.05, 12.68, 92),
    ('amsterdam', 'NL', 52.23, 4.70, 52.48, 5.08, 90),
    ('brussels', 'BE', 50.74, 4.20, 50.96, 4.55, 88),
    ('zurich', 'CH', 47.27, 8.36, 47.48, 8.68, 86),
    ('vienna', 'AT', 48.08, 16.18, 48.35, 16.58, 86),
    ('stockholm', 'SE', 59.20, 17.75, 59.48, 18.28, 84),
    ('copenhagen', 'DK', 55.58, 12.35, 55.78, 12.75, 84),
    ('oslo', 'NO', 59.80, 10.55, 60.02, 10.95, 82),
    ('helsinki', 'FI', 60.07, 24.72, 60.32, 25.18, 82),
    ('dublin', 'IE', 53.24, -6.45, 53.45, -6.05, 82),
    ('lisbon', 'PT', 38.61, -9.32, 38.86, -9.02, 82),
    ('istanbul', 'TR', 40.78, 28.45, 41.35, 29.45, 88),
    ('toronto', 'CA', 43.50, -79.75, 43.90, -79.05, 92),
    ('vancouver', 'CA', 49.10, -123.35, 49.42, -122.82, 88),
    ('montreal', 'CA', 45.37, -73.90, 45.72, -73.35, 88),
    ('mexico_city', 'MX', 19.15, -99.40, 19.60, -98.85, 88),
    ('sao_paulo', 'BR', -23.82, -46.88, -23.35, -46.35, 88),
    ('rio_de_janeiro', 'BR', -23.08, -43.80, -22.70, -43.05, 84),
    ('buenos_aires', 'AR', -34.78, -58.65, -34.45, -58.25, 84),
    ('santiago', 'CL', -33.65, -70.90, -33.28, -70.45, 84),
    ('bogota', 'CO', 4.45, -74.30, 4.85, -73.95, 82),
    ('lima', 'PE', -12.28, -77.20, -11.85, -76.85, 82),
    ('sydney', 'AU', -34.05, 150.55, -33.55, 151.35, 94),
    ('melbourne', 'AU', -38.08, 144.55, -37.55, 145.45, 92),
    ('brisbane', 'AU', -27.75, 152.70, -27.20, 153.30, 86),
    ('perth', 'AU', -32.18, 115.62, -31.75, 116.10, 84),
    ('auckland', 'NZ', -37.05, 174.55, -36.68, 175.05, 82),
    ('tokyo', 'JP', 35.45, 139.35, 35.90, 140.05, 94),
    ('osaka', 'JP', 34.45, 135.25, 34.85, 135.75, 88),
    ('seoul', 'KR', 37.38, 126.75, 37.72, 127.20, 90),
    ('singapore', 'SG', 1.20, 103.58, 1.48, 104.08, 90),
    ('hong_kong', 'HK', 22.15, 113.82, 22.55, 114.38, 88),
    ('taipei', 'TW', 24.90, 121.35, 25.22, 121.70, 86),
    ('bangkok', 'TH', 13.55, 100.28, 13.95, 100.85, 86),
    ('kuala_lumpur', 'MY', 3.00, 101.45, 3.30, 101.85, 84),
    ('jakarta', 'ID', -6.42, 106.60, -6.05, 107.05, 84),
    ('manila', 'PH', 14.35, 120.82, 14.82, 121.20, 84),
    ('dubai', 'AE', 24.92, 54.85, 25.38, 55.55, 84),
    ('doha', 'QA', 25.15, 51.35, 25.45, 51.70, 80),
    ('tel_aviv', 'IL', 32.00, 34.65, 32.20, 34.90, 80),
    ('johannesburg', 'ZA', -26.38, 27.75, -25.95, 28.35, 82),
    ('cape_town', 'ZA', -34.18, 18.25, -33.75, 18.75, 80),
    ('cairo', 'EG', 29.82, 31.05, 30.25, 31.55, 80)
),
tile_ranges as (
  select
    m.city,
    m.country_code,
    m.priority,
    10 as zoom,
    floor(((m.min_lng + 180.0) / 360.0) * power(2.0, 10))::int as x_min,
    floor(((m.max_lng + 180.0) / 360.0) * power(2.0, 10))::int as x_max,
    floor(((1.0 - ln(tan(radians(m.max_lat)) + (1.0 / cos(radians(m.max_lat)))) / pi()) / 2.0) * power(2.0, 10))::int as y_min,
    floor(((1.0 - ln(tan(radians(m.min_lat)) + (1.0 / cos(radians(m.min_lat)))) / pi()) / 2.0) * power(2.0, 10))::int as y_max
  from world_metros m
),
tiles as (
  select
    tr.city,
    tr.country_code,
    tr.priority,
    tr.zoom,
    x,
    y
  from tile_ranges tr
  cross join lateral generate_series(tr.x_min, tr.x_max) as x
  cross join lateral generate_series(tr.y_min, tr.y_max) as y
),
tile_bounds as (
  select
    'osm'::text as source,
    format('z%s-x%s-y%s', t.zoom, t.x, t.y) as tile_key,
    t.zoom,
    t.x,
    t.y,
    degrees(atan(sinh(pi() * (1.0 - (2.0 * (t.y + 1)::double precision) / power(2.0, t.zoom)))))::double precision as min_lat,
    (((t.x)::double precision / power(2.0, t.zoom)) * 360.0 - 180.0)::double precision as min_lng,
    degrees(atan(sinh(pi() * (1.0 - (2.0 * t.y::double precision) / power(2.0, t.zoom)))))::double precision as max_lat,
    ((((t.x + 1)::double precision / power(2.0, t.zoom)) * 360.0) - 180.0)::double precision as max_lng,
    t.country_code,
    t.city,
    t.priority
  from tiles t
),
prioritized as (
  select
    tb.source,
    tb.tile_key,
    tb.zoom,
    tb.x,
    tb.y,
    tb.min_lat,
    tb.min_lng,
    tb.max_lat,
    tb.max_lng,
    (array_agg(distinct tb.country_code order by tb.country_code))[1] as country_code,
    max(tb.priority) as priority,
    jsonb_build_object(
      'global_city_seed',
      true,
      'seed_cities',
      array_agg(distinct tb.city order by tb.city),
      'seed_country_codes',
      array_agg(distinct tb.country_code order by tb.country_code),
      'seeded_by_migration',
      '20260522090000_seed_global_osm_city_tiles',
      'seeded_at',
      now()
    ) as metadata
  from tile_bounds tb
  group by
    tb.source,
    tb.tile_key,
    tb.zoom,
    tb.x,
    tb.y,
    tb.min_lat,
    tb.min_lng,
    tb.max_lat,
    tb.max_lng
)
insert into public.external_ingest_tiles (
  source,
  tile_key,
  zoom,
  x,
  y,
  min_lat,
  min_lng,
  max_lat,
  max_lng,
  country_code,
  priority,
  status,
  next_run_at,
  metadata
)
select
  p.source,
  p.tile_key,
  p.zoom,
  p.x,
  p.y,
  p.min_lat,
  p.min_lng,
  p.max_lat,
  p.max_lng,
  p.country_code,
  p.priority,
  'pending',
  now(),
  p.metadata
from prioritized p
on conflict (source, tile_key) do update
set
  country_code = excluded.country_code,
  priority = greatest(public.external_ingest_tiles.priority, excluded.priority),
  status = case
    when public.external_ingest_tiles.status = 'running' then public.external_ingest_tiles.status
    else 'pending'
  end,
  next_run_at = least(public.external_ingest_tiles.next_run_at, now()),
  metadata = coalesce(public.external_ingest_tiles.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

commit;
