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
    <div className="min-h-screen bg-black text-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zinc-800">
      <div className="max-w-md mx-auto relative">
        <header className="mb-6 relative z-10 flex flex-col items-center pt-2">
          {user && (
            <button 
              onClick={signOut}
              className="absolute top-2 right-0 text-zinc-500 hover:text-white p-2 rounded-full hover:bg-zinc-900 transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          )}
          
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent drop-shadow-sm pb-1">
            Goal Tally
          </h1>
          <p className="mt-1 text-zinc-500 text-xs font-medium tracking-wide">Keep track of your goals</p>
        </header>

        <main className="relative z-10">
          {user ? <GoalList /> : <Login />}
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
