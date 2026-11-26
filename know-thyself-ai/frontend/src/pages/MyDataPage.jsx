import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Upload, 
  Trash2, 
  Edit3, 
  Database, 
  Filter, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Sparkles,
  Info,
  X,
  RotateCcw
} from 'lucide-react';
import { recordsService, authService } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function MyDataPage() {
  const { success, error, info } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const fileInputRef = useRef(null);

  // Form State for Add / Edit
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    steps: 8000,
    sleep_hours: 7.5,
    screen_time: 4.0,
    exercise_minutes: 30,
    water_intake: 2.5,
    mood: 'Good',
    energy: 7,
    notes: '',
  });

  const MOOD_OPTIONS = ['Great', 'Good', 'Energetic', 'Neutral', 'Tired', 'Stressed'];

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await recordsService.getRecords();
      setRecords(res.data);
    } catch (err) {
      error('Failed to load records: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const openAddModal = () => {
    setEditingRecord(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      steps: 0,
      sleep_hours: 0.0,
      screen_time: 0.0,
      exercise_minutes: 0,
      water_intake: 0.0,
      mood: 'Good',
      energy: 7,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rec) => {
    setEditingRecord(rec);
    setForm({
      date: rec.date,
      steps: rec.steps,
      sleep_hours: rec.sleep_hours,
      screen_time: rec.screen_time,
      exercise_minutes: rec.exercise_minutes,
      water_intake: rec.water_intake,
      mood: rec.mood,
      energy: rec.energy,
      notes: rec.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await recordsService.updateRecord(editingRecord.id, form);
        success('Record updated successfully!');
      } else {
        await recordsService.createRecord(form);
        success('Daily record logged successfully!');
      }
      setIsModalOpen(false);
      fetchRecords();
    } catch (err) {
      error(err.response?.data?.detail || 'Failed to save record.');
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await recordsService.deleteRecord(id);
      success('Record removed.');
      fetchRecords();
    } catch (err) {
      error('Failed to delete record.');
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      await recordsService.loadSampleData(30);
      success('Loaded 30 days of realistic demonstration data!');
      fetchRecords();
    } catch (err) {
      error('Failed to load sample dataset.');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleResetToZero = async () => {
    if (!window.confirm("Reset your account to fresh 0 records? This will clear all data so you can record 100% genuine real-time data.")) {
      return;
    }
    try {
      await authService.resetFreshAccount();
      success("Account reset to fresh 0! Ready for real-time tracking.");
      fetchRecords();
    } catch (err) {
      error("Failed to reset account: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      error('Please select a CSV file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);

    setUploading(true);
    setUploadResult(null);
    try {
      const res = await recordsService.uploadCSV(formData);
      setUploadResult(res.data);
      if (res.data.success) {
        success(`Imported ${res.data.imported_rows} records successfully!`);
        fetchRecords();
      } else {
        error(`Failed to import records: ${res.data.errors?.join(', ') || 'No valid rows'}`);
      }
    } catch (err) {
      error(err.response?.data?.detail || 'CSV upload error');
    } finally {
      setUploading(false);
    }
  };

  const filteredRecords = records.filter((r) => 
    !searchDate || r.date.includes(searchDate) || r.mood.toLowerCase().includes(searchDate.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Personal Lifestyle Data
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage daily records, upload CSV archives, or explore the 30-day simulated dataset.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleResetToZero}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            title="Wipe simulated data and reset to completely fresh 0 records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Fresh 0</span>
          </button>

          <button
            onClick={handleLoadSample}
            disabled={loadingSample}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{loadingSample ? 'Loading 30 Days...' : 'Load 30-Day Demo'}</span>
          </button>

          <button
            onClick={() => {
              setCsvFile(null);
              setUploadResult(null);
              setUploadModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Daily Entry</span>
          </button>
        </div>
      </div>

      {/* Synthetic Data Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center gap-3">
        <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <div>
          <strong className="text-slate-800">Transparency Note:</strong> Records with the{' '}
          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold text-[10px]">
            Simulated
          </span>{' '}
          tag are synthetic demo data generated for evaluation and do not represent actual wearable measurements.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            placeholder="Search by date (YYYY-MM-DD) or mood..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="text-slate-900 font-bold">{filteredRecords.length}</span> of {records.length} records
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Steps</th>
                <th className="py-3.5 px-4">Sleep</th>
                <th className="py-3.5 px-4">Screen Time</th>
                <th className="py-3.5 px-4">Exercise</th>
                <th className="py-3.5 px-4">Water</th>
                <th className="py-3.5 px-4">Energy</th>
                <th className="py-3.5 px-4">Mood</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span>{r.date}</span>
                      {r.is_synthetic && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-50 text-purple-600 border border-purple-200/50">
                          Simulated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-indigo-700">
                      {r.steps.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {r.sleep_hours} hrs
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {r.screen_time} hrs
                    </td>
                    <td className="py-3.5 px-4 font-medium text-teal-700">
                      {r.exercise_minutes} min
                    </td>
                    <td className="py-3.5 px-4 font-medium text-blue-700">
                      {r.water_intake} L
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">
                      {r.energy}/10
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 text-slate-700">
                        {r.mood}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(r)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? 'Loading records...' : 'No records found matching your filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Daily Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-base font-extrabold text-slate-900">
                {editingRecord ? 'Edit Daily Record' : 'Log Daily Lifestyle Entry'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  disabled={!!editingRecord}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Steps Walked</label>
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    required
                    value={form.steps}
                    onChange={(e) => setForm({ ...form, steps: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sleep Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="24"
                    required
                    value={form.sleep_hours}
                    onChange={(e) => setForm({ ...form, sleep_hours: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Screen Time (hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="24"
                    required
                    value={form.screen_time}
                    onChange={(e) => setForm({ ...form, screen_time: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Exercise Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    required
                    value={form.exercise_minutes}
                    onChange={(e) => setForm({ ...form, exercise_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Water Intake (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="15"
                    required
                    value={form.water_intake}
                    onChange={(e) => setForm({ ...form, water_intake: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Energy Rating (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={form.energy}
                    onChange={(e) => setForm({ ...form, energy: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mood</label>
                <select
                  value={form.mood}
                  onChange={(e) => setForm({ ...form, mood: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {MOOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any subjective reflections, workouts done, or sleep conditions..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25"
                >
                  {editingRecord ? 'Update Record' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-extrabold text-slate-900">
                Import Records from CSV
              </h2>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCsvUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors">
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700">
                  {csvFile ? csvFile.name : 'Choose a CSV file'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Expected columns: date, steps, sleep_hours, screen_time, exercise_minutes, water_intake, mood, energy
                </div>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                >
                  Browse Files
                </button>
              </div>

              {uploadResult && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900">Import Summary:</div>
                  <div>Total Rows: {uploadResult.total_rows}</div>
                  <div className="text-emerald-600 font-semibold">Imported: {uploadResult.imported_rows}</div>
                  <div className="text-slate-500">Skipped (duplicates/errors): {uploadResult.skipped_rows}</div>
                  {uploadResult.errors?.length > 0 && (
                    <div className="text-rose-600 text-[11px] pt-1 border-t border-slate-200">
                      {uploadResult.errors.slice(0, 3).map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={uploading || !csvFile}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 disabled:opacity-50"
                >
                  {uploading ? 'Processing CSV...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
