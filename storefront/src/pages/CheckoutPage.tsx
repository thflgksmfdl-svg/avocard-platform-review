import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { cnyTotal, useCart } from '../cart';
import type { Address, ProductDetail } from '../types';

type Validation = { checking: boolean; issues: string[] };
type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string }
  | {
      phase: 'result';
      createdCount: number;
      totalCount: number;
      createdOrderNos: string[];
      failed: Array<{ submissionRequestId: string; sellerId: string; reason: string; canRetry: boolean }>;
      materializing: number;
      pendingReconciliation: number;
    };

export function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [customsType, setCustomsType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [transport, setTransport] = useState<'SEA' | 'AIR' | 'LCL'>('SEA');
  const [memo, setMemo] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [validation, setValidation] = useState<Validation>({ checking: true, issues: [] });
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });
  useEffect(() => { api.addresses().then((list) => { setAddresses(list); const first = list.find((x) => x.isDefault) ?? list[0]; if (first) { setAddressId(first.id); setCustomsType(first.addressType); } }).catch((e) => setSessionError(e instanceof ApiError && e.status === 401 ? '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' : '배송등록지를 불러오지 못했습니다.')); }, []);
  useEffect(() => { if (!cart.items.length) { setValidation({ checking: false, issues: [] }); return; } Promise.all([...new Set(cart.items.map((x) => x.offerId))].map(api.product)).then((products) => setValidation({ checking: false, issues: validate(products, cart.items) })).catch((e) => setValidation({ checking: false, issues: [e instanceof ApiError && e.status === 401 ? '로그인 세션이 만료되었습니다.' : '상품의 현재 가격과 재고를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.'] })); }, [cart.items]);
  const selectedAddress = useMemo(() => addresses.find((x) => x.id === addressId), [addresses, addressId]);
  if (!cart.items.length && submit.phase !== 'result') return <main className="state"><h1>주문 확인</h1><p>확인할 상품이 없습니다.</p><Link to="/cart">장바구니로 돌아가기</Link></main>;
  const blocked = validation.checking || validation.issues.length > 0 || !selectedAddress || !!sessionError || submit.phase === 'submitting';

  async function handleSubmit() {
    if (!selectedAddress) return;
    setSubmit({ phase: 'submitting' });
    try {
      const revalidation = await api.revalidateCartForSubmission();
      if (!revalidation.ok) {
        setSubmit({ phase: 'error', message: revalidation.issues.map((i) => i.reason).join(' ') || '장바구니 상품을 확인하지 못했습니다.' });
        return;
      }
      const response = await api.submitOrder({
        customsType,
        transportMode: transport,
        recipientSnapshot: { addressId: selectedAddress.id, label: selectedAddress.label, recipientName: selectedAddress.recipientName, recipientPhone: selectedAddress.recipientPhone, postalCode: selectedAddress.postalCode, address: selectedAddress.address, addressDetail: selectedAddress.addressDetail, customsClearanceNo: selectedAddress.customsClearanceNo, businessName: selectedAddress.businessName, businessNo: selectedAddress.businessNo },
        customerMemo: memo || undefined,
      });
      // One submit can yield independent per-seller outcomes — a failure on
      // one seller group must never hide or block the orders that DID
      // succeed (09_CANONICAL_DECISIONS.md order-recovery addendum §4: "B
      // 실패 때문에 A/C를 막지 않는다").
      setSubmit({
        phase: 'result',
        createdCount: response.createdOrders.length,
        totalCount: response.createdOrders.length + response.failedRequests.length + response.pendingReconciliation.length + response.materializingRequests.length,
        createdOrderNos: response.createdOrders.map((o) => o.orderNo),
        failed: response.failedRequests,
        materializing: response.materializingRequests.length,
        pendingReconciliation: response.pendingReconciliation.length,
      });
      await cart.reload();
    } catch (cause) {
      const message = cause instanceof ApiError
        ? (cause.status === 401 ? '로그인 세션이 만료되었습니다.' : cause.message)
        : '주문 제출에 실패했습니다.';
      setSubmit({ phase: 'error', message });
    }
  }

  if (submit.phase === 'result') {
    return <main className="state">
      <h1>{submit.totalCount}건 중 {submit.createdCount}건의 주문이 생성되었습니다.</h1>
      {submit.createdOrderNos.length > 0 && <section>
        <h2>생성된 주문</h2>
        <ul>{submit.createdOrderNos.map((no) => <li key={no}><strong>{no}</strong> — 바로 결제할 수 있습니다.</li>)}</ul>
      </section>}
      {submit.failed.length > 0 && <section>
        <h2 role="alert">실패한 상품</h2>
        <ul>{submit.failed.map((f) => <li key={f.submissionRequestId} className="warning">
          {f.sellerId} 상품: {f.reason}
          {f.canRetry && <button onClick={() => navigate('/cart')}>장바구니에서 확인 후 다시 제출</button>}
        </li>)}</ul>
      </section>}
      {submit.materializing > 0 && <p className="notice">{submit.materializing}건은 주문 생성이 완료되어 주문내역에 반영 중입니다. 잠시 후 주문 내역에서 확인해 주세요.</p>}
      {submit.pendingReconciliation > 0 && <p className="notice">{submit.pendingReconciliation}건은 처리 결과를 확인하고 있습니다. 중복 주문 방지를 위해 다시 제출하지 마세요.</p>}
      <Link to="/cart">장바구니로 돌아가기</Link>
      <button onClick={() => navigate('/orders')}>주문 내역 보기</button>
    </main>;
  }

  return <main><Link to="/cart">← 장바구니 수정</Link><h1>주문 제출 전 확인</h1><p className="notice">제출 후 상품과 수량은 수정할 수 없습니다. 이 화면은 결제 화면이 아닙니다.</p>{sessionError && <p role="alert" className="warning">{sessionError}</p>}{validation.checking ? <p>현재 가격과 재고를 확인하고 있습니다…</p> : validation.issues.map((x) => <p role="alert" className="warning" key={x}>{x}</p>)}<section><h2>상품 스냅샷</h2>{cart.items.map((item) => <article className="snapshot" key={item.key}><span>{item.titleKo || item.titleZh}</span><span>{item.optionSnapshot.map((a) => a.valueTrans || a.value).join(' / ')}</span><span>{item.qty}개</span><strong>¥{(Number(item.cnyUnitPrice) * item.qty).toFixed(2)}</strong></article>)}<p className="total">CNY 상품금액 합계 <strong>¥{cnyTotal(cart.items).toFixed(2)}</strong></p></section><section className="form"><h2>수취 및 운송 정보</h2><label>배송등록지<select value={addressId} onChange={(e) => { setAddressId(e.target.value); const a = addresses.find((x) => x.id === e.target.value); if (a) setCustomsType(a.addressType); }}><option value="">선택해 주세요</option>{addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.address}</option>)}</select></label>{!addresses.length && <p>저장된 배송등록지가 없습니다. 계정에서 배송등록지를 먼저 추가해 주세요.</p>}<label>통관 유형<select value={customsType} onChange={(e) => setCustomsType(e.target.value as 'PERSONAL' | 'BUSINESS')}><option value="PERSONAL">개인통관</option><option value="BUSINESS">사업자통관</option></select></label><label>운송 방식<select value={transport} onChange={(e) => setTransport(e.target.value as 'SEA' | 'AIR' | 'LCL')}><option value="SEA">해운</option><option value="AIR">항공</option>{customsType === 'BUSINESS' && <option value="LCL">LCL</option>}</select></label><label>고객 메모<textarea value={memo} onChange={(e) => setMemo(e.target.value)} /></label></section>{submit.phase === 'error' && <p role="alert" className="warning">{submit.message}</p>}<button disabled={blocked} title={blocked ? '입력 또는 상품 상태를 확인해 주세요.' : undefined} onClick={handleSubmit}>{submit.phase === 'submitting' ? '제출 중…' : '주문 제출'}</button><p className="notice">[임시 UI] 이 버튼을 누르면 실제로 1688에 주문이 생성됩니다(로컬 테스트 전용 환경에서만 동작). 최종 디자인과 결제 연동 UI는 후속 UI 작업에서 완성됩니다.</p></main>;
}

function validate(products: ProductDetail[], items: ReturnType<typeof useCart>['items']) {
  const issues: string[] = [];
  for (const item of items) {
    const product = products.find((x) => x.offerId === item.offerId);
    const sku = product?.skus.find((x) => x.skuId === item.skuId);
    if (!sku || sku.stock === 0) issues.push(`${item.titleKo || item.titleZh}: 선택한 SKU가 품절되었거나 판매되지 않습니다.`);
    else if (!sku.priceCny) issues.push(`${item.titleKo || item.titleZh}: 현재 가격을 확인할 수 없습니다.`);
    else if (sku.priceCny !== item.cnyUnitPrice) issues.push(`${item.titleKo || item.titleZh}: 가격이 ¥${item.cnyUnitPrice}에서 ¥${sku.priceCny}(으)로 변경되었습니다.`);
    else if (sku.stock !== undefined && sku.stock < item.qty) issues.push(`${item.titleKo || item.titleZh}: 재고가 선택 수량보다 부족합니다.`);
  }
  return issues;
}

