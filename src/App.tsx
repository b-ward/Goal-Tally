import { LogOut } from 'lucide-react';
import { GoalList } from './components/GoalList';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Login } from './components/Login';

function AppContent() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full absolute border-4 border-zinc-900"></div>
          <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-white border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-50 py-4 px-4 sm:px-6 font-sans selection:bg-zinc-800">
      <div className="max-w-md mx-auto relative">
        <header className="mb-5 relative z-10 flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-white">
              Goal Tally
            </h1>
          </div>
          {user && (
            <button 
              onClick={signOut}
              className="text-zinc-500 hover:text-white p-2 rounded-full hover:bg-zinc-900 transition-colors"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          )}
        </header>

        <main className="relative z-10">
          {user ? <GoalList key={user.id} /> : <Login />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
