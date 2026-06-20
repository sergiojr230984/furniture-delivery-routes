import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import type { Driver } from '@/lib/types'

async function createDriver(formData: FormData) {
  'use server'
  const supabase = createClient()
  await supabase.from('drivers').insert({
    name: formData.get('name') as string,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    vehicle_type: (formData.get('vehicle_type') as string) || null,
    license_plate: (formData.get('license_plate') as string) || null,
    status: 'active',
  })
  redirect('/drivers')
}

async function toggleDriverStatus(driverId: string, currentStatus: string) {
  'use server'
  const supabase = createClient()
  await supabase
    .from('drivers')
    .update({ status: currentStatus === 'active' ? 'inactive' : 'active' })
    .eq('id', driverId)
  redirect('/drivers')
}

export default async function DriversPage() {
  const supabase = createClient()
  const { data } = await supabase.from('drivers').select('*').order('name')
  const drivers = (data ?? []) as Driver[]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Drivers</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your delivery team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1">
          {drivers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-6 py-16 text-center">
              <p className="text-slate-400 text-sm">No drivers yet. Add your first driver.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {drivers.map((driver) => {
                  const toggleBound = toggleDriverStatus.bind(null, driver.id, driver.status)
                  return (
                    <div key={driver.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{driver.name}</p>
                          {driver.email && <p className="text-xs text-slate-500 mt-0.5">{driver.email}</p>}
                          {driver.phone && <p className="text-xs text-slate-400">{driver.phone}</p>}
                          {(driver.vehicle_type || driver.license_plate) && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {[driver.vehicle_type, driver.license_plate].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <StatusBadge status={driver.status} />
                          <form action={toggleBound}>
                            <button type="submit" className="text-xs text-slate-500 hover:text-slate-700 underline">
                              {driver.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Name</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Contact</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Vehicle</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drivers.map((driver) => {
                    const toggleBound = toggleDriverStatus.bind(null, driver.id, driver.status)
                    return (
                      <tr key={driver.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-slate-900">{driver.name}</td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div>{driver.email ?? '—'}</div>
                          <div className="text-slate-400 text-xs">{driver.phone}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div>{driver.vehicle_type ?? '—'}</div>
                          {driver.license_plate && (
                            <div className="text-slate-400 text-xs">{driver.license_plate}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={driver.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <form action={toggleBound}>
                            <button
                              type="submit"
                              className="text-xs text-slate-500 hover:text-slate-700 underline"
                            >
                              {driver.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 h-fit order-1 lg:order-2">
          <h2 className="font-semibold text-slate-900 mb-4">Add Driver</h2>
          <form action={createDriver} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full name *</label>
              <input
                name="name"
                required
                placeholder="John Doe"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                name="phone"
                type="tel"
                placeholder="+1 555 000 0000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                placeholder="driver@example.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle type</label>
              <input
                name="vehicle_type"
                placeholder="Box truck, van…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">License plate</label>
              <input
                name="license_plate"
                placeholder="ABC-1234"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-orange-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Add Driver
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
