'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkRecord } from '@/types';

export default function PreviousRecords() {
  const [selectedWeek, setSelectedWeek] = useState('');
  const [records, setRecords] = useState<WorkRecord | null>(null);
  const [error, setError] = useState('');

  const handleViewPreviousRecord = async () => {
    if (!selectedWeek) {
      setError('주를 선택해주세요.');
      return;
    }

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('로그인이 필요합니다.');
      }
      const user = JSON.parse(userStr);

      const { data, error: fetchError } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', selectedWeek)
        .single();

      if (fetchError) throw fetchError;
      setRecords(data);
      setError('');
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : '기록을 불러오는데 실패했습니다.');
      setRecords(null);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">이전 근무 기록 보기</h2>
      <div className="space-y-4">
        <div className="flex gap-4">
          <input
            type="week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={handleViewPreviousRecord}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            조회
          </button>
        </div>

        {error && (
          <div className="text-red-500">{error}</div>
        )}

        {records && (
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">총 근무시간</th>
                <th className="px-4 py-2 text-left">남은 근무시간</th>
                <th className="px-4 py-2 text-left">근무 상태</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-2">{formatTime(records.total_work_time)}</td>
                <td className="px-4 py-2">{formatTime(records.remaining_time)}</td>
                <td className="px-4 py-2">{records.work_status}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}