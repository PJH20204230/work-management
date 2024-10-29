import { UserWorkStatus } from '@/types';

interface WorkRecordsProps {
  users: UserWorkStatus[];
  onRefresh: () => void;
}

export default function WorkRecords({ users, onRefresh }: WorkRecordsProps) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">전체 사용자 근무 정보</h2>
        <button
          onClick={onRefresh}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          새로고침
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">사용자명</th>
              <th className="px-4 py-2 text-left">이번 주 총 근무시간</th>
              <th className="px-4 py-2 text-left">남은 근무시간</th>
              <th className="px-4 py-2 text-left">근무 상태</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-2">{user.username}</td>
                <td className="px-4 py-2">
                  {user.workRecord ? formatTime(user.workRecord.total_work_time) : '0시간 0분'}
                </td>
                <td className="px-4 py-2">
                  {user.workRecord ? formatTime(user.workRecord.remaining_time) : '20시간 0분'}
                </td>
                <td className="px-4 py-2">
                  {user.workRecord?.work_status ?? '퇴근'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}