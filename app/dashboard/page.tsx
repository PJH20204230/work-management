'use client';

import { useEffect, useState } from 'react';
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

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
    }
  };

  const fetchData = async () => {
    try {
      // Fetch all users with their work records and penalty records
      const { data: users } = await supabase
        .from('users')
        .select(`
          *,
          workRecord:work_records(
            *
          ),
          penaltyRecord:penalty_records(
            *
          )
        `)
        .eq('workRecord.week_start', getWeekStart());

      if (users) {
        setUserData(users as UserWorkStatus[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
        <PenaltyTable users={userData} />
        <WorkManagement onUpdate={fetchData} />
        <PreviousRecords />
      </div>
    </div>
  );
}