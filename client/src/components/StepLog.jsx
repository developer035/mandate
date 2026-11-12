import React from 'react';
import { Search, ShieldAlert, CheckCircle2, AlertTriangle, CreditCard, MessageSquare, FileText, Loader2 } from 'lucide-react';

export default function StepLog({ steps, isRunning }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
        <p className="text-sm">No agent activity yet. Submit a shopping list to observe the agent loop.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="bg-slate-800/60 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 className="font-semibold text-sm text-slate-200">Live Agent Activity Log</h3>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
          {steps.length} {steps.length === 1 ? 'step' : 'steps'} recorded
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-3.5 max-h-[500px] overflow-y-auto font-mono text-xs">
        {steps.map((s, idx) => {
          const tool = s.tool;
          const input = s.input || {};
          const output = s.output || {};

          let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
          let icon = <FileText className="w-4 h-4 text-blue-400" />;

          if (tool === 'search_catalog') {
            badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
            icon = <Search className="w-4 h-4 text-cyan-400" />;
          } else if (tool === 'check_mandate') {
            if (output.status === 'ALLOWED') {
              badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            } else if (output.status === 'NEEDS_APPROVAL') {
              badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
              icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
            } else {
              badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
              icon = <ShieldAlert className="w-4 h-4 text-rose-400" />;
            }
          } else if (tool === 'ask_user') {
            badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
            icon = <MessageSquare className="w-4 h-4 text-purple-400" />;
          } else if (tool === 'create_paypal_order') {
            badgeColor = 'bg-amber-400/10 text-amber-300 border-amber-400/30';
            icon = <CreditCard className="w-4 h-4 text-amber-400" />;
          }

          return (
            <div key={idx} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {icon}
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${badgeColor}`}>
                    {tool}
                  </span>
                  <span className="text-slate-500 text-[10px]">Step #{s.step_no}</span>
                </div>
                <span className="text-slate-500 text-[10px]">
                  {s.created_at ? new Date(s.created_at).toLocaleTimeString() : ''}
                </span>
              </div>

              {/* Tool specific summaries */}
              {tool === 'search_catalog' && (
                <div className="text-slate-300 pl-6">
                  Searched for <span className="text-cyan-300 font-semibold">"{input.query}"</span> → Found {output.count || 0} product(s).
                </div>
              )}

              {tool === 'check_mandate' && (
                <div className="pl-6 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">Server Verdict:</span>
                    <span className={`font-bold ${
                      output.status === 'ALLOWED' ? 'text-emerald-400' :
                      output.status === 'NEEDS_APPROVAL' ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {output.status}
                    </span>
                    <span className="text-slate-500">
                      (Total: ${output.basket_total?.toFixed(2)} | Remaining: ${output.remaining_budget?.toFixed(2)})
                    </span>
                  </div>
                  {output.reasons && output.reasons.length > 0 && (
                    <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-0.5">
                      {output.reasons.map((r, i) => (
                        <li key={i} className={output.status === 'BLOCKED' ? 'text-rose-300' : 'text-amber-300'}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tool === 'ask_user' && (
                <div className="text-purple-300 pl-6 bg-purple-950/30 p-2 rounded border border-purple-800/40">
                  <span className="font-semibold text-purple-200">Question: </span>
                  {input.question}
                </div>
              )}

              {tool === 'create_paypal_order' && (
                <div className="text-amber-200 pl-6 space-y-1">
                  <div>
                    Created PayPal Order: <span className="font-mono text-white">{output.order_id}</span>
                  </div>
                  {output.approve_url && (
                    <div className="text-[11px] text-amber-400/80 truncate">
                      Approval link generated (awaiting buyer checkout)
                    </div>
                  )}
                </div>
              )}

              {tool === 'log_to_ledger' && (
                <div className="text-slate-300 pl-6">
                  Recorded decision: <span className="text-blue-400 font-bold">{input.decision}</span> for <span className="text-white">{input.name}</span> — <span className="text-slate-400 italic">"{input.reason}"</span>
                </div>
              )}
            </div>
          );
        })}

        {isRunning && (
          <div className="flex items-center space-x-2 text-blue-400 pl-2 pt-2 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Agent is evaluating options and executing guardrails...</span>
          </div>
        )}
      </div>
    </div>
  );
}
