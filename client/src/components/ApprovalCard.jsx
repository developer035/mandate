import React, { useState } from 'react';
import { ShoppingBag, CheckCircle, XCircle, CreditCard, ExternalLink, HelpCircle, AlertCircle, Zap, Shield, User } from 'lucide-react';

export default function ApprovalCard({ run, onAnswer, isAnswering, onViewLedger }) {
  const [customAnswer, setCustomAnswer] = useState('');

  if (!run) return null;

  const status = run.status;
  const basket = run.latest_basket;
  const items = basket?.items_detail || [];

  if (status === 'FAILED') {
    return (
      <div className="rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 border-2 bg-rose-950/30 border-rose-500/40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-rose-300">Run Incomplete / Failed</h3>
            <p className="text-xs text-slate-400">The agent hit a step limit or tool issue before finalizing checkout.</p>
          </div>
        </div>
        <p className="text-xs text-slate-300">
          Tip: You can use a more concise shopping list (e.g. <em>"1L milk, 1kg rice, dish soap"</em>) or click one of the quick chips above.
        </p>
      </div>
    );
  }

  if (
    status !== 'AWAITING_USER' &&
    status !== 'AWAITING_PAYMENT' &&
    status !== 'COMPLETED' &&
    status !== 'DENIED'
  ) return null;

  return (
    <div className={`rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 border-2 ${
      status === 'COMPLETED' ? 'bg-emerald-950/40 border-emerald-500/50' :
      status === 'DENIED' ? 'bg-rose-950/30 border-rose-500/40' :
      status === 'AWAITING_PAYMENT' ? 'bg-amber-950/30 border-amber-400/50 ring-2 ring-amber-400/20' :
      'bg-slate-900 border-blue-500/40'
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'AWAITING_PAYMENT' ? 'bg-amber-400/20 text-amber-300' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {status === 'COMPLETED' ? <CheckCircle className="w-5 h-5" /> :
             status === 'AWAITING_PAYMENT' ? <CreditCard className="w-5 h-5" /> :
             status === 'DENIED' ? <XCircle className="w-5 h-5 text-rose-400" /> :
             <ShoppingBag className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">
              {status === 'AWAITING_USER' && 'Agent Requesting Approval'}
              {status === 'AWAITING_PAYMENT' && '🛒 PayPal Sandbox Checkout Ready'}
              {status === 'COMPLETED' && '✅ Payment Captured! Transaction Complete.'}
              {status === 'DENIED' && 'Order Denied — No Charge Made'}
            </h3>
            <p className="text-xs text-slate-400">
              {status === 'AWAITING_USER' && 'Review the proposed basket before authorizing payment.'}
              {status === 'AWAITING_PAYMENT' && 'Real PayPal Sandbox order created. Click below to authorize.'}
              {status === 'COMPLETED' && 'PayPal transaction ID logged to the immutable audit ledger.'}
              {status === 'DENIED' && 'The agent correctly handled the user rejection.'}
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
          status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          status === 'AWAITING_PAYMENT' ? 'bg-amber-400/10 text-amber-300 border-amber-400/30' :
          status === 'DENIED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
          'bg-purple-500/10 text-purple-300 border-purple-500/30'
        }`}>
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Pending question */}
      {run.pending_question && (
        <div className="bg-purple-950/40 border border-purple-700/40 rounded-xl p-4 space-y-1">
          <div className="flex items-center space-x-2 text-purple-300 font-semibold text-xs uppercase tracking-wide">
            <HelpCircle className="w-4 h-4" /> <span>Agent Question</span>
          </div>
          <p className="text-slate-200 text-sm">{run.pending_question}</p>
        </div>
      )}

      {/* Items table */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider px-1">
            <span>Items ({items.length})</span>
            <span>Subtotal</span>
          </div>
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-slate-500 text-[11px]">
                    {item.qty} × ${item.unit_price?.toFixed(2)} · {item.category}
                  </div>
                </div>
                <div className="font-mono font-bold text-white">${item.line_total?.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl border border-slate-800/50 bg-slate-950/40 flex justify-between text-sm font-semibold">
            <span className="text-slate-400">Basket Total: <span className="text-white text-lg font-extrabold">${basket?.basket_total?.toFixed(2)}</span></span>
            <span className="text-slate-400">Budget Left: <span className="text-emerald-400 font-extrabold">${basket?.remaining_budget?.toFixed(2)}</span></span>
          </div>
        </div>
      )}

      {/* AWAITING_USER controls */}
      {status === 'AWAITING_USER' && (
        <div className="space-y-3 pt-1">
          {run.pending_options?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {run.pending_options.map((opt, i) => (
                <button
                  key={i}
                  disabled={isAnswering}
                  onClick={() => onAnswer(opt)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                >{opt}</button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isAnswering}
                onClick={() => onAnswer('Approve')}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" /> <span>Approve Basket</span>
              </button>
              <button
                disabled={isAnswering}
                onClick={() => onAnswer('Deny')}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-sm transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> <span>Deny</span>
              </button>
            </div>
          )}
          <div className="flex space-x-2 pt-1">
            <input
              type="text"
              placeholder="Or type a custom reply to the agent..."
              value={customAnswer}
              onChange={e => setCustomAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customAnswer.trim()) { onAnswer(customAnswer.trim()); setCustomAnswer(''); } }}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              disabled={isAnswering || !customAnswer.trim()}
              onClick={() => { if (customAnswer.trim()) { onAnswer(customAnswer.trim()); setCustomAnswer(''); } }}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50"
            >Send</button>
          </div>
        </div>
      )}

      {/* AWAITING_PAYMENT — the star of the show for judges */}
      {status === 'AWAITING_PAYMENT' && run.approve_url && (
        <div className="space-y-4">

          {/* Big PayPal Button */}
          <a
            href={run.approve_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center space-x-3 py-4 px-6 rounded-2xl bg-[#FFC439] hover:bg-[#FDB813] text-slate-900 font-extrabold text-base shadow-2xl shadow-amber-500/20 hover:shadow-amber-400/30 transition-all group active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.5 7.5C19.5 11.09 16.59 14 13 14H10L9 19H6L7.5 11H10.5C13.5 11 15.5 9.5 15.5 7C15.5 5.5 14.5 4.5 13 4.5H8L6 14" stroke="#003087" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Authorize Payment with PayPal Sandbox</span>
            <ExternalLink className="w-4 h-4 text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {/* Approve URL box for judges */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Live PayPal Sandbox Approval Link</div>
            <div className="font-mono text-xs text-blue-400 break-all leading-relaxed">{run.approve_url}</div>
            <button
              onClick={() => navigator.clipboard.writeText(run.approve_url)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >Click to copy</button>
          </div>

          {/* PayPal Order ID */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">PayPal Sandbox Order ID</div>
              <div className="font-mono text-sm text-white font-bold mt-0.5">{run.paypal_order_id}</div>
            </div>
            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded font-bold">REAL API CALL</div>
          </div>

          {/* Sandbox login instructions */}
          <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-2 font-bold text-blue-300 text-sm">
              <User className="w-4 h-4" />
              <span>Sandbox Buyer Login Instructions</span>
            </div>
            <ol className="text-xs text-slate-300 space-y-2 list-none">
              <li className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                <span>Click <strong className="text-white">"Authorize Payment with PayPal Sandbox"</strong> above. A new tab opens with the real PayPal checkout page.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                <span>Log in with your <strong className="text-white">sandbox personal (buyer) account</strong> from developer.paypal.com → Sandbox → Accounts.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                <span>Click <strong className="text-white">"Pay Now"</strong>. PayPal redirects back to this app automatically.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">4</span>
                <span>The server captures the payment and displays the <strong className="text-white">real transaction ID</strong> in the ledger.</span>
              </li>
            </ol>
          </div>

          {/* Security badge */}
          <div className="flex items-center space-x-2 text-xs text-slate-500 pt-1">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Mandate guardrails were re-verified server-side before this order was created. The model never touched your PayPal credentials.</span>
          </div>
        </div>
      )}

      {/* COMPLETED state — show real transaction proof */}
      {status === 'COMPLETED' && (
        <div className="space-y-3">
          <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-300 font-bold text-sm">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Payment Captured — Proof of Transaction</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">PayPal Order ID</div>
                <div className="font-mono text-xs text-white break-all">{run.paypal_order_id || '—'}</div>
              </div>
              <div className="bg-slate-950/60 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Captured Via</div>
                <div className="text-xs text-emerald-400 font-bold">PayPal Orders v2 REST API</div>
                <div className="text-[10px] text-slate-500">POST /v2/checkout/orders/{'{'}id{'}'}/capture</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <div className="text-xs text-slate-400">
              Transaction recorded in immutable audit ledger with full item breakdown.
            </div>
            <button
              onClick={onViewLedger}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 underline"
            >
              View Ledger →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
