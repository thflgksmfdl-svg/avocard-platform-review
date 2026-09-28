import { useAuth } from '../state/authStore';

export function DashboardPage() {
  const { admin } = useAuth();

  return (
    <div>
      <h1>대시보드</h1>
      <p>{admin?.display_name}님, 환영합니다.</p>
      <p style={{ color: '#888', fontSize: 14 }}>
        이 페이지는 자리 표시용입니다. 실제 통계/위젯은 이후 스프린트에서 추가됩니다.
      </p>
    </div>
  );
}
