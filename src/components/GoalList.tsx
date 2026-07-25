import { useEffect, useState } from 'react';
import { Plus, Target, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Goal, GoalWithCount, Tally } from '../types';
import { GoalItem } from './GoalItem';
import { HistoryModal } from './HistoryModal';
import { GoalFormModal } from './GoalFormModal';
import { useAuth } from '../lib/AuthContext';

export function GoalList() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // History Modal State
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [historyTallies, setHistoryTallies] = useState<Tally[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Goal Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Reorder State
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (goalsError) throw goalsError;

      const { data: talliesData, error: talliesError } = await supabase
        .from('tallies')
        .select('goal_id');

      if (talliesError) throw talliesError;

      const goalCounts = (talliesData || []).reduce((acc, tally) => {
        acc[tally.goal_id] = (acc[tally.goal_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const goalsWithCounts: GoalWithCount[] = (goalsData || []).map((goal, index) => ({
        ...goal,
        position: goal.position ?? index,
        count: goalCounts[goal.id] || 0
      }));

      setGoals(goalsWithCounts);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
    }
  };

  const handleOpenHistory = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId) || null;
    setSelectedGoal(goal);
    
    if (goal) {
      setIsHistoryModalOpen(true);
      try {
        const { data, error } = await supabase
          .from('tallies')
          .select('*')
          .eq('goal_id', goalId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setHistoryTallies(data || []);
      } catch (error) {
        console.error('Error fetching history:', error);
      }
    }
  };

  const handleSaveGoal = async (name: string, color: string, emoji: string) => {
    try {
      if (editingGoal) {
        const { error } = await supabase
          .from('goals')
          .update({ name, color, emoji })
          .eq('id', editingGoal.id);
        if (error) throw error;
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, name, color, emoji } : g));
        if (selectedGoal && selectedGoal.id === editingGoal.id) {
          setSelectedGoal(prev => prev ? { ...prev, name, color, emoji } : null);
        }
      } else {
        const maxPos = goals.length > 0 ? Math.max(...goals.map(g => g.position || 0)) : -1;
        const newGoal = { name, color, emoji, user_id: user?.id, position: maxPos + 1 };
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
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (error) throw error;
      setGoals(prev => prev.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
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
      await supabase.from('goals').update({ position: posB }).eq('id', goalA.id);
      await supabase.from('goals').update({ position: posA }).eq('id', goalB.id);
    } catch (error) {
      console.error('Error reordering goals:', error);
      fetchGoals(); // revert if error
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center">
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
                onClick={handleOpenHistory}
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

            {goals.length > 1 && (
              <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-center pb-4">
                <button 
                  onClick={() => setIsReordering(!isReordering)}
                  className={`text-sm flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isReordering ? 'bg-white text-black font-semibold' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                >
                  <ArrowUpDown size={16} />
                  {isReordering ? 'Finish Reordering' : 'Reorder Goals'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <GoalFormModal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)} 
        onSubmit={handleSaveGoal}
        editingGoal={editingGoal}
      />
      <HistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
        goal={selectedGoal} 
        tallies={historyTallies}
        onEdit={(g) => { setIsHistoryModalOpen(false); setEditingGoal(g); setIsFormModalOpen(true); }}
        onDelete={handleDeleteGoal}
      />
    </>
  );
}
