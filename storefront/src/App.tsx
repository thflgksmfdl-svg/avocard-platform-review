import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, ApiError, clearImpersonationCredential, getImpersonationCredential } from './api';
import { CartProvider } from './cart';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ProductPage } from './pages/ProductPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { ImpersonationEnterPage } from './pages/ImpersonationEnterPage';

function ImpersonationBanner() {
  const [ending, setEnding] = useState(false);
  async function endSession() {
    const credential = getImpersonationCredential();
    if (!credential) return;
    setEnding(true);
    try { await api.endImpersonation(credential); } catch { /* best-effort */ }
    clearImpersonationCredential();
    window.location.reload();
  }
  return <div className="notice" style={{ margin: 0, borderRadius: 0 }} role="alert">
    관리자 대리 로그인 중입니다. <button className="secondary" disabled={ending} onClick={endSession}>대리 로그인 종료</button>
  </div>;
}

function MainApp() {
  const [customerId, setCustomerId] = useState<string>();
  const [isImpersonated, setIsImpersonated] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { api.profile().then((p) => { setCustomerId(p.id); setIsImpersonated(!!p.isImpersonated); }).catch((e) => setError(e instanceof ApiError && e.status === 401 ? '로그인 세션이 만료되었습니다. Shopify에서 다시 로그인해 주세요.' : '고객 정보를 불러오지 못했습니다.')); }, []);
  if (error) return <main className="state"><h1>AVOCARD</h1><p role="alert">{error}</p></main>;
  if (!customerId) return <main className="state">고객 정보를 확인하고 있습니다…</main>;
  return <CartProvider customerId={customerId}>
    {isImpersonated && <ImpersonationBanner />}
    <header><Link to="/">AVOCARD</Link><nav><Link to="/orders">주문 내역</Link><Link to="/cart">장바구니</Link></nav></header>
    <Routes><Route path="/products/:offerId" element={<ProductPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/orders" element={<OrdersPage />} /><Route path="/orders/:id" element={<OrderDetailPage />} /><Route path="*" element={<Navigate to="/cart" replace />} /></Routes>
  </CartProvider>;
}

export function App() {
  const location = useLocation();
  // /impersonation/enter must render before any api.profile() call fires —
  // it has not exchanged its credential yet, so MainApp would 401.
  if (location.pathname === '/impersonation/enter') return <ImpersonationEnterPage />;
  return <MainApp />;
}
