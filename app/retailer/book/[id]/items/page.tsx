import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";
import { addItemAction, removeItemAction, continueToDestinationAction } from "../../actions";
import BookingWizardSteps from "@/components/BookingWizardSteps";
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABELS, PACKAGING_CONDITIONS } from "@/lib/constants";
import { Trash2 } from "lucide-react";

export default async function ItemsStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(id, user.org_id);

  const items = await query<{ id: string; name: string; category: string; quantity: number; needs_review: boolean; review_reason: string | null }>(
    `select id, name, category, quantity, needs_review, review_reason from booking_items where booking_id = $1 order by created_at`,
    [id]
  );
  const savedProducts = await query<{ id: string; name: string; category: string }>(
    `select id, name, category from saved_products where org_id = $1 order by name`,
    [user.org_id]
  );

  return (
    <div className="mx-auto max-w-lg">
      <BookingWizardSteps current="items" />
      <h1 className="text-2xl font-bold text-navy-900">What are we moving?</h1>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="card flex items-center justify-between p-3">
              <div>
                <div className="font-medium text-navy-800">
                  {it.quantity}× {it.name}
                </div>
                <div className="text-xs text-navy-400">{ITEM_CATEGORY_LABELS[it.category as keyof typeof ITEM_CATEGORY_LABELS]}</div>
                {it.needs_review && <div className="text-xs text-amber-600">Needs review: {it.review_reason}</div>}
              </div>
              <form action={removeItemAction.bind(null, id, it.id)}>
                <button type="submit" className="btn-ghost !p-2 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {savedProducts.length > 0 && (
        <form action={addItemAction.bind(null, id)} className="card mt-4 space-y-3 p-5">
          <h2 className="font-semibold text-navy-800">Add a saved product</h2>
          <select className="input" name="savedProductId" required>
            {savedProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input className="input" name="quantity" type="number" min="1" defaultValue={1} placeholder="Quantity" />
          <button type="submit" className="btn-secondary w-full">
            Add saved product
          </button>
        </form>
      )}

      <form action={addItemAction.bind(null, id)} className="card mt-4 space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Add a custom item</h2>
        <input className="input" name="name" placeholder="Item name" required />
        <select className="input" name="category" defaultValue="misc">
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ITEM_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input className="input" name="quantity" type="number" min="1" defaultValue={1} placeholder="Quantity" />
        <div className="grid grid-cols-3 gap-3">
          <input className="input" name="lengthIn" type="number" step="0.1" placeholder='Length (in)' />
          <input className="input" name="widthIn" type="number" step="0.1" placeholder='Width (in)' />
          <input className="input" name="heightIn" type="number" step="0.1" placeholder='Height (in)' />
        </div>
        <input className="input" name="weightLbs" type="number" step="0.1" placeholder="Weight (lbs)" />
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" name="dimsUnknown" /> Dimensions/weight unknown
        </label>
        <select className="input" name="packagingCondition" defaultValue="unknown">
          {PACKAGING_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <input className="input" name="declaredValue" type="number" step="0.01" placeholder="Declared value (USD, optional)" />
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" name="assemblyRequired" /> Requires assembly
        </label>
        <button type="submit" className="btn-secondary w-full">
          Add custom item
        </button>
      </form>

      <form action={continueToDestinationAction.bind(null, id)} className="mt-6">
        <button type="submit" className="btn-primary w-full" disabled={items.length === 0}>
          Continue with {items.length} item{items.length === 1 ? "" : "s"}
        </button>
      </form>
    </div>
  );
}
