import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createExchangeRate, listExchangeRates } from '../api/exchangeRate';
import type { ExchangeRateDto } from '../api/exchangeRate';
import { ApiError } from '../api/client';

export function ExchangeRatePage() {
  const [rates, setRates] = useState<ExchangeRateDto[]>([]);
  const [rate, setRate] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const result = await listExchangeRates();
      setRates(result.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createExchangeRate(rate, new Date(effectiveAt).toISOString());
      setRate('');
      setEffectiveAt('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '환율 등록에 실패했습니다.');
    }
  }

  return (
    <div>
      <h1>환율 관리</h1>
      <p style={{ color: '#888', fontSize: 14 }}>
        환율은 수정 불가(insert-only)입니다. 새 값은 새 레코드로 추가되며, 이전 레코드는 그대로 유지됩니다.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <input
          type="text"
          placeholder="예: 195.00"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
        <input
          type="datetime-local"
          value={effectiveAt}
          onChange={(e) => setEffectiveAt(e.target.value)}
          required
        />
        <button type="submit">새 환율 등록</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>통화쌍</th>
              <th style={{ textAlign: 'left' }}>환율</th>
              <th style={{ textAlign: 'left' }}>적용시각</th>
              <th style={{ textAlign: 'left' }}>등록자</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.currencyPair}</td>
                <td>{r.rate}</td>
                <td>{new Date(r.effectiveAt).toLocaleString('ko-KR')}</td>
                <td>{r.enteredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
