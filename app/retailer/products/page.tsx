import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { addProductAction, deleteProductAction } from "./actions";
import { ITEM_CATEGORIES, ITEM_CATEGORY_LABELS } from "@/lib/constants";
import type { SavedProduct } from "@/lib/types";
import { Trash2 } from "lucide-react";

export default async function RetailerProductsPage() {
  const user = await requireRole("retailer_owner", "retailer_staff");
  const products = await query<SavedProduct>(`select * from saved_products where org_id = $1 order by name`, [user.org_id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Saved Products</h1>

      <div className="card divide-y divide-navy-100">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-navy-800">{p.name}</div>
              <div className="text-xs text-navy-400">
                {ITEM_CATEGORY_LABELS[p.category]} · {p.length_in}&quot;×{p.width_in}&quot;×{p.height_in}&quot; · {p.weight_lbs} lbs
              </div>
            </div>
            <form action={deleteProductAction.bind(null, p.id)}>
              <button type="submit" className="btn-ghost !p-2 text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          </div>
        ))}
      </div>

      <form action={addProductAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Add a product template</h2>
        <input className="input" name="name" placeholder="Product name" required />
        <select className="input" name="category" defaultValue="misc">
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ITEM_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <input className="input" name="lengthIn" type="number" step="0.1" placeholder="Length (in)" />
          <input className="input" name="widthIn" type="number" step="0.1" placeholder="Width (in)" />
          <input className="input" name="heightIn" type="number" step="0.1" placeholder="Height (in)" />
        </div>
        <input className="input" name="weightLbs" type="number" step="0.1" placeholder="Weight (lbs)" />
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" name="assemblyRequired" /> Requires assembly by default
        </label>
        <button type="submit" className="btn-primary w-full">
          Add product
        </button>
      </form>
    </div>
  );
}
