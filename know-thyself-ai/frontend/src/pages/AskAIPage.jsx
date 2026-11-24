import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquareText, 
  Send, 
  Sparkles, 
  Trash2, 
  Bot, 
  User, 
  HelpCircle, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { aiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SUGGESTED_PROMPTS = [
  "How many steps did I average this week?",
  "How has my sleep changed over the last 7 days?",
  "Which days were least active?",
  "What is my screen-time trend?",
  "What should I improve next week?",
  "Give me a summary of my last seven days."
];

export default function AskAIPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  const chatBottomRef = useRef(null);

  const fetchHistory = async () => {
    try {
      setFetchingHistory(true);
      const res = await aiService.getHistory();
      const formatted = [];
      res.data.forEach((item) => {
        formatted.push({ id: `q-${item.id}`, sender: 'user', text: item.question });
        formatted.push({ id: `a-${item.id}`, sender: 'ai', text: item.answer });
      });
      setMessages(formatted);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (qToSend) => {
    const question = qToSend || inputQuestion;
    if (!question.trim()) return;

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await aiService.askChat(question);
      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.data.answer,
        source: res.data.source,
        context: res.data.context_summary,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: 'Sorry, I encountered an error while processing your data. Please ensure you have daily records logged and try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to delete your conversation history?')) return;
    try {
      await aiService.clearHistory();
      setMessages([]);
      success('Chat history cleared.');
    } catch (err) {
      error('Failed to clear chat history.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-5xl mx-auto space-y-4">
      {/* Header with Title and Clear Chat */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Ask Your Data
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time conversational intelligence grounded strictly in your personal lifestyle database.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
            title="Clear chat history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear History</span>
          </button>
        )}
      </div>

      {/* Main Chat Message Container */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200/80 shadow-card p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.length === 0 && !fetchingHistory && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-inner">
              <MessageSquareText className="w-7 h-7" />
            </div>
            <h2 className="text-base font-extrabold text-slate-800">
              Your Personal Data Coach
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
              Ask any question about your steps, sleep patterns, screen time, workout routines, and energy correlations. Answers are generated using verified Python analytics and Google Gemini.
            </p>

            <div className="w-full space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Suggested Inquiries:
              </span>
              {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-xs font-medium text-slate-700 hover:text-indigo-900 transition-all flex items-center justify-between group"
                >
                  <span>{prompt}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'
                    : 'bg-slate-100 text-indigo-700 border border-slate-200'
                }`}
              >
                {isUser ? user?.name?.charAt(0).toUpperCase() || 'U' : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-xs shadow-md shadow-indigo-600/15'
                    : 'bg-slate-50/90 border border-slate-200/80 text-slate-800 rounded-tl-xs whitespace-pre-wrap'
                }`}
              >
                {m.text}

                {/* Grounding pill on AI message */}
                {!isUser && m.context && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{m.context}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-indigo-600 flex items-center justify-center border border-slate-200">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              <span>Analyzing records & calculating metrics...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Quick Prompt Chips (when in chat) */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SUGGESTED_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/40 whitespace-nowrap transition-all shadow-xs"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask a question about your personal activity, sleep, screen time..."
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-transparent border-none text-xs font-medium text-slate-900 focus:outline-none placeholder-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !inputQuestion.trim()}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
