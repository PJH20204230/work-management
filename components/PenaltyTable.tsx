'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserWorkStatus } from '@/types';

interface PenaltyTableProps {
  users: UserWorkStatus[];
  onRefresh: () => void;
}

export default function PenaltyTable({ users, onRefresh }: PenaltyTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSettlement = async (userId: string, username: string) => {
    try {
      if (!currentUser.id || userId !== currentUser.id) {
        throw new Error('자신의 벌금만 정산할 수 있습니다.');
      }

      setLoading(userId);
      setError(null);

      const { error: updateError } = await supabase
        .from('penalty_records')
        .update({ accumulated_penalty: 0 })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${username}님의 정산 처리 중 오류가 발생했습니다.`);
      console.error('Settlement error:', err);
    } finally {
      setLoading(null);
    }
  };

  const isSettlementEnabled = (userId: string, penaltyAmount: number = 0) => {
    return (
      currentUser.id === userId && 
      penaltyAmount > 0 && 
      loading !== userId
    );
  };

  const getButtonText = (userId: string, penaltyAmount: number = 0) => {
    if (loading === userId) return '처리중...';
    if (currentUser.id !== userId) return '정산 불가';
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