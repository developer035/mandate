import React from 'react';
import { ShieldCheck, PlayCircle, Sliders, History, Sparkles, RefreshCw } from 'lucide-react';

export default function NavBar({ currentTab, setCurrentTab, onResetDemo, isResetting }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('run')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Mandate
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                PayPal Sandbox
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">The AI proposes, the code decides</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => setCurrentTab('run')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'run'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Run Agent</span>
          </button>

          <button
            onClick={() => setCurrentTab('mandate')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'mandate'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Mandate</span>
          </button>

          <button
            onClick={() => setCurrentTab('ledger')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'ledger'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Ledger</span>
          </button>
        </nav>

        {/* Demo Mode Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onResetDemo}
            disabled={isResetting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500/15 to-yellow-500/15 text-amber-300 border border-amber-500/30 hover:from-amber-500/25 hover:to-yellow-500/25 transition-all shadow-sm"
            title="Reset demo data and prefill sample shopping list"
          >
            {isResetting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden md:inline">Demo Quick-Start</span>
          </button>
        </div>

      </div>
    </header>
  );
}
