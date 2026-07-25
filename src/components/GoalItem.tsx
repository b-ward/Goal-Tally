import { Plus, Minus } from 'lucide-react';
import type { GoalWithCount } from '../types';
import { themeColors } from '../lib/theme';
import type { ThemeColorKey } from '../lib/theme';

interface GoalItemProps {
  goal: GoalWithCount;
  onAdd: (goalId: string) => void;
  onRemove: (goalId: string) => void;
  onClick: (goalId: string) => void;
}

export function GoalItem({ goal, onAdd, onRemove, onClick }: GoalItemProps) {
  // Fallback to zinc if color is old format
  const theme = themeColors[goal.color as ThemeColorKey] || themeColors.zinc;
  const emoji = goal.emoji || '🎯';

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden mb-4 ${theme.bg} text-white transition-all transform hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] group border ${theme.border} shadow-lg`}>
      <div className="relative flex items-center justify-between p-4 sm:p-5 z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(goal.id); }}
          className={`p-3 rounded-full transition-colors shadow-inner ${theme.button}`}
          aria-label="Remove tally"
        >
          <Minus size={22} />
        </button>

        <div 
          className="flex-1 text-center cursor-pointer px-4 select-none flex flex-col items-center justify-center" 
          onClick={() => onClick(goal.id)}
        >
          <div className="flex items-center gap-2 justify-center mb-1.5">
            <span className="text-2xl drop-shadow-sm">{emoji}</span>
            <h3 className={`text-xl sm:text-2xl font-bold tracking-wide drop-shadow-sm ${theme.text}`}>{goal.name}</h3>
          </div>
          <p className={`text-sm sm:text-base font-semibold bg-black/20 inline-block px-3 py-1 rounded-full ${theme.text} shadow-inner`}>
            Total: {goal.count}
          </p>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); onAdd(goal.id); }}
          className={`p-3 rounded-full transition-colors shadow-lg ${theme.button}`}
          aria-label="Add tally"
        >
          <Plus size={22} />
        </button>
      </div>
    </div>
  );
}
