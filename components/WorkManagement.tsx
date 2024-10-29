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

  const handleWorkAction = async (action: string, isManual: boolean = false) => {
    try {
      setLoading(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('로그인이 필요합니다.');
      }

      const currentWeekStart = new Date();
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
      currentWeekStart.setHours(0, 0, 0, 0);

      let clockTime = new Date();
      if (isManual && manualTime) {
        clockTime = new Date(manualTime);
      }

      if (action.includes('출근')) {
        const { error: updateError } = await supabase
          .from('work_records')
          .upsert({
            user_id: session.user.id,
            week_start: currentWeekStart.toISOString(),
            work_status: '출근',
            last_clock_in: clockTime.toISOString(),
            last_clock_in_time: clockTime.toTimeString().split(' ')[0]
          });

        if (updateError) throw updateError;
      } else if (action.includes('퇴근')) {
        // 현재 근무 기록 조회
        const { data: currentRecord, error: fetchError } = await supabase
          .from('work_records')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('week_start', currentWeekStart.toISOString())
          .single();

        if (fetchError) throw fetchError;
        if (!currentRecord.last_clock_in) {
          throw new Error('출근 기록이 없습니다.');
        }

        const lastClockIn = new Date(currentRecord.last_clock_in);
        if (clockTime <= lastClockIn) {
          throw new Error('퇴근 시간은 출근 시간보다 이후여야 합니다.');
        }

        const workDuration = Math.floor((clockTime.getTime() - lastClockIn.getTime()) / (1000 * 60));
        const newTotalWorkTime = currentRecord.total_work_time + workDuration;
        const newRemainingTime = Math.max(0, 1200 - newTotalWorkTime);  // 20시간 = 1200분

        const { error: updateError } = await supabase
          .from('work_records')
          .update({
            work_status: '퇴근',
            total_work_time: newTotalWorkTime,
            remaining_time: newRemainingTime
          })
          .eq('id', currentRecord.id);

        if (updateError) throw updateError;
      }

      onUpdate();
      if (isManual) {
        setManualTime('');
      }
    } catch (err: any) {
      setError(err.message);
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