import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Footprints, 
  Copy, 
  Check, 
  X, 
  Wifi, 
  ShieldCheck, 
  Clock, 
  RotateCcw,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Layers,
  Sparkles,
  QrCode,
  ExternalLink,
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react';
import { recordsService, mobileService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useLiveMetrics } from '../hooks/useLiveMetrics';

export default function ConnectPhoneModal({ 
  isOpen, 
  onClose, 
  onDataUpdated, 
  currentSteps = 0, 
  currentScreenTime = 0,
  deviceStatus,
  onStatusChange
}) {
  const { success, error, info } = useToast();

  const [loadingPairing, setLoadingPairing] = useState(false);
  const [pairingData, setPairingData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [pairingError, setPairingError] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Scan QR code with your mobile camera');

  // Real-time WebSocket hook for instant pairing state updates
  const { pairingEvent, refreshDeviceStatus } = useLiveMetrics();

  // Watch for real-time WebSocket pairing events
  useEffect(() => {
    if (!pairingEvent) return;

    if (pairingEvent.type === 'device_scanned') {
      setStatusMessage(`Phone scanned! Waiting for permission on ${pairingEvent.device_name || 'your phone'}...`);
      info('QR Code scanned by your phone!');
    } else if (pairingEvent.type === 'device_approval_required') {
      setStatusMessage(`Please tap "Allow Data Sharing" on your phone.`);
    } else if (pairingEvent.type === 'device_connected') {
      setStatusMessage(`Connected to ${pairingEvent.device_name || 'Android phone'}!`);
      success(`Android device ${pairingEvent.device_name || 'companion'} connected successfully!`);
      if (onStatusChange) onStatusChange();
      if (onDataUpdated) onDataUpdated();
      setTimeout(() => {
        onClose();
      }, 1600);
    } else if (pairingEvent.type === 'pairing_expired') {
      setStatusMessage('Pairing session expired (2-minute window). Click Regenerate.');
      setPairingData(null);
    }
  }, [pairingEvent, onStatusChange, onDataUpdated, onClose, success, info]);

  // Fetch or regenerate QR code pairing session
  const initiatePairingSession = async () => {
    setLoadingPairing(true);
    setPairingError(null);
    setStatusMessage('Generating secure 2-minute pairing session...');
    try {
      const res = await mobileService.createPairing();
      setPairingData(res.data);
      setTimeLeft(res.data.expires_in_seconds || 120);
      setStatusMessage('Scan QR code with your phone camera or Google Lens');
    } catch (err) {
      setPairingError(err.response?.data?.detail || 'Failed to initialize QR code.');
      setStatusMessage('Failed to initialize session. Please retry.');
    } finally {
      setLoadingPairing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initiatePairingSession();
    }
  }, [isOpen]);

  // 120-second countdown timer
  useEffect(() => {
    if (!pairingData || !pairingData.expires_at) return;
    const expiryTime = new Date(pairingData.expires_at).getTime();

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setPairingData(null);
        setStatusMessage('QR code expired. Click "Regenerate QR" below.');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pairingData]);

  const handleDisconnect = async (deviceId = 'all') => {
    setDisconnecting(true);
    try {
      await mobileService.disconnectDevice(deviceId);
      success('Android companion device unpaired.');
      if (onStatusChange) onStatusChange();
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      error('Failed to unpair device.');
    } finally {
      setDisconnecting(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  const isConnected = Boolean(deviceStatus?.is_connected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Connect Android Phone
                </h3>
                {isConnected ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Instant QR
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Sync live steps, screen time &amp; wellness in real time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Active Paired Device Status Banner if connected */}
          {isConnected && (
            <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Android Companion Connected
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    Real-time steps and screen time are syncing live with your dashboard.
                  </p>
                  {deviceStatus?.last_sync_at && (
                    <span className="inline-block mt-1.5 text-[11px] font-semibold text-emerald-700">
                      Last synced: {new Date(deviceStatus.last_sync_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDisconnect()}
                disabled={disconnecting}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{disconnecting ? 'Unpairing...' : 'Unpair'}</span>
              </button>
            </div>
          )}

          {/* QR Code Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-indigo-50/30 border border-slate-200/80 text-center space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
              <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>{statusMessage}</span>
            </div>

            {/* QR Code SVG Display */}
            <div className="mx-auto w-52 h-52 bg-white rounded-2xl p-3 border-2 border-indigo-200 shadow-md flex items-center justify-center">
              {loadingPairing ? (
                <div className="flex flex-col items-center gap-2 text-indigo-600">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-semibold">Generating QR Code...</span>
                </div>
              ) : pairingData?.qr_svg ? (
                <div 
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:rounded-lg"
                  dangerouslySetInnerHTML={{ __html: pairingData.qr_svg }}
                />
              ) : (
                <div className="text-center p-4">
                  <p className="text-xs text-slate-400 font-medium mb-3">QR code expired</p>
                  <button
                    onClick={initiatePairingSession}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    Generate New QR
                  </button>
                </div>
              )}
            </div>

            {/* Countdown Timer & Refresh */}
            <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
              <span>
                Expires in: <strong className="text-indigo-600 font-bold">{formatTime(timeLeft)}</strong>
              </span>
              <button
                onClick={initiatePairingSession}
                disabled={loadingPairing}
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPairing ? 'animate-spin' : ''}`} />
                <span>Regenerate QR</span>
              </button>
            </div>
          </div>

          {pairingError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pairingError}</span>
            </div>
          )}

          {/* Simple 3-step Instructions */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              How to Connect Your Phone
            </h4>
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                1
              </span>
              <span>
                Open your phone camera, Google Lens, or companion app.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                2
              </span>
              <span>
                Scan the QR code above and tap the link to open the connection page.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                3
              </span>
              <span>
                Tap <strong>"Allow Data Sharing"</strong> on your phone (like Jovi Home / Digital Wellbeing) to stream live steps &amp; screen time!
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Encrypted WebSocket Channel</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
