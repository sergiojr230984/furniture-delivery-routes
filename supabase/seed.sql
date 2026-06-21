-- =====================================================================
--  Optional sample data. Run AFTER schema.sql.
--  Note: user/profile rows are created through Supabase Auth (sign-up or
--  the admin "Add staff" screen), so this seed only fills the operational
--  tables that don't depend on a login.
-- =====================================================================

-- Vehicles / vans
insert into public.vehicles (name, make, model, year, license_plate, capacity_volume, capacity_weight, status)
values
  ('Van 1', 'Ford',     'Transit',     2022, 'FUR-101', 12.0, 1200, 'available'),
  ('Van 2', 'Mercedes', 'Sprinter',    2021, 'FUR-102', 15.0, 1500, 'available'),
  ('Box Truck', 'Isuzu', 'NPR',        2020, 'FUR-201', 28.0, 3500, 'maintenance')
on conflict do nothing;

-- Crew (drivers + helpers). profile_id is linked later from the Drivers screen.
insert into public.drivers (full_name, phone, license_number, crew_type, active)
values
  ('Carlos Mendez', '555-0101', 'DL-88213', 'driver', true),
  ('Tomas Rivera',  '555-0102', 'DL-77452', 'driver', true),
  ('Luis Ortega',   '555-0103', null,       'helper', true)
on conflict do nothing;

-- Customers
insert into public.customers (name, phone, email, address_line1, city, state, postal_code)
values
  ('Maria Gonzalez', '555-0201', 'maria@example.com', '123 Oak Street',  'Springfield', 'IL', '62701'),
  ('James Carter',   '555-0202', 'james@example.com', '88 Maple Avenue', 'Springfield', 'IL', '62702'),
  ('The Loft Cafe',  '555-0203', 'orders@loftcafe.com', '4 Market Sq',   'Springfield', 'IL', '62703')
on conflict do nothing;

-- A couple of delivery orders for today (order numbers auto-generate)
insert into public.delivery_orders
  (order_type, customer_id, status, scheduled_date, contact_name, contact_phone,
   address_line1, city, state, postal_code, notes)
select 'delivery', c.id, 'pending', current_date, c.name, c.phone,
       c.address_line1, c.city, c.state, c.postal_code, 'Sofa + coffee table'
from public.customers c where c.name = 'Maria Gonzalez'
on conflict do nothing;

insert into public.delivery_orders
  (order_type, customer_id, status, scheduled_date, contact_name, contact_phone,
   address_line1, city, state, postal_code, notes)
select 'delivery', c.id, 'scheduled', current_date, c.name, c.phone,
       c.address_line1, c.city, c.state, c.postal_code, 'Dining set, 6 chairs — call on arrival'
from public.customers c where c.name = 'James Carter'
on conflict do nothing;

-- Depot (Springfield, IL) so routes have a start/end point to optimise around.
update public.org_settings
set depot_name = 'Main Warehouse',
    depot_address = '1500 Industrial Pkwy, Springfield, IL',
    depot_lat = 39.7600,
    depot_lng = -89.6700
where id = 1;

-- A delivery zone covering Springfield postal codes.
insert into public.delivery_zones (name, color, center_lat, center_lng, radius_km, postal_prefixes)
values ('Springfield', '#2563eb', 39.7817, -89.6501, 15, array['627'])
on conflict do nothing;

-- Give the seeded orders coordinates + a time window so optimisation/ETAs work.
update public.delivery_orders o
set latitude = 39.7900, longitude = -89.6440, time_window_end = '12:00',
    zone_id = (select id from public.delivery_zones where name = 'Springfield' limit 1)
from public.customers c
where o.customer_id = c.id and c.name = 'Maria Gonzalez';

update public.delivery_orders o
set latitude = 39.7550, longitude = -89.6900, time_window_end = '11:00',
    zone_id = (select id from public.delivery_zones where name = 'Springfield' limit 1)
from public.customers c
where o.customer_id = c.id and c.name = 'James Carter';

-- An on-demand order waiting for auto-dispatch.
insert into public.delivery_orders
  (order_type, customer_id, status, scheduled_date, on_demand, sla_deadline,
   contact_name, contact_phone, address_line1, city, state, postal_code,
   latitude, longitude, notes)
select 'delivery', c.id, 'pending', current_date, true,
       (current_date + time '17:00'), c.name, c.phone,
       c.address_line1, c.city, c.state, c.postal_code,
       39.7700, -89.6600, 'Rush: accent chair'
from public.customers c where c.name = 'The Loft Cafe'
on conflict do nothing;
