import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Footprints, 
  Moon, 
  Smartphone, 
  Dumbbell, 
  Droplet, 
  Zap, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Plus, 
  BrainCircuit, 
  CheckCircle2, 
  X, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Database,
  BellRing,
  Play,
  RotateCcw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { dashboardService, nudgesService, recordsService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [timeRange, setTimeRange] = useState(7);
  const [loadingSample, setLoadingSample] = useState(false);
  const [syncingSteps, setSyncingSteps] = useState(false);
  const [pedometerActive, setPedometerActive] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, trendsRes] = await Promise.all([
        dashboardService.getDashboard(),
        dashboardService.getTrends(timeRange),
      ]);
      setDashboardData(dashRes.data);
      setTrendData(trendsRes.data.trend_data || []);
    } catch (err) {
      error('Failed to load dashboard data: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  // Live Pedometer & Motion Sensor Listener (Android / Mobile Web)
  useEffect(() => {
    let lastAccel = 0;
    let stepCountThreshold = 12.0;

    const handleMotion = (event) => {
      if (!pedometerActive) return;
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const delta = Math.abs(magnitude - lastAccel);
      lastAccel = magnitude;

      if (delta > stepCountThreshold) {
        // Physical step detected!
        handleLiveStepSync(2);
      }
    };

    if (window.DeviceMotionEvent && pedometerActive) {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, [pedometerActive]);

  const handleLiveStepSync = async (increment = 150) => {
    setSyncingSteps(true);
    try {
      const res = await recordsService.syncLiveSteps(increment);
      success(`+${increment} steps synced from phone pedometer! (Today: ${res.data.steps.toLocaleString()})`);
      // Update local state without full reload
      setDashboardData((prev) => {
        if (!prev) return prev;
        const newSteps = res.data.steps;
        const target = prev.metrics?.steps?.target_value || 8000;
        return {
          ...prev,
          today_record: res.data,
          metrics: {
            ...prev.metrics,
            steps: {
              ...prev.metrics.steps,
              current_value: newSteps,
              percentage: Math.round((newSteps / target) * 100),
            }
          }
        };
      });
    } catch (err) {
      console.error("Step sync error:", err);
    } finally {
      setSyncingSteps(false);
    }
  };

  const handleNudgeAction = async (nudgeId, status) => {
    try {
      await nudgesService.updateNudge(nudgeId, status);
      success(status === 'completed' ? 'Great job! Nudge marked completed.' : 'Nudge dismissed.');
      fetchData();
    } catch (err) {
      error('Failed to update nudge.');
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      await recordsService.loadSampleData(30);
      success('Successfully loaded 30 days of realistic demonstration data!');
      fetchData();
    } catch (err) {
      error('Failed to load sample records.');
    } finally {
      setLoadingSample(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200/70 rounded-3xl w-full"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200/60 rounded-3xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-slate-200/60 rounded-3xl lg:col-span-1"></div>
          <div className="h-96 bg-slate-200/60 rounded-3xl lg:col-span-2"></div>
        </div>
      </div>
    );
  }

  const { greeting, current_date, motivational_message, metrics, intelligence_score, recent_insights, active_nudges, data_days_count, live_alerts } = dashboardData || {};

  const METRIC_CONFIG = [
    { key: 'steps', icon: Footprints, color: 'text-indigo-600', bg: 'bg-indigo-50', gradient: 'from-indigo-500 to-indigo-600' },
    { key: 'sleep', icon: Moon, color: 'text-purple-600', bg: 'bg-purple-50', gradient: 'from-purple-500 to-purple-600' },
    { key: 'screen_time', icon: Smartphone, color: 'text-coral-600', bg: 'bg-orange-50', gradient: 'from-orange-500 to-coral-600' },
    { key: 'exercise', icon: Dumbbell, color: 'text-teal-600', bg: 'bg-teal-50', gradient: 'from-teal-500 to-teal-600' },
    { key: 'water', icon: Droplet, color: 'text-blue-600', bg: 'bg-blue-50', gradient: 'from-blue-500 to-blue-600' },
    { key: 'energy', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50', gradient: 'from-amber-400 to-amber-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 shadow-xl shadow-indigo-950/10">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{current_date}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/90 mt-1 max-w-xl font-medium">
              "{motivational_message}"
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Phone Pedometer Sync Button */}
            <button
              onClick={() => handleLiveStepSync(250)}
              disabled={syncingSteps}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20"
              title="Simulates walking & increments phone steps in real-time"
            >
              <Footprints className={`w-4 h-4 ${syncingSteps ? 'animate-bounce' : ''}`} />
              <span>{syncingSteps ? 'Syncing...' : '+250 Steps Walk'}</span>
            </button>

            <button
              onClick={() => navigate('/data')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Log Data</span>
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-500/25"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI Coach</span>
            </button>
          </div>
        </div>

        {/* Decorative backdrop glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute right-48 -bottom-12 w-48 h-48 rounded-full bg-teal-500/20 blur-3xl pointer-events-none"></div>
      </div>

      {/* REAL-TIME LIFESTYLE ALERTS PANEL (Steps incomplete, Sleep cycle, Screen warning & limit exceeded) */}
      {live_alerts && live_alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <BellRing className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>Real-Time Lifestyle & Health Cycle Alerts</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Live Phone Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {live_alerts.map((alert) => {
              const isDanger = alert.severity === 'danger';
              const isWarning = alert.severity === 'warning';
              const bg = isDanger
                ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                : isWarning
                ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                : 'bg-emerald-50/90 border-emerald-200 text-emerald-950';

              const badgeColor = isDanger
                ? 'bg-rose-200/80 text-rose-900'
                : isWarning
                ? 'bg-amber-200/80 text-amber-900'
                : 'bg-emerald-200/80 text-emerald-900';

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${bg} transition-all`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-xs">{alert.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${badgeColor}`}>
                        {alert.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90 font-medium">
                      {alert.message}
                    </p>
                  </div>

                  {alert.action_label && (
                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold opacity-75">Recommended Action:</span>
                      <button
                        onClick={() => {
                          if (alert.type.includes('step')) handleLiveStepSync(500);
                          else if (alert.type.includes('sleep')) navigate('/chat');
                          else if (alert.type.includes('screen')) success('Screen-free eye relaxation break initiated!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white shadow-xs font-bold text-xs hover:bg-slate-50 transition-colors"
                      >
                        {alert.action_label} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6 Overview Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Daily Vitals & Target Indicators
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">
            {data_days_count} days logged
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {METRIC_CONFIG.map(({ key, icon: Icon, color, bg }) => {
            const m = metrics?.[key] || {
              current_value: 0,
              target_value: 0,
              unit: '',
              percentage: 0,
              change_pct: 0,
              trend: 'neutral',
              label: key,
            };

            const isUp = m.trend === 'up';
            const isDown = m.trend === 'down';

            return (
              <div
                key={key}
                className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-card flex flex-col justify-between hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {m.change_pct !== 0 && (
                    <span
                      className={`text-[10px] font-extrabold flex items-center px-1.5 py-0.5 rounded-md ${
                        (isUp && key !== 'screen_time') || (isDown && key === 'screen_time')
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-rose-700 bg-rose-50'
                      }`}
                    >
                      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(m.change_pct)}%
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {m.label}
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                    {typeof m.current_value === 'number' ? m.current_value.toLocaleString() : m.current_value}{' '}
                    <span className="text-xs font-semibold text-slate-400">{m.unit}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Goal: {m.target_value}{m.unit}</span>
                  <span className={`font-bold ${m.percentage >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                    {Math.round(m.percentage)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal Intelligence Score & Lifestyle Synergy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Intelligence Score Card */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Personal Intelligence Score
                </span>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {intelligence_score?.level || 'Developing'}
              </span>
            </div>

            {/* Score Ring Gauge */}
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f1f5f9"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="url(#scoreGradient)"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={
                      2 * Math.PI * 40 * (1 - (intelligence_score?.overall_score || 50) / 100)
                    }
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#9333ea" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    {intelligence_score?.overall_score || 50}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    out of 100
                  </span>
                </div>
              </div>

              <div className="mt-3 text-xs font-bold text-indigo-950">
                {intelligence_score?.rating || 'Balanced Foundation'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                {intelligence_score?.explanation}
              </p>
            </div>

            {/* Category Contributions List */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {intelligence_score?.breakdown?.map((b) => (
                <div key={b.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{b.category}</span>
                    <span className="font-bold text-slate-900">
                      {b.score} / {b.max_score} pts
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${(b.score / b.max_score) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
            * {intelligence_score?.disclaimer}
          </div>
        </div>

        {/* 7-Day Lifestyle Activity & Sleep Recharts Graph */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-card lg:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Weekly Movement & Sleep Rhythm
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Correlating daily step count with nightly restorative sleep duration
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setTimeRange(7)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  timeRange === 7 ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange(14)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  timeRange === 14 ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                14 Days
              </button>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="stepArea" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="sleepArea" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="display_date" 
                  tickLine={false} 
                  stroke="#94a3b8" 
                  fontSize={11} 
                />
                <YAxis 
                  yAxisId="left" 
                  tickLine={false} 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  domain={[0, 'dataMax + 2000']} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tickLine={false} 
                  stroke="#14b8a6" 
                  fontSize={11} 
                  domain={[0, 12]} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="steps"
                  name="Daily Steps"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#stepArea)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sleep_hours"
                  name="Sleep (hrs)"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#14b8a6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Graphs: Screen Time & Workout Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Digital Screen Consumption</h2>
              <p className="text-xs text-slate-500 font-medium">Daily phone and computer hours</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-coral-600 border border-orange-200">
              Hours / Day
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} stroke="#94a3b8" fontSize={11} />
                <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar 
                  dataKey="screen_time" 
                  name="Screen Time (hrs)" 
                  fill="#f97316" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Physical Exercise Vitality</h2>
              <p className="text-xs text-slate-500 font-medium">Workout & deliberate movement duration</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              Minutes Active
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} stroke="#94a3b8" fontSize={11} />
                <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar 
                  dataKey="exercise_minutes" 
                  name="Exercise Minutes" 
                  fill="#0d9488" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Behavioral Insights Preview & Smart Nudges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  AI Behavioral Insights
                </h2>
                <p className="text-xs text-slate-500 font-medium">Grounded in your authenticated data</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/insights')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All Categories →
            </button>
          </div>

          {recent_insights && recent_insights.length > 0 ? (
            <div className="space-y-3.5">
              {recent_insights.slice(0, 3).map((ins) => (
                <div
                  key={ins.id}
                  className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200/70 hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900">{ins.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100/70 text-indigo-800 uppercase tracking-wider">
                      {ins.category.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal mb-2">
                    {ins.observation}
                  </p>
                  <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded-xl border border-slate-200/60 flex items-start gap-1.5">
                    <span className="font-bold text-indigo-700">Recommendation:</span>
                    <span>{ins.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No insights generated yet. Click below to analyze your data!
            </div>
          )}
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                Active Smart Nudges
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {active_nudges?.length || 0} active
              </span>
            </div>

            {active_nudges && active_nudges.length > 0 ? (
              <div className="space-y-3">
                {active_nudges.slice(0, 3).map((nudge) => (
                  <div
                    key={nudge.id}
                    className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/70 text-amber-950 text-xs"
                  >
                    <p className="leading-relaxed font-medium mb-3">{nudge.message}</p>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleNudgeAction(nudge.id, 'completed')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                      <button
                        onClick={() => handleNudgeAction(nudge.id, 'dismissed')}
                        className="text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                All smart nudges addressed. Keep up the great consistency!
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Nudges adapt automatically based on your daily step targets, bedtime habits, and screen limits.
          </div>
        </div>
      </div>
    </div>
  );
}
