"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Map,
  Truck,
  Users,
  UserCog,
  Smartphone,
  Shield,
  Zap,
  MapPinned,
  Settings,
  Navigation,
} from "lucide-react";
import type { Role } from "@/lib/constants";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "salesperson"] },
  { href: "/deliveries", label: "Deliveries", icon: Package, roles: ["admin", "manager", "salesperson"] },
  { href: "/dispatch", label: "Auto-Dispatch", icon: Zap, roles: ["admin", "manager"] },
  { href: "/routes", label: "Routes", icon: Map, roles: ["admin", "manager"] },
  { href: "/tracking", label: "Live tracking", icon: Navigation, roles: ["admin", "manager"] },
  { href: "/vehicles", label: "Vehicles", icon: Truck, roles: ["admin", "manager"] },
  { href: "/drivers", label: "Drivers", icon: UserCog, roles: ["admin", "manager"] },
  { href: "/zones", label: "Zones", icon: MapPinned, roles: ["admin", "manager"] },
  { href: "/customers", label: "Customers", icon: Users, roles: ["admin", "manager", "salesperson"] },
  { href: "/driver", label: "Driver view", icon: Smartphone, roles: ["admin", "manager", "driver"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "manager"] },
  { href: "/staff", label: "Staff & users", icon: Shield, roles: ["admin"] },
];

export default function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
