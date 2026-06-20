import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile, UserRole } from '@/lib/types'

async function updateRole(userId: string, role: UserRole) {
  'use server'
  const admin = createAdminClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
  redirect('/admin')
}

export default async function AdminPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">Access denied</p>
          <p className="text-red-500 text-sm mt-1">You need admin privileges to view this page.</p>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: profiles } = await admin.from('profiles').select('*').order('created_at')
  const users = (profiles ?? []) as Profile[]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage users and roles</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Users ({users.length})</h2>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {users.map((u) => {
            const makeAdmin = updateRole.bind(null, u.id, 'admin')
            const makeDriver = updateRole.bind(null, u.id, 'driver')
            const isSelf = u.id === user.id
            return (
              <div key={u.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900 font-medium truncate">
                      {u.email}
                      {isSelf && <span className="ml-1.5 text-xs text-slate-400 font-normal">(you)</span>}
                    </p>
                    {u.full_name && <p className="text-xs text-slate-500 mt-0.5">{u.full_name}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role}
                    </span>
                    {!isSelf && (
                      <form action={u.role === 'admin' ? makeDriver : makeAdmin}>
                        <button type="submit" className="text-xs text-blue-600 hover:text-blue-700 underline">
                          Make {u.role === 'admin' ? 'driver' : 'admin'}
                        </button>
                      </form>
                    )}
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
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Email</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Role</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const makeAdmin = updateRole.bind(null, u.id, 'admin')
              const makeDriver = updateRole.bind(null, u.id, 'driver')
              const isSelf = u.id === user.id

              return (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-900">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{u.full_name ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!isSelf && (
                      <form action={u.role === 'admin' ? makeDriver : makeAdmin}>
                        <button type="submit" className="text-xs text-blue-600 hover:text-blue-700 underline">
                          Make {u.role === 'admin' ? 'driver' : 'admin'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 md:mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5">
        <h3 className="text-sm font-semibold text-amber-900 mb-1">Bootstrap first admin</h3>
        <p className="text-sm text-amber-700">
          If this page shows &quot;Access denied&quot;, run the following in the Supabase SQL editor:
        </p>
        <pre className="mt-2 bg-amber-100 text-amber-900 text-xs p-3 rounded-lg overflow-x-auto">
          {`UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';`}
        </pre>
      </div>
    </div>
  )
}
