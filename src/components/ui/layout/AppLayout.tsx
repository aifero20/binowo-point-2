import { Link, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

const menuItems = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/barang', label: 'Master Barang', icon: '📦' },
  { to: '/supplier', label: 'Supplier', icon: '🏭' },
  { to: '/gudang', label: 'Gudang', icon: '🏬' },
  { to: '/penjualan', label: 'Penjualan', icon: '🛒' },
  { to: '/pembelian', label: 'Pembelian', icon: '📋' },
  { to: '/stok', label: 'Stock Movement', icon: '📊' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuthStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">Binowo Kasir</h1>
          <p className="text-xs text-gray-400 mt-1">{profile?.full_name ?? '—'}</p>
          <p className="text-xs text-gray-500">{profile?.role_code ?? '—'}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {menuItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-700 transition-colors',
                currentPath === item.to ? 'bg-blue-700 font-semibold' : ''
              ].join(' ')}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-gray-300 hover:text-white py-2"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
