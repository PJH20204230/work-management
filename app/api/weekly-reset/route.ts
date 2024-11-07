import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getWeekStart } from '@/lib/dateUtils';

export async function POST() {
  try {
    const supabase = getServiceSupabase();
    const currentWeekStart = getWeekStart();
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    console.log('Weekly reset started:', { 
      currentWeekStart: currentWeekStart.toISOString(),
      previousWeekStart: previousWeekStart.toISOString() 
    });

    // 1. 이전 주의 출근 상태인 사용자 처리 (퇴근 안 찍은 사용자)
    const { data: clockedInUsers, error: clockedInError } = await supabase
      .from('work_records')
      .select('*')
      .eq('week_start', previousWeekStart.toISOString())
      .eq('work_status', '출근');

    if (clockedInError) {
      console.error('Error fetching clocked in users:', clockedInError);
    }

    for (const user of clockedInUsers || []) {
      const lastClockIn = new Date(user.last_clock_in);
      const now = new Date();
      const workDuration = Math.floor((now.getTime() - lastClockIn.getTime()) / (1000 * 60));

      const newTotalWorkTime = user.total_work_time + workDuration;
      
      await supabase
        .from('work_records')
        .update({
          total_work_time: newTotalWorkTime,
          remaining_time: Math.max(0, 1200 - newTotalWorkTime),
          work_status: '퇴근'
        })
        .eq('id', user.id);
    }

    // 2. 이전 주 근무 기록 확인하고 벌금/추가시간 처리
    const { data: previousRecords, error: previousError } = await supabase
      .from('work_records')
      .select('*')
      .eq('week_start', previousWeekStart.toISOString());  // 직전 주차만 조회하도록 수정

    if (previousError) {
      console.error('Error fetching previous records:', previousError);
    }

    console.log('Processing previous week records:', previousRecords?.length || 0);

    for (const record of previousRecords || []) {
      if (record.total_work_time < 1200) {
        const { data: penaltyRecord, error: penaltyError } = await supabase
          .from('penalty_records')
          .select('*')
          .eq('user_id', record.user_id)
          .single();

        if (penaltyError) {
          console.error('Error fetching penalty record:', { userId: record.user_id, error: penaltyError });
          continue;
        }

        if (penaltyRecord) {
          const actualWorkMinutes = record.total_work_time;
          const shortfallMinutes = 1200 - actualWorkMinutes;
          
          let penalty = 0;
          let remainingExtraHours = penaltyRecord.additional_hours;

          if (shortfallMinutes > 0) {
            const neededExtraHours = Math.ceil(shortfallMinutes / 60);
            
            if (remainingExtraHours >= neededExtraHours) {
              // 추가시간으로 부족한 시간을 채울 수 있는 경우
              remainingExtraHours -= neededExtraHours;
            } else {
              // 추가시간을 모두 사용하고도 부족한 경우
              const finalTotalMinutes = actualWorkMinutes + (remainingExtraHours * 60);
              remainingExtraHours = 0;

              if (finalTotalMinutes < 600) { // 10시간 미만
                penalty = 10000;
              } else if (finalTotalMinutes < 1200) { // 10시간 이상 20시간 미만
                penalty = 5000;
              }
            }
          }

          console.log('Updating penalty record:', {
            userId: record.user_id,
            previousPenalty: penaltyRecord.accumulated_penalty,
            newPenalty: penaltyRecord.accumulated_penalty + penalty,
            previousExtraHours: penaltyRecord.additional_hours,
            newExtraHours: remainingExtraHours
          });

          // 벌금과 남은 추가시간 업데이트
          const { error: updateError } = await supabase
            .from('penalty_records')
            .update({
              accumulated_penalty: penaltyRecord.accumulated_penalty + penalty,
              additional_hours: remainingExtraHours
            })
            .eq('user_id', record.user_id);

          if (updateError) {
            console.error('Error updating penalty record:', { userId: record.user_id, error: updateError });
          }
        }
      }
    }

    // 3. 새로운 주차의 레코드 생성
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // 모든 사용자에 대해 새로운 주차 레코드 생성
    for (const user of users || []) {
      const { error: insertError } = await supabase
        .from('work_records')
        .insert({
          user_id: user.id,
          week_start: currentWeekStart.toISOString(),
          total_work_time: 0,
          remaining_time: 1200,
          work_status: '퇴근'
        });

      if (insertError) {
        console.error('Error creating new week record:', { userId: user.id, error: insertError });
      }
    }

    console.log('Weekly reset completed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Weekly reset error:', error);
    return NextResponse.json({ error: 'Weekly reset failed' }, { status: 500 });
  }
}