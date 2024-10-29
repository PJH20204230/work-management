import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = getServiceSupabase();
    const { action, manualTime } = await request.json();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const userId = session.user.id;
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
    currentWeekStart.setHours(0, 0, 0, 0);

    const { data: recordData, error: fetchError } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', currentWeekStart.toISOString())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let currentRecordData = recordData;
    if (!currentRecordData) {
      const { data: newRecord, error: insertError } = await supabase
        .from('work_records')
        .insert({
          user_id: userId,
          week_start: currentWeekStart.toISOString(),
          total_work_time: 0,
          remaining_time: 1200,
          work_status: '퇴근'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      currentRecordData = newRecord;
    }

    const clockTime = manualTime ? new Date(manualTime) : new Date();

    if (action === '출근' || action === '출근 시간 입력') {
      const { error } = await supabase
        .from('work_records')
        .update({
          work_status: '출근',
          last_clock_in: clockTime.toISOString(),
          last_clock_in_time: clockTime.toTimeString().split(' ')[0]
        })
        .eq('id', currentRecordData.id);

      if (error) throw error;
    } else if (action === '퇴근' || action === '퇴근 시간 입력') {
      if (!currentRecordData.last_clock_in) {
        return NextResponse.json({ error: '출근 기록이 없습니다.' }, { status: 400 });
      }

      const lastClockIn = new Date(currentRecordData.last_clock_in);
      if (clockTime <= lastClockIn) {
        return NextResponse.json({ 
          error: '퇴근 시간은 출근 시간보다 이후여야 합니다.' 
        }, { status: 400 });
      }

      const workDuration = Math.floor((clockTime.getTime() - lastClockIn.getTime()) / (1000 * 60));
      const newTotalWorkTime = currentRecordData.total_work_time + workDuration;
      const newRemainingTime = Math.max(0, 1200 - newTotalWorkTime);

      const { error } = await supabase
        .from('work_records')
        .update({
          work_status: '퇴근',
          total_work_time: newTotalWorkTime,
          remaining_time: newRemainingTime
        })
        .eq('id', currentRecordData.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
}