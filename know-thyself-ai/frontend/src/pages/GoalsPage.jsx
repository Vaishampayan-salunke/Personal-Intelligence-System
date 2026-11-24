import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Plus, 
  CheckCircle2, 
  Flame, 
  Footprints, 
  Moon, 
  Dumbbell, 
  Droplet, 
  Smartphone,
  Trash2,
  Edit3,
  X,
  Trophy
} from 'lucide-react';
import { goalsService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function GoalsPage() {
  const { success, error } = useToast();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const [form, setForm] = useState({
    metric: 'steps',
    title: 'Daily Movement Target',
    target_value: 10000,
    timeframe: 'daily',
    status: 'active',
  });

  const METRIC_ICONS = {
    steps: Footprints,
    sleep: Moon,
    exercise: Dumbbell,
    water: Droplet,
    screen_time: Smartphone,
  };

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const res = await goalsService.getGoals();
      setGoals(res.data);
    } catch (err) {
      error('Failed to load goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const openAddModal = () => {
    setEditingGoal(null);
    setForm({
      metric: 'steps',
      title: 'Daily Movement Target',
      target_value: 10000,
      timeframe: 'daily',
      status: 'active',
    });
    setModalOpen(true);
  };

  const openEditModal = (g) => {
    setEditingGoal(g);
    setForm({
      metric: g.metric,
      title: g.title,
      target_value: g.target_value,
      timeframe: g.timeframe,
      status: g.status,
    });
    setModalOpen(true);
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    try {
      if (editingGoal) {
        await goalsService.updateGoal(editingGoal.id, form);
        success('Goal updated successfully!');
      } else {
        await goalsService.createGoal(form);
        success('New goal created!');
      }
      setModalOpen(false);
      fetchGoals();
    } catch (err) {
      error(err.response?.data?.detail || 'Failed to save goal.');
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm('Are you sure you want to remove this goal?')) return;
    try {
      await goalsService.deleteGoal(id);
      success('Goal deleted.');
      fetchGoals();
    } catch (err) {
      error('Failed to delete goal.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Target className="w-4 h-4" />
            <span>Habit Mastery</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Personal Lifestyle Goals
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Define daily targets for movement, restorative sleep, physical exercise, and digital boundaries.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center gap-1.5 transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Goal</span>
        </button>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-200/60 rounded-3xl"></div>
          ))}
        </div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((g) => {
            const Icon = METRIC_ICONS[g.metric] || Target;
            const pct = Math.min(Math.round(g.progress_pct || 0), 100);
            const isCompleted = pct >= 100;

            return (
              <div
                key={g.id}
                className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card hover:border-indigo-200 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">{g.title}</h3>
                        <span className="text-[11px] font-semibold text-slate-400 capitalize">
                          {g.timeframe} • {g.metric.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(g)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Edit goal"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(g.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mt-4 mb-2">
                    <div className="text-2xl font-extrabold text-slate-900">
                      {typeof g.current_value === 'number' ? g.current_value.toLocaleString() : g.current_value}{' '}
                      <span className="text-xs font-semibold text-slate-400">
                        / {g.target_value.toLocaleString()} target
                      </span>
                    </div>
                    <span className={`text-sm font-extrabold ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {pct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isCompleted
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                          : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Status: Active Habit</span>
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                      <Trophy className="w-3.5 h-3.5" /> Target Achieved!
                    </span>
                  ) : (
                    <span className="text-slate-500 font-semibold">In Progress</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-6">
          <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-extrabold text-slate-800">No Goals Configured</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Set your personal daily targets to track habit mastery.</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
          >
            Create First Goal
          </button>
        </div>
      )}

      {/* Goal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-extrabold text-slate-900">
                {editingGoal ? 'Edit Goal' : 'Configure New Goal'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Metric Type</label>
                <select
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="steps">Steps (Daily Movement)</option>
                  <option value="sleep">Sleep Hours (Nightly Rest)</option>
                  <option value="exercise">Exercise Minutes (Active Workouts)</option>
                  <option value="water">Water Intake (Litres)</option>
                  <option value="screen_time">Screen Time Limit (Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Goal Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 10k Steps Daily Streak"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Value</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  min="0.1"
                  value={form.target_value}
                  onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25"
                >
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
