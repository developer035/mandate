import React, { useState } from 'react';
import NavBar from './components/NavBar';
import RunPage from './pages/RunPage';
import MandatePage from './pages/MandatePage';
import LedgerPage from './pages/LedgerPage';
import { ShieldCheck, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('run');
  const [initialRunText, setInitialRunText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = 'info') {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }

  async function handleResetDemo() {
    try {
      setIsResetting(true);
      const res = await fetch('/demo/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setInitialRunText(data.sample_prompt || 'I need 2L milk, 2kg rice, dish soap, an HDMI cable, and India Gate classic basmati');
        setCurrentTab('run');
        showToast('🎯 Demo state reset! Sample shopping list prefilled.', 'success');
      } else {
        throw new Error('Failed to reset demo state');
      }
    } catch (err) {
      console.error(err);
      showToast('Error resetting demo: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      
      {/* Navbar */}
      <NavBar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-4 duration-200">
          <div className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold ${
            toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40' :
            toast.type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-500/40' :
            'bg-slate-900/95 text-slate-200 border-blue-500/40'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {currentTab === 'run' && (
          <RunPage
            initialText={initialRunText}
            onNotify={showToast}
            onViewLedger={() => setCurrentTab('ledger')}
          />
        )}
        {currentTab === 'mandate' && (
          <MandatePage onNotify={showToast} />
        )}
        {currentTab === 'ledger' && (
          <LedgerPage onNotify={showToast} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center space-x-2 text-slate-400">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-300">Mandate Restock Agent</span>
          <span>•</span>
          <span>PayPal AI Hackathon 2026</span>
        </div>
        <p className="max-w-md mx-auto text-[11px] text-slate-500">
          Demo storefront with seeded catalog. Payments move in PayPal Sandbox. Financial constraints and spending caps are verified server-side.
        </p>
      </footer>

    </div>
  );
}
