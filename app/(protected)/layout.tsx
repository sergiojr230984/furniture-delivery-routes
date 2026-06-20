import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar userEmail={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    )
  } catch {
    redirect('/login')
  }
}
