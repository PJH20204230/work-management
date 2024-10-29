export interface User {
    id: string;
    username: string;
    created_at: string;
  }
  
  export interface WorkRecord {
    id: string;
    user_id: string;
    week_start: string;
    total_work_time: number;
    remaining_time: number;
    work_status: string;
    last_clock_in?: string;
    last_clock_in_time?: string;
    created_at: string;
  }
  
  export interface PenaltyRecord {
    id: string;
    user_id: string;
    accumulated_penalty: number;
    additional_hours: number;
    created_at: string;
    updated_at: string;
  }
  
  export interface UserWorkStatus extends User {
    workRecord?: WorkRecord;
    penaltyRecord?: PenaltyRecord;
  }