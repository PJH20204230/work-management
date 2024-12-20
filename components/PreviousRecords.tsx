'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkRecord } from '@/types';

export default function PreviousRecords() {
  const [selectedWeek, setSelectedWeek] = useState('');
  const [records, setRecords] = useState<WorkRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleViewPreviousRecord = async () => {
    if (!selectedWeek) {
      setError('주를 선택해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    setRecords(null);

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('로그인이 필요합니다.');
      }
      const user = JSON.parse(userStr);

      // 날짜 처리 로직
      const [year, week] = selectedWeek.split('-W');
      const weekStart = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 조정
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);

      const formattedDate = weekStart.toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', formattedDate)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error(`해당 주차(${formattedDate})의 근무 기록이 없습니다.`);
        }
        throw fetchError;
      }

      setRecords(data);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : '기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
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
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
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