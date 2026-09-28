import { useEffect, useState } from 'react';
import { getCustomerDetail, listCustomers } from '../api/customers';
import type { AddressAdminDto, CustomerListItemDto } from '../api/customers';

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItemDto[]>([]);
  const [selected, setSelected] = useState<{ profile: CustomerListItemDto; addresses: AddressAdminDto[] } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCustomers()
      .then((result) => setCustomers(result.items))
      .finally(() => setLoading(false));
  }, []);

  async function openDetail(id: string) {
    const detail = await getCustomerDetail(id);
    setSelected(detail);
  }

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <div style={{ flex: 1 }}>
        <h1>고객</h1>
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>이메일</th>
                <th style={{ textAlign: 'left' }}>전화번호</th>
                <th style={{ textAlign: 'left' }}>사업자등록</th>
                <th style={{ textAlign: 'left' }}>배송등록지 수</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.email ?? '-'}</td>
                  <td>{c.phone ?? '-'}</td>
                  <td>{c.businessDocumentStatus}</td>
                  <td>{c.addressCount}</td>
                  <td>
                    <button onClick={() => openDetail(c.id)}>상세</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div style={{ flex: 1, borderLeft: '1px solid #ddd', paddingLeft: 24 }}>
          <h2>고객 상세</h2>
          <p>Shopify Customer ID: {selected.profile.shopifyCustomerId}</p>
          <p>이메일: {selected.profile.email ?? '-'}</p>
          <p>전화번호: {selected.profile.phone ?? '-'}</p>
          <h3>배송등록지</h3>
          {selected.addresses.length === 0 && <p>등록된 배송등록지가 없습니다.</p>}
          <ul>
            {selected.addresses.map((a) => (
              <li key={a.id} style={{ marginBottom: 8 }}>
                <strong>{a.label}</strong> ({a.addressType})
                <br />
                {a.address} {a.addressDetail}
                <br />
                통관고유부호/사업자번호: {a.customsClearanceNo ?? a.businessNo ?? '-'} (마스킹됨)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
