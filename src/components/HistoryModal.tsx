import { X, Edit2, Trash2 } from 'lucide-react';
import type { Tally, Goal, TrackingPeriod } from '../types';
import { elapsedFraction, localDate } from '../lib/trackingPeriod';
import { themeColors } from '../lib/theme';
import type { ThemeColorKey } from '../lib/theme';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  tallies: Tally[];
  loading: boolean;
  error: string | null;
  period?: TrackingPeriod;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
}

export function HistoryModal({ isOpen, onClose, goal, tallies, loading, error, period, onEdit, onDelete }: HistoryModalProps) {
  if (!isOpen || !goal) return null;
  
  const theme = themeColors[goal.color as ThemeColorKey] || themeColors.zinc;
  const emoji = goal.emoji || '🎯';
  const today = localDate(new Date());
  const target = goal.target;
  const showProgress = target != null && period && !loading && !error;
  const periodCount = period ? tallies.filter(tally => {
    const date = localDate(new Date(tally.created_at));
    return date >= period.start_date && date <= period.end_date && date <= today;
  }).length : 0;
  const elapsed = period ? elapsedFraction(period, today) : 0;
  const expected = target == null ? 0 : Math.floor(target * elapsed);
  let pace = 'On track';
  if (target != null && period) {
    if (today < period.start_date) pace = 'Period hasn’t started';
    else if (periodCount >= target) pace = 'Target reached';
    else if (today > period.end_date) pace = 'Period ended · Target not reached';
    else if (periodCount < expected) pace = 'Behind schedule';
    else if (periodCount > expected) pace = 'Ahead of schedule';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className={`bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border ${theme.border} overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200`}>
        <div className={`px-4 py-3 bg-zinc-950 flex items-center gap-2 border-b ${theme.border} relative`}>
          <span className="text-xl shrink-0">{emoji}</span>
          <span className={`font-bold text-white flex-1 min-w-0 truncate text-base`} title={goal.name}>{goal.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && <button
              onClick={() => onEdit(goal)}
              className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
              title="Edit Goal"
            >
              <Edit2 size={16} />
            </button>}
            {onDelete && <button
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
            </button>}
            {(onEdit || onDelete) && <div className="w-px h-5 bg-zinc-800 mx-0.5"></div>}
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className={`p-6 overflow-y-auto flex-1 custom-scrollbar ${theme.bg}`}>
          {showProgress && (
            <section aria-label="Target progress" className="mb-4 rounded-xl bg-black/25 px-3 py-2 text-xs text-zinc-200">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <span className="font-medium">Target: {target} · {periodCount} this period</span>
                <span>{pace}</span>
              </div>
              <div role="progressbar" aria-label="Target progress" aria-valuemin={0} aria-valuemax={target}
                aria-valuenow={Math.min(periodCount, target)} aria-valuetext={`${periodCount} of ${target}. ${pace}.`}
                className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-black/50"
              >
                <div className={`h-full rounded-full ${theme.swatch}`} style={{ width: `${Math.min(100, periodCount / target * 100)}%` }} />
                <div aria-hidden="true" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
                  style={{ left: `${elapsed * 100}%` }} />
              </div>
              <p className="mt-1.5 text-zinc-300">Expected by now: {expected}</p>
            </section>
          )}
          {target != null && !showProgress && <p className="mb-4 text-sm text-zinc-300">Target: {target}</p>}
          {loading ? (
            <p role="status" className="text-zinc-300 text-sm">Loading tally history…</p>
          ) : error ? (
            <p role="alert" className="text-red-300 text-sm">{error}</p>
          ) : tallies.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full mb-2 border ${theme.border} bg-black/30`}>
                <span className="text-4xl opacity-50">{emoji}</span>
              </div>
              <p className="text-zinc-300 font-medium">No tallies yet</p>
              {onEdit && <p className="text-zinc-500 text-sm">Start tracking to see your history here.</p>}
            </div>
          ) : (
            <ul className="space-y-3">
              {tallies.map((tally) => {
                const date = new Date(tally.created_at);
                return (
                  <li key={tally.id} className={`bg-black/40 hover:bg-black/60 p-4 rounded-2xl flex items-center justify-between border ${theme.border} transition-colors`}>
                    <span className="text-zinc-300 font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${theme.swatch}`}></span>
                      {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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
