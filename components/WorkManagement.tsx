'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface WorkManagementProps {
  onUpdate: () => void;
}

export default function WorkManagement({ onUpdate }: WorkManagementProps) {
  const [manualTime, setManualTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 주의 시작일을 정확히 계산하는 함수
  const getWeekStart = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatDateTime = (date: Date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };

  const formatTime = (date: Date) => {
    return date.toTimeString().split(' ')[0];
  };

  const handleWorkAction = async (action: string, isManual: boolean = false) => {
    try {
      setLoading(true);
      setError('');

      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('로그인이 필요합니다.');
      }
      const user = JSON.parse(userStr);

      const weekStart = getWeekStart();
      const clockTime = isManual && manualTime ? new Date(manualTime) : new Date();  // let을 const로 변경

      // 현재 주의 근무 기록 조회
      const { data: existingRecord } = await supabase  // fetchError 제거
        .from('work_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart.toISOString())
        .single();

      if (action === '출근' || action === '출근 시간 입력') {
        const updateData = {
          work_status: '출근',
          last_clock_in: formatDateTime(clockTime),
          last_clock_in_time: formatTime(clockTime)
        };

        if (existingRecord) {
          const { error: updateError } = await supabase
            .from('work_records')
            .update(updateData)
            .eq('id', existingRecord.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('work_records')
            .insert({
              user_id: user.id,
              week_start: weekStart.toISOString(),
              total_work_time: 0,
              remaining_time: 1200,
              ...updateData
            });

          if (insertError) throw insertError;
        }
      } else if (action === '퇴근' || action === '퇴근 시간 입력') {
        if (!existingRecord || !existingRecord.last_clock_in) {
          throw new Error('출근 기록이 없습니다.');
        }

        const lastClockIn = new Date(existingRecord.last_clock_in);
        if (clockTime <= lastClockIn) {
          throw new Error(`퇴근 시간은 마지막 출근 시간(${formatDateTime(lastClockIn)}) 이후여야 합니다.`);
        }

        const workDuration = Math.floor((clockTime.getTime() - lastClockIn.getTime()) / (1000 * 60));
        const newTotalWorkTime = existingRecord.total_work_time + workDuration;
        const newRemainingTime = Math.max(0, 1200 - newTotalWorkTime);

        const { error: updateError } = await supabase
          .from('work_records')
          .update({
            work_status: '퇴근',
            total_work_time: newTotalWorkTime,
            remaining_time: newRemainingTime
          })
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      }

      onUpdate();
      if (isManual) {
        setManualTime('');
      }
    } catch (err) {
      console.error('Work action error:', err);
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">출퇴근 관리</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => handleWorkAction('출근')}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            출근
          </button>
          <button
            onClick={() => handleWorkAction('퇴근')}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            퇴근
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">직접 입력</h3>
          <div className="flex gap-4">
            <input
              type="datetime-local"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              className="flex-1 px-3 py-2 border rounded"
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => handleWorkAction('출근 시간 입력', true)}
              disabled={loading || !manualTime}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              출근 시간 입력
            </button>
            <button
              onClick={() => handleWorkAction('퇴근 시간 입력', true)}
              disabled={loading || !manualTime}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              퇴근 시간 입력
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}