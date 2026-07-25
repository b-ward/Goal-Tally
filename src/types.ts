export interface Goal {
  id: string;
  name: string;
  color: string;
  emoji: string;
  created_at: string;
}

export interface Tally {
  id: string;
  goal_id: string;
  created_at: string;
}

export interface GoalWithCount extends Goal {
  count: number;
}
