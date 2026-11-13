export interface Goal {
  id: string;
  name: string;
  color: string;
  emoji: string;
  position?: number;
  created_at: string;
  target?: number | null;
}

export interface TrackingPeriod {
  start_date: string;
  end_date: string;
}

export interface Tally {
  id: string;
  goal_id: string;
  created_at: string;
}

export interface GoalWithCount extends Goal {
  count: number;
}

export interface ArchivedGoal extends GoalWithCount {
  archive_year: number | null;
  archive_id?: string | null;
  archive_name?: string | null;
  archived_at?: string | null;
  backup_id: string | null;
  backed_up_at: string | null;
}
