import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Driver } from '@/lib/types'

async function createRoute(formData: FormData) {
  'use server'
  const supabase = createClient()
  const name = formData.get('name') as string
  const date = formData.get('date') as string
  const driver_id = (formData.get('driver_id') as string) || null
  const notes = (formData.get('notes') as string) || null

  const { data, error } = await supabase
    .from('routes')
    .insert({ name, date, driver_id, notes, status: 'pending' })
    .select('id')
    .single()

  if (error || !data) return
  redirect(`/routes/${data.id}`)
}

export default async function NewRoutePage() {
  const supabase = createClient()
  const { data: driversData } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('status', 'active')
    .order('name')

  const drivers = (driversData ?? []) as Pick<Driver, 'id' | 'name'>[]
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <Link href="/routes" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
          ← Back to routes
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">New Route</h1>
        <p className="text-slate-500 text-sm mt-0.5">Create a new delivery route</p>
      </div>

      <form action={createRoute} className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Route name *</label>
          <input
            name="name"
            required
            placeholder="e.g. North Side AM"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign driver</label>
          <select
            name="driver_id"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="">— Unassigned —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Optional notes for this route…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-orange-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            Create Route
          </button>
          <Link
            href="/routes"
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
