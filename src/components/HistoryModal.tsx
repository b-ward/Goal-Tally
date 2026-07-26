import { X, Edit2, Trash2 } from 'lucide-react';
import type { Tally, Goal } from '../types';
import { themeColors } from '../lib/theme';
import type { ThemeColorKey } from '../lib/theme';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  tallies: Tally[];
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
}

export function HistoryModal({ isOpen, onClose, goal, tallies, onEdit, onDelete }: HistoryModalProps) {
  if (!isOpen || !goal) return null;
  
  const theme = themeColors[goal.color as ThemeColorKey] || themeColors.zinc;
  const emoji = goal.emoji || '🎯';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className={`bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border ${theme.border} overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200`}>
        <div className={`px-4 py-3 bg-zinc-950 flex items-center gap-2 border-b ${theme.border} relative`}>
          <span className="text-xl shrink-0">{emoji}</span>
          <span className={`font-bold text-white flex-1 min-w-0 truncate text-base`} title={goal.name}>{goal.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => onEdit(goal)}
              className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
              title="Edit Goal"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => {
                if(window.confirm('Are you sure you want to delete this goal and all its tallies?')) {
                  onDelete(goal.id);
                  onClose();
                }
              }}
              className="text-zinc-400 hover:text-red-500 p-2 rounded-full hover:bg-zinc-800 transition-colors"
              title="Delete Goal"
            >
              <Trash2 size={16} />
            </button>
            <div className="w-px h-5 bg-zinc-800 mx-0.5"></div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className={`p-6 overflow-y-auto flex-1 custom-scrollbar ${theme.bg}`}>
          {tallies.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full mb-2 border ${theme.border} bg-black/30`}>
                <span className="text-4xl opacity-50">{emoji}</span>
              </div>
              <p className="text-zinc-300 font-medium">No tallies yet</p>
              <p className="text-zinc-500 text-sm">Start tracking to see your history here.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tallies.map((tally) => {
                const date = new Date(tally.created_at);
                return (
                  <li key={tally.id} className={`bg-black/40 hover:bg-black/60 p-4 rounded-2xl flex items-center justify-between border ${theme.border} transition-colors`}>
                    <span className="text-zinc-300 font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${theme.swatch}`}></span>
                      {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`font-semibold bg-black/60 px-3 py-1 rounded-full shadow-inner border ${theme.border} ${theme.text}`}>
                      {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
