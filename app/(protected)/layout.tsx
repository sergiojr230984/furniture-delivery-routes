import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import LogoutButton from '@/components/LogoutButton'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar userEmail={user.email ?? ''} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mobile header */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-orange-600 rounded-md flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2.5 0M13 16H9m4 0h2.586a1 1 0 00.707-.293l3.414-3.414a1 1 0 00.293-.707V9a1 1 0 00-1-1h-2m-5 8H3" />
                </svg>
              </div>
              <span className="text-white font-bold">FleetView</span>
            </div>
            <LogoutButton />
          </header>
          {/* pb-20 leaves room for the mobile bottom nav */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        </div>
      </div>
    )
  } catch {
    redirect('/login')
  }
}
