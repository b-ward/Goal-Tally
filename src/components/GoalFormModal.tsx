import { useState, useEffect } from 'react';
import { X, Target } from 'lucide-react';
import type { Goal } from '../types';
import { themeColors, emojis } from '../lib/theme';
import type { ThemeColorKey } from '../lib/theme';

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string, emoji: string) => Promise<void>;
  editingGoal?: Goal | null;
}

export function GoalFormModal({ isOpen, onClose, onSubmit, editingGoal }: GoalFormModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<ThemeColorKey>('blue');
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(editingGoal?.name || '');
      // Fallback to blue if the color is an old string
      const color = editingGoal?.color as ThemeColorKey;
      setSelectedColor(themeColors[color] ? color : 'blue');
      setSelectedEmoji(editingGoal?.emoji || '🎯');
    }
  }, [isOpen, editingGoal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    await onSubmit(name.trim(), selectedColor, selectedEmoji);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target size={20} className={themeColors[selectedColor]?.text || 'text-zinc-400'} />
            {editingGoal ? 'Edit Goal' : 'New Goal'}
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-1.5">
                Goal Name
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl select-none">
                  {selectedEmoji}
                </span>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Read 10 Pages"
                  className="w-full bg-black border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-5 gap-2 bg-black p-3 rounded-xl border border-zinc-800">
                {emojis.slice(0, 14).map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`text-2xl p-1.5 rounded-lg transition-colors ${selectedEmoji === emoji ? 'bg-zinc-800 ring-1 ring-zinc-700' : 'hover:bg-zinc-900'}`}
                  >
                    {emoji}
                  </button>
                ))}
                <div className={`relative flex items-center justify-center rounded-lg transition-colors h-[44px] ${!emojis.slice(0, 14).includes(selectedEmoji) ? 'bg-zinc-800 ring-1 ring-zinc-700' : 'hover:bg-zinc-900 border border-dashed border-zinc-700'}`}>
                  <input
                    type="text"
                    maxLength={2}
                    value={!emojis.slice(0, 14).includes(selectedEmoji) ? selectedEmoji : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) setSelectedEmoji(val);
                      else setSelectedEmoji('🎯');
                    }}
                    placeholder="+"
                    className="w-full h-full absolute inset-0 text-center text-2xl bg-transparent text-white placeholder-zinc-500 focus:outline-none focus:bg-zinc-800 focus:ring-1 focus:ring-zinc-600 rounded-lg"
                    title="Type custom emoji"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Color Theme
              </label>
              <div className="grid grid-cols-6 gap-3 bg-black p-3 rounded-xl border border-zinc-800 place-items-center">
                {(Object.keys(themeColors) as ThemeColorKey[]).map(colorKey => (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setSelectedColor(colorKey)}
                    className={`w-8 h-8 rounded-full ${themeColors[colorKey].swatch} transition-transform ${selectedColor === colorKey ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                    aria-label={`Select ${colorKey}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full bg-white text-black font-semibold py-3 px-4 rounded-xl hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-zinc-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : (editingGoal ? 'Save Changes' : 'Create Goal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
