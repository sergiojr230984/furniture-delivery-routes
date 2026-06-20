import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import type { Route, Driver, Delivery, RouteStatus, DeliveryStatus } from '@/lib/types'

async function addDelivery(routeId: string, formData: FormData) {
  'use server'
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('deliveries')
    .select('sequence_order')
    .eq('route_id', routeId)
    .order('sequence_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (existing?.sequence_order ?? 0) + 1

  await supabase.from('deliveries').insert({
    route_id: routeId,
    customer_name: formData.get('customer_name') as string,
    customer_phone: (formData.get('customer_phone') as string) || null,
    address: formData.get('address') as string,
    city: (formData.get('city') as string) || null,
    items_description: (formData.get('items_description') as string) || null,
    time_window: (formData.get('time_window') as string) || null,
    notes: (formData.get('notes') as string) || null,
    sequence_order: nextOrder,
    status: 'pending',
  })

  redirect(`/routes/${routeId}`)
}

async function updateRouteStatus(routeId: string, status: RouteStatus) {
  'use server'
  const supabase = createClient()
  await supabase.from('routes').update({ status, updated_at: new Date().toISOString() }).eq('id', routeId)
  redirect(`/routes/${routeId}`)
}

async function updateDeliveryStatus(deliveryId: string, routeId: string, status: DeliveryStatus) {
  'use server'
  const supabase = createClient()
  await supabase.from('deliveries').update({ status, updated_at: new Date().toISOString() }).eq('id', deliveryId)
  redirect(`/routes/${routeId}`)
}

export default async function RouteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: routeData } = await supabase
    .from('routes')
    .select('*, drivers(id, name, phone, vehicle_type, license_plate), deliveries(*)')
    .eq('id', params.id)
    .single()

  if (!routeData) notFound()

  const route = routeData as Route & {
    drivers: Driver | null
    deliveries: Delivery[]
  }

  const deliveries = [...(route.deliveries ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)

  const { data: driversData } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('status', 'active')
    .order('name')
  const allDrivers = (driversData ?? []) as Pick<Driver, 'id' | 'name'>[]

  const addDeliveryForRoute = addDelivery.bind(null, params.id)
  const updateRouteStatusBound = updateRouteStatus.bind(null, params.id)

  const deliveryStatuses: DeliveryStatus[] = ['delivered', 'failed', 'rescheduled', 'pending']

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <Link href="/routes" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
          ← Back to routes
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{route.name}</h1>
              <StatusBadge status={route.status} />
            </div>
            <p className="text-slate-500 text-sm">
              {new Date(route.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {route.status === 'pending' && (
              <form action={updateRouteStatusBound.bind(null, 'in_progress')}>
                <button className="text-sm bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                  Start
                </button>
              </form>
            )}
            {route.status === 'in_progress' && (
              <form action={updateRouteStatusBound.bind(null, 'completed')}>
                <button className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors">
                  Complete
                </button>
              </form>
            )}
            {(route.status === 'pending' || route.status === 'in_progress') && (
              <form action={updateRouteStatusBound.bind(null, 'cancelled')}>
                <button className="text-sm bg-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-300 transition-colors">
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2">
          <h2 className="font-semibold text-slate-900 mb-3">Route Info</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Driver</span>
              <p className="font-medium text-slate-900">{route.drivers?.name ?? 'Unassigned'}</p>
            </div>
            {route.drivers?.phone && (
              <div>
                <span className="text-slate-500">Phone</span>
                <p className="font-medium text-slate-900">{route.drivers.phone}</p>
              </div>
            )}
            {route.drivers?.vehicle_type && (
              <div>
                <span className="text-slate-500">Vehicle</span>
                <p className="font-medium text-slate-900">{route.drivers.vehicle_type}</p>
              </div>
            )}
            {route.drivers?.license_plate && (
              <div>
                <span className="text-slate-500">Plate</span>
                <p className="font-medium text-slate-900">{route.drivers.license_plate}</p>
              </div>
            )}
            {route.notes && (
              <div className="col-span-2">
                <span className="text-slate-500">Notes</span>
                <p className="font-medium text-slate-900">{route.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900 mb-3">Progress</h2>
          <div className="space-y-2 text-sm">
            {(['pending', 'delivered', 'failed', 'rescheduled'] as DeliveryStatus[]).map((s) => {
              const count = deliveries.filter((d) => d.status === s).length
              return (
                <div key={s} className="flex items-center justify-between">
                  <StatusBadge status={s} />
                  <span className="font-medium text-slate-700">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4 md:mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            Deliveries <span className="text-slate-400 font-normal">({deliveries.length})</span>
          </h2>
        </div>

        {deliveries.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">
            No deliveries yet. Add one below.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {deliveries.map((delivery) => {
              return (
                <div key={delivery.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 mt-0.5">
                        {delivery.sequence_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-slate-900 text-sm">{delivery.customer_name}</span>
                          {delivery.time_window && (
                            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                              {delivery.time_window}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 truncate">
                          {delivery.address}
                          {delivery.city ? `, ${delivery.city}` : ''}
                        </p>
                        {delivery.items_description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{delivery.items_description}</p>
                        )}
                        {delivery.customer_phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{delivery.customer_phone}</p>
                        )}
                        {delivery.notes && (
                          <p className="text-xs text-amber-600 mt-0.5">{delivery.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      <StatusBadge status={delivery.status} />
                      <div className="flex gap-1">
                        {deliveryStatuses
                          .filter((s) => s !== delivery.status)
                          .map((s) => {
                            const updateDeliveryBound = updateDeliveryStatus.bind(null, delivery.id, params.id, s)
                            const label =
                              s === 'delivered' ? '✓' : s === 'failed' ? '✗' : s === 'rescheduled' ? '↻' : '○'
                            const cls =
                              s === 'delivered'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : s === 'failed'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : s === 'rescheduled'
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            return (
                              <form key={s} action={updateDeliveryBound}>
                                <button
                                  type="submit"
                                  title={s}
                                  className={`w-6 h-6 rounded text-xs font-bold transition-colors ${cls}`}
                                >
                                  {label}
                                </button>
                              </form>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Add Delivery</h2>
        <form action={addDeliveryForRoute} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer name *</label>
              <input
                name="customer_name"
                required
                placeholder="Jane Smith"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                name="customer_phone"
                type="tel"
                placeholder="+1 555 000 0000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Address *</label>
              <input
                name="address"
                required
                placeholder="123 Main St"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
              <input
                name="city"
                placeholder="Chicago"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Items</label>
              <input
                name="items_description"
                placeholder="3-piece sofa set"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Time window</label>
              <input
                name="time_window"
                placeholder="9am – 12pm"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input
              name="notes"
              placeholder="Gate code, floor, special instructions…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto bg-orange-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Add Delivery
          </button>
        </form>
      </div>
    </div>
  )
}
