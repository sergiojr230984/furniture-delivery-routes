import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FleetView — Furniture Delivery & Route Management',
  description: 'Manage furniture delivery routes, drivers, and deliveries.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
