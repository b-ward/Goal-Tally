import { useState } from 'react';
import type { TrackingPeriod } from '../types';
import { supabase } from '../lib/supabase';

interface TrackingPeriodModalProps {
  period: TrackingPeriod;
  onSave: (period: TrackingPeriod) => void;
  onClose: () => void;
}

export function TrackingPeriodModal({ period, onSave, onClose }: TrackingPeriodModalProps) {
  const [draft, setDraft] = useState(period);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !draft.start_date || !draft.end_date || draft.end_date < draft.start_date) return;
    setSaving(true);
    setError('');
    try {
      const { error } = await supabase.rpc('save_goal_tracking_period', {
        p_start: draft.start_date,
        p_end: draft.end_date,
      });
      if (error) throw error;
      onSave(draft);
    } catch (error) {
      console.error('Error saving tracking period:', error);
      setError('Could not save the tracking period. Try again.');
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog => { if (dialog && !dialog.open) dialog.showModal(); }}
      aria-labelledby="tracking-period-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={save} className="space-y-4">
        <h2 id="tracking-period-title" className="text-lg font-bold">Tracking Period</h2>
        <p className="text-sm text-zinc-400">These dates set the pace for all active goals. Only tallies within the period count toward that pace.</p>
        <label className="block text-sm text-zinc-300">
          Start date
          <input type="date" required max={draft.end_date} value={draft.start_date} disabled={saving}
            onChange={event => setDraft({ ...draft, start_date: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 scheme-dark"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          End date
          <input type="date" required min={draft.start_date} value={draft.end_date} disabled={saving}
            onChange={event => setDraft({ ...draft, end_date: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 scheme-dark"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="px-3 py-2 text-sm text-zinc-300">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Period'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
