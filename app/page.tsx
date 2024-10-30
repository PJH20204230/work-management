'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // 로그인
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (userError || !user) {
          throw new Error('사용자명 또는 비밀번호가 올바르지 않습니다.');
        }

        if (password !== user.password) {
          throw new Error('사용자명 또는 비밀번호가 올바르지 않습니다.');
        }

        // 세션 설정
        localStorage.setItem('user', JSON.stringify(user));
        
        // 리다이렉트
        router.push('/dashboard');
      } else {
        // 회원가입 유효성 검사
        if (username.length < 2) {
          throw new Error('사용자명은 2자 이상이어야 합니다.');
        }

        if (password.length < 6) {
          throw new Error('비밀번호는 6자 이상이어야 합니다.');
        }

        // 중복 사용자 확인
        const { data: existingUser } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .single();

        if (existingUser) {
          throw new Error('이미 존재하는 사용자명입니다.');
        }

        // 새 사용자 생성
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            username,
            password,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (userError || !newUser) {
          throw new Error('회원가입 중 오류가 발생했습니다.');
        }

        // 초기 패널티 레코드 생성
        const { error: penaltyError } = await supabase
          .from('penalty_records')
          .insert({
            user_id: newUser.id,
            accumulated_penalty: 0,
            additional_hours: 10
          });

        if (penaltyError) {
          // 실패 시 생성된 사용자 삭제
          await supabase.from('users').delete().eq('id', newUser.id);
          throw new Error('회원가입 중 오류가 발생했습니다.');
        }

        // 초기 work record 생성
        const currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
        currentWeekStart.setHours(0, 0, 0, 0);

        const { error: workError } = await supabase
          .from('work_records')
          .insert({
            user_id: newUser.id,
            week_start: currentWeekStart.toISOString(),
            total_work_time: 0,
            remaining_time: 1200,
            work_status: '퇴근'
          });

        if (workError) {
          // 실패 시 생성된 데이터 삭제
          await supabase.from('penalty_records').delete().eq('user_id', newUser.id);
          await supabase.from('users').delete().eq('id', newUser.id);
          throw new Error('회원가입 중 오류가 발생했습니다.');
        }

        // 세션 설정
        localStorage.setItem('user', JSON.stringify(newUser));

        // 리다이렉트
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          {isLogin ? '로그인' : '회원가입'}
        </h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleAuth} className="mt-8 space-y-6">
          <input
            type="text"
            required
            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="사용자명 (실명)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            required
            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
              loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          >
            {loading ? '처리중...' : (isLogin ? '로그인' : '회원가입')}
          </button>
        </form>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          {isLogin ? '회원가입하기' : '로그인하기'}
        </button>
      </div>
    </div>
  );
}