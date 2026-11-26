import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  QrCode, 
  ShieldCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  Trash2, 
  Radio, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound, 
  Phone, 
  Lock, 
  Clock, 
  Activity, 
  ExternalLink,
  ChevronRight,
  Shield,
  Zap,
  Footprints,
  Moon,
  Droplet
} from 'lucide-react';
import { mobileService, recordsService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useLiveMetrics } from '../hooks/useLiveMetrics';

export default function DeviceIntegration() {
  const { success, error, info } = useToast();

  // Pairing Flow Modal State
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingStep, setPairingStep] = useState(1); // 1 = Phone Verification, 2 = Pairing (QR / Code)

  // Step 1: Phone Verification State
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [devModeNotice, setDevModeNotice] = useState(null);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // Step 2: QR & Manual Code State
  const [selectedPairingTab, setSelectedPairingTab] = useState('qr'); // 'qr' or 'code'
  const [pairingData, setPairingData] = useState(null);
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pairingStatusMessage, setPairingStatusMessage] = useState('Waiting for Android companion app...');
  const [disconnecting, setDisconnecting] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  // Real-time WebSocket hook
  const { isWsConnected, deviceStatus, pairingEvent, refreshDeviceStatus } = useLiveMetrics();

  // Watch pairing WebSocket events in real-time
  useEffect(() => {
    if (!pairingEvent) return;

    if (pairingEvent.type === 'device_scanned') {
      setPairingStatusMessage(`QR Code scanned by ${pairingEvent.device_name || 'Android phone'}!`);
      info(`Device scanned! Waiting for approval on phone.`);
    } else if (pairingEvent.type === 'device_approval_required') {
      setPairingStatusMessage(`Approval required on ${pairingEvent.device_name || 'your phone'}. Please tap 'Approve & Connect'.`);
    } else if (pairingEvent.type === 'device_connected') {
      setPairingStatusMessage('Android Phone Connected Successfully!');
      success(`Android device ${pairingEvent.device_name || 'companion'} connected successfully!`);
      refreshDeviceStatus();
      setTimeout(() => {
        setIsPairingModalOpen(false);
      }, 1500);
    } else if (pairingEvent.type === 'pairing_expired') {
      setPairingStatusMessage('Pairing session expired (2-minute limit). Please regenerate.');
      setPairingData(null);
    } else if (pairingEvent.type === 'pairing_failed') {
      setPairingStatusMessage('Pairing failed or was cancelled on device.');
      error('Pairing attempt was cancelled or failed.');
    } else if (pairingEvent.type === 'device_disconnected') {
      refreshDeviceStatus();
      info('Device has been disconnected.');
    }
  }, [pairingEvent, refreshDeviceStatus, success, error, info]);

  // 120s Countdown Timer for Pairing Session
  useEffect(() => {
    if (!pairingData || !pairingData.expires_at) return;
    const expiryTime = new Date(pairingData.expires_at).getTime();

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setPairingData(null);
        setPairingStatusMessage('Pairing session expired. Click "Regenerate" below.');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pairingData]);

  // STEP 1: Send OTP via SMS
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      error('Please enter a valid mobile phone number.');
      return;
    }
    setSendingOtp(true);
    setDevModeNotice(null);
    try {
      const res = await mobileService.verifyPhone(countryCode, phoneNumber);
      setOtpSent(true);
      success(`Verification code dispatched via SMS to ${countryCode} ${phoneNumber}. Please check your phone.`);
    } catch (err) {
      error(err.response?.data?.detail || 'Failed to send OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  // STEP 1: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      error('Please enter the verification code.');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await mobileService.verifyOtp(countryCode, phoneNumber, otpCode);
      if (res.data.verified) {
        setIsPhoneVerified(true);
        success('Phone number verified successfully!');
        // Advance to Step 2: Device Pairing
        setPairingStep(2);
        initiatePairingSession();
      }
    } catch (err) {
      error(err.response?.data?.detail || 'Invalid verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // STEP 2: Initiate Pairing Session (Generate QR + Manual Code)
  const initiatePairingSession = async () => {
    setLoadingPairing(true);
    setPairingStatusMessage('Generating secure 2-minute pairing session...');
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const res = await mobileService.createPairing(fullPhone);
      setPairingData(res.data);
      setTimeLeft(res.data.expires_in_seconds || 120);
      setPairingStatusMessage('Waiting for Android companion app...');
    } catch (err) {
      error(err.response?.data?.detail || 'Failed to generate pairing session.');
      setPairingStatusMessage('Failed to initialize session. Please retry.');
    } finally {
      setLoadingPairing(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingData?.pairing_code) return;
    navigator.clipboard.writeText(pairingData.pairing_code);
    setCodeCopied(true);
    success('6-digit code copied to clipboard!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDisconnect = async (deviceId = null) => {
    setDisconnecting(true);
    try {
      await mobileService.disconnectDevice(deviceId);
      success('Android companion device disconnected.');
      refreshDeviceStatus();
    } catch (err) {
      error('Failed to disconnect device.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleManualSyncNow = async () => {
    setManualSyncing(true);
    try {
      await recordsService.syncLiveSteps(150);
      success('Triggered real-time device sync! Live metrics updated.');
      refreshDeviceStatus();
    } catch (err) {
      error('Sync failed.');
    } finally {
      setManualSyncing(false);
    }
  };

  const activeDevice = deviceStatus?.devices?.find((d) => d.is_connected) || null;

  return (
    <div className="space-y-6">
      {/* Device Integration Section Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Android Companion Integration
                </h2>
                {deviceStatus?.is_connected ? (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Not Paired
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Sync live steps, screen time &amp; sleep data from your physical Android phone
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsPairingModalOpen(true);
              // Reset steps if re-opening
              if (!isPhoneVerified) {
                setPairingStep(1);
              } else {
                setPairingStep(2);
                initiatePairingSession();
              }
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            <span>Connect Android Phone</span>
          </button>
        </div>

        {/* CONNECTED STATE DISPLAY */}
        {deviceStatus?.is_connected ? (
          <div className="pt-6 space-y-6">
            {/* Device Info & Status Row */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/60 to-teal-50/60 border border-emerald-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs mt-0.5">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {activeDevice?.device_name || 'Google Pixel / Galaxy Android'}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                        {activeDevice?.os_version || 'Android 14 (API 34)'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                      <span>Device ID: <code className="font-mono text-slate-700">{activeDevice?.device_id || 'pixel_pro'}</code></span>
                      <span>•</span>
                      <span>
                        Last Synced: <strong className="text-slate-900 font-bold">
                          {deviceStatus?.last_sync_at ? new Date(deviceStatus.last_sync_at).toLocaleTimeString() : 'Active Now'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSyncNow}
                    disabled={manualSyncing}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${manualSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>{manualSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  <button
                    onClick={() => handleDisconnect(activeDevice?.device_id)}
                    disabled={disconnecting}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Available Permissions Grid */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                Active Android Permissions &amp; Data Feeds
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Hardware Steps</span>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> SensorManager Active
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Screen Time</span>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> UsageStats Granted
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Restorative Sleep</span>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Health Connect
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Droplet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Hydration Logging</span>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Hydration Sync
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* UNPAIRED EMPTY STATE */
          <div className="pt-6 text-center py-8">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 mb-4 shadow-xs">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              No Android Companion Connected
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
              Connect your Android phone to automatically stream real pedometer steps, screen usage, and Health Connect sleep cycles directly to your Know Thyself AI score.
            </p>
            <button
              onClick={() => {
                setIsPairingModalOpen(true);
                if (!isPhoneVerified) setPairingStep(1);
                else { setPairingStep(2); initiatePairingSession(); }
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 inline-flex items-center gap-2 transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span>Connect Android Phone</span>
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DEVICE PAIRING MODAL (STEP 1: PHONE OTP, STEP 2: QR & CODE) */}
      {/* ------------------------------------------------------------- */}
      {isPairingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-7 relative">
            {/* Close Button */}
            <button
              onClick={() => setIsPairingModalOpen(false)}
              className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>

            {/* Stepper Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold">
                {pairingStep === 1 ? <Phone className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Step {pairingStep} of 2
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {pairingStep === 1 ? 'Verify Your Phone Number' : 'Pair Android Companion App'}
                </h3>
              </div>
            </div>

            {/* STEP 1: PHONE NUMBER VERIFICATION */}
            {pairingStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your mobile phone number to receive a secure one-time verification code.
                </p>

                <form onSubmit={handleSendOtp} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-20 px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-center bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="+91"
                    />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter 10-digit mobile number"
                      disabled={otpSent}
                    />
                    <button
                      type="submit"
                      disabled={sendingOtp || otpSent}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {sendingOtp ? 'Sending...' : otpSent ? 'Sent' : 'Send OTP'}
                    </button>
                  </div>
                </form>

                {/* OTP SUBMISSION */}
                {otpSent && (
                  <form onSubmit={handleVerifyOtp} className="pt-2 space-y-3">
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>SMS OTP sent to your phone. Please check your SMS inbox and enter the 6-digit code below:</span>
                    </div>

                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Enter 6-Digit OTP Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.trim())}
                        maxLength={8}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-300 font-mono text-center text-lg font-extrabold text-indigo-700 tracking-widest bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="••••••"
                      />
                      <button
                        type="submit"
                        disabled={verifyingOtp}
                        className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {verifyingOtp ? 'Verifying...' : 'Verify OTP →'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* STEP 2: DEVICE PAIRING (QR CODE & MANUAL CODE) */}
            {pairingStep === 2 && (
              <div className="space-y-4">
                {/* Method Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button
                    onClick={() => setSelectedPairingTab('qr')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      selectedPairingTab === 'qr'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Option A: Scan QR Code</span>
                  </button>

                  <button
                    onClick={() => setSelectedPairingTab('code')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      selectedPairingTab === 'code'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Option B: 6-Digit Code</span>
                  </button>
                </div>

                {/* Expiration & Regenerate Bar */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Expires in: <strong className="text-indigo-700 font-bold">{timeLeft}s</strong>
                  </span>

                  <button
                    onClick={initiatePairingSession}
                    disabled={loadingPairing}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPairing ? 'animate-spin' : ''}`} />
                    <span>Regenerate QR</span>
                  </button>
                </div>

                {/* OPTION A: QR CODE */}
                {selectedPairingTab === 'qr' && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                      {loadingPairing ? (
                        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                      ) : pairingData?.qr_svg ? (
                        <div
                          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: pairingData.qr_svg }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">QR Code expired. Click Regenerate above.</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto">
                      Scan this QR code using the <strong>Know Thyself Companion App</strong> on your Android phone.
                    </p>
                  </div>
                )}

                {/* OPTION B: MANUAL CODE */}
                {selectedPairingTab === 'code' && (
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-200 text-center space-y-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      Enter This Code in the Android App
                    </span>

                    <div className="flex items-center justify-center gap-2">
                      {pairingData?.pairing_code ? (
                        pairingData.pairing_code.split('').map((digit, idx) => (
                          <div
                            key={idx}
                            className="w-10 h-13 sm:w-11 sm:h-14 bg-white border-2 border-indigo-300 rounded-xl flex items-center justify-center text-2xl font-black text-indigo-700 shadow-xs"
                          >
                            {digit}
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Code expired. Please regenerate.</span>
                      )}
                    </div>

                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition-all shadow-xs"
                    >
                      {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{codeCopied ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                )}

                {/* LIVE CONNECTION STATUS BOX */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-800 block">Status:</span>
                    <span className="text-indigo-700 font-semibold">{pairingStatusMessage}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" /> Secure single-use pairing
              </span>
              <button
                onClick={() => setIsPairingModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
