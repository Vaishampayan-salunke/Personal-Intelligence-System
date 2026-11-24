import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import OnboardingModal from './OnboardingModal';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const showOnboarding = user && user.preferences && !user.preferences.onboarding_completed;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop & Mobile Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen min-w-0">
        <Navbar setMobileOpen={setMobileOpen} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* First-time Onboarding Modal */}
      {showOnboarding && <OnboardingModal />}
    </div>
  );
}
