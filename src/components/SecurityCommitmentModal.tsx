import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface SecurityCommitmentModalProps {
  onAgree: () => void;
  onDisagree: () => void;
  isTerminated: boolean;
  onRelaunchAfterTerminate: () => void;
}

export const SecurityCommitmentModal: React.FC<SecurityCommitmentModalProps> = ({
  onAgree,
  onDisagree,
  isTerminated,
  onRelaunchAfterTerminate,
}) => {
  const formattedCurrentDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  if (isTerminated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full border border-red-900/60 bg-slate-900/90 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
            <XCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Application Session Terminated
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Access to the C. ACADEMY platform requires mandatory acceptance of the Warning and Product Security Commitment Document. Because you selected Disagree, your session has been closed immediately.
          </p>
          <div className="pt-2">
            <button
              onClick={onRelaunchAfterTerminate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Relaunch C. ACADEMY Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950/95 text-slate-900 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-3xl w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h1 className="text-base md:text-lg font-bold tracking-tight text-white">
                WARNING AND PRODUCT SECURITY COMMITMENT DOCUMENT
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                C. ACADEMY Platform Legal & Copyright Compliance Gate
              </p>
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-300 shrink-0">
            {formattedCurrentDate}
          </span>
        </div>

        {/* Scrollable Legal Document Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-5 text-sm text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs text-slate-700">
            <p>
              <strong className="text-slate-900">Date:</strong> {formattedCurrentDate}
            </p>
            <p>
              <strong className="text-slate-900">Document Type:</strong> Warning Regarding Confidentiality and Copyright Protection
            </p>
          </div>

          <section className="space-y-1.5">
            <h2 className="text-base font-semibold text-slate-900">
              1. Introduction and Purpose
            </h2>
            <p>
              This document has been prepared to ensure the security of digital products, training materials, content, and any products offered for sale (hereinafter referred to as the &quot;Product&quot;) on the [C. ACADEMY] platform, to protect copyright laws, and to prevent unauthorized distribution. Every individual using the platform agrees to comply with the rules and liability terms outlined below.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">
              2. Prohibited Actions
            </h2>
            <p>
              It is strictly prohibited to acquire, copy, or distribute any product offered for sale or provided to the user within the platform through the following methods:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong className="text-slate-900">Digital Theft Methods:</strong> Screen recording, taking screenshots, or stealing source codes.
              </li>
              <li>
                <strong className="text-slate-900">Physical and Alternative Methods:</strong> Making visual or audio recordings using another device (such as a phone, camera, etc.).
              </li>
              <li>
                <strong className="text-slate-900">Distribution Channels:</strong> Sharing, transferring, or reselling information or products obtained through the methods mentioned above—whether paid or free—via third-party applications (Telegram channels, social networks, forums, cloud storage systems, etc.).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">
              3. Legal Liability and Compensation for Damages
            </h2>
            <p>
              In the event that any of the rules listed above are violated, the violator directly accepts the following financial and legal obligations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong className="text-slate-900">Coverage of All Expenses:</strong> All costs resulting from illegal distribution—including but not limited to material damages incurred by the company, legal proceedings, attorney fees, court costs, expert fees, and lost profits—shall be paid in full by the party committing the violation.
              </li>
              <li>
                <strong className="text-slate-900">Fines and Penalties:</strong> Fines stipulated by legislation regarding copyright infringement shall be applied.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-base font-semibold text-slate-900">
              4. Final Provisions
            </h2>
            <p>
              This document has legal force for every user who registers on the application or purchases a product. Violation of these rules provides grounds for applying to law enforcement agencies and initiating legal proceedings.
            </p>
          </section>

          <section className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              User Acknowledgment:
            </h3>
            <p className="text-xs md:text-sm text-slate-800 font-medium">
              I have read and familiarized myself with the terms stated above, and I accept full responsibility by acknowledging them.
            </p>
          </section>
        </div>

        {/* Action Buttons at Bottom */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onDisagree}
            className="px-5 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-sm font-semibold transition-all duration-150 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            Disagree
          </button>
          <button
            type="button"
            onClick={onAgree}
            className="px-6 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0040C9] text-white text-sm font-semibold shadow-sm transition-all duration-150 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Agree
          </button>
        </div>
      </div>
    </div>
  );
};
