import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/authStore';

const navItems = [
  { to: '/', label: '대시보드' },
  { to: '/exchange-rates', label: '환율 관리' },
  { to: '/customers', label: '고객' },
  { to: '/orders', label: '주문' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 220, borderRight: '1px solid #ddd', padding: 16 }}>
        <h2 style={{ fontSize: 18 }}>AVOCARD Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
          {navItems.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 32, fontSize: 14, color: '#555' }}>
          <p>{admin?.display_name}</p>
          <p>{admin?.email}</p>
          <button onClick={handleLogout} style={{ marginTop: 8 }}>
            로그아웃
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
