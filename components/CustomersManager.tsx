"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/lib/types";

export default function CustomersManager({ initial }: { initial: Customer[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("customers").insert({
      name: fd.get("name") as string,
      phone: (fd.get("phone") as string) || null,
      email: (fd.get("email") as string) || null,
      address_line1: (fd.get("address_line1") as string) || null,
      city: (fd.get("city") as string) || null,
      state: (fd.get("state") as string) || null,
      postal_code: (fd.get("postal_code") as string) || null,
    });
    setSaving(false);
    if (error) return setError(error.message);
    (e.target as HTMLFormElement).reset();
    setShowForm(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this customer?")) return;
    await supabase.from("customers").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add customer
        </button>
      </div>

      {showForm && (
        <form onSubmit={addCustomer} className="card grid gap-4 p-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Name *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input name="address_line1" className="input" />
          </div>
          <div>
            <label className="label">City</label>
            <input name="city" className="input" />
          </div>
          <div>
            <label className="label">State</label>
            <input name="state" className="input" />
          </div>
          <div>
            <label className="label">Postal code</label>
            <input name="postal_code" className="input" />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>Save</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-gray-100">
        {initial.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No customers yet.</p>
        ) : (
          initial.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-gray-500">
                    {[c.phone, c.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <button onClick={() => remove(c.id)} className="btn-secondary text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
