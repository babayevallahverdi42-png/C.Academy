import React, { useState } from 'react';
import {
  CreditCard,
  Globe,
  Lock,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle2,
} from 'lucide-react';
import { AcademicProduct, UserProfile } from '../types';
import { validateTrustedUserEvent } from '../utils/antiTamperEngine';

interface PaymentModalProps {
  product: AcademicProduct;
  authorProfile?: UserProfile;
  onClose: () => void;
  onConfirmPurchase: (product: AcademicProduct) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  product,
  authorProfile,
  onClose,
  onConfirmPurchase,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'payoneer_card' | 'payoneer_account'>('payoneer_card');
  const [payoneerEmail, setPayoneerEmail] = useState('verified.student@payoneer.com');
  const [payoneerAccountId, setPayoneerAccountId] = useState('PAYO-STU-482910');
  const [cardNumber, setCardNumber] = useState('5289 •••• •••• 8891');
  const [cardHolder, setCardHolder] = useState('VERIFIED STUDENT');
  const [expiry, setExpiry] = useState('09/29');
  const [cvc, setCvc] = useState('842');
  const [processing, setProcessing] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const isPremiumAuthor = Boolean(authorProfile?.isPremium);
  const teacherPercent = isPremiumAuthor ? 78 : 80;
  const platformPercent = isPremiumAuthor ? 22 : 20;
  const teacherAmount = ((product.price * teacherPercent) / 100).toFixed(2);
  const platformAmount = ((product.price * platformPercent) / 100).toFixed(2);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);

    const check = validateTrustedUserEvent(e);
    if (!check.valid) {
      setSecurityError(
        check.reason ||
          'Untrusted synthetic payment event rejected by C. ACADEMY Anti-Emitter Guard.'
      );
      return;
    }

    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      onConfirmPurchase(product);
    }, 650);
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 secure-content-surface"
    >
      <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#FF4800]" />
            <h3 className="text-sm font-bold">
              C. ACADEMY · Payoneer Global Checkout (FLAG_SECURE)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handlePay} className="p-6 space-y-4">
          {securityError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{securityError}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {product.type === 'exam' ? 'Interactive Exam (7-Day Validity)' : 'Protected Academic PDF'}
              </span>
              <span className="font-mono">{product.subject}</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {product.topicName}
            </h4>
            <p className="text-xs text-slate-600">
              Author: {product.authorName} ({product.authorDegree}) · {product.auditorium}
            </p>
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Payoneer Checkout Total
              </span>
              <span className="text-lg font-bold font-mono tabular-nums text-[#0052FF]">
                ${product.price.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-1">
              <span>
                Payoneer Split ({teacherPercent}% Author / {platformPercent}% Platform):
              </span>
              <span>
                ${teacherAmount} / ${platformAmount}
              </span>
            </div>
          </div>

          {/* Payoneer Payment Method Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setPaymentMethod('payoneer_card')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                paymentMethod === 'payoneer_card'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#FF4800]" />
              <span>Payoneer / Bank Card</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('payoneer_account')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                paymentMethod === 'payoneer_account'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-[#FF4800]" />
              <span>Payoneer Balance</span>
            </button>
          </div>

          {paymentMethod === 'payoneer_card' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  required
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payoneer Mastercard / Encrypted Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 pr-9"
                  />
                  <CreditCard className="w-4 h-4 text-[#FF4800] absolute right-3 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    required
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CVC
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payoneer Account Email
                </label>
                <input
                  type="email"
                  required
                  value={payoneerEmail}
                  onChange={(e) => setPayoneerEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payoneer Payee / Customer ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={payoneerAccountId}
                    onChange={(e) => setPayoneerAccountId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 pr-9"
                  />
                  <Globe className="w-4 h-4 text-[#FF4800] absolute right-3 top-2.5" />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={processing}
            className="w-full py-3 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {processing ? (
              <span>Authorizing Payoneer Global Settlement...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Confirm & Pay ${product.price.toFixed(2)} via Payoneer
                </span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3" />
            <span>End-to-End TLS 1.3 & Payoneer Global Vault Tokenization</span>
          </div>
        </form>
      </div>
    </div>
  );
};
