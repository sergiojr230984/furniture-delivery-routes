// Shared enums, labels and colour mappings used across the UI.

export const DELIVERY_STATUSES = [
  "pending",
  "scheduled",
  "loaded",
  "out_for_delivery",
  "delivered",
  "failed",
  "rescheduled",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  loaded: "Loaded",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  failed: "Failed",
  rescheduled: "Rescheduled",
};

// Tailwind classes for each status badge.
export const STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  loaded: "bg-indigo-100 text-indigo-700 border-indigo-200",
  out_for_delivery: "bg-amber-100 text-amber-700 border-amber-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  rescheduled: "bg-purple-100 text-purple-700 border-purple-200",
};

export const ROLES = ["admin", "manager", "salesperson", "driver"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin / Dispatcher",
  manager: "Manager",
  salesperson: "Salesperson",
  driver: "Driver",
};

export const VEHICLE_STATUSES = [
  "available",
  "in_use",
  "maintenance",
  "out_of_service",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: "Available",
  in_use: "In Use",
  maintenance: "Maintenance",
  out_of_service: "Out of Service",
};

export const ROUTE_STATUSES = [
  "planning",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  planning: "Planning",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_TYPES = ["delivery", "pickup"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Customer Delivery",
  pickup: "Supplier Pickup",
};

export const CREW_TYPES = ["driver", "helper"] as const;
export type CrewType = (typeof CREW_TYPES)[number];
