import React, { useState } from 'react';
import { ShoppingBag, CheckCircle, XCircle, CreditCard, ExternalLink, HelpCircle, AlertCircle } from 'lucide-react';

export default function ApprovalCard({
  run,
  onAnswer,
  isAnswering,
  onViewLedger
}) {
  const [customAnswer, setCustomAnswer] = useState('');

  if (!run) return null;

  const status = run.status;
  const basket = run.latest_basket;
  const items = basket?.items_detail || [];

  if (status !== 'AWAITING_USER' && status !== 'AWAITING_PAYMENT' && status !== 'COMPLETED' && status !== 'DENIED') {
    return null;
  }

  return (
    <div className="bg-slate-900 border-2 border-blue-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in duration-300">
      
      {/* Header status */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">
              {status === 'AWAITING_USER' && 'User Review & Approval Required'}
              {status === 'AWAITING_PAYMENT' && 'Ready for PayPal Sandbox Checkout'}
              {status === 'COMPLETED' && 'Restock Order Successfully Captured!'}
              {status === 'DENIED' && 'Order Denied by User'}
            </h3>
            <p className="text-xs text-slate-400">
              {status === 'AWAITING_USER' && 'The agent proposed this basket within spending limits.'}
              {status === 'AWAITING_PAYMENT' && 'The server verified the mandate and created a PayPal Order.'}
              {status === 'COMPLETED' && 'Payment verified and transaction written to audit ledger.'}
              {status === 'DENIED' && 'No payment or order was processed.'}
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
          status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          status === 'AWAITING_PAYMENT' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
          status === 'DENIED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
          'bg-purple-500/10 text-purple-300 border-purple-500/30'
        }`}>
          {status}
        </span>
      </div>

      {/* Pending Question from ask_user */}
      {run.pending_question && (
        <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-purple-300 font-semibold text-xs uppercase tracking-wide">
            <HelpCircle className="w-4 h-4" />
            <span>Agent Question</span>
          </div>
          <p className="text-slate-200 text-sm">{run.pending_question}</p>
        </div>
      )}

      {/* Proposed Items Table */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase tracking-wider px-1">
            <span>Proposed Items ({items.length})</span>
            <span>Subtotal</span>
          </div>
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-slate-400 text-[11px]">
                    Qty: <span className="text-white font-mono">{item.qty}</span> × ${item.unit_price?.toFixed(2)} ({item.category})
                  </div>
                </div>
                <div className="font-mono font-bold text-slate-100 text-sm">
                  ${item.line_total?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 flex justify-between items-center text-sm font-semibold">
            <div className="text-xs text-slate-400">
              Basket Total: <span className="font-bold text-white text-base">${basket?.basket_total?.toFixed(2)}</span>
            </div>
            <div className="text-xs text-slate-400">
              Weekly Remaining: <span className="font-bold text-emerald-400">${basket?.remaining_budget?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Controls for AWAITING_USER */}
      {status === 'AWAITING_USER' && (
        <div className="space-y-3 pt-2">
          {run.pending_options && run.pending_options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {run.pending_options.map((opt, i) => (
                <button
                  key={i}
                  disabled={isAnswering}
                  onClick={() => onAnswer(opt)}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={isAnswering}
                onClick={() => onAnswer('Approve')}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve Basket</span>
              </button>
              <button
                disabled={isAnswering}
                onClick={() => onAnswer('Deny')}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-sm transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Deny / Cancel</span>
              </button>
            </div>
          )}

          {/* Optional custom text input */}
          <div className="flex space-x-2 pt-1">
            <input
              type="text"
              placeholder="Or type custom instructions / answer to agent..."
              value={customAnswer}
              onChange={e => setCustomAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customAnswer.trim()) {
                  onAnswer(customAnswer.trim());
                  setCustomAnswer('');
                }
              }}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              disabled={isAnswering || !customAnswer.trim()}
              onClick={() => {
                if (customAnswer.trim()) {
                  onAnswer(customAnswer.trim());
                  setCustomAnswer('');
                }
              }}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Action Controls for AWAITING_PAYMENT */}
      {status === 'AWAITING_PAYMENT' && (
        <div className="space-y-4 pt-2">
          {run.approve_url && (
            <a
              href={run.approve_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#FFC439] to-[#FDB813] text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/10 hover:brightness-105 transition-all group"
            >
              <CreditCard className="w-5 h-5 text-slate-900" />
              <span>Complete Payment in PayPal Sandbox</span>
              <ExternalLink className="w-4 h-4 text-slate-800 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-200/90 space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Sandbox Test Credentials for Hackathon Reviewers:</span>
            </div>
            <p className="text-[11px] text-amber-300/80">
              Click the button above to log in with your sandbox buyer personal account. When payment is approved, PayPal redirects back and captures the transaction ID automatically!
            </p>
          </div>
        </div>
      )}

      {/* Completion View */}
      {status === 'COMPLETED' && (
        <div className="pt-2 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            PayPal Order: <span className="font-mono text-white">{run.paypal_order_id || 'N/A'}</span>
          </div>
          <button
            onClick={onViewLedger}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
          >
            View in Audit Ledger →
          </button>
        </div>
      )}

    </div>
  );
}
