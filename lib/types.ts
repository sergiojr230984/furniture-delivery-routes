export type UserRole = 'admin' | 'driver'
export type DriverStatus = 'active' | 'inactive'
export type RouteStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'rescheduled'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export interface Driver {
  id: string
  profile_id: string | null
  name: string
  phone: string | null
  email: string | null
  vehicle_type: string | null
  license_plate: string | null
  status: DriverStatus
  created_at: string
}

export interface Route {
  id: string
  name: string
  date: string
  driver_id: string | null
  status: RouteStatus
  notes: string | null
  created_at: string
  updated_at: string
  driver?: Driver | null
  deliveries?: Delivery[]
}

export interface Delivery {
  id: string
  route_id: string
  customer_name: string
  customer_phone: string | null
  address: string
  city: string | null
  items_description: string | null
  status: DeliveryStatus
  time_window: string | null
  sequence_order: number
  notes: string | null
  created_at: string
  updated_at: string
}
