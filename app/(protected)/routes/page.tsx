import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import type { Route, Delivery } from '@/lib/types'

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const supabase = createClient()
  const date = searchParams.date ?? new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('routes')
    .select('id, name, date, status, notes, drivers(name), deliveries(id, status)')
    .eq('date', date)
    .order('created_at', { ascending: false })

  const routes = (data ?? []) as unknown as (Route & {
    drivers: { name: string } | null
    deliveries: Pick<Delivery, 'id' | 'status'>[]
  })[]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Routes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Delivery routes by date</p>
        </div>
        <Link
          href="/routes/new"
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New
        </Link>
      </div>

      <form method="GET" className="mb-5 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">Date</label>
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          Filter
        </button>
      </form>

      {routes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-16 text-center">
          <p className="text-slate-400 text-sm">No routes found for {date}.</p>
          <Link href="/routes/new" className="inline-block mt-3 text-blue-600 hover:underline text-sm font-medium">
            Create a route
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const total = route.deliveries?.length ?? 0
            const done = route.deliveries?.filter((d) => d.status === 'delivered').length ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0

            return (
              <Link
                key={route.id}
                href={`/routes/${route.id}`}
                className="block bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-semibold text-slate-900 truncate">{route.name}</span>
                      <StatusBadge status={route.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      Driver: <span className="text-slate-700">{route.drivers?.name ?? 'Unassigned'}</span>
                    </p>
                    {route.notes && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{route.notes}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-slate-900">
                      {done}/{total} delivered
                    </p>
                    <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
