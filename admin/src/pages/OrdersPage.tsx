import { useEffect, useState } from 'react';
import {
  addOrderNote,
  assignOperator,
  getOrderDetail,
  listOperators,
  listOrders,
} from '../api/orders';
import type {
  AdminOperatorDto,
  AuditLogDto,
  IntegrationAttemptDto,
  OrderInternalDto,
  OrderListFilters,
  OrderNoteDto,
} from '../api/orders';

const CUSTOMER_STATUSES = [
  'QUOTE_PENDING',
  'PAYMENT_PENDING',
  'PAID',
  'AWAITING_ARRIVAL',
  'ARRIVED',
  'ARRIVAL_ERROR',
  'AWAITING_SHIPMENT',
  'SHIPPED',
];

export function OrdersPage() {
  const [orders, setOrders] = useState<OrderInternalDto[]>([]);
  const [total, setTotal] = useState(0);
  const [operators, setOperators] = useState<AdminOperatorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{
    order: OrderInternalDto;
    integrationAttempts: IntegrationAttemptDto[];
    notes: OrderNoteDto[];
    auditLog: AuditLogDto[];
  } | null>(null);

  const [filters, setFilters] = useState<OrderListFilters>({ page: 1, pageSize: 20 });

  function refreshOrders(nextFilters: OrderListFilters) {
    setLoading(true);
    listOrders(nextFilters)
      .then((result) => {
        setOrders(result.items);
        setTotal(result.total);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshOrders(filters);
    listOperators().then(setOperators);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    refreshOrders(next);
  }

  function resetFilters() {
    const next: OrderListFilters = { page: 1, pageSize: 20 };
    setFilters(next);
    refreshOrders(next);
  }

  async function openDetail(id: string) {
    const result = await getOrderDetail(id);
    setDetail(result);
  }

  async function refreshDetail(id: string) {
    const result = await getOrderDetail(id);
    setDetail(result);
  }

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>주문</h1>

        <form
          onSubmit={applyFilters}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}
        >
          <input
            placeholder="주문번호 / 이메일 / 메모 검색"
            value={filters.search ?? ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
            style={{ width: 220 }}
          />
          <select
            value={filters.customerStatus ?? ''}
            onChange={(e) => setFilters({ ...filters, customerStatus: e.target.value || undefined })}
          >
            <option value="">고객상태 전체</option>
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filters.paymentMethod ?? ''}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value || undefined })}
          >
            <option value="">결제수단 전체</option>
            <option value="CARD">카드</option>
            <option value="BANK_TRANSFER">계좌이체</option>
          </select>
          <select
            value={filters.assignedOperatorId ?? ''}
            onChange={(e) => setFilters({ ...filters, assignedOperatorId: e.target.value || undefined })}
          >
            <option value="">담당자 전체</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.displayName}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 14 }}>
            <input
              type="checkbox"
              checked={filters.hasApiError ?? false}
              onChange={(e) => setFilters({ ...filters, hasApiError: e.target.checked || undefined })}
            />{' '}
            API 오류만
          </label>
          <label style={{ fontSize: 14 }}>
            <input
              type="checkbox"
              checked={filters.hasRefundInProgress ?? false}
              onChange={(e) =>
                setFilters({ ...filters, hasRefundInProgress: e.target.checked || undefined })
              }
            />{' '}
            환불 진행중만
          </label>
          <input
            type="date"
            value={filters.submittedFrom ?? ''}
            onChange={(e) => setFilters({ ...filters, submittedFrom: e.target.value || undefined })}
          />
          <span>~</span>
          <input
            type="date"
            value={filters.submittedTo ?? ''}
            onChange={(e) => setFilters({ ...filters, submittedTo: e.target.value || undefined })}
          />
          <button type="submit">검색</button>
          <button type="button" onClick={resetFilters}>
            초기화
          </button>
        </form>

        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#666' }}>총 {total}건</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>주문번호</th>
                  <th style={{ textAlign: 'left' }}>고객</th>
                  <th style={{ textAlign: 'left' }}>고객상태</th>
                  <th style={{ textAlign: 'left' }}>결제수단</th>
                  <th style={{ textAlign: 'left' }}>담당자</th>
                  <th style={{ textAlign: 'left' }}>제출일</th>
                  <th style={{ textAlign: 'left' }}>오류</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const operator = operators.find((op) => op.id === o.assignedOperatorId);
                  return (
                    <tr key={o.id}>
                      <td>{o.orderNo}</td>
                      <td>{o.customerEmail ?? '-'}</td>
                      <td>{o.customerStatus}</td>
                      <td>{o.paymentMethod ?? '-'}</td>
                      <td>{operator?.displayName ?? '미배정'}</td>
                      <td>{o.submittedAt ? new Date(o.submittedAt).toLocaleString('ko-KR') : '-'}</td>
                      <td>
                        {o.errorSummaries.length === 0 ? (
                          '-'
                        ) : (
                          <span
                            title={o.errorSummaries.map((s) => `${s.reason} (${s.count}회)`).join(', ')}
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: '#fdecea',
                              color: '#b3261e',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'default',
                            }}
                          >
                            ⚠ {o.errorSummaries[0]!.reason}
                            {o.errorSummaries.length > 1 ? ` 외 ${o.errorSummaries.length - 1}건` : ''}
                          </span>
                        )}
                      </td>
                      <td>
                        <button onClick={() => openDetail(o.id)}>상세</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {detail && (
        <OrderDetailPanel
          detail={detail}
          operators={operators}
          onChanged={() => refreshDetail(detail.order.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function OrderDetailPanel({
  detail,
  operators,
  onChanged,
  onClose,
}: {
  detail: {
    order: OrderInternalDto;
    integrationAttempts: IntegrationAttemptDto[];
    notes: OrderNoteDto[];
    auditLog: AuditLogDto[];
  };
  operators: AdminOperatorDto[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingOperator, setSavingOperator] = useState(false);

  async function handleAssign(operatorId: string) {
    setSavingOperator(true);
    try {
      await assignOperator(detail.order.id, operatorId || null);
      onChanged();
    } finally {
      setSavingOperator(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      await addOrderNote(detail.order.id, noteBody.trim());
      setNoteBody('');
      onChanged();
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid #ddd', paddingLeft: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2>주문 상세: {detail.order.orderNo}</h2>
        <button onClick={onClose} title="목록으로 돌아가기" style={{ fontSize: 16, lineHeight: 1, padding: '4px 10px' }}>
          ✕
        </button>
      </div>
      <p>고객 이메일: {detail.order.customerEmail ?? '-'}</p>
      <p>고객상태: {detail.order.customerStatus}</p>
      <p>내부상태: {detail.order.internalStatus}</p>
      <p>고객 제출메모: {detail.order.customerMemo ?? '-'}</p>

      {detail.order.errorSummaries.length > 0 && (
        <div
          style={{
            background: '#fdecea',
            border: '1px solid #f5c6c3',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <h3 style={{ marginTop: 0, color: '#b3261e' }}>⚠ API 오류</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {detail.order.errorSummaries.map((s) => (
              <li key={`${s.provider}-${s.operation}`} style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>{s.reason}</strong> — {s.count}회, 마지막 발생{' '}
                {new Date(s.lastOccurredAt).toLocaleString('ko-KR')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>담당자</h3>
      <select
        value={detail.order.assignedOperatorId ?? ''}
        onChange={(e) => handleAssign(e.target.value)}
        disabled={savingOperator}
      >
        <option value="">미배정</option>
        {operators.map((op) => (
          <option key={op.id} value={op.id}>
            {op.displayName} ({op.email})
          </option>
        ))}
      </select>

      <h3>상품</h3>
      <ul>
        {detail.order.items.map((item) => (
          <li key={item.id}>
            {item.titleZh} x{item.qty} — ¥{item.cnyAmount} (판매자: {item.sellerId})
          </li>
        ))}
      </ul>

      <h3>내부메모</h3>
      <ul style={{ paddingLeft: 16, listStyle: 'none' }}>
        {detail.notes.length === 0 && <li style={{ color: '#888' }}>메모 없음</li>}
        {detail.notes.map((note) => (
          <li key={note.id} style={{ marginBottom: 8, fontSize: 13, borderBottom: '1px dashed #eee', paddingBottom: 8 }}>
            <div>{note.body}</div>
            <div style={{ color: '#888' }}>
              {note.createdBy} · {new Date(note.createdAt).toLocaleString('ko-KR')}
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8 }}>
        <input
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="내부메모 추가"
          style={{ flex: 1 }}
          disabled={savingNote}
        />
        <button type="submit" disabled={savingNote || !noteBody.trim()}>
          추가
        </button>
      </form>

      <h3>외부 연동 시도 (IntegrationAttempt)</h3>
      {detail.integrationAttempts.length === 0 && <p>기록 없음</p>}
      <ul>
        {detail.integrationAttempts.map((attempt) => (
          <li key={attempt.id}>
            [{attempt.provider}] {attempt.operation} — {attempt.status} (재시도 {attempt.retryCount}회)
          </li>
        ))}
      </ul>

      <h3>수정 이력 (감사로그)</h3>
      {detail.auditLog.length === 0 && <p>기록 없음</p>}
      <ul style={{ paddingLeft: 16, listStyle: 'none', fontSize: 12 }}>
        {detail.auditLog.map((log) => {
          const actorLabel =
            log.actorType === 'ADMIN'
              ? operators.find((op) => op.id === log.actorId)?.displayName ?? log.actorId ?? '알수없음'
              : log.actorType;
          return (
            <li key={log.id} style={{ marginBottom: 6, borderBottom: '1px dashed #eee', paddingBottom: 6 }}>
              <div>
                <strong>{log.action}</strong> — {actorLabel}
              </div>
              <div style={{ color: '#888' }}>{new Date(log.createdAt).toLocaleString('ko-KR')}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
