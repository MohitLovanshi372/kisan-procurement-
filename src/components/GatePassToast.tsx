import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  X,
  Copy,
  Check,
  Truck,
  Scale,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { GatePassData } from '../types';

export interface ToastItem {
  id: string;
  type: 'gate_pass' | 'success' | 'warning' | 'error';
  title: string;
  passData?: GatePassData;
  message?: string;
  timestamp: string;
  duration?: number; // duration in ms, default 6000
}

interface GatePassToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onViewDetails?: (pass: GatePassData) => void;
}

interface SingleToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onViewDetails?: (pass: GatePassData) => void;
}

const SingleToast: React.FC<SingleToastProps> = ({ toast, onDismiss, onViewDetails }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(100);
  const duration = toast.duration || 6500;

  useEffect(() => {
    if (isPaused) return;

    const interval = 50; // update every 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(toast.id);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, isPaused, onDismiss, toast.id]);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const pass = toast.passData;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      id={`gate-pass-toast-${toast.id}`}
      className="pointer-events-auto relative w-full overflow-hidden rounded-xl border-2 border-emerald-500/40 bg-white p-4 shadow-xl shadow-emerald-950/15 transition-all hover:border-emerald-500 hover:shadow-2xl"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Glowing Animated Icon */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                <ShieldCheck className="h-3 w-3" />
                Gate Pass Validated
              </span>
              <span className="text-[10px] text-slate-400">
                {toast.timestamp}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight mt-0.5">
              {toast.title}
            </h4>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Pass Details */}
      {pass ? (
        <div className="mt-3 space-y-2 text-xs">
          {/* Highlight Gate Pass Number & Token */}
          <div className="flex items-center justify-between rounded-lg bg-emerald-50/70 border border-emerald-200/70 px-2.5 py-1.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Pass #
              </span>
              <div className="font-mono text-sm font-black text-emerald-950">
                {pass.gatePassNumber}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Token
              </span>
              <div className="font-mono text-xs font-bold text-slate-800">
                {pass.tokenNumber}
              </div>
            </div>
          </div>

          {/* Farmer & Logistics Details */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Farmer
              </span>
              <div className="font-bold text-slate-900 truncate">
                {pass.farmerName}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {pass.farmerId} • {pass.farmerVillage || 'Sanwer'}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Crop & Volume
              </span>
              <div className="font-bold text-emerald-700 truncate">
                {pass.crop}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {pass.quantity}
              </div>
            </div>
          </div>

          {/* Assigned Lane */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-100">
            <Truck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              Assigned: <strong>{pass.assignedGate || 'Gate 1 (Weighbridge Scale 1)'}</strong>
            </span>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={(e) => handleCopy(e, pass.gatePassNumber)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Pass ID</span>
                </>
              )}
            </button>

            {onViewDetails && (
              <button
                type="button"
                onClick={() => onViewDetails(pass)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <span>View Slip</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-600">
          {toast.message || 'Verification successfully completed.'}
        </p>
      )}

      {/* Real-time Progress Countdown Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-100 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export const GatePassToastContainer: React.FC<GatePassToastContainerProps> = ({
  toasts,
  onDismiss,
  onViewDetails,
}) => {
  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-md pointer-events-none px-3 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <SingleToast
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            onViewDetails={onViewDetails}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
