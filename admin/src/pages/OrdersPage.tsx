import { useEffect, useState } from 'react';
import { getOrderDetail, listOrders } from '../api/orders';
import type { IntegrationAttemptDto, OrderInternalDto } from '../api/orders';

export function OrdersPage() {
  const [orders, setOrders] = useState<OrderInternalDto[]>([]);
  const [detail, setDetail] = useState<{ order: OrderInternalDto; integrationAttempts: IntegrationAttemptDto[] } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOrders()
      .then((result) => setOrders(result.items))
      .finally(() => setLoading(false));
  }, []);

  async function openDetail(id: string) {
    const result = await getOrderDetail(id);
    setDetail(result);
  }

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <div style={{ flex: 1 }}>
        <h1>주문</h1>
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>주문번호</th>
                <th style={{ textAlign: 'left' }}>고객상태</th>
                <th style={{ textAlign: 'left' }}>내부상태</th>
                <th style={{ textAlign: 'left' }}>제출일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.orderNo}</td>
                  <td>{o.customerStatus}</td>
                  <td>{o.internalStatus}</td>
                  <td>{o.submittedAt ? new Date(o.submittedAt).toLocaleString('ko-KR') : '-'}</td>
                  <td>
                    <button onClick={() => openDetail(o.id)}>상세</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div style={{ flex: 1, borderLeft: '1px solid #ddd', paddingLeft: 24 }}>
          <h2>주문 상세: {detail.order.orderNo}</h2>
          <p>고객 이메일: {detail.order.customerEmail ?? '-'}</p>
          <p>내부상태: {detail.order.internalStatus}</p>
          <h3>상품</h3>
          <ul>
            {detail.order.items.map((item) => (
              <li key={item.id}>
                {item.titleZh} x{item.qty} — ¥{item.cnyAmount} (판매자: {item.sellerId})
              </li>
            ))}
          </ul>
          <h3>외부 연동 시도 (IntegrationAttempt)</h3>
          {detail.integrationAttempts.length === 0 && <p>기록 없음</p>}
          <ul>
            {detail.integrationAttempts.map((attempt) => (
              <li key={attempt.id}>
                [{attempt.provider}] {attempt.operation} — {attempt.status} (재시도 {attempt.retryCount}회)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
