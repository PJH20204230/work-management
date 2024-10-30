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
    setLoading(true);
    setError('');
    setRecords(null);

    try {
      // 1. 로그인 체크
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('로그인이 필요합니다.');
      }

      // 2. 주 선택 확인
      if (!selectedWeek) {
        throw new Error('주를 선택해주세요.');
      }

      const user = JSON.parse(userStr);

      // 3. 날짜 형식 변환 (선택된 주의 월요일 구하기)
      const weekDate = new Date(selectedWeek);
      const day = weekDate.getDay();
      const diff = weekDate.getDate() - day + (day === 0 ? -6 : 1);
      weekDate.setDate(diff);
      weekDate.setHours(0, 0, 0, 0);
      
      const weekStart = weekDate.toISOString().split('T')[0];

      // 4. 해당 주의 근무 기록 조회
      const { data, error: fetchError } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {  // 데이터가 없는 경우
          throw new Error(`${weekStart} 주의 근무 기록이 없습니다.`);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
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
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {formatDate(records.week_start)} 주 근무 기록
            </h3>
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
          </div>
        )}
      </div>
    </div>
  );
}