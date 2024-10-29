import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = getServiceSupabase();
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Get all work records from previous week
    const { data: previousRecords } = await supabase
      .from('work_records')
      .select('*')
      .lt('week_start', currentWeekStart.toISOString());

    for (const record of previousRecords || []) {
      if (record.total_work_time < 1200) {
        const { data: penaltyRecord } = await supabase
          .from('penalty_records')
          .select('*')
          .eq('user_id', record.user_id)
          .single();

        if (penaltyRecord) {
          const actualWorkMinutes = record.total_work_time;
          const shortfallMinutes = 1200 - actualWorkMinutes;
          
          let penalty = 0;
          let remainingExtraHours = penaltyRecord.additional_hours;

          if (shortfallMinutes > 0) {
            const neededExtraHours = Math.ceil(shortfallMinutes / 60);
            
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

          await supabase
            .from('penalty_records')
            .update({
              accumulated_penalty: penaltyRecord.accumulated_penalty + penalty,
              additional_hours: remainingExtraHours
            })
            .eq('user_id', record.user_id);
        }
      }
    }

    // Create new records for the current week
    const { data: users } = await supabase
      .from('users')
      .select('id');

    for (const user of users || []) {
      // 기존 레코드가 있는지 확인
      const { data: existingRecord } = await supabase
        .from('work_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start', currentWeekStart.toISOString())
        .single();

      if (!existingRecord) {
        // 레코드가 없는 경우에만 새로 생성
        await supabase
          .from('work_records')
          .insert({
            user_id: user.id,
            week_start: currentWeekStart.toISOString(),
            total_work_time: 0,
            remaining_time: 1200,
            work_status: '퇴근'
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Weekly reset error:', error);
    return NextResponse.json({ error: 'Weekly reset failed' }, { status: 500 });
  }
}