"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import StarRating from "@/components/StarRating";
import type { Organization } from "@/lib/types";

type Row = Organization & { ratingAvg: number | null; ratingCount: number };

// No way to find a specific organization today beyond scrolling — every
// comparable ops/dispatch tool treats search-over-a-record-list as table
// stakes. Filters client-side; this list is small (demo/pilot scale), so
// no extra round trip is needed.
export default function OrganizationsList({ orgs }: { orgs: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) => o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q) || o.status.replace(/_/g, " ").toLowerCase().includes(q)
    );
  }, [orgs, query]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
        <input
          className="input pl-9"
          placeholder="Search by name, type, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card divide-y divide-navy-100">
        {orgs.length > 0 && filtered.length === 0 && <p className="p-5 text-navy-500">No organizations match &quot;{query}&quot;.</p>}
        {filtered.map((o) => (
          <Link key={o.id} href={`/admin/organizations/${o.id}`} className="flex items-center justify-between p-4 hover:bg-navy-50">
            <div>
              <div className="font-medium text-navy-800">
                {o.name} {o.is_internal_fleet && "(internal fleet)"} {o.is_demo && <span className="text-xs text-navy-400">Demo</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-navy-400">
                <span>{o.type}</span>
                {o.type === "provider" && o.ratingAvg != null && (
                  <span className="flex items-center gap-1">
                    <StarRating value={o.ratingAvg} />
                    <span>({o.ratingCount})</span>
                  </span>
                )}
              </div>
            </div>
            <span
              className={`badge ${
                o.status === "active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : o.status === "pending_review"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {o.status.replace(/_/g, " ")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
