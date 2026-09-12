import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Volume2,
  VolumeX,
  Upload,
  Keyboard,
  Truck,
  Scale,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { GatePassData, VerifyTokenResponse } from '../types';
import { playSuccessChime, playScanBeep, playErrorBuzz } from '../utils/audio';

interface OfficerQRScannerProps {
  onValidated?: (pass: GatePassData) => void;
  onShowToast?: (pass: GatePassData) => void;
  officerToken?: string;
  defaultCentreName?: string;
  className?: string;
}

export const OfficerQRScanner: React.FC<OfficerQRScannerProps> = ({
  onValidated,
  onShowToast,
  officerToken: propToken,
  defaultCentreName = 'Sanwer Procurement Centre',
  className = '',
}) => {
  // Video and Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // States
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanning & Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'upload'>('camera');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Verification Results
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<VerifyTokenResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPassNumber, setCopiedPassNumber] = useState<boolean>(false);

  // Auth token state
  const [activeToken, setActiveToken] = useState<string>(() => {
    return propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');
  });

  // Ensure officer session token is present
  const ensureOfficerAuth = useCallback(async (): Promise<string | null> => {
    let currentToken = activeToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');
    
    // Check if token exists and seems valid
    if (currentToken && currentToken.length > 10) {
      return currentToken;
    }

    // Auto-authenticate as default Centre Officer for seamless instant scanning experience
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: '9893011111',
          password: 'officer123',
          portalType: 'centre_officer'
        })
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        const token = data.data.token;
        setActiveToken(token);
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        return token;
      }
    } catch {
      // Fallback
    }
    return currentToken || null;
  }, [activeToken]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Frame decoding loop
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);

        // Method A: Check for native BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ['qr_code'] });
            detector.detect(video)
              .then((barcodes) => {
                if (barcodes && barcodes.length > 0 && !isProcessing) {
                  handleCodeDetected(barcodes[0].rawValue);
                  return;
                }
              })
              .catch(() => {
                // Fallback to jsQR
              });
          } catch {
            // Fallback to jsQR
          }
        }

        // Method B: jsQR decoding
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && !isProcessing) {
            handleCodeDetected(code.data);
            return;
          }
        } catch {
          // Ignore frame read error
        }
      }
    }

    if (!isProcessing) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [isProcessing]);

  // Start Browser Camera
  const startCamera = useCallback(async () => {
    setIsStartingCamera(true);
    setCameraError(null);

    // Stop any existing stream
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported in this browser environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check for torch/flash capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? (videoTrack.getCapabilities() as unknown as { torch?: boolean }) : null;
        setHasTorch(Boolean(capabilities?.torch));
      }

      setIsCameraActive(true);
      setIsStartingCamera(false);

      // Start scan loop
      animFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const errObj = err as Error;
      let msg = 'Unable to access camera. Please verify camera permissions in your browser.';
      if (errObj.name === 'NotAllowedError' || errObj.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in browser address bar settings.';
      } else if (errObj.name === 'NotFoundError' || errObj.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device. You can use Manual Token Entry or Upload QR Image.';
      } else if (errObj.name === 'NotReadableError' || errObj.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application or tab.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
      setIsStartingCamera(false);
    }
  }, [facingMode, scanFrame, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.error('Failed to toggle torch:', e);
      }
    }
  };

  // Flip Camera Facing
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Trigger when facingMode changes if active
  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Central Token Verification Request
  const validateToken = useCallback(
    async (tokenOrPayload: string) => {
      setIsValidating(true);
      setErrorMessage(null);

      if (audioEnabled) {
        playScanBeep();
      }

      try {
        const authToken = await ensureOfficerAuth();

        // Extract clean token if string format
        let searchToken = tokenOrPayload.trim();
        try {
          const parsed = JSON.parse(tokenOrPayload);
          if (parsed?.tokenNumber) searchToken = String(parsed.tokenNumber).trim();
        } catch {
          const match = searchToken.match(/TK-\d+/i);
          if (match) searchToken = match[0].toUpperCase();
        }

        const res = await fetch('/api/officer/verify-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            tokenNumber: searchToken,
            qrPayload: tokenOrPayload,
          }),
        });

        const data: VerifyTokenResponse = await res.json();

        if (res.ok && data.success && data.valid && data.data) {
          setValidationResult(data);
          if (audioEnabled) {
            playSuccessChime();
          }
          if (onValidated && data.data) {
            onValidated(data.data);
          }
          if (onShowToast && data.data) {
            onShowToast(data.data);
          }
        } else if (data.isCentreMismatch) {
          setValidationResult(data);
          if (audioEnabled) {
            playErrorBuzz();
          }
        } else {
          setValidationResult(data);
          setErrorMessage(data.message || 'Token verification failed. Not found in registry.');
          if (audioEnabled) {
            playErrorBuzz();
          }
        }
      } catch (err) {
        console.error('Verification error:', err);
        setErrorMessage('Failed to connect to verification server. Please check your network connection.');
        if (audioEnabled) {
          playErrorBuzz();
        }
      } finally {
        setIsValidating(false);
      }
    },
    [audioEnabled, ensureOfficerAuth, onValidated]
  );

  // Handle Detected QR code from camera
  const handleCodeDetected = (codeData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setScannedCode(codeData);

    // Run backend verification
    validateToken(codeData);

    // Debounce camera frame processing
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  };

  // Reset and Scan Next Farmer
  const handleResetForNextScan = () => {
    setValidationResult(null);
    setErrorMessage(null);
    setScannedCode(null);
    setManualTokenInput('');
    setIsProcessing(false);

    if (activeTab === 'camera' && !isCameraActive) {
      startCamera();
    }
  };

  // Copy Gate Pass Number
  const copyGatePass = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedPassNumber(true);
      setTimeout(() => setCopiedPassNumber(false), 2000);
    }
  };

  // Print Gate Pass Slip
  const handlePrintSlip = () => {
    window.print();
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          setScannedCode(code.data);
          validateToken(code.data);
        } else {
          setErrorMessage('Could not decode QR code from the uploaded image. Please try a clearer picture.');
          if (audioEnabled) playErrorBuzz();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="officer-qr-scanner-card" className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap justify-between items-center gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
              <span>Mandi Gate Pass Security</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-base font-bold text-white">
              Procurement Officer QR Gate Scanner
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            id="officer-audio-toggle-btn"
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={audioEnabled ? 'Mute scan audio' : 'Unmute scan audio'}
            aria-label="Toggle audio feedback"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Centre Badge */}
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" />
            <span>{defaultCentreName}</span>
          </span>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2 text-xs font-semibold">
        <button
          id="scanner-tab-camera"
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'camera'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Camera Scanner</span>
        </button>

        <button
          id="scanner-tab-manual"
          type="button"
          onClick={() => {
            setActiveTab('manual');
            stopCamera();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'manual'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Manual Token Entry</span>
        </button>

        <button
          id="scanner-tab-upload"
          type="button"
          onClick={() => {
            setActiveTab('upload');
            stopCamera();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'upload'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload QR Image</span>
        </button>
      </div>

      <div className="p-5">
        {/* TAB 1: Camera Scanner */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            {/* Camera Viewport Container */}
            <div className="relative rounded-2xl bg-slate-950 overflow-hidden border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[340px]">
              {/* Hidden Canvas for Frame Decoding */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Video Element */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full max-h-[380px] object-cover transition-opacity duration-300 ${
                  isCameraActive ? 'opacity-100' : 'opacity-0 absolute'
                }`}
              />

              {/* Reticle / Viewfinder Frame when Camera is Active */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="relative w-64 h-64 border border-emerald-500/30 rounded-2xl">
                    {/* Reticle Corner Brackets */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                    {/* Laser Scan Animation Line */}
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[scanLaser_2s_infinite_ease-in-out]" />

                    {/* Center Crosshair Target */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                      <div className="w-6 h-0.5 bg-emerald-400" />
                      <div className="w-0.5 h-6 bg-emerald-400 absolute" />
                    </div>
                  </div>
                </div>
              )}

              {/* Placeholder when Camera is OFF */}
              {!isCameraActive && (
                <div className="py-12 px-6 text-center text-slate-400 max-w-md space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-emerald-400">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Browser Camera Offline</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Start the camera to automatically scan farmer digital token QR codes at the gate terminal.
                    </p>
                  </div>
                  <button
                    id="officer-start-camera-btn"
                    type="button"
                    onClick={startCamera}
                    disabled={isStartingCamera}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50"
                  >
                    {isStartingCamera ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Initializing Lens...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Start Camera Scanner</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* In-camera Status Banner */}
              {isCameraActive && (
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center text-xs font-medium text-slate-300 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Align Farmer QR code inside the target reticle</span>
                  </div>
                  {isValidating && (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Validating...</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Camera Controls Bar */}
            {isCameraActive && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    id="officer-stop-camera-btn"
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </button>

                  <button
                    id="officer-flip-camera-btn"
                    type="button"
                    onClick={toggleFacingMode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors"
                    title="Switch front/back camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
                  </button>

                  {hasTorch && (
                    <button
                      id="officer-torch-btn"
                      type="button"
                      onClick={toggleTorch}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        torchOn
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{torchOn ? 'Torch On' : 'Torch Off'}</span>
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Auto-detection active • 60 FPS scan loop
                </div>
              </div>
            )}

            {/* Camera Error Alert */}
            {cameraError && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Camera Access Note</div>
                  <div className="mt-0.5">{cameraError}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 text-xs"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className="px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-800 font-semibold hover:bg-amber-100 text-xs"
                    >
                      Switch to Manual Input
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Manual Token Entry */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <label htmlFor="officer-manual-token-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Enter Farmer Token Number
              </label>
              <div className="flex gap-2">
                <input
                  id="officer-manual-token-input"
                  type="text"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualTokenInput.trim()) {
                      validateToken(manualTokenInput.trim());
                    }
                  }}
                  placeholder="e.g. TK-1042 or TK-1043"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-800 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  id="officer-manual-verify-btn"
                  type="button"
                  onClick={() => {
                    if (manualTokenInput.trim()) {
                      validateToken(manualTokenInput.trim());
                    }
                  }}
                  disabled={!manualTokenInput.trim() || isValidating}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Validate Token</span>
                </button>
              </div>

              {/* Quick Demo Token Chips */}
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-500 mr-2 font-medium">Quick Test Tokens:</span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1">
                  {['TK-1042', 'TK-1043', 'TK-1044', 'TK-1045'].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => {
                        setManualTokenInput(tok);
                        validateToken(tok);
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Upload QR Image */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/60 transition-colors">
              <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <div className="font-semibold text-sm text-slate-800">
                Select or Drop Farmer QR Slip Image
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload a mobile screenshot or photographed printed procurement token slip (PNG, JPG).
              </p>
              <label
                htmlFor="officer-file-upload-input"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow-sm"
              >
                <span>Browse File</span>
                <input
                  id="officer-file-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Loading Spinner during Token Validation */}
        {isValidating && (
          <div className="mt-4 p-5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
            <div className="text-sm font-bold text-emerald-950">Validating Token with Procurement Registry...</div>
            <div className="text-xs text-emerald-700">Checking centre jurisdiction, quota status, and assigning weighbridge gate.</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONFIRMATION CARD: 'Gate Pass Validated' (EXPLICIT USER DIRECTIVE)       */}
        {/* ========================================================================= */}
        {validationResult && validationResult.valid && validationResult.data && (
          <div
            id="gate-pass-validated-confirmation-card"
            className="mt-5 rounded-2xl border-2 border-emerald-500 bg-gradient-to-b from-emerald-50/50 via-white to-white shadow-lg overflow-hidden transition-all"
          >
            {/* Confirmation Header Banner */}
            <div className="px-6 py-4 bg-emerald-600 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white text-emerald-700 flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-200 font-bold">
                    Official Mandi Authorization
                  </div>
                  {/* The explicitly requested 'Gate Pass Validated' confirmation message */}
                  <h3 id="gate-pass-validated-message" className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>Gate Pass Validated</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase border border-white/30">
                      Entry Authorized
                    </span>
                  </h3>
                </div>
              </div>

              {/* Digital Passed Stamp */}
              <div className="border-2 border-dashed border-white/70 px-3 py-1 rounded-lg text-center transform -rotate-1 bg-emerald-700/60">
                <span className="text-xs font-mono font-black tracking-widest uppercase">
                  PASSED • GATE 1
                </span>
              </div>
            </div>

            {/* Slip Core Details */}
            <div className="p-6 space-y-5">
              {/* Top Key Identifiers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="text-slate-500 font-medium">Gate Pass Number</div>
                  <div className="font-mono font-bold text-sm text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <span>{validationResult.data.gatePassNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyGatePass(validationResult.data?.gatePassNumber || '')}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy Pass Number"
                    >
                      {copiedPassNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 font-medium">Digital Token</div>
                  <div className="font-mono font-bold text-sm text-emerald-700 mt-0.5">
                    {validationResult.data.tokenNumber}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 font-medium">Validation Timestamp</div>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {validationResult.data.verifiedAt || validationResult.data.gatePassPassedAt}
                  </div>
                </div>
              </div>

              {/* Farmer & Procurement Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Farmer Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-emerald-800">
                    <span>👨‍🌾 Farmer Identification</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Farmer Name:</span>
                    <span className="font-bold text-slate-800">{validationResult.data.farmerName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Farmer ID:</span>
                    <span className="font-mono font-semibold text-slate-800">{validationResult.data.farmerId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Mobile Contact:</span>
                    <span className="font-medium text-slate-800">{validationResult.data.farmerMobile}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Village / Tehsil:</span>
                    <span className="font-medium text-slate-800">{validationResult.data.farmerVillage}</span>
                  </div>
                </div>

                {/* Crop & Procurement Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-emerald-800">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Vehicle & Produce Cargo</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Produce Crop:</span>
                    <span className="font-bold text-slate-900 bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                      🌾 {validationResult.data.crop}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Approved Quantity:</span>
                    <span className="font-bold text-slate-800">{validationResult.data.quantity}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Allotted Gate:</span>
                    <span className="font-bold text-emerald-700">{validationResult.data.assignedGate}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Officer in Charge:</span>
                    <span className="font-medium text-slate-800">{validationResult.data.officerName || 'Centre Officer'}</span>
                  </div>
                </div>
              </div>

              {/* Physical Gate Direction Notice */}
              <div className="p-3.5 rounded-xl bg-emerald-100/60 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <span>
                    <strong>Vehicle Clearance Granted:</strong> Instruct farmer tractor/vehicle to enter through{' '}
                    <strong>{validationResult.data.assignedGate}</strong> for direct weighment.
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-200 px-2 py-1 rounded">
                  Status: Arrived
                </span>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex gap-2">
                  <button
                    id="gate-pass-print-btn"
                    type="button"
                    onClick={handlePrintSlip}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Gate Pass Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyGatePass(`Gate Pass: ${validationResult.data?.gatePassNumber}\nToken: ${validationResult.data?.tokenNumber}\nFarmer: ${validationResult.data?.farmerName}\nCrop: ${validationResult.data?.crop} (${validationResult.data?.quantity})\nGate: ${validationResult.data?.assignedGate}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedPassNumber ? 'Copied Details!' : 'Copy Summary'}</span>
                  </button>
                </div>

                <button
                  id="gate-pass-scan-next-btn"
                  type="button"
                  onClick={handleResetForNextScan}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-900/20 transition-all"
                >
                  <span>Authorize Next Vehicle</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ERROR / MISMATCH WARNING DISPLAY */}
        {validationResult && !validationResult.valid && (
          <div className="mt-4 p-5 rounded-2xl border-2 border-rose-400 bg-rose-50/70 text-rose-950 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-900">
                  {validationResult.isCentreMismatch ? 'Centre Jurisdiction Mismatch' : 'Invalid or Unregistered Token'}
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">{validationResult.message}</p>
              </div>
            </div>

            {validationResult.isCentreMismatch && (
              <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Token Allocated Centre:</span>{' '}
                  <strong className="text-rose-700">{validationResult.tokenCentre}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Your Assigned Centre:</span>{' '}
                  <strong className="text-slate-800">{validationResult.officerCentre}</strong>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Due to strict procurement isolation rules, officers cannot issue gate passes for tokens belonging to different mandi centres. Please direct the farmer to their designated facility.
                </p>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleResetForNextScan}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Scan Another Token
              </button>
            </div>
          </div>
        )}

        {/* General Error Message */}
        {errorMessage && !validationResult && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={handleResetForNextScan}
              className="px-3 py-1 rounded-lg bg-white border border-rose-300 font-bold text-rose-800 hover:bg-rose-100"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Embedded Printable Gate Pass Slip (Visible when window.print() is called) */}
      {validationResult && validationResult.valid && validationResult.data && (
        <div id="printableGatePassSlip" className="hidden print:block p-8 font-sans text-black">
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h1 className="text-2xl font-bold uppercase">Government of Madhya Pradesh</h1>
            <h2 className="text-xl font-bold">MSP Procurement Centre • Gate Entry Pass</h2>
            <div className="text-sm font-semibold">{validationResult.data.centre}</div>
          </div>

          <div className="border-2 border-black p-4 mb-4">
            <div className="text-center font-bold text-lg mb-2">GATE PASS VALIDATED & PASSED</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>Gate Pass Number:</strong> {validationResult.data.gatePassNumber}</div>
              <div><strong>Token Number:</strong> {validationResult.data.tokenNumber}</div>
              <div><strong>Farmer Name:</strong> {validationResult.data.farmerName}</div>
              <div><strong>Farmer ID:</strong> {validationResult.data.farmerId}</div>
              <div><strong>Mobile:</strong> {validationResult.data.farmerMobile}</div>
              <div><strong>Village:</strong> {validationResult.data.farmerVillage}</div>
              <div><strong>Crop:</strong> {validationResult.data.crop}</div>
              <div><strong>Quantity:</strong> {validationResult.data.quantity}</div>
              <div><strong>Allotted Weighbridge:</strong> {validationResult.data.assignedGate}</div>
              <div><strong>Passed At:</strong> {validationResult.data.verifiedAt}</div>
              <div><strong>Officer:</strong> {validationResult.data.officerName}</div>
            </div>
          </div>

          <div className="mt-8 flex justify-between text-sm pt-8 border-t border-black">
            <div>Officer Signature / Seal</div>
            <div>Weighbridge Operator Signature</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerQRScanner;
