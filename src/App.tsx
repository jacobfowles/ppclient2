import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Teams } from './pages/Teams';
import { PeopleMatching } from './pages/PeopleMatching';
import { Analytics } from './pages/Analytics';
import { Results } from './pages/Results';
import { Insights } from './pages/Insights';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';
import { PlanningCenterCallback } from './pages/PlanningCenterCallback';

const AppContent: React.FC = () => {
  const { user, loading, forcePasswordChange, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = React.useState(false);

  // Check for force password change after user loads
  React.useEffect(() => {
    if (user && forcePasswordChange) {
      setShowPasswordChangeModal(true);
    }
  }, [user, forcePasswordChange]);

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChangeModal(false);
    alert('Password changed successfully! You will now be logged out. Please sign in with your new password.');
    signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200">
                <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-transparent border-t-accent-500 animate-spin"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-light overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/people-matching" element={<PeopleMatching />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/results" element={<Results />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/planning-center/callback" element={<PlanningCenterCallback />} />
          </Routes>
        </main>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showPasswordChangeModal}
        onSuccess={handlePasswordChangeSuccess}
        userEmail={user.email}
      />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;