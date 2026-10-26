import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useCart } from '../cart';
import type { ProductDetail } from '../types';

export function ProductPage() {
  const { offerId = '' } = useParams();
  const cart = useCart();
  const [product, setProduct] = useState<ProductDetail>();
  const [skuId, setSkuId] = useState('');
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setError(''); api.product(offerId).then((value) => { setProduct(value); if (value.skus.length === 1) setSkuId(value.skus[0]!.skuId); setQty(Math.max(1, value.moq ?? 1)); }).catch((e) => setError(e instanceof ApiError && e.status === 401 ? '로그인 세션이 만료되었습니다.' : '상품 정보를 불러오지 못했습니다.')); }, [offerId]);
  const sku = useMemo(() => product?.skus.find((x) => x.skuId === skuId), [product, skuId]);
  if (error && !product) return <main><p role="alert">{error}</p></main>;
  if (!product) return <main>상품 정보를 불러오는 중입니다…</main>;
  const unavailable = !sku || !sku.priceCny || sku.stock === 0 || qty < (product.moq ?? 1) || (sku.stock !== undefined && qty > sku.stock);
  async function handleAdd() {
    if (!sku) return;
    setMessage(''); setError('');
    try { await cart.add({ offerId: product!.offerId, skuId: sku.skuId, qty }); setMessage('장바구니에 담았습니다.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '장바구니에 담지 못했습니다.'); }
  }
  return <main><Link to="/cart">← 장바구니</Link><section className="product"><img className="hero" src={product.imageUrls[0]} alt="" /><div><p className="eyebrow">1688 상품</p><h1>{product.titleTrans || product.titleZh}</h1>{product.titleTrans && <p>{product.titleZh}</p>}<fieldset><legend>SKU 선택</legend>{product.skus.length === 0 ? <p className="warning">선택 가능한 SKU가 없습니다.</p> : product.skus.map((item) => <label className="sku" key={item.skuId}><input type="radio" name="sku" checked={skuId === item.skuId} onChange={() => setSkuId(item.skuId)} /><span>{item.attributes.map((a) => a.valueTrans || a.value).join(' / ') || item.skuId}</span><strong>¥{item.priceCny}</strong><small>{item.stock === 0 ? '품절' : item.stock === undefined ? '재고 확인 필요' : `재고 ${item.stock}`}</small></label>)}</fieldset><label>수량<input className="quantity" type="number" min={product.moq ?? 1} max={sku?.stock} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>{product.moq && <p>최소 주문 수량: {product.moq}개</p>}<button disabled={unavailable || cart.loading} onClick={handleAdd}>{cart.loading ? '처리 중…' : sku?.stock === 0 ? '품절' : '장바구니 담기'}</button>{error && <p role="alert" className="warning">{error}</p>}{message && <p role="status">{message} <Link to="/cart">장바구니 보기</Link></p>}</div></section></main>;
}
