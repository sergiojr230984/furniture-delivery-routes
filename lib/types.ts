// Hand-written row types for the tables we read/write in the app.
import type {
  DeliveryStatus,
  VehicleStatus,
  RouteStatus,
  OrderType,
  CrewType,
  Role,
} from "./constants";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  capacity_volume: number | null;
  capacity_weight: number | null;
  status: VehicleStatus;
  notes: string | null;
  avg_speed_kmh: number;
  max_stops: number | null;
  avoid_tolls: boolean;
  created_at: string;
}

export interface Driver {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  crew_type: CrewType;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_order_id: string;
  description: string;
  sku: string | null;
  quantity: number;
  weight: number | null;
  volume: number | null;
  notes: string | null;
}

export interface DeliveryOrder {
  id: string;
  order_number: string | null;
  order_type: OrderType;
  customer_id: string | null;
  status: DeliveryStatus;
  scheduled_date: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  priority: number;
  salesperson_id: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  on_demand: boolean;
  service_minutes: number | null;
  zone_id: string | null;
  sla_deadline: string | null;
  created_at: string;
  // optional joined relations
  customer?: Customer | null;
  delivery_items?: DeliveryItem[];
}

export interface Route {
  id: string;
  name: string;
  route_date: string;
  vehicle_id: string | null;
  driver_id: string | null;
  helper_id: string | null;
  status: RouteStatus;
  notes: string | null;
  start_time: string;
  avoid_tolls: boolean;
  total_distance_km: number | null;
  total_duration_min: number | null;
  optimized_at: string | null;
  calendar_event_id: string | null;
  created_at: string;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
  helper?: Driver | null;
}

export interface RouteStop {
  id: string;
  route_id: string;
  delivery_order_id: string;
  stop_order: number;
  stop_type: OrderType;
  arrived_at: string | null;
  completed_at: string | null;
  notes: string | null;
  eta: string | null;
  planned_service_minutes: number | null;
  distance_from_prev_km: number | null;
  predicted_delay_min: number;
  delivery_order?: DeliveryOrder | null;
}

export interface DeliveryZone {
  id: string;
  name: string;
  color: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  postal_prefixes: string[];
  active: boolean;
  created_at: string;
}

export interface DriverLocation {
  driver_id: string;
  route_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
  driver?: Driver | null;
}

export interface OrgSettings {
  id: number;
  depot_name: string | null;
  depot_address: string | null;
  depot_lat: number | null;
  depot_lng: number | null;
  default_service_minutes: number;
  default_avg_speed_kmh: number;
}

export interface DeliveryPhoto {
  id: string;
  delivery_order_id: string;
  route_stop_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface DeliverySignature {
  id: string;
  delivery_order_id: string;
  signer_name: string | null;
  storage_path: string;
  signed_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  delivery_order_id: string;
  status: DeliveryStatus;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}
