import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, Calendar, Plus, Target, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ArchivedGoal, Goal, GoalWithCount, Tally, TrackingPeriod } from '../types';
import { defaultTrackingPeriod } from '../lib/trackingPeriod';
import { TrackingPeriodModal } from './TrackingPeriodModal';
import { GoalItem } from './GoalItem';
import { HistoryModal } from './HistoryModal';
import { GoalFormModal } from './GoalFormModal';
import { useAuth } from '../lib/AuthContext';

export function GoalList() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithCount[]>([]);
  const [trackingPeriod, setTrackingPeriod] = useState<TrackingPeriod | null>(null);
  const [periodLoading, setPeriodLoading] = useState(true);
  const [periodError, setPeriodError] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showArchive, setShowArchive] = useState(() => window.location.hash === '#archive');
  const [archivedGoals, setArchivedGoals] = useState<ArchivedGoal[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState(false);
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const restoreDialog = useRef<HTMLDialogElement>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ goalId: string; title: string; restoreAvailable: boolean } | null>(null);
  const [archiveSubmitError, setArchiveSubmitError] = useState('');
  const [archiveNotice, setArchiveNotice] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveName, setArchiveName] = useState(() => String(new Date().getFullYear()));
  
  // History Modal State
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [historyReadOnly, setHistoryReadOnly] = useState(false);
  const [historyTallies, setHistoryTallies] = useState<Tally[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequest = useRef(0);
  
  // Goal Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Reorder State
  const [isReordering, setIsReordering] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase.rpc('get_goal_results', { p_archived: false });
      if (error) throw error;
      setGoals((data as GoalWithCount[]).map((goal, index) => ({
        ...goal, position: goal.position ?? index,
      })));
    } catch (error) {
      setLoadError(true);
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const fetchTrackingPeriod = useCallback(async () => {
    setPeriodLoading(true);
    setPeriodError(false);
    try {
      const { data, error } = await supabase.rpc('get_goal_tracking_period');
      if (error) throw error;
      setTrackingPeriod(data as TrackingPeriod | null);
    } catch (error) {
      console.error('Error loading tracking period:', error);
      setPeriodError(true);
    } finally {
      setPeriodLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrackingPeriod();
  }, [fetchTrackingPeriod]);

  const fetchArchive = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveError(false);
    try {
      const { data, error } = await supabase.rpc('get_goal_results', { p_archived: true });
      if (error) throw error;
      setArchivedGoals(data as ArchivedGoal[]);
    } catch (error) {
      setArchiveError(true);
      console.error('Error fetching archives:', error);
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleNavigation = () => {
      setShowArchive(window.location.hash === '#archive');
      setArchiveNotice('');
      setIsReordering(false);
      setIsFormModalOpen(false);
      setEditingPeriod(false);
      setIsHistoryModalOpen(false);
      historyRequest.current++;
      archiveDialog.current?.close();
      restoreDialog.current?.close();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleNavigation);
    return () => window.removeEventListener('hashchange', handleNavigation);
  }, []);

  useEffect(() => {
    if (showArchive) void fetchArchive();
  }, [showArchive, fetchArchive]);

  const handleArchive = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = archiveName.trim();
    if (archiving || !name) return;
    setArchiving(true);
    setArchiveSubmitError('');
    try {
      const { error } = await supabase.rpc('archive_goal_set', { p_name: name });
      if (error) {
        console.error('Error archiving goals:', error);
        if (error.code === 'PGRST202' || error.code === '42883') {
          setArchiveSubmitError('Named archives require the latest database migration.');
        } else {
          setArchiveSubmitError(error.code === 'P0001' ? error.message : 'Could not archive your goals. Refresh before trying again.');
        }
        return;
      }
      archiveDialog.current?.close();
      setIsReordering(false);
      setGoals([]);
      if (window.location.hash === '#archive') setArchiveNotice(`Goals saved to “${name}”.`);
      await Promise.all([fetchGoals(), fetchArchive()]);
    } catch (error) {
      console.error('Error archiving goals:', error);
      setArchiveSubmitError('Could not confirm the archive. Refresh before trying again.');
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restoreTarget?.restoreAvailable || archiving) return;
    setArchiving(true);
    setArchiveSubmitError('');
    try {
      const { error } = await supabase.rpc('restore_goal_archive', { p_goal_id: restoreTarget.goalId });
      if (error) {
        console.error('Error restoring goals:', error);
        if (error.code === 'PGRST202' || error.code === '42883') {
          setArchiveSubmitError('Restore is unavailable on this database. Apply the restore migration and try again.');
        } else {
          setArchiveSubmitError(error.code === 'P0001' ? error.message : 'Could not restore these goals. Refresh before trying again.');
        }
        return;
      }
      restoreDialog.current?.close();
      if (window.location.hash === '#archive') setArchiveNotice('Goals restored. Choose Back to Goals to see them.');
      await Promise.all([fetchGoals(), fetchArchive()]);
    } catch (error) {
      console.error('Error restoring goals:', error);
      setArchiveSubmitError('Could not confirm the restore. Refresh before trying again.');
    } finally {
      setArchiving(false);
    }
  };

  const handleAddTally = async (goalId: string) => {
    try {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, count: g.count + 1 } : g));
      const { error } = await supabase.from('tallies').insert([{ goal_id: goalId }]);
      if (error) {
        setGoals(prev => prev.map(g => g.id === goalId ? { ...g, count: g.count - 1 } : g));
        throw error;
      }
    } catch (error) {
      console.error('Error adding tally:', error);
      setActionError('Could not add the tally. Refresh if this goal was archived on another device.');
    }
  };

  const handleRemoveTally = async (goalId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tallies')
        .select('id')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!data || data.length === 0) return;

      const tallyId = data[0].id;
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, count: Math.max(0, g.count - 1) } : g));

      const { error: deleteError } = await supabase.from('tallies').delete().eq('id', tallyId);
      if (deleteError) {
        setGoals(prev => prev.map(g => g.id === goalId ? { ...g, count: g.count + 1 } : g));
        throw deleteError;
      }
    } catch (error) {
      console.error('Error removing tally:', error);
      setActionError('Could not remove the tally. Refresh if this goal was archived on another device.');
    }
  };

  const handleOpenHistory = async (goal: Goal, readOnly = false) => {
    const request = ++historyRequest.current;
    setSelectedGoal(goal);
    setHistoryReadOnly(readOnly);
    setHistoryTallies([]);
    setHistoryError(null);
    setHistoryLoading(true);
    setIsHistoryModalOpen(true);
    try {
      const tallies: Tally[] = [];
      const pageSize = 200;
      for (let offset = 0; request === historyRequest.current; offset += pageSize) {
        const { data, error } = await supabase
          .from('tallies')
          .select('*')
          .eq('goal_id', goal.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        tallies.push(...data);
        if (data.length < pageSize) break;
      }
      if (request === historyRequest.current) setHistoryTallies(tallies);
    } catch (error) {
      console.error('Error fetching history:', error);
      if (request === historyRequest.current) setHistoryError('Could not load the tally history. Close and try again.');
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    historyRequest.current++;
    setIsHistoryModalOpen(false);
  };

  const handleSaveGoal = async (name: string, color: string, emoji: string, target: number | null) => {
    const fields = { name, color, emoji, target };
    try {
      if (editingGoal) {
        const { error } = await supabase
          .from('goals')
          .update(fields)
          .eq('id', editingGoal.id);
        if (error) throw error;
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...fields } : g));
        if (selectedGoal && selectedGoal.id === editingGoal.id) {
          setSelectedGoal(prev => prev ? { ...prev, ...fields } : null);
        }
      } else {
        const maxPos = goals.length > 0 ? Math.max(...goals.map(g => g.position || 0)) : -1;
        const newGoal = { ...fields, user_id: user?.id, position: maxPos + 1 };
        const { data, error } = await supabase
          .from('goals')
          .insert([newGoal])
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setGoals(prev => [...prev, { ...data, count: 0, position: newGoal.position }]);
        }
      }
      return true;
    } catch (error) {
      console.error('Error saving goal:', error);
      return false;
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (error) throw error;
      setGoals(prev => prev.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
      setActionError('Could not delete the goal.');
    }
  };

  const handleMoveUp = async (goalId: string) => {
    const index = goals.findIndex(g => g.id === goalId);
    if (index <= 0) return;
    await swapPositions(index, index - 1);
  };

  const handleMoveDown = async (goalId: string) => {
    const index = goals.findIndex(g => g.id === goalId);
    if (index === -1 || index >= goals.length - 1) return;
    await swapPositions(index, index + 1);
  };

  const swapPositions = async (indexA: number, indexB: number) => {
    const newGoals = [...goals];
    const goalA = newGoals[indexA];
    const goalB = newGoals[indexB];

    const posA = goalA.position || indexA;
    const posB = goalB.position || indexB;
    goalA.position = posB;
    goalB.position = posA;

    newGoals[indexA] = goalB;
    newGoals[indexB] = goalA;
    setGoals(newGoals);

    try {
      const first = await supabase.from('goals').update({ position: posB }).eq('id', goalA.id);
      if (first.error) throw first.error;
      const second = await supabase.from('goals').update({ position: posA }).eq('id', goalB.id);
      if (second.error) throw second.error;
    } catch (error) {
      console.error('Error reordering goals:', error);
      fetchGoals(); // revert if error
    }
  };

  const archiveGroups = new Map<string, ArchivedGoal[]>();
  for (const goal of archivedGoals) {
    const key = goal.archive_id ?? goal.backup_id ?? String(goal.archive_year);
    const entries = archiveGroups.get(key);
    if (entries) entries.push(goal);
    else archiveGroups.set(key, [goal]);
  }

  return (
    <>
      {actionError && <p role="alert" className="mb-4 text-sm text-red-300">{actionError}</p>}
      {showArchive ? (
        <section aria-labelledby="archive-page-title" className="space-y-5">
          <a href="#" className="inline-flex items-center gap-2 rounded-md py-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Goals
          </a>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="archive-page-title" className="text-xl font-bold">Archives</h2>
            <button
              type="button"
              disabled={loading || loadError || archiving || goals.length === 0}
              onClick={() => {
                setArchiveName(String(new Date().getFullYear()));
                setArchiveSubmitError('');
                archiveDialog.current?.showModal();
              }}
              className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Archive Goals
            </button>
          </div>
          {archiveNotice && <p role="status" className="text-sm text-zinc-300">{archiveNotice}</p>}
          {loadError && (
            <p role="alert" className="text-sm text-red-300">Could not load your active goals. <button onClick={fetchGoals} className="underline">Try again</button></p>
          )}
          {!loading && !loadError && goals.length === 0 && (
            <p className="text-sm text-zinc-400">No active goals to archive.</p>
          )}
          {archiveLoading ? (
            <p role="status" className="text-sm text-zinc-400">Loading archives…</p>
          ) : archiveError ? (
            <p role="alert" className="text-sm text-red-300">Could not load your archives. <button onClick={fetchArchive} className="underline">Try again</button></p>
          ) : archivedGoals.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 p-6 text-center text-sm text-zinc-400">No archives yet.</p>
          ) : (
            Array.from(archiveGroups).map(([key, entries]) => {
              const firstGoal = entries[0];
              const title = firstGoal.backed_up_at
                ? `Backup · ${new Date(firstGoal.backed_up_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                : firstGoal.archive_name ?? `${firstGoal.archive_year} Results`;
              const archiveDate = firstGoal.archive_id && firstGoal.archived_at
                ? new Date(firstGoal.archived_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                : null;
              return (
              <section key={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 wrap-break-word">
                    <h3 className="text-lg font-bold">{title}</h3>
                    {archiveDate && <p className="text-xs text-zinc-400">{archiveDate}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={archiving}
                    aria-label={archiveDate ? `Restore ${title}, archived ${archiveDate}` : `Restore ${title}`}
                    onClick={() => {
                      const restoreAvailable = Object.hasOwn(firstGoal, 'backup_id');
                      setArchiveSubmitError(restoreAvailable ? '' : 'Restore is unavailable on this database. Apply the restore migration or open the updated preview.');
                      setRestoreTarget({ goalId: firstGoal.id, title, restoreAvailable });
                      restoreDialog.current?.showModal();
                    }}
                    className="rounded-full px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Restore
                  </button>
                </div>
                <ul className="divide-y divide-zinc-800">
                  {entries.map(goal => (
                    <li key={goal.id}>
                      <button
                        type="button"
                        onClick={() => void handleOpenHistory(goal, true)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg py-3 text-left hover:bg-zinc-800 focus-visible:outline-white"
                      >
                        <span className="min-w-0 wrap-break-word"><span aria-hidden="true" className="mr-2">{goal.emoji || '🎯'}</span>{goal.name}</span>
                        <span className="shrink-0 text-sm text-zinc-300">Final total: {goal.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              );
            })
          )}
        </section>
      ) : (
        <>
          {loading ? (
            <div role="status" aria-label="Loading goals" className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : loadError ? (
            <p role="alert" className="text-sm text-red-300">Could not load your goals. <button onClick={fetchGoals} className="underline">Try again</button></p>
          ) : <div className="flex flex-col items-center">
            {goals.length === 0 ? (
              <div className="text-center py-16 px-4 bg-zinc-900/50 rounded-3xl border border-zinc-800/50 w-full mb-6">
                <Target size={48} className="mx-auto mb-4 text-zinc-600" />
                <h2 className="text-xl font-bold text-white mb-2">No goals yet</h2>
                <p className="text-zinc-400 mb-6 max-w-xs mx-auto text-sm">Start tracking your daily habits by creating your first goal.</p>
                <button
                  onClick={() => { setEditingGoal(null); setIsFormModalOpen(true); }}
                  className="inline-flex items-center justify-center bg-white text-black font-semibold py-3 px-6 rounded-full hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  <Plus size={20} className="mr-2" />
                  Add First Goal
                </button>
              </div>
            ) : (
              <div className="w-full space-y-4 relative">
                {goals.map((goal, i) => (
                  <GoalItem
                    key={goal.id}
                    goal={goal}
                    isReordering={isReordering}
                    isFirst={i === 0}
                    isLast={i === goals.length - 1}
                    onAdd={handleAddTally}
                    onRemove={handleRemoveTally}
                    onClick={() => void handleOpenHistory(goal)}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                ))}

                <button
                  onClick={() => {
                    if (!isReordering) {
                      setEditingGoal(null);
                      setIsFormModalOpen(true);
                    } else {
                      setIsReordering(false);
                    }
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-4 rounded-2xl flex items-center justify-center transition-colors border border-zinc-800 mt-2 shadow-lg group"
                >
                  {isReordering ? (
                    <span>Done Reordering</span>
                  ) : (
                    <>
                      <Plus size={20} className="mr-2 group-hover:scale-110 transition-transform" />
                      Add New Goal
                    </>
                  )}
                </button>

              </div>
            )}
          </div>}

          <footer className="mt-4 flex items-center justify-center gap-1 border-t border-zinc-900 pt-3 text-xs sm:gap-2 sm:text-sm">
            <button
              type="button"
              disabled={loading || loadError || goals.length < 2}
              aria-pressed={isReordering}
              onClick={() => setIsReordering(!isReordering)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-40 sm:px-3"
            >
              <ArrowUpDown size={16} aria-hidden="true" />
              {isReordering ? 'Finish Reordering' : 'Reorder Goals'}
            </button>
            <a href="#archive" className="flex items-center gap-1.5 rounded-full px-2 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white sm:px-3">
              <Archive size={16} aria-hidden="true" /> Archive
            </a>
            <button type="button" disabled={periodLoading}
              onClick={() => periodError ? void fetchTrackingPeriod() : setEditingPeriod(true)}
              aria-label={periodError ? 'Retry loading tracking period' : undefined}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-50 sm:px-3"
            >
              <Calendar size={16} aria-hidden="true" />
              {periodError ? 'Retry Period' : 'Tracking Period'}
            </button>
          </footer>
        </>
      )}

      <dialog
        ref={archiveDialog}
        aria-labelledby="archive-title"
        aria-describedby="archive-description"
        onCancel={event => { if (archiving) event.preventDefault(); }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={handleArchive} className="space-y-4">
          <h2 id="archive-title" className="text-lg font-bold">Archive all active goals</h2>
          <p id="archive-description" className="text-sm text-zinc-400">This saves the final totals and tally history for all your active goals, then clears your active list.</p>
          <label className="block text-sm text-zinc-300">
            Archive name
            <input
              type="text"
              required
              value={archiveName}
              disabled={archiving}
              onChange={event => setArchiveName(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-zinc-700 bg-black px-3 py-2"
            />
          </label>
          {archiveSubmitError && <p role="alert" className="text-sm text-red-300">{archiveSubmitError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" autoFocus disabled={archiving} onClick={() => archiveDialog.current?.close()} className="rounded-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={archiving || !archiveName.trim()} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
              {archiving ? 'Archiving…' : 'Archive Goals'}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={restoreDialog}
        aria-labelledby="restore-title"
        aria-describedby="restore-description"
        onCancel={event => { if (archiving) event.preventDefault(); }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={handleRestore} className="space-y-4">
          <h2 id="restore-title" className="wrap-break-word text-lg font-bold">Restore {restoreTarget?.title}?</h2>
          <p id="restore-description" className="text-sm text-zinc-300">
            <strong className="text-amber-300">This will replace all your current goals.</strong>{' '}
            Any current goals and their tallies will move to a backup in Archives. The selected goals will become active again.
          </p>
          {archiveSubmitError && <p role="alert" className="text-sm text-red-300">{archiveSubmitError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" autoFocus disabled={archiving} onClick={() => restoreDialog.current?.close()} className="rounded-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={archiving || !restoreTarget?.restoreAvailable} className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-200 disabled:opacity-50">
              {archiving ? 'Restoring…' : 'Restore and Replace'}
            </button>
          </div>
        </form>
      </dialog>

      {editingPeriod && <TrackingPeriodModal
        period={trackingPeriod ?? defaultTrackingPeriod()}
        onClose={() => setEditingPeriod(false)}
        onSave={period => { setTrackingPeriod(period); setEditingPeriod(false); }}
      />}
      <GoalFormModal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)} 
        onSubmit={handleSaveGoal}
        editingGoal={editingGoal}
      />
      <HistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={closeHistory}
        goal={selectedGoal} 
        tallies={historyTallies}
        loading={historyLoading}
        error={historyError}
        period={!historyReadOnly && !periodLoading && !periodError ? trackingPeriod ?? defaultTrackingPeriod() : undefined}
        onEdit={historyReadOnly ? undefined : (g) => { closeHistory(); setEditingGoal(g); setIsFormModalOpen(true); }}
        onDelete={historyReadOnly ? undefined : handleDeleteGoal}
      />
    </>
  );
}
