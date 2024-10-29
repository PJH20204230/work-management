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
        const { error } = await supabase.auth.signInWithPassword({
          email: `${username.toLowerCase()}@work-management.com`,
          password,
        });
        
        if (error) {
          throw new Error('사용자명 또는 비밀번호가 올바르지 않습니다.');
        }

        router.push('/dashboard');
      } else {
        // 회원가입
        if (username.length < 2) {
          throw new Error('사용자명은 2자 이상이어야 합니다.');
        }

        if (password.length < 6) {
          throw new Error('비밀번호는 6자 이상이어야 합니다.');
        }

        // 이미 존재하는 사용자명인지 확인
        const { data: existingUser } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .single();

        if (existingUser) {
          throw new Error('이미 존재하는 사용자명입니다.');
        }

        // 새 사용자 생성
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: `${username.toLowerCase()}@work-management.com`,
          password,
          options: {
            data: {
              username,
            }
          }
        });
        
        if (signUpError) throw signUpError;

        // users 테이블에 사용자 정보 저장
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: data.user?.id,
            username: username
          });

        if (userError) throw userError;

        // 초기 패널티 레코드 생성
        const { error: penaltyError } = await supabase
          .from('penalty_records')
          .insert({
            user_id: data.user?.id,
            accumulated_penalty: 0,
            additional_hours: 10
          });
        
        if (penaltyError) throw penaltyError;
        
        router.push('/dashboard');
      }
    } catch (err) {
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