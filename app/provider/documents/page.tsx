import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { uploadDocumentAction } from "./actions";
import { formatDate } from "@/lib/time";
import type { ProviderDocument } from "@/lib/types";

const DOC_TYPES = [
  ["general_liability_insurance", "General liability insurance"],
  ["auto_insurance", "Commercial auto insurance"],
  ["business_license", "Business license"],
  ["w9", "W-9"],
  ["other", "Other"],
];

export default async function ProviderDocumentsPage() {
  const user = await requireRole("provider_owner");
  const docs = await query<ProviderDocument>(`select * from provider_documents where org_id = $1 order by created_at desc`, [user.org_id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Documents</h1>
      <p className="text-sm text-navy-500">
        Uploading a document does not automatically imply approved coverage — Belliza reviews every document before
        it counts toward eligibility.
      </p>

      <div className="card divide-y divide-navy-100">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-navy-800">{d.doc_type.replace(/_/g, " ")}</div>
              <div className="text-xs text-navy-400">
                {d.expires_at ? `Expires ${formatDate(d.expires_at)}` : "No expiry set"}
              </div>
            </div>
            <span
              className={`badge ${
                d.status === "approved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : d.status === "rejected" || d.status === "expired"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {d.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>

      <form action={uploadDocumentAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Upload a document</h2>
        <select className="input" name="docType" required>
          {DOC_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Issued</label>
            <input className="input" name="issuedAt" type="date" />
          </div>
          <div>
            <label className="label">Expires</label>
            <input className="input" name="expiresAt" type="date" />
          </div>
        </div>
        <input className="input" name="file" type="file" accept="application/pdf,image/*" required />
        <button type="submit" className="btn-primary w-full">
          Upload
        </button>
      </form>
    </div>
  );
}
