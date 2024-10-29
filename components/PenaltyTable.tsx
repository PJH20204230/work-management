import { useState, useEffect } from 'react';
import { UserWorkStatus } from '@/types';
import { supabase } from '@/lib/supabase';

interface PenaltyTableProps {
  users: UserWorkStatus[];
}

export default function PenaltyTable({ users }: PenaltyTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 현재 로그인한 사용자의 ID를 가져오는 함수
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      }
    };
    getCurrentUser();
  }, []);

  const handleSettlement = async (userId: string, username: string) => {
    try {
      // 현재 사용자가 로그인하지 않았거나, 자신의 벌금이 아닌 경우 정산 불가
      if (!currentUserId || userId !== currentUserId) {
        setError('자신의 벌금만 정산할 수 있습니다.');
        return;
      }

      setLoading(userId);
      setError(null);

      const response = await fetch('/api/penalty/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('정산 처리 중 오류가 발생했습니다.');
      }

      // 페이지 새로고침으로 데이터 갱신
      window.location.reload();
    } catch (err: any) {
      setError(`${username}님의 정산 처리 중 오류가 발생했습니다.`);
      console.error('Settlement error:', err);
    } finally {
      setLoading(null);
    }
  };

  // 버튼 활성화 여부를 확인하는 함수
  const isSettlementEnabled = (userId: string, penaltyAmount: number = 0) => {
    return (
      currentUserId === userId && // 현재 사용자의 벌금인지
      penaltyAmount > 0 && // 벌금이 있는지
      loading !== userId // 처리 중이 아닌지
    );
  };

  // 버튼 텍스트를 반환하는 함수
  const getButtonText = (userId: string, penaltyAmount: number = 0) => {
    if (loading === userId) return '처리중...';
    if (currentUserId !== userId) return '정산 불가';
    if (penaltyAmount <= 0) return '정산 완료';
    return '정산하기';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">근무 패널티</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">사용자명</th>
              <th className="px-4 py-2 text-left">누적 벌금</th>
              <th className="px-4 py-2 text-left">추가 시간</th>
              <th className="px-4 py-2 text-left">작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const penaltyAmount = user.penaltyRecord?.accumulated_penalty ?? 0;
              return (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-2">{user.username}</td>
                  <td className="px-4 py-2">
                    {penaltyAmount.toLocaleString()}원
                  </td>
                  <td className="px-4 py-2">
                    {user.penaltyRecord?.additional_hours ?? 10}시간
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleSettlement(user.id, user.username)}
                      disabled={!isSettlementEnabled(user.id, penaltyAmount)}
                      className={`px-3 py-1 rounded text-sm ${
                        isSettlementEnabled(user.id, penaltyAmount)
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {getButtonText(user.id, penaltyAmount)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}