import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Footprints, 
  Activity, 
  Copy, 
  Check, 
  X, 
  Wifi, 
  ShieldCheck, 
  Zap, 
  Clock, 
  RotateCcw,
  Sparkles,
  Radio,
  ExternalLink
} from 'lucide-react';
import { recordsService, authService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ConnectPhoneModal({ isOpen, onClose, onDataUpdated, currentSteps = 0, currentScreenTime = 0 }) {
  const { success, error, info } = useToast();
  const [copied, setCopied] = useState(false);
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

  // Active Screen-Time local timer
  useEffect(() => {
    let timer;
    if (isOpen) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          setScreenSeconds((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  // Real Hardware DeviceMotion Sensor Listener
  useEffect(() => {
    let lastMagnitude = 0;
    const threshold = 11.5; // Walking step threshold

    const handleDeviceMotion = (event) => {
      if (!sensorActive) return;
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const delta = Math.abs(magnitude - lastMagnitude);
      lastMagnitude = magnitude;
      setLiveAccel(Math.round(magnitude * 10) / 10);

      if (delta > threshold) {
        // Physical step detected by phone accelerometer!
        handleSyncSteps(1);
      }
    };

    if (sensorActive && typeof window !== 'undefined' && window.DeviceMotionEvent) {
      // In iOS 13+ or modern Android, request permission if needed
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              window.addEventListener('devicemotion', handleDeviceMotion);
            } else {
              error('Motion sensor permission denied on device.');
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
      setCopied(true);
      success('Mobile pairing URL copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSyncSteps = async (increment = 100) => {
    setSyncing(true);
    try {
      const res = await recordsService.syncLiveSteps(increment);
      setStepsToday(res.data.steps);
      success(`+${increment} steps synced from device sensor! (Today: ${res.data.steps.toLocaleString()})`);
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

  const screenHours = Math.floor(screenSeconds / 3600);
  const screenMinutes = Math.floor((screenSeconds % 3600) / 60);
  const screenSecs = screenSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-7 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Connect Android Phone
              </h2>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                isMobile ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {isMobile ? 'Mobile Device' : 'Desktop Link'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Stream genuine physical walking steps and device screen-time in real time.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Section 1: How Mobile Pairing Works */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-indigo-600" />
                Step 1: Open Website on Your Android Phone
              </span>
              <span className="text-[10px] font-semibold text-slate-500">Google Chrome / Mobile Web</span>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Open your browser on your phone and log into your account. The web app uses Android's built-in <strong>DeviceMotion Accelerometer</strong> to count physical walking steps and screen visibility.
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
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Hardware Accelerometer Sensor */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/70 border border-indigo-200/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">Live Hardware Pedometer Sensor</h4>
                  <p className="text-[11px] text-slate-500">Counts real walking steps via phone motion sensors</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSensorActive(!sensorActive);
                  if (!sensorActive) {
                    info('Accelerometer sensor active! Walk with your phone in hand or pocket.');
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

            {/* Quick Test Walking Simulators */}
            <div className="mt-3 pt-3 border-t border-indigo-100/70">
              <div className="text-[11px] font-bold text-slate-700 mb-2">Manual Movement Simulators (for stationary testing):</div>
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
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-500/25"
                >
                  +500 Steps (Brisk Walk)
                </button>
                <button
                  onClick={() => handleSyncSteps(1000)}
                  disabled={syncing}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm shadow-purple-500/25"
                >
                  +1,000 Steps (Jog)
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Active Device Screen Time */}
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
                Tracking Active
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

          {/* Section 4: Start Fresh at 0 */}
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

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Private & encrypted on-device telemetry</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
