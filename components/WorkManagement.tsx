'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getWeekStart, formatDateTime, formatTime } from '@/lib/dateUtils';

interface WorkManagementProps {
  onUpdate: () => void;
}

export default function WorkManagement({ onUpdate }: WorkManagementProps) {
  const [manualTime, setManualTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [error, setError] = useState('');

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
      const clockTime = isManual && manualTime ? new Date(manualTime) : new Date();
      const formattedWeekStart = weekStart.toISOString().split('T')[0];

      // 현재 주의 근무 기록 조회
      const { data: existingRecord } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', formattedWeekStart)
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
              week_start: formattedWeekStart,
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

        // work_records 업데이트
        const { error: updateError } = await supabase
          .from('work_records')
          .update({
            work_status: '퇴근',
            total_work_time: newTotalWorkTime,
            remaining_time: newRemainingTime
          })
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;

        // latest_work_increases 테이블 업데이트
        const { data: existingIncrease, error: fetchError } = await supabase
          .from('latest_work_increases')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (existingIncrease) {
          const { error: increaseUpdateError } = await supabase
            .from('latest_work_increases')
            .update({
              increased_time: workDuration,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

          if (increaseUpdateError) throw increaseUpdateError;
        } else {
          const { error: increaseInsertError } = await supabase
            .from('latest_work_increases')
            .insert({
              user_id: user.id,
              increased_time: workDuration
            });

          if (increaseInsertError) throw increaseInsertError;
        }
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

  const handleUndo = async () => {
    try {
      setUndoLoading(true);
      setError('');

      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('로그인이 필요합니다.');
      }
      const user = JSON.parse(userStr);

      const weekStart = getWeekStart();
      const formattedWeekStart = weekStart.toISOString().split('T')[0];

      // 현재 work_record 조회
      const { data: workRecord, error: workError } = await supabase
        .from('work_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', formattedWeekStart)
        .single();

      if (workError) {
        throw new Error('현재 근무 기록을 찾을 수 없습니다.');
      }

      // 출근 상태일 때는 실행취소 불가능
      if (workRecord.work_status === '출근') {
        throw new Error('현재 출근 중인 상태에서는 실행취소할 수 없습니다.');
      }

      // 증가된 시간 조회
      const { data: increaseRecord, error: fetchError } = await supabase
        .from('latest_work_increases')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error('최근 기록을 찾을 수 없습니다.');
      }

      if (!increaseRecord || increaseRecord.increased_time === 0) {
        throw new Error('되돌릴 기록이 없습니다.');
      }

      // 음수 값 방지 체크
      if (workRecord.total_work_time < increaseRecord.increased_time) {
        throw new Error('실행취소할 수 없는 상태입니다.');
      }

      // work_record 업데이트
      const newTotalWorkTime = workRecord.total_work_time - increaseRecord.increased_time;
      const newRemainingTime = workRecord.remaining_time + increaseRecord.increased_time;

      const { error: updateError } = await supabase
        .from('work_records')
        .update({
          total_work_time: newTotalWorkTime,
          remaining_time: newRemainingTime
        })
        .eq('id', workRecord.id);

      if (updateError) throw updateError;

      // increased_time 초기화
      const { error: resetError } = await supabase
        .from('latest_work_increases')
        .update({
          increased_time: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', increaseRecord.id);

      if (resetError) throw resetError;

      onUpdate();
    } catch (err) {
      console.error('Undo error:', err);
      setError(err instanceof Error ? err.message : '실행취소 중 오류가 발생했습니다.');
    } finally {
      setUndoLoading(false);
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
            disabled={loading || undoLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            출근
          </button>
          <button
            onClick={() => handleWorkAction('퇴근')}
            disabled={loading || undoLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            퇴근
          </button>
          <button
            onClick={handleUndo}
            disabled={loading || undoLoading}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            {undoLoading ? '처리중...' : '실행취소'}
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
              disabled={loading || undoLoading || !manualTime}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              출근 시간 입력
            </button>
            <button
              onClick={() => handleWorkAction('퇴근 시간 입력', true)}
              disabled={loading || undoLoading || !manualTime}
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