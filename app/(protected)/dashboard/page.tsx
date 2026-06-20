import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import type { Route, Delivery } from '@/lib/types'

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [routesRes, driversRes] = await Promise.all([
    supabase
      .from('routes')
      .select('id, name, date, status, driver_id, drivers(name), deliveries(id, status)')
      .eq('date', today)
      .order('created_at', { ascending: false }),
    supabase.from('drivers').select('id').eq('status', 'active'),
  ])

  const routes = (routesRes.data ?? []) as unknown as (Route & {
    drivers: { name: string } | null
    deliveries: Pick<Delivery, 'id' | 'status'>[]
  })[]

  const activeDriverCount = driversRes.data?.length ?? 0
  const allDeliveries = routes.flatMap((r) => r.deliveries ?? [])
  const pendingDeliveries = allDeliveries.filter((d) => d.status === 'pending').length
  const completedRoutes = routes.filter((r) => r.status === 'completed').length

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Routes Today" value={routes.length} />
        <StatCard label="Pending" value={pendingDeliveries} />
        <StatCard label="Active Drivers" value={activeDriverCount} />
        <StatCard label="Completed" value={completedRoutes} sub={`of ${routes.length}`} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm md:text-base">Today&apos;s Routes</h2>
          <Link href="/routes/new" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + New
          </Link>
        </div>

        {routes.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-400 text-sm">
            No routes today.{' '}
            <Link href="/routes/new" className="text-blue-600 hover:underline">Create one</Link>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {routes.map((route) => {
                const total = route.deliveries?.length ?? 0
                const done = route.deliveries?.filter((d) => d.status === 'delivered').length ?? 0
                return (
                  <Link key={route.id} href={`/routes/${route.id}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{route.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{route.drivers?.name ?? 'Unassigned'} · {done}/{total} delivered</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <StatusBadge status={route.status} />
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Route</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Driver</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Deliveries</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.map((route) => {
                  const total = route.deliveries?.length ?? 0
                  const done = route.deliveries?.filter((d) => d.status === 'delivered').length ?? 0
                  return (
                    <tr key={route.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{route.name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{route.drivers?.name ?? '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{done}/{total}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={route.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/routes/${route.id}`} className="text-blue-600 hover:text-blue-700 font-medium text-xs">View →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
