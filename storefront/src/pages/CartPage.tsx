import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { cnyTotal, useCart } from '../cart';
import type { Address, CartItem, CartItemSubmissionStatus } from '../types';

/**
 * Per-item banner for the 6 non-NORMAL submission statuses
 * (09_CANONICAL_DECISIONS.md order-recovery addendum §5) — raw 1688
 * error/exception text never reaches here; item.failureReason is already the
 * customer-safe message the backend's customer-failure-message.ts mapped it
 * to.
 */
function StatusBanner({ item, onRetry, retrying }: { item: CartItem; onRetry: () => void; retrying: boolean }) {
  switch (item.submissionStatus) {
    case 'CREATE_PROCESSING':
      return <p className="notice">주문을 처리하고 있습니다.</p>;
    case 'CREATE_RESULT_UNKNOWN':
      return <p className="warning" role="alert">주문 처리 결과를 확인하고 있습니다. 중복 주문 방지를 위해 다시 제출하지 마세요.</p>;
    case 'CREATE_MATERIALIZING':
      return <p className="notice">주문 생성이 완료되어 주문내역을 반영하고 있습니다.</p>;
    case 'CREATE_FAILED_SUPPORT_REQUIRED':
      return <p className="warning" role="alert">주문 생성에 다시 실패했습니다. 고객센터로 문의해주세요.</p>;
    case 'CREATE_FAILED_ACTION_REQUIRED':
      return <p className="warning" role="alert">{item.failureReason ?? '수량 또는 옵션을 확인한 뒤 다시 제출해 주세요.'} <button disabled={retrying} onClick={onRetry}>배송정보 확인 후 다시 제출</button></p>;
    case 'CREATE_FAILED_RETRY_AVAILABLE':
      return <p className="warning" role="alert">{item.failureReason ?? '주문 생성에 실패했습니다.'} <button disabled={retrying} onClick={onRetry}>배송정보 확인 후 다시 제출</button></p>;
    default:
      return null;
  }
}

/**
 * The cart holds no address/customs/transport state (that only exists on
 * CheckoutPage), and the backend does not persist the original submission's
 * shipping input anywhere it can be restored from
 * (OrderSubmissionRequest has no recipient/customs/transport columns — a
 * failed request never materializes an AvocardOrder to read a snapshot
 * from). So a retry can never silently resend "the same" shipping info: the
 * customer must explicitly reconfirm address/customs/transport here before
 * resubmitting. This intentionally mirrors CheckoutPage's own fields rather
 * than defaulting to anything.
 */
function RetryShippingDialog({ onCancel, onConfirm, submitting, error }: {
  onCancel: () => void;
  onConfirm: (shipping: { customsType: 'PERSONAL' | 'BUSINESS'; transportMode: 'SEA' | 'AIR' | 'LCL'; recipientSnapshot: Record<string, unknown> }) => void;
  submitting: boolean;
  error: string;
}) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addressId, setAddressId] = useState('');
  const [customsType, setCustomsType] = useState<'PERSONAL' | 'BUSINESS' | ''>('');
  const [transport, setTransport] = useState<'SEA' | 'AIR' | 'LCL' | ''>('');

  useEffect(() => {
    api.addresses()
      .then((list) => setAddresses(list))
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 401 ? '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' : '배송등록지를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedAddress = addresses.find((x) => x.id === addressId);
  const canConfirm = !!selectedAddress && !!customsType && !!transport;

  return <div className="retry-dialog" role="dialog">
    <p className="notice">이전에 입력한 배송·통관 정보는 재제출 시 자동으로 유지되지 않습니다. 다시 제출하기 전에 배송등록지와 통관·운송 방법을 직접 확인해 주세요.</p>
    {loading && <p>배송등록지를 불러오는 중입니다…</p>}
    {loadError && <p role="alert" className="warning">{loadError}</p>}
    {!loading && !loadError && <>
      <label>배송등록지<select value={addressId} onChange={(e) => { setAddressId(e.target.value); const a = addresses.find((x) => x.id === e.target.value); if (a) setCustomsType(a.addressType); }}>
        <option value="">선택해 주세요</option>
        {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.address}</option>)}
      </select></label>
      {!addresses.length && <p>저장된 배송등록지가 없습니다. 계정에서 배송등록지를 먼저 추가해 주세요.</p>}
      <label>통관 유형<select value={customsType} onChange={(e) => setCustomsType(e.target.value as 'PERSONAL' | 'BUSINESS')}>
        <option value="">선택해 주세요</option>
        <option value="PERSONAL">개인통관</option>
        <option value="BUSINESS">사업자통관</option>
      </select></label>
      <label>운송 방식<select value={transport} onChange={(e) => setTransport(e.target.value as 'SEA' | 'AIR' | 'LCL')}>
        <option value="">선택해 주세요</option>
        <option value="SEA">해운</option>
        <option value="AIR">항공</option>
        {customsType === 'BUSINESS' && <option value="LCL">LCL</option>}
      </select></label>
    </>}
    {error && <p role="alert" className="warning">{error}</p>}
    <div className="actions">
      <button className="secondary" disabled={submitting} onClick={onCancel}>취소</button>
      <button
        disabled={!canConfirm || submitting}
        title={canConfirm ? undefined : '배송등록지, 통관 유형, 운송 방식을 모두 선택해 주세요.'}
        onClick={() => selectedAddress && customsType && transport && onConfirm({
          customsType,
          transportMode: transport,
          recipientSnapshot: {
            addressId: selectedAddress.id, label: selectedAddress.label, recipientName: selectedAddress.recipientName,
            recipientPhone: selectedAddress.recipientPhone, postalCode: selectedAddress.postalCode, address: selectedAddress.address,
            addressDetail: selectedAddress.addressDetail, customsClearanceNo: selectedAddress.customsClearanceNo,
            businessName: selectedAddress.businessName, businessNo: selectedAddress.businessNo,
          },
        })}
      >{submitting ? '제출 중…' : '확인하고 다시 제출'}</button>
    </div>
  </div>;
}

const LOCKED_STATUSES = new Set<CartItemSubmissionStatus>(['CREATE_PROCESSING', 'CREATE_RESULT_UNKNOWN', 'CREATE_MATERIALIZING']);

export function CartPage() {
  const cart = useCart(); const navigate = useNavigate();
  const [retryError, setRetryError] = useState('');
  const [retryingId, setRetryingId] = useState('');
  const [retryTarget, setRetryTarget] = useState<CartItem | null>(null);
  if (cart.loading && !cart.items.length) return <main className="state">장바구니를 불러오는 중입니다…</main>;
  if (!cart.items.length) return <main className="state"><h1>장바구니</h1><p>장바구니가 비어 있습니다.</p><p>상품 상세에서 SKU와 수량을 선택해 담아 주세요.</p>{cart.error && <p role="alert" className="warning">{cart.error}</p>}</main>;
  const invalid = cart.items.some((x) => !x.cnyUnitPrice || x.stockSnapshot === 0 || (x.stockSnapshot != null && x.qty > x.stockSnapshot) || LOCKED_STATUSES.has(x.submissionStatus) || x.submissionStatus === 'CREATE_FAILED_SUPPORT_REQUIRED');

  // Retry never resends a guessed/default shipping input — the cart has no
  // memory of the address/customs/transport the customer picked on
  // Checkout, and the backend has nowhere to restore it from either (a
  // failed OrderSubmissionRequest never materializes an AvocardOrder, so
  // there is no snapshot to read back). Instead this opens
  // RetryShippingDialog so the customer explicitly reconfirms before each
  // retry call. logicalRequestKey stays fixed server-side regardless.
  async function confirmRetry(item: CartItem, shipping: { customsType: 'PERSONAL' | 'BUSINESS'; transportMode: 'SEA' | 'AIR' | 'LCL'; recipientSnapshot: Record<string, unknown> }) {
    if (!item.submissionRequestId) return;
    setRetryError('');
    setRetryingId(item.key);
    try {
      const outcome = await api.retrySubmissionRequest(item.submissionRequestId, shipping);
      if (outcome.outcome === 'failed') setRetryError(outcome.reason);
      else setRetryTarget(null);
      await cart.reload();
    } catch (cause) {
      setRetryError(cause instanceof ApiError ? cause.message : '다시 제출하지 못했습니다.');
    } finally {
      setRetryingId('');
    }
  }

  return <main><h1>장바구니</h1><p>마지막 변경 후 5일 동안 이 브라우저에서 로그인 사용자별로 보관됩니다.{cart.expiresAt && ` 만료: ${new Date(cart.expiresAt).toLocaleString('ko-KR')}`}</p>{cart.error && <p role="alert" className="warning">{cart.error}</p>}{retryError && !retryTarget && <p role="alert" className="warning">{retryError}</p>}<div className="items">{cart.items.map((item) => {
    const locked = item.locked || LOCKED_STATUSES.has(item.submissionStatus);
    return <article className="item" key={item.key}>{item.imageUrl && <img src={item.imageUrl} alt="" />}<div><h2>{item.titleKo || item.titleZh}</h2><p>{item.optionSnapshot.map((a) => `${a.nameTrans || a.name}: ${a.valueTrans || a.value}`).join(' / ')}</p><p>단가 ¥{item.cnyUnitPrice}</p>{item.stockSnapshot === 0 && <p className="warning">품절된 상품입니다.</p>}<StatusBanner item={item} onRetry={() => { setRetryError(''); setRetryTarget(item); }} retrying={retryingId === item.key} />{retryTarget?.key === item.key && <RetryShippingDialog
      submitting={retryingId === item.key}
      error={retryError}
      onCancel={() => { setRetryTarget(null); setRetryError(''); }}
      onConfirm={(shipping) => void confirmRetry(item, shipping)}
    />}</div><label>수량<input className="quantity" type="number" min="1" max={item.stockSnapshot ?? undefined} value={item.qty} disabled={cart.loading || locked} onChange={(e) => void cart.setQty(item.key, Number(e.target.value))} /></label><strong>¥{(Number(item.cnyUnitPrice) * item.qty).toFixed(2)}</strong><button className="secondary" disabled={cart.loading || locked} title={locked ? '이 상품은 주문 생성이 진행 중이라 지금은 수정하거나 삭제할 수 없습니다.' : undefined} onClick={() => void cart.remove(item.key)}>삭제</button></article>;
  })}</div><aside className="summary"><span>선택 상품 합계</span><strong>¥{cnyTotal(cart.items).toFixed(2)}</strong><small>KRW 예상금액은 장바구니에서 제공하지 않습니다.</small><button disabled={invalid || cart.loading} onClick={() => navigate('/checkout')}>주문 제출 전 확인</button></aside><Link to="/products/">다른 상품 보기</Link></main>;
}
