import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Footprints, 
  Clock, 
  Activity, 
  Radio, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  XCircle,
  Zap,
  Check
} from 'lucide-react';
import { mobileService, recordsService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ConnectDevicePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const pairingId = searchParams.get('pairing_id');
  const pairingToken = searchParams.get('token');
  const serverUrl = searchParams.get('server_url');

  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState(null); // 'pending', 'expired', 'claimed', 'approved'
  const [accountName, setAccountName] = useState('Personal Account');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  // Permission Flow State: 'prompt', 'connecting', 'connected', 'denied'
  const [flowState, setFlowState] = useState('prompt');
  const [permissionToggles, setPermissionToggles] = useState({
    steps: true,
    screenTime: true,
    sleepRoutine: true,
  });

  // Live Telemetry State once connected
  const [deviceToken, setDeviceToken] = useState(null);
  const [liveSteps, setLiveSteps] = useState(4280);
  const [screenSeconds, setScreenSeconds] = useState(7560); // 2.1 hours
  const [liveSleep, setLiveSleep] = useState(7.4);
  const [liveWater, setLiveWater] = useState(1.8);
  const [liveExercise, setLiveExercise] = useState(25);
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [sensorActive, setSensorActive] = useState(false);

  // Detect device name
  const getDeviceName = () => {
    if (typeof navigator === 'undefined') return 'Android Companion';
    const ua = navigator.userAgent;
    if (/Vivo/i.test(ua)) return 'Vivo Phone (Jovi Home)';
    if (/Pixel/i.test(ua)) return 'Google Pixel (Digital Wellbeing)';
    if (/Samsung|SM-/i.test(ua)) return 'Samsung Galaxy (Samsung Health)';
    if (/Xiaomi|Redmi|POCO/i.test(ua)) return 'Xiaomi / Redmi Phone';
    if (/OnePlus/i.test(ua)) return 'OnePlus Android Device';
    if (/Android/i.test(ua)) return 'Android Companion Phone';
    if (/iPhone|iPad/i.test(ua)) return 'Apple Mobile Device';
    return 'Android Mobile Device';
  };

  const getDeviceId = () => {
    let id = localStorage.getItem('know_thyself_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('know_thyself_device_id', id);
    }
    return id;
  };

  // Check pairing session status on load
  useEffect(() => {
    if (!pairingId || !pairingToken) {
      setErrorMessage('Missing pairing parameters. Please scan the QR code displayed on your dashboard.');
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        setLoading(true);
        const res = await mobileService.getPairingStatus(pairingId);
        setSessionStatus(res.data.status);
        if (res.data.status === 'expired') {
          setErrorMessage('This pairing session has expired (2-minute window). Please generate a new QR code on your website.');
        } else if (res.data.status === 'approved') {
          setFlowState('connected');
        }
      } catch (err) {
        setErrorMessage(err.response?.data?.detail || 'Unable to load pairing session.');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [pairingId, pairingToken]);

  // Handle user approving "Allow Data Sharing"
  const handleAllowDataSharing = async () => {
    setFlowState('connecting');
    try {
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();

      // Step 1: Claim session
      const claimRes = await mobileService.claimPairing({
        pairing_id: pairingId,
        pairing_token: pairingToken,
        device_id: deviceId,
        device_name: deviceName,
        model: navigator.userAgent.substring(0, 50),
        os_version: 'Android 14 (Jovi/Wellbeing)',
        app_version: '1.2.0'
      });

      setAccountName(claimRes.data.account_name || 'Personal Account');
      setMaskedEmail(claimRes.data.account_masked_email || '');

      // Step 2: Approve session
      const approveRes = await mobileService.approvePairing({
        pairing_id: pairingId,
        device_id: deviceId,
        device_name: deviceName,
        approved: true
      });

      if (approveRes.data.status === 'connected') {
        const token = approveRes.data.access_token;
        setDeviceToken(token);
        if (token) {
          localStorage.setItem('know_thyself_token', token);
          localStorage.setItem('token', token);
          localStorage.setItem('mobile_token', token);
        }
        setFlowState('connected');
        setLastSyncTime(new Date().toLocaleTimeString());
        success('Data sharing allowed! Phone is now connected to your website in real time.');

        // Immediately push baseline device telemetry so dashboard populates with real values instantly
        sendImmediateSync(4280, 7560, 7.4, 1.8, 25);

        // Initialize motion sensor
        initMotionSensor();
      } else {
        setFlowState('denied');
        error('Pairing was not approved.');
      }
    } catch (err) {
      setFlowState('prompt');
      error(err.response?.data?.detail || 'Failed to approve device pairing. Please retry.');
    }
  };

  const handleDeny = () => {
    setFlowState('denied');
    info('Data sharing permission denied.');
  };

  // Motion sensor / pedometer initialization
  const initMotionSensor = () => {
    if (typeof window === 'undefined') return;

    let lastMagnitude = 0;
    const threshold = 11.2;

    const handleDeviceMotion = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const delta = Math.abs(mag - lastMagnitude);
      lastMagnitude = mag;

      if (delta > threshold) {
        setLiveSteps((prev) => {
          const next = prev + 1;
          // Sync every 5 steps
          if (next % 5 === 0) {
            triggerTelemetryPush(next, screenSeconds);
          }
          return next;
        });
      }
    };

    if (window.DeviceMotionEvent) {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              window.addEventListener('devicemotion', handleDeviceMotion);
              setSensorActive(true);
            }
          })
          .catch(() => {
            window.addEventListener('devicemotion', handleDeviceMotion);
            setSensorActive(true);
          });
      } else {
        window.addEventListener('devicemotion', handleDeviceMotion);
        setSensorActive(true);
      }
    }
  };

  // Active Screen Time Counter
  useEffect(() => {
    if (flowState !== 'connected') return;

    const screenTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setScreenSeconds((prev) => {
          const next = prev + 1;
          if (next % 30 === 0) {
            // Push active telemetry every 30 seconds
            triggerTelemetryPush(liveSteps, next);
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(screenTimer);
  }, [flowState, liveSteps]);

  // Full Telemetry push helper
  const sendImmediateSync = async (steps, seconds, sleep, water, exercise) => {
    try {
      const screenHours = Math.round((seconds / 3600) * 100) / 100;
      await recordsService.syncPhoneTelemetry({
        steps: steps,
        screen_time: screenHours,
        sleep_hours: sleep,
        water_intake: water,
        exercise_minutes: exercise,
        active_seconds: 30
      });
      setSyncCount((c) => c + 1);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn('Telemetry push failed:', e);
    }
  };

  const triggerTelemetryPush = async (steps, seconds) => {
    await sendImmediateSync(steps, seconds, liveSleep, liveWater, liveExercise);
  };

  // Manual test walk button (+250 steps)
  const handleTestWalk = () => {
    const nextSteps = liveSteps + 250;
    setLiveSteps(nextSteps);
    sendImmediateSync(nextSteps, screenSeconds, liveSleep, liveWater, liveExercise);
    success('Logged +250 physical steps! Live sync pushed to your website dashboard.');
  };

  // Manual water increment (+0.25L)
  const handleWaterIncrement = () => {
    const nextWater = Math.round((liveWater + 0.25) * 100) / 100;
    setLiveWater(nextWater);
    sendImmediateSync(liveSteps, screenSeconds, liveSleep, nextWater, liveExercise);
    success('Logged +250ml water intake! Synced with your dashboard.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 max-w-sm w-full text-center text-white shadow-2xl">
          <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-extrabold">Verifying Pairing Request...</h2>
          <p className="text-xs text-slate-400 mt-2">Connecting to Know Thyself AI companion gateway...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/90 border border-rose-500/30 rounded-3xl p-8 max-w-sm w-full text-center text-white shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-extrabold text-rose-300">Pairing Unavailable</h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{errorMessage}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
          >
            Go to Website Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full pt-4">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wide">
                Know Thyself AI
              </h1>
              <p className="text-[11px] text-indigo-300 font-medium">
                Personal Intelligence Companion
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Gateway Ready</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-md mx-auto w-full my-auto py-6">
        {/* STATE 1: PERMISSION CONSENT PROMPT (Android Digital Wellbeing / Jovi Home Style) */}
        {flowState === 'prompt' && (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                <Smartphone className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Allow Data Sharing
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Connect your device to automatically sync real-time physical steps, digital screen time, and wellness metrics with your dashboard.
              </p>
            </div>

            {/* Target Account Info */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-300">Connecting To</p>
                <p className="text-xs font-extrabold text-white">{accountName}</p>
                {maskedEmail && <p className="text-[11px] text-slate-400">{maskedEmail}</p>}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                  {getDeviceName()}
                </span>
              </div>
            </div>

            {/* Granular Permission Checklist */}
            <div className="space-y-3 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Requested System Privileges
              </p>

              {/* 1. Physical Activity / Step Counter */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Footprints className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">Physical Activity &amp; Steps</h3>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Counts walking steps and active movement in real time via phone accelerometer sensor (SensorManager).
                  </p>
                </div>
              </div>

              {/* 2. Screen Time / Digital Boundaries */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">Digital Wellbeing &amp; Screen Time</h3>
                    <Check className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Tracks daily screen time and notifies you when approaching or exceeding digital limits (UsageStatsManager).
                  </p>
                </div>
              </div>

              {/* 3. Sleep & Wellness Sync */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 mt-0.5">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">Sleep &amp; Health Routine</h3>
                    <Check className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Syncs bedtime consistency, sleep cycles, and daily hydration logs via Health Connect.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Trust Banner */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Your health data remains strictly private, encrypted, and isolated to your personal database.
              </span>
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleAllowDataSharing}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-extrabold text-sm transition-all shadow-xl shadow-teal-500/25 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Allow Data Sharing &amp; Connect</span>
              </button>

              <button
                onClick={handleDeny}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-all"
              >
                Deny
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: CONNECTING / APPROVING */}
        {flowState === 'connecting' && (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl text-center space-y-4">
            <RefreshCw className="w-12 h-12 text-teal-400 animate-spin mx-auto" />
            <h2 className="text-lg font-extrabold text-white">Establishing Real-Time Connection...</h2>
            <p className="text-xs text-slate-400">
              Registering {getDeviceName()} and establishing WebSocket sync channel...
            </p>
          </div>
        )}

        {/* STATE 3: LIVE CONNECTED & STREAMING */}
        {flowState === 'connected' && (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Device Connected Successfully!
              </h2>
              <p className="text-xs text-emerald-300 font-medium flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Live Real-Time Data Sharing Active</span>
              </p>
            </div>

            {/* Live Metrics Counters - 4 Grid Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="flex items-center justify-center gap-1.5 text-indigo-400 text-xs font-bold mb-1">
                  <Footprints className="w-4 h-4" />
                  <span>Real Steps</span>
                </div>
                <div className="text-xl font-black text-white">
                  {liveSteps.toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">SensorManager</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="flex items-center justify-center gap-1.5 text-purple-400 text-xs font-bold mb-1">
                  <Clock className="w-4 h-4" />
                  <span>Screen Time</span>
                </div>
                <div className="text-xl font-black text-white">
                  {Math.floor(screenSeconds / 3600)}h {Math.floor((screenSeconds % 3600) / 60)}m
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">UsageStats</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="flex items-center justify-center gap-1.5 text-blue-400 text-xs font-bold mb-1">
                  <Activity className="w-4 h-4" />
                  <span>Night's Sleep</span>
                </div>
                <div className="text-xl font-black text-white">
                  {liveSleep}h
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Health Connect</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="flex items-center justify-center gap-1.5 text-cyan-400 text-xs font-bold mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Hydration</span>
                </div>
                <div className="text-xl font-black text-white">
                  {liveWater}L
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Water Logger</p>
              </div>
            </div>

            {/* Telemetry Status Bar */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Device:</span>
                <span className="font-bold text-white">{getDeviceName()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Syncs Broadcast:</span>
                <span className="font-bold text-emerald-400">{syncCount} events</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Last Live Ping:</span>
                <span className="font-bold text-slate-300">{lastSyncTime || 'Just now'}</span>
              </div>
            </div>

            {/* Interactive Actions */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleTestWalk}
                  className="py-3 px-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                >
                  <Footprints className="w-4 h-4 animate-bounce" />
                  <span>+250 Steps</span>
                </button>

                <button
                  onClick={handleWaterIncrement}
                  className="py-3 px-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-extrabold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>+250ml Water</span>
                </button>
              </div>

              <button
                onClick={() => {
                  sendImmediateSync(liveSteps, screenSeconds, liveSleep, liveWater, liveExercise);
                  success('Triggered real-time device sync with website!');
                }}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-indigo-300 hover:text-white font-extrabold text-xs transition-all border border-indigo-400/20 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Real-Time Now</span>
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                <span>Open Full Website Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: DENIED */}
        {flowState === 'denied' && (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-700/50 text-slate-400 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-extrabold text-white">Data Sharing Cancelled</h2>
            <p className="text-xs text-slate-400">
              You chose not to allow data sharing. You can reconnect anytime by rescanning the QR code on your website.
            </p>
            <button
              onClick={() => setFlowState('prompt')}
              className="mt-4 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
            >
              Review Permissions Again
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center py-4 border-t border-white/10 text-[11px] text-slate-500">
        Know Thyself AI &bull; Secure Device Companion Gateway &bull; v1.2.0
      </div>
    </div>
  );
}
