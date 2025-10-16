import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  TrendingUp,
  Database,
  Lightbulb,
  BookOpen,
  LogOut,
  Settings,
  X,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3, path: '/' },
  { id: 'results', name: 'Results', icon: Database, path: '/results' },
  { id: 'teams', name: 'Teams and Roles', icon: Users, path: '/teams' },
  { id: 'people-matching', name: 'People Matching', icon: UserCheck, path: '/people-matching' },
  { id: 'analytics', name: 'Analytics', icon: TrendingUp, path: '/analytics' },
  { id: 'insights', name: 'Insights', icon: Lightbulb, path: '/insights' },
  { id: 'resources', name: 'Resources', icon: BookOpen, path: '/resources' },
  { id: 'settings', name: 'Settings', icon: Settings, path: '/settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        flex h-screen w-72 flex-col bg-white border-r border-gray-200 shadow-lg
        fixed lg:static inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

      {/* Logo */}
      <div className="flex h-20 shrink-0 items-center px-8 pr-16 lg:pr-8 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <img 
            src="/64e815ad31cc23753b969f9e_PurposeParadigm_Logo-p-500.png" 
            alt="Purpose Paradigm" 
            className="h-10 w-auto"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-6 py-8 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => onClose()} // Close sidebar on mobile when clicking nav item
              className={`group flex w-full items-center rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-300 ${
                active
                  ? 'bg-accent-400 text-primary-500 shadow-md'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-primary-500'
              }`}
            >
              <Icon
                className={`mr-4 h-5 w-5 transition-colors ${
                  active ? 'text-primary-500' : 'text-gray-600 group-hover:text-primary-500'
                }`}
              />
              {item.name}
            </Link>
          );
        })}

      </nav>

      {/* Bottom actions */}
      <div className="border-t border-gray-200 p-6 space-y-3 bg-white flex-shrink-0">
        <button
          onClick={handleSignOut}
          className="group flex w-full items-center rounded-xl px-4 py-3.5 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-300 min-h-[44px]"
        >
          <LogOut className="mr-4 h-5 w-5 text-gray-600 group-hover:text-red-600" />
          Sign Out
        </button>
      </div>
      </div>
    </>
  );
};