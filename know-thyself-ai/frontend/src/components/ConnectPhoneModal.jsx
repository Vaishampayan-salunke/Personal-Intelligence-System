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
  Sparkles
} from 'lucide-react';
import { recordsService, authService, mobileService } from '../services/api';
import { useToast } from '../context/ToastContext';

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
  const [activeTab, setActiveTab] = useState('companion'); // 'companion' or 'web_sensor'

  // Companion App State
  const [pairingCode, setPairingCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Web Sensor State
  const [urlCopied, setUrlCopied] = useState(false);
  const [sensorActive, setSensorActive] = useState(false);
  const [liveAccel, setLiveAccel] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [stepsToday, setStepsToday] = useState(currentSteps);
  const [screenSeconds, setScreenSeconds] = useState(Math.round(currentScreenTime * 3600));

  useEffect(() => {
    setStepsToday(currentSteps);
  }, [currentSteps]);

  useEffect(() => {
    setScreenSeconds(Math.round(currentScreenTime * 3600));
  }, [currentScreenTime]);

  const mobileUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Generate pairing code
  const fetchPairingCode = async () => {
    setLoadingCode(true);
    setCodeError(null);
    try {
      const res = await mobileService.getPairingCode();
      setPairingCode(res.data.pairing_code);
      setTimeLeft(res.data.expires_in_seconds || 600);
      setExpiresAt(Date.now() + (res.data.expires_in_seconds || 600) * 1000);
    } catch (err) {
      setCodeError(err.response?.data?.detail || 'Failed to generate 6-digit code.');
    } finally {
      setLoadingCode(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPairingCode();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setPairingCode(null);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCodeCopied(true);
    success('6-digit pairing code copied to clipboard!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDisconnect = async (deviceId = 'all') => {
    setDisconnecting(true);
    try {
      await mobileService.disconnectDevice(deviceId);
      success('Android companion device unpaired.');
      if (onStatusChange) onStatusChange();
    } catch (err) {
      error('Failed to unpair device.');
    } finally {
      setDisconnecting(false);
    }
  };

  // Web Sensor Accelerometer
  useEffect(() => {
    let lastMagnitude = 0;
    const threshold = 11.5;

    const handleDeviceMotion = (event) => {
      if (!sensorActive) return;
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const delta = Math.abs(magnitude - lastMagnitude);
      lastMagnitude = magnitude;
      setLiveAccel(Math.round(magnitude * 10) / 10);

      if (delta > threshold) {
        handleSyncSteps(1);
      }
    };

    if (sensorActive && typeof window !== 'undefined' && window.DeviceMotionEvent) {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              window.addEventListener('devicemotion', handleDeviceMotion);
            } else {
              error('Motion sensor permission denied.');
              setSensorActive(false);
            }
          })
          .catch(() => {
            window.addEventListener('devicemotion', handleDeviceMotion);
          });
      } else {
        window.addEventListener('devicemotion', handleDeviceMotion);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, [sensorActive]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mobileUrl);
      setUrlCopied(true);
      success('Mobile pairing URL copied to clipboard!');
      setTimeout(() => setUrlCopied(false), 3000);
    }
  };

  const handleSyncSteps = async (increment = 100) => {
    setSyncing(true);
    try {
      const res = await recordsService.syncLiveSteps(increment);
      setStepsToday(res.data.steps);
      success(`+${increment} steps synced! (Today: ${res.data.steps.toLocaleString()})`);
      if (onDataUpdated) onDataUpdated(res.data);
    } catch (err) {
      error('Failed to sync steps: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncScreenTime = async () => {
    setSyncing(true);
    try {
      const hours = Math.round((screenSeconds / 3600) * 10) / 10;
      const res = await recordsService.syncPhoneTelemetry({ screen_time: hours });
      success(`Active device screen time synced: ${hours}h!`);
      if (onDataUpdated) onDataUpdated(res.data);
    } catch (err) {
      error('Failed to sync screen time.');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetToZero = async () => {
    if (!window.confirm("Reset your account to fresh 0 records? This will clear all data so you can log or stream real-time data.")) {
      return;
    }
    try {
      await authService.resetFreshAccount();
      setStepsToday(0);
      setScreenSeconds(0);
      success('Account reset to fresh 0! Ready for genuine real-time data.');
      if (onDataUpdated) onDataUpdated({ steps: 0, screen_time: 0 });
    } catch (err) {
      error('Failed to reset account.');
    }
  };

  if (!isOpen) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const screenHours = Math.floor(screenSeconds / 3600);
  const screenMinutes = Math.floor((screenSeconds % 3600) / 60);
  const screenSecs = screenSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-7 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Connect Android Phone
              </h2>
              {deviceStatus?.is_connected ? (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Phone Paired
                </span>
              ) : (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Real-Time Sync
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Hardware pedometer, usage stats &amp; sleep synchronization
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-2xl mb-5">
          <button
            onClick={() => setActiveTab('companion')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'companion'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android Companion App (Native)</span>
          </button>
          <button
            onClick={() => setActiveTab('web_sensor')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'web_sensor'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Footprints className="w-4 h-4" />
            <span>Web Motion Sensor</span>
          </button>
        </div>

        {/* TAB 1: Native Android Companion App */}
        {activeTab === 'companion' && (
          <div className="space-y-5">
            {/* Active Paired Device Status Banner */}
            {deviceStatus?.is_connected ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Companion App Connected &amp; Streaming
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      Your phone's hardware step sensor and UsageStats are streaming into your dashboard via WebSockets.
                    </p>
                    {deviceStatus.last_sync_at && (
                      <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-700">
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
            ) : null}

            {/* 6-Digit Pairing Code Display */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-200/80 text-center">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Enter this 6-digit code in the Android App
              </span>

              <div className="my-3 flex items-center justify-center gap-2">
                {loadingCode ? (
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin my-2" />
                ) : pairingCode ? (
                  pairingCode.split('').map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-13 sm:w-11 sm:h-14 bg-white border-2 border-indigo-300 rounded-xl flex items-center justify-center text-2xl font-black text-indigo-700 shadow-xs"
                    >
                      {digit}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Code expired. Click Refresh below.</span>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
                <span>Expires in: <strong className="text-indigo-700 font-bold">{formatTime(timeLeft)}</strong></span>
                {pairingCode && (
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-700 font-bold transition-colors"
                  >
                    {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{codeCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                <button
                  onClick={fetchPairingCode}
                  disabled={loadingCode}
                  className="inline-flex items-center gap-1 text-indigo-700 hover:underline font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCode ? 'animate-spin' : ''}`} />
                  <span>New Code</span>
                </button>
              </div>
            </div>

            {codeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{codeError}</span>
              </div>
            )}

            {/* Quick 3-step setup guide */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                How to set up the Android app
              </h4>
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5">
                  1
                </span>
                <span>
                  Open <code>android-app/</code> in Android Studio or install the debug APK on your phone.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5">
                  2
                </span>
                <span>
                  Enter the <strong>6-digit code</strong> above into the companion app and tap <strong>Connect Phone</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5">
                  3
                </span>
                <span>
                  Grant <strong>Physical Activity</strong> &amp; <strong>Usage Access</strong> permissions. The app will sync your steps and screen time automatically every 15 minutes!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Web Motion Sensor */}
        {activeTab === 'web_sensor' && (
          <div className="space-y-5">
            {/* Mobile Web URL */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-indigo-600" />
                  Step 1: Open on Your Phone's Browser
                </span>
                <span className="text-[10px] font-semibold text-slate-500">Chrome / Safari</span>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Log into your account on your phone's browser to count walking steps via DeviceMotion accelerometer without installing any app.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={mobileUrl}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {urlCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{urlCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Hardware Accelerometer Sensor */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/70 border border-indigo-200/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Footprints className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Live Browser Pedometer</h4>
                    <p className="text-[11px] text-slate-500">Counts real walking steps via phone motion sensors</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSensorActive(!sensorActive);
                    if (!sensorActive) {
                      info('Accelerometer active! Walk with your phone in hand or pocket.');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    sensorActive 
                      ? 'bg-emerald-600 text-white shadow-emerald-500/25 animate-pulse' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Radio className={`w-3.5 h-3.5 ${sensorActive ? 'text-emerald-200 animate-spin' : ''}`} />
                  <span>{sensorActive ? 'Sensor Active' : 'Start Sensor'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Live Steps</div>
                  <div className="text-xl font-extrabold text-indigo-600 mt-0.5">
                    {stepsToday.toLocaleString()} <span className="text-xs font-normal text-slate-500">steps</span>
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Motion Gauge</div>
                  <div className="text-xl font-extrabold text-slate-800 mt-0.5">
                    {liveAccel} <span className="text-xs font-normal text-slate-500">m/s²</span>
                  </div>
                </div>
              </div>

              {/* Movement Simulators */}
              <div className="mt-3 pt-3 border-t border-indigo-100/70">
                <div className="text-[11px] font-bold text-slate-700 mb-2">Movement Simulators (for stationary testing):</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSyncSteps(100)}
                    disabled={syncing}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all shadow-xs"
                  >
                    +100 Steps
                  </button>
                  <button
                    onClick={() => handleSyncSteps(500)}
                    disabled={syncing}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    +500 Steps (Brisk Walk)
                  </button>
                  <button
                    onClick={() => handleSyncSteps(1000)}
                    disabled={syncing}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    +1,000 Steps (Jog)
                  </button>
                </div>
              </div>
            </div>

            {/* Screen Time Section */}
            <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Active Screen-Time Tracker</h4>
                    <p className="text-[11px] text-slate-500">Tracks active, focused screen duration on this device</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping"></span>
                  Active
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-teal-100 shadow-xs flex items-center justify-between mt-2">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Device Usage Today</div>
                  <div className="text-lg font-extrabold text-teal-700 mt-0.5">
                    {screenHours}h {screenMinutes}m {screenSecs}s
                  </div>
                </div>
                <button
                  onClick={handleSyncScreenTime}
                  disabled={syncing}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Sync Screen Time
                </button>
              </div>
            </div>

            {/* Reset to 0 */}
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  Fresh 0 Real-Time Mode
                </div>
                <p className="text-[11px] text-rose-800/80">Wipe any synthetic/demo records and start cleanly at 0.</p>
              </div>
              <button
                onClick={handleResetToZero}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs flex-shrink-0"
              >
                Reset to 0
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Private &amp; encrypted on-device telemetry</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
