import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  Sparkles, 
  MessageSquareText, 
  Target, 
  Settings, 
  LogOut,
  BrainCircuit,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'My Data', path: '/data', icon: Database },
  { name: 'Insights', path: '/insights', icon: Sparkles, badge: 'AI' },
  { name: 'Ask AI', path: '/chat', icon: MessageSquareText, badge: 'Chat' },
  { name: 'My Goals', path: '/goals', icon: Target },
  { name: 'Settings & Privacy', path: '/settings', icon: Settings },
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 bg-clip-text text-transparent">
              Know Thyself AI
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600/80">
              Personal Intelligence
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Platform Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-50 to-purple-50/60 text-indigo-700 font-semibold shadow-sm border border-indigo-100/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100/80 text-indigo-700 border border-indigo-200/60">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Privacy & User Info footer */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {user?.name || 'Active User'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user?.email || 'user@knowthyself.ai'}
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between px-2 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1 text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              Privacy Isolated
            </span>
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
