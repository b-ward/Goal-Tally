import { useEffect, useState } from 'react';
import { Plus, Target } from 'lucide-react';
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

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
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

      const goalsWithCounts: GoalWithCount[] = (goalsData || []).map(goal => ({
        ...goal,
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
        const newGoal = { name, color, emoji, user_id: user?.id };
        const { data, error } = await supabase
          .from('goals')
          .insert([newGoal])
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setGoals(prev => [...prev, { ...data, count: 0 }]);
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

  const openNewGoalModal = () => {
    setEditingGoal(null);
    setIsFormModalOpen(true);
  };

  const openEditGoalModal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsFormModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative">
          <div className="w-12 h-12 rounded-full absolute border-4 border-zinc-900"></div>
          <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-white border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {goals.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-3xl border border-zinc-800 p-8 shadow-xl backdrop-blur-sm">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700">
            <Target size={24} className="text-zinc-400" />
          </div>
          <h3 className="text-xl text-white font-bold mb-2">No Goals Found</h3>
          <p className="text-zinc-400 mb-6">Create your first goal to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map(goal => (
            <GoalItem 
              key={goal.id} 
              goal={goal} 
              onAdd={handleAddTally} 
              onRemove={handleRemoveTally}
              onClick={handleOpenHistory}
            />
          ))}
        </div>
      )}

      <button
        onClick={openNewGoalModal}
        className="w-full py-4 border-2 border-dashed border-zinc-800 text-zinc-400 rounded-2xl hover:border-zinc-600 hover:text-white transition-colors flex items-center justify-center gap-2 font-medium"
      >
        <Plus size={20} />
        Add New Goal
      </button>

      <HistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        goal={selectedGoal}
        tallies={historyTallies}
        onEdit={openEditGoalModal}
        onDelete={handleDeleteGoal}
      />

      <GoalFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleSaveGoal}
        editingGoal={editingGoal}
      />
    </div>
  );
}
