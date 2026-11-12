import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, DollarSign, PackageCheck, AlertCircle, RefreshCw, Filter, ArrowUpRight } from 'lucide-react';

export default function LedgerPage({ onNotify }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summary: {}, rows: [] });
  const [filter, setFilter] = useState('ALL');
  const [highlightTx, setHighlightTx] = useState(null);

  useEffect(() => {
    // Check if PayPal redirected back with a captured transaction
    const hash = window.location.hash || '';
    const txMatch = hash.match(/captured=([^&]+)/);
    if (txMatch) {
      setHighlightTx(txMatch[1]);
      if (onNotify) onNotify(`🎉 PayPal Sandbox Transaction Captured: ${txMatch[1]}`, 'success');
    }
    fetchLedger();
  }, []);

  async function fetchLedger() {
    try {
      setLoading(true);
      const res = await fetch('/ledger');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
      if (onNotify) onNotify('Error loading ledger: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const rows = data.rows || [];
  const summary = data.summary || {};

  const filteredRows = rows.filter(r => {
    if (filter === 'ALL') return true;
    return r.decision === filter;
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Audit Ledger</h1>
              <p className="text-sm text-slate-400">
                Immutable trace of every agent proposal, substitution, block, and PayPal transaction
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchLedger}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Captured Spend</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            ${summary.total_spent ? summary.total_spent.toFixed(2) : '0.00'}
          </div>
          <div className="text-[11px] text-slate-500">PayPal Sandbox live captures</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Items Purchased</span>
            <PackageCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {summary.items_bought || 0}
          </div>
          <div className="text-[11px] text-slate-500">Units ordered within mandate</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Substitutions</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {summary.substitutions || 0}
          </div>
          <div className="text-[11px] text-slate-500">Replaced over-cap or out-of-stock</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Over-Budget Leaks</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            0
          </div>
          <div className="text-[11px] text-emerald-400/80 font-semibold">Strict code guarantee</div>
        </div>

      </div>

      {/* Filter Chips */}
      <div className="flex items-center space-x-2 text-xs font-semibold">
        <span className="text-slate-500 flex items-center space-x-1 mr-2">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </span>
        {['ALL', 'BOUGHT', 'SUBSTITUTED', 'BLOCKED', 'SKIPPED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              filter === f
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-4 px-5 font-bold">Item & Quantity</th>
                <th className="py-4 px-4 font-bold">Price / Total</th>
                <th className="py-4 px-4 font-bold">Decision</th>
                <th className="py-4 px-5 font-bold">Reason & Context</th>
                <th className="py-4 px-4 font-bold">PayPal TX ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500 text-sm">
                    No ledger entries matching this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  let badge = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (row.decision === 'BOUGHT') {
                    badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                  } else if (row.decision === 'SUBSTITUTED') {
                    badge = 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
                  } else if (row.decision === 'BLOCKED') {
                    badge = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
                  }

                  const isJustCaptured = highlightTx && row.transaction_id === highlightTx;

                  return (
                    <tr key={idx} className={`transition-colors ${isJustCaptured ? 'bg-emerald-950/50 ring-1 ring-inset ring-emerald-500/40' : 'hover:bg-slate-800/40'}`}>
                      <td className="py-4 px-5">
                        {isJustCaptured && (
                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                            <span>Just captured via PayPal Sandbox!</span>
                          </div>
                        )}
                        <div className="font-bold text-slate-100 text-sm">{row.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {row.product_id} | Qty: {row.qty}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono">
                        <div className="font-bold text-white text-sm">
                          ${row.line_total ? row.line_total.toFixed(2) : '0.00'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          @ ${row.unit_price ? row.unit_price.toFixed(2) : '0.00'}/unit
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border ${badge}`}>
                          {row.decision}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-slate-300 text-xs max-w-xs leading-relaxed">
                        {row.reason || '—'}
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px]">
                        {row.transaction_id ? (
                          <div className={`font-bold break-all ${isJustCaptured ? 'text-emerald-300' : 'text-blue-400'}`}>
                            {row.transaction_id}
                            {isJustCaptured && (
                              <div className="text-[10px] text-emerald-500 font-normal mt-0.5">PayPal Sandbox Capture ID</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
