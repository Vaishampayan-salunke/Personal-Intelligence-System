import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle, 
  Activity, 
  Moon, 
  Smartphone, 
  Heart, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Droplet
} from 'lucide-react';
import { insightsService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function InsightsPage() {
  const { success, error } = useToast();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const res = await insightsService.getInsights(30);
      setInsights(res.data);
    } catch (err) {
      error('Failed to load insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await insightsService.generateInsights();
      success(`Generated ${res.data.generated_count} behavioral insights across all categories via ${res.data.source}!`);
      fetchInsights();
    } catch (err) {
      error('Failed to generate insights: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const CATEGORIES = [
    { key: 'all', label: 'All Patterns', icon: Sparkles },
    { key: 'activity', label: 'Movement & Steps', icon: Activity },
    { key: 'sleep', label: 'Sleep & Rhythm', icon: Moon },
    { key: 'screen_time', label: 'Digital Boundaries', icon: Smartphone },
    { key: 'routine', label: 'Hydration & Routine', icon: Droplet },
    { key: 'wellness', label: 'Wellness', icon: Heart },
  ];

  const matchesCategory = (category, key) => {
    if (key === 'all') return true;
    const c = (category || '').toLowerCase();
    if (key === 'activity') {
      return c.includes('activ') || c.includes('step') || c.includes('move') || c.includes('walk') || c.includes('exercise');
    }
    if (key === 'sleep') {
      return c.includes('sleep') || c.includes('rest') || c.includes('rhythm') || c.includes('night') || c.includes('circadian');
    }
    if (key === 'screen_time') {
      return c.includes('screen') || c.includes('digit') || c.includes('phone') || c.includes('boundar') || c.includes('device');
    }
    if (key === 'routine') {
      return c.includes('rout') || c.includes('water') || c.includes('hydrat') || c.includes('habit');
    }
    if (key === 'wellness') {
      return c.includes('well') || c.includes('vital') || c.includes('energy') || c.includes('general') || c.includes('health');
    }
    return c === key;
  };

  const filtered = insights.filter((i) => matchesCategory(i.category, filterCategory));

  return (
    <div className="space-y-8">
      {/* Header with Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Behavioral Intelligence Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Personalized AI Insights
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Synthesizing historical lifestyle metrics into explainable, evidence-backed lifestyle guidance.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 hover:from-indigo-700 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Synthesizing with Gemini...' : 'Generate Fresh Insights'}</span>
        </button>
      </div>

      {/* Safety & Medical Disclaimers Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
        <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold">Grounded & Non-Medical Intelligence:</strong> Every observation is strictly calculated from your personal database records. Know Thyself AI never diagnoses medical conditions or prescribes treatments. Recommendations are practical lifestyle and habit suggestions designed for daily vitality.
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const count = insights.filter((i) => matchesCategory(i.category, c.key)).length;
          return (
            <button
              key={c.key}
              onClick={() => setFilterCategory(c.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterCategory === c.key
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{c.label}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  filterCategory === c.key ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Insights Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-200/60 rounded-3xl"></div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card hover:border-indigo-200 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    {item.category.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{item.confidence} Confidence</span>
                  </div>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 tracking-tight mb-2">
                  {item.title}
                </h3>

                {/* Observation */}
                <div className="text-xs text-slate-700 font-medium leading-relaxed mb-3">
                  {item.observation}
                </div>

                {/* Quantitative Evidence */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs mb-3 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Supporting Data Evidence
                  </div>
                  <div className="font-semibold text-slate-800">
                    {item.evidence}
                  </div>
                </div>

                {/* Explanation */}
                <div className="text-xs text-slate-500 leading-relaxed mb-4">
                  <strong className="text-slate-700 font-semibold">Why this matters: </strong>
                  {item.explanation}
                </div>
              </div>

              {/* Recommended Action */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/80 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-extrabold text-indigo-950 block mb-0.5">Recommended Action:</span>
                  <span className="text-indigo-900 font-medium">{item.recommendation}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
          <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-800">No Insights in this Category Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            Click 'Generate Fresh Insights' to immediately produce verified recommendations across all 5 lifestyle categories!
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
          >
            {generating ? 'Generating...' : 'Generate Category Insights Now'}
          </button>
        </div>
      )}
    </div>
  );
}
