import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OfficerQRScanner } from './components/OfficerQRScanner';
import { GatePassToastContainer, ToastItem } from './components/GatePassToast';
import { GatePassData } from './types';
import {
  ShieldCheck,
  Building2,
  Clock,
  Truck,
  CheckCircle2,
  ExternalLink,
  RotateCw,
  Scale,
  Award,
  Bell,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [validatedPasses, setValidatedPasses] = useState<GatePassData[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedCentre, setSelectedCentre] = useState<string>('Sanwer Procurement Centre');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) +
          ' • ' +
          now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch already passed passes from backend on load
  useEffect(() => {
    const fetchPassedPasses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/officer/passed-gate-passes', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setValidatedPasses(json.data);
        }
      } catch {
        // Ignore background fetch error
      }
    };
    fetchPassedPasses();
  }, []);

  // Toast management
  const addToast = (pass: GatePassData) => {
    const newToast: ToastItem = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'gate_pass',
      title: `Authorized Entry: ${pass.farmerName}`,
      passData: pass,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      duration: 6500,
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleViewDetails = (pass: GatePassData) => {
    const el = document.getElementById('ledger-table');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle new validation from the OfficerQRScanner component
  const handlePassValidated = (newPass: GatePassData) => {
    setValidatedPasses((prev) => {
      const filtered = prev.filter((p) => p.tokenNumber !== newPass.tokenNumber);
      return [newPass, ...filtered];
    });
    addToast(newPass);
  };

  // Real-time socket event listener for gate passes
  useEffect(() => {
    const handleRemoteGatePass = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.gatePassNumber) {
        const pass: GatePassData = {
          gatePassNumber: detail.gatePassNumber,
          tokenNumber: detail.tokenNumber,
          farmerName: detail.farmerName || 'Registered Farmer',
          farmerId: detail.farmerId || 'FMR1001',
          crop: detail.crop || 'Wheat (गेहूं)',
          quantity: detail.quantity || '25 Quintal',
          assignedGate: detail.assignedGate || 'Gate 1 (Scale 1)',
          gatePassPassedAt: detail.gatePassPassedAt || new Date().toLocaleString('en-IN'),
          verifiedAt: detail.gatePassPassedAt || 'Just now',
          status: 'Passed'
        };
        setValidatedPasses((prev) => {
          if (prev.some(p => p.gatePassNumber === pass.gatePassNumber)) return prev;
          return [pass, ...prev];
        });
        addToast(pass);
      }
    };

    window.addEventListener('gate:pass_passed', handleRemoteGatePass);
    return () => window.removeEventListener('gate:pass_passed', handleRemoteGatePass);
  }, []);

  // Quick simulation helper for demonstration
  const handleTriggerDemoToast = () => {
    const demoPasses = [
      {
        gatePassNumber: `GP-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        tokenNumber: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
        farmerName: 'Ramesh Patel (रमेश पटेल)',
        farmerId: 'FMR1001',
        farmerVillage: 'Sanwer (सांवेर)',
        crop: 'Wheat (गेहूं - Sharbati)',
        quantity: '40 Quintal',
        assignedGate: 'Gate 1 (Weighbridge Scale 1)',
        status: 'Passed',
        verifiedAt: 'Just now',
        gatePassPassedAt: new Date().toLocaleString('en-IN')
      },
      {
        gatePassNumber: `GP-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        tokenNumber: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
        farmerName: 'Suresh Verma (सुरेश वर्मा)',
        farmerId: 'FMR1042',
        farmerVillage: 'Bicholi Mardana',
        crop: 'Gram (चना)',
        quantity: '25 Quintal',
        assignedGate: 'Gate 2 (Scale 2)',
        status: 'Passed',
        verifiedAt: 'Just now',
        gatePassPassedAt: new Date().toLocaleString('en-IN')
      }
    ];

    const pick = demoPasses[Math.floor(Math.random() * demoPasses.length)];
    handlePassValidated(pick);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      {/* Top Government Navigation Header */}
      <header className="bg-emerald-900 text-white border-b border-emerald-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-white border border-emerald-700 shadow-sm">
              <Scale className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-widest text-emerald-400">
                  Government of Madhya Pradesh
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-700">
                  e-Uparjan MSP Portal
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Mandisathi</span>
                <span className="text-slate-400 font-normal text-xs">|</span>
                <span className="text-xs font-semibold text-emerald-200">
                  Procurement Gate Terminal
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right text-xs">
              <span className="text-slate-300 flex items-center gap-1 justify-end font-mono">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentTime}</span>
              </span>
              <span className="text-emerald-300 font-semibold">
                Officer: Rajesh Sharma (ID: OFF001)
              </span>
            </div>

            <button
              type="button"
              onClick={handleTriggerDemoToast}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800/90 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/70 transition-colors shadow-sm"
              title="Simulate real-time QR scan validation toast"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Simulate Scan Toast</span>
            </button>

            <div
              className="relative inline-flex items-center justify-center p-2 rounded-lg bg-emerald-800/70 text-emerald-200 border border-emerald-700/60"
              title="Real-time validation toasts active"
            >
              <Bell className="w-4 h-4 text-emerald-200" />
              {toasts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-emerald-950 shadow">
                  {toasts.length}
                </span>
              )}
            </div>

            <a
              id="return-to-portal-link"
              href="/centre-officer.html"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-700 transition-colors shadow-sm"
              title="Switch to Full Officer Dashboard"
            >
              <span>Full Officer Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mandi Centre Status Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-5 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase font-bold text-emerald-200 tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Assigned Mandi Complex Terminal</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{selectedCentre}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-400/40 text-emerald-300">
                Gate 1 Active
              </span>
            </h2>
            <p className="text-xs text-emerald-100 max-w-xl">
              Strict Procurement Jurisdiction: Only tokens scheduled for this centre are authorized for entry. Live video frames are automatically analyzed to issue official gate entry passes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right text-xs bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-4 py-2.5">
              <div className="text-emerald-300 font-medium">Weighbridge Scale 1 & 2</div>
              <div className="font-bold text-white text-sm">Operating Normal (09:00 - 17:00)</div>
            </div>
          </div>
        </div>

        {/* 4 Overview Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Validated Gate Passes</span>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {validatedPasses.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Authorized vehicle entries today</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Gate 1 Scale Queue</span>
              <Truck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {Math.max(2, 8 - validatedPasses.length)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tractors waiting for weighment</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Average Wait Time</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1">18 mins</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Fast-track gate pass active</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Security Check Status</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">100%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">QR verified with Aadhaar/DBT</div>
          </div>
        </div>

        {/* PRIMARY USER REQUIREMENT: React Component for Procurement Officer with Browser Camera API */}
        <div className="space-y-2">
          <OfficerQRScanner
            defaultCentreName={selectedCentre}
            onValidated={handlePassValidated}
            onShowToast={addToast}
          />
        </div>

        {/* Real-time Ledger of Authorized Gate Entries */}
        <div id="ledger-table" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-sm text-slate-900">
                Today's Authorized Gate Entries Ledger ({validatedPasses.length} Vehicles)
              </h3>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/officer/passed-gate-passes');
                  const json = await res.json();
                  if (json.success && Array.isArray(json.data)) {
                    setValidatedPasses(json.data);
                  }
                } catch {}
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-1"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Gate Pass #</th>
                  <th className="px-4 py-3">Token #</th>
                  <th className="px-4 py-3">Farmer Name</th>
                  <th className="px-4 py-3">Crop & Quantity</th>
                  <th className="px-4 py-3">Allotted Gate</th>
                  <th className="px-4 py-3">Passed Timestamp</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {validatedPasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No vehicles authorized yet today. Use the camera scanner above to validate farmer digital tokens!
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence initial={false}>
                    {validatedPasses.map((pass, idx) => (
                      <motion.tr
                        key={pass.gatePassNumber || pass.tokenNumber || idx}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {pass.gatePassNumber}
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-700 font-semibold">
                          {pass.tokenNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div>{pass.farmerName}</div>
                          <div className="text-[10px] text-slate-400">{pass.farmerId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900">{pass.crop}</span>{' '}
                          <span className="text-slate-500">({pass.quantity})</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {pass.assignedGate || 'Gate 1'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {pass.verifiedAt || pass.gatePassPassedAt || 'Just now'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Passed</span>
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <p>Mandisathi Procurement Operations • Department of Food, Civil Supplies & Consumer Protection, Madhya Pradesh</p>
        <p className="mt-1 text-[11px] text-slate-400">Official Gate Pass Terminal • Secure Browser Camera Scanning Engine</p>
      </footer>

      {/* Visual Toast Notification System for Gate Pass Validation */}
      <GatePassToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
        onViewDetails={handleViewDetails}
      />
    </div>
  );
}
