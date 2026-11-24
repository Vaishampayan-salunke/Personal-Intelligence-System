import React, { useState } from 'react';
import { Target, Footprints, Moon, Dumbbell, Sparkles, X, Check } from 'lucide-react';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function OnboardingModal() {
  const { user, updateUser } = useAuth();
  const { success, error } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    primary_goal: 'Optimize energy and sleep consistency',
    step_target: 8000,
    sleep_target: 8.0,
    exercise_target: 30,
    water_target: 2.5,
    screen_time_limit: 4.0,
    preferred_sleep_time: '23:00',
  });

  const GOAL_OPTIONS = [
    'Optimize daily energy & sleep regularity',
    'Increase physical activity and step baseline',
    'Establish mindful digital screen boundaries',
    'Build consistent workout & hydration routines',
  ];

  const handleFinish = async (skip = false) => {
    setSubmitting(true);
    try {
      const payload = skip
        ? { onboarding_completed: true }
        : { ...formData, onboarding_completed: true };

      const res = await authService.completeOnboarding(payload);
      updateUser({ preferences: res.data });
      success(skip ? 'Onboarding skipped. You can configure goals anytime!' : 'Personal goals configured successfully!');
    } catch (err) {
      error('Failed to complete onboarding: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
        {/* Skip button */}
        <button
          onClick={() => handleFinish(true)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Skip for now
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.name ? user.name.split(' ')[0] : 'there'}!
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Step {step} of 2: Personalize your intelligence baseline
            </p>
          </div>
        </div>

        {/* Step 1: Core Focus */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              What is your primary lifestyle goal?
            </label>
            <div className="space-y-2">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({ ...formData, primary_goal: g })}
                  className={`w-full text-left p-3.5 rounded-2xl text-xs font-semibold border transition-all flex items-center justify-between ${
                    formData.primary_goal === g
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{g}</span>
                  {formData.primary_goal === g && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all"
              >
                Next: Set Targets →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Targets Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  <Footprints className="w-4 h-4 text-indigo-600" />
                  Daily Steps
                </div>
                <input
                  type="number"
                  value={formData.step_target}
                  onChange={(e) => setFormData({ ...formData, step_target: Number(e.target.value) })}
                  className="w-full text-base font-extrabold text-slate-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                />
                <span className="text-[10px] text-slate-400">Recommended: 8,000–10,000</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  <Moon className="w-4 h-4 text-purple-600" />
                  Sleep Target
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={formData.sleep_target}
                  onChange={(e) => setFormData({ ...formData, sleep_target: Number(e.target.value) })}
                  className="w-full text-base font-extrabold text-slate-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                />
                <span className="text-[10px] text-slate-400">Hours per night</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  <Dumbbell className="w-4 h-4 text-teal-600" />
                  Exercise
                </div>
                <input
                  type="number"
                  value={formData.exercise_target}
                  onChange={(e) => setFormData({ ...formData, exercise_target: Number(e.target.value) })}
                  className="w-full text-base font-extrabold text-slate-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                />
                <span className="text-[10px] text-slate-400">Minutes daily</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  <Target className="w-4 h-4 text-coral-500" />
                  Screen Limit
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={formData.screen_time_limit}
                  onChange={(e) => setFormData({ ...formData, screen_time_limit: Number(e.target.value) })}
                  className="w-full text-base font-extrabold text-slate-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                />
                <span className="text-[10px] text-slate-400">Max hours daily</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinish(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
              >
                {submitting ? 'Saving Profile...' : 'Complete & Go to Dashboard ✨'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
