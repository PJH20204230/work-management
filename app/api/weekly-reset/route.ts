import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getWeekStart } from '@/lib/dateUtils';

export async function POST() {
  try {
    const supabase = getServiceSupabase();
    const currentWeekStart = getWeekStart();
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    // date 형식으로 변환
    const currentWeekStartDate = currentWeekStart.toISOString().split('T')[0];
    const previousWeekStartDate = previousWeekStart.toISOString().split('T')[0];

    console.log('Weekly reset started:', { 
      currentWeekStart: currentWeekStartDate,
      previousWeekStart: previousWeekStartDate
    });

    // 1. 이전 주의 출근 상태인 사용자 처리 (퇴근 안 찍은 사용자)
    const { data: clockedInUsers, error: clockedInError } = await supabase
      .from('work_records')
      .select('*')
      .eq('week_start', previousWeekStartDate)
      .eq('work_status', '출근');

    if (clockedInError) {
      console.error('Error fetching clocked in users:', clockedInError);
    } else {
      console.log('Found clocked in users:', clockedInUsers?.length || 0);
    }

    // 출근 상태인 사용자들 처리
    for (const user of clockedInUsers || []) {
      if (!user.last_clock_in) {
        console.error('Missing last_clock_in for user:', user.user_id);
        continue;
      }

      const lastClockIn = new Date(user.last_clock_in);
      const now = new Date();
      const workDuration = Math.floor((now.getTime() - lastClockIn.getTime()) / (1000 * 60));

      const newTotalWorkTime = user.total_work_time + workDuration;
      
      const { error: updateError } = await supabase
        .from('work_records')
        .update({
          total_work_time: newTotalWorkTime,
          remaining_time: Math.max(0, 1200 - newTotalWorkTime),
          work_status: '퇴근'
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating clocked in user:', {
          userId: user.user_id,
          error: updateError
        });
      }
    }

    // 2. 이전 주 근무 기록 확인하고 벌금/추가시간 처리
    const { data: previousRecords, error: previousError } = await supabase
      .from('work_records')
      .select('*, users(username)')  // username 추가하여 로깅 개선
      .eq('week_start', previousWeekStartDate);

    if (previousError) {
      console.error('Error fetching previous records:', previousError);
    } else {
      console.log('Processing previous week records:', previousRecords?.length || 0);
    }

    for (const record of previousRecords || []) {
      if (record.total_work_time < 1200) {
        const { data: penaltyRecord, error: penaltyError } = await supabase
          .from('penalty_records')
          .select('*')
          .eq('user_id', record.user_id)
          .single();

        if (penaltyError) {
          console.error('Error fetching penalty record:', {
            userId: record.user_id,
            username: record.users?.username,
            error: penaltyError
          });
          continue;
        }

        if (penaltyRecord) {
          const actualWorkMinutes = record.total_work_time;
          const shortfallMinutes = 1200 - actualWorkMinutes;
          
          let penalty = 0;
          let remainingExtraHours = penaltyRecord.additional_hours;

          if (shortfallMinutes > 0) {
            const neededExtraHours = Math.ceil(shortfallMinutes / 60);
            
            console.log('Calculating penalty:', {
              userId: record.user_id,
              username: record.users?.username,
              actualWorkMinutes,
              shortfallMinutes,
              neededExtraHours,
              currentExtraHours: remainingExtraHours
            });

            if (remainingExtraHours >= neededExtraHours) {
              remainingExtraHours -= neededExtraHours;
            } else {
              const finalTotalMinutes = actualWorkMinutes + (remainingExtraHours * 60);
              remainingExtraHours = 0;

              if (finalTotalMinutes < 600) {
                penalty = 10000;
              } else if (finalTotalMinutes < 1200) {
                penalty = 5000;
              }
            }
          }

          console.log('Updating penalty record:', {
            userId: record.user_id,
            username: record.users?.username,
            previousPenalty: penaltyRecord.accumulated_penalty,
            newPenalty: penaltyRecord.accumulated_penalty + penalty,
            previousExtraHours: penaltyRecord.additional_hours,
            newExtraHours: remainingExtraHours
          });

          const { error: updateError } = await supabase
            .from('penalty_records')
            .update({
              accumulated_penalty: penaltyRecord.accumulated_penalty + penalty,
              additional_hours: remainingExtraHours,
              updated_at: new Date().toISOString()  // updated_at 필드 업데이트 추가
            })
            .eq('user_id', record.user_id);

          if (updateError) {
            console.error('Error updating penalty record:', {
              userId: record.user_id,
              username: record.users?.username,
              error: updateError
            });
          }
        }
      }
    }

    // 3. 새로운 주차의 레코드 생성
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username');  // username 추가하여 로깅 개선

    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else {
      console.log('Creating new week records for users:', users?.length || 0);
    }

    // 새로운 주차 레코드 생성 전에 중복 체크
    for (const user of users || []) {
      // 중복 체크
      const { data: existingRecord, error: checkError } = await supabase
        .from('work_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start', currentWeekStartDate)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {  // PGRST116는 레코드 없음을 의미
        console.error('Error checking existing record:', {
          userId: user.id,
          username: user.username,
          error: checkError
        });
        continue;
      }

      if (!existingRecord) {  // 레코드가 없을 때만 생성
        const { error: insertError } = await supabase
          .from('work_records')
          .insert({
            user_id: user.id,
            week_start: currentWeekStartDate,
            total_work_time: 0,
            remaining_time: 1200,
            work_status: '퇴근'
          });

        if (insertError) {
          console.error('Error creating new week record:', {
            userId: user.id,
            username: user.username,
            error: insertError
          });
        }
      }
    }

    console.log('Weekly reset completed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Weekly reset error:', error);
    return NextResponse.json({ 
      error: 'Weekly reset failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}