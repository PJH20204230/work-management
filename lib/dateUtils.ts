// lib/dateUtils.ts
export const getWeekStart = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);  // 월요일 기준
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  
  export const formatDateTime = (date: Date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  
  export const formatTime = (date: Date) => {
    return date.toTimeString().split(' ')[0];
  };