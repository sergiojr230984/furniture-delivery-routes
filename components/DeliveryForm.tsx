"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createDelivery } from "@/app/(dashboard)/deliveries/actions";
import { ORDER_TYPES, ORDER_TYPE_LABELS } from "@/lib/constants";
import type { Customer } from "@/lib/types";

interface Item {
  description: string;
  sku: string;
  quantity: number;
  notes: string;
}

const emptyItem = (): Item => ({ description: "", sku: "", quantity: 1, notes: "" });

export default function DeliveryForm({ customers }: { customers: Customer[] }) {
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Prefill contact/address when an existing customer is selected.
  function onCustomerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const c = customers.find((x) => x.id === e.target.value);
    if (!c) return;
    const form = e.target.form;
    if (!form) return;
    const set = (name: string, val: string | null) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el && !el.value) el.value = val ?? "";
    };
    set("contact_name", c.name);
    set("contact_phone", c.phone);
    set("address_line1", c.address_line1);
    set("address_line2", c.address_line2);
    set("city", c.city);
    set("state", c.state);
    set("postal_code", c.postal_code);
  }

  return (
    <form action={createDelivery} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {/* Order basics */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">Order</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="order_type">Type</label>
            <select id="order_type" name="order_type" className="input" defaultValue="delivery">
              {ORDER_TYPES.map((t) => (
                <option key={t} value={t}>{ORDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="customer_id">Customer</label>
            <select id="customer_id" name="customer_id" className="input" defaultValue="" onChange={onCustomerChange}>
              <option value="">— None / one-off —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="scheduled_date">Scheduled date</label>
            <input id="scheduled_date" type="date" name="scheduled_date" className="input"
              defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="label" htmlFor="priority">Priority</label>
            <input id="priority" type="number" name="priority" className="input" defaultValue={0} min={0} />
          </div>
          <div>
            <label className="label" htmlFor="time_window_start">Time window — from</label>
            <input id="time_window_start" type="time" name="time_window_start" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="time_window_end">Time window — to</label>
            <input id="time_window_end" type="time" name="time_window_end" className="input" />
          </div>
        </div>
      </section>

      {/* Contact + address */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">Contact & address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact_name">Contact name</label>
            <input id="contact_name" name="contact_name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="contact_phone">Contact phone</label>
            <input id="contact_phone" name="contact_phone" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address_line1">Address line 1</label>
            <input id="address_line1" name="address_line1" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address_line2">Address line 2</label>
            <input id="address_line2" name="address_line2" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" name="city" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="state">State</label>
              <input id="state" name="state" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="postal_code">Postal code</label>
              <input id="postal_code" name="postal_code" className="input" />
            </div>
          </div>
        </div>
      </section>

      {/* Logistics / routing */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">Logistics & routing</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="on_demand" type="checkbox" className="h-4 w-4" />
          On-demand order (eligible for auto-dispatch into live routes)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="latitude">Latitude</label>
            <input id="latitude" name="latitude" type="number" step="any" className="input" placeholder="39.7817" />
          </div>
          <div>
            <label className="label" htmlFor="longitude">Longitude</label>
            <input id="longitude" name="longitude" type="number" step="any" className="input" placeholder="-89.6501" />
          </div>
          <div>
            <label className="label" htmlFor="service_minutes">Service time (min)</label>
            <input id="service_minutes" name="service_minutes" type="number" min={1} className="input" placeholder="learned / default" />
          </div>
          <div>
            <label className="label" htmlFor="sla_deadline">SLA deadline (on-demand)</label>
            <input id="sla_deadline" name="sla_deadline" type="datetime-local" className="input" />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Coordinates power route optimization and ETAs. The delivery zone is
          assigned automatically from coordinates or postal code.
        </p>
      </section>

      {/* Items */}
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Items</h2>
          <button type="button" onClick={addItem} className="btn-secondary">
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>
        {items.map((it, idx) => (
          <div key={idx} className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="label">Description</label>
              <input className="input" value={it.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="e.g. 3-seat sofa" />
            </div>
            <div className="sm:col-span-3">
              <label className="label">SKU</label>
              <input className="input" value={it.sku}
                onChange={(e) => updateItem(idx, { sku: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Qty</label>
              <input type="number" min={1} className="input" value={it.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
            </div>
            <div className="flex items-end sm:col-span-2">
              <button type="button" onClick={() => removeItem(idx)}
                className="btn-secondary w-full text-red-600" disabled={items.length === 1}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Notes */}
      <section className="card space-y-2 p-5">
        <label className="label" htmlFor="notes">Delivery notes</label>
        <textarea id="notes" name="notes" rows={3} className="input"
          placeholder="Access instructions, stairs, call on arrival, etc." />
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" className="btn-primary">Create delivery</button>
      </div>
    </form>
  );
}
