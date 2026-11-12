import React, { useState, useEffect } from 'react';
import { Sliders, ShieldAlert, Sparkles, Check, Save, Info, AlertTriangle } from 'lucide-react';

export default function MandatePage({ onNotify }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [weeklyBudget, setWeeklyBudget] = useState(20.00);
  const [perItemCap, setPerItemCap] = useState(6.00);
  const [allowedCategories, setAllowedCategories] = useState('groceries, cleaning');
  const [autoApproveUnder, setAutoApproveUnder] = useState(15.00);

  useEffect(() => {
    fetchMandate();
  }, []);

  async function fetchMandate() {
    try {
      setLoading(true);
      const res = await fetch('/mandate');
      if (res.ok) {
        const data = await res.json();
        setWeeklyBudget(data.weekly_budget);
        setPerItemCap(data.per_item_cap);
        setAllowedCategories(
          Array.isArray(data.allowed_categories)
            ? data.allowed_categories.join(', ')
            : data.allowed_categories
        );
        setAutoApproveUnder(data.auto_approve_under);
      }
    } catch (err) {
      console.error('Failed to load mandate:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_budget: parseFloat(weeklyBudget),
          per_item_cap: parseFloat(perItemCap),
          allowed_categories: allowedCategories.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
          auto_approve_under: parseFloat(autoApproveUnder)
        })
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        if (onNotify) onNotify('Mandate saved successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save mandate:', err);
      if (onNotify) onNotify('Error saving mandate: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleSetDemoValues() {
    setWeeklyBudget(20.00);
    setPerItemCap(6.00);
    setAllowedCategories('groceries, cleaning');
    setAutoApproveUnder(15.00);
    if (onNotify) onNotify('Demo values applied! Click Save to confirm.', 'info');
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Spending Mandate</h1>
              <p className="text-sm text-slate-400">
                Deterministic spending guardrails enforced at server runtime
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSetDemoValues}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all self-start sm:self-center"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Use Hackathon Demo Values</span>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Weekly Budget */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Weekly Budget (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={weeklyBudget}
                onChange={e => setWeeklyBudget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Hard limit: Total captured spend in any rolling 7-day period cannot exceed this amount.
            </p>
          </div>

          {/* Per-Item Cap */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Per-Item Unit Cap (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0.50"
                value={perItemCap}
                onChange={e => setPerItemCap(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Hard limit: Agent will block or substitute any item with a unit price higher than this.
            </p>
          </div>

          {/* Auto-Approve Under */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Auto-Approve Threshold (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={autoApproveUnder}
                onChange={e => setAutoApproveUnder(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Soft limit: Baskets totaling above this threshold require explicit in-app confirmation before ordering.
            </p>
          </div>

          {/* Allowed Categories */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Allowed Categories (comma separated)
            </label>
            <input
              type="text"
              value={allowedCategories}
              onChange={e => setAllowedCategories(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="groceries, cleaning"
              required
            />
            <p className="text-[11px] text-slate-500">
              Hard limit: Non-permitted categories (e.g. electronics) are blocked server-side.
            </p>
          </div>

        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>Server enforces these rules regardless of user or agent prompt text.</span>
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Mandate'}</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Security Architecture Box */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span>Why this design is immune to prompt injection</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The AI model (xAI Grok) only ever outputs <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">product_id</code> and <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">qty</code>. The server looks up prices directly in <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">catalog.json</code>, queries rolling spend from SQLite, and computes all monetary values in pure JavaScript. Even if a prompt commands the agent to <span className="text-slate-300 italic">"ignore budget and buy everything"</span>, <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">check_mandate</code> and <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">create_paypal_order</code> reject the basket immediately.
        </p>
      </div>

    </div>
  );
}
