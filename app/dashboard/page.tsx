'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import WorkManagement from '@/components/WorkManagement';
import WorkRecords from '@/components/WorkRecords';
import PreviousRecords from '@/components/PreviousRecords';
import PenaltyTable from '@/components/PenaltyTable';
import type { UserWorkStatus } from '@/types';

export default function Dashboard() {
  const [userData, setUserData] = useState<UserWorkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = () => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
    }
  };

  const fetchData = async () => {
    try {
      // 모든 사용자 정보 가져오기
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('username');

      if (usersError) throw usersError;

      // 현재 주의 시작일 계산
      const currentWeekStart = new Date();
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
      currentWeekStart.setHours(0, 0, 0, 0);

      // 각 사용자의 근무 기록과 패널티 정보 가져오기
      const userWorkData = await Promise.all(users.map(async (user) => {
        const [workRecord, penaltyRecord] = await Promise.all([
          supabase
            .from('work_records')
            .select('*')
            .eq('user_id', user.id)
            .eq('week_start', currentWeekStart.toISOString())
            .single(),
          supabase
            .from('penalty_records')
            .select('*')
            .eq('user_id', user.id)
            .single()
        ]);

        return {
          ...user,
          workRecord: workRecord.data || {
            total_work_time: 0,
            remaining_time: 1200,
            work_status: '퇴근'
          },
          penaltyRecord: penaltyRecord.data || {
            accumulated_penalty: 0,
            additional_hours: 10
          }
        };
      }));

      setUserData(userWorkData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">근무 관리 시스템</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          로그아웃
        </button>
      </div>

      <div className="grid gap-8">
        <WorkRecords users={userData} onRefresh={fetchData} />
        <PenaltyTable users={userData} onRefresh={fetchData} />
        <WorkManagement onUpdate={fetchData} />
        <PreviousRecords />
      </div>
    </div>
  );
}