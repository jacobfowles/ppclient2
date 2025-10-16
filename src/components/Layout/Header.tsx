import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Bell, Search, X, Users, BarChart3, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface SearchResult {
  id: string;
  type: 'assessment' | 'team';
  title: string;
  subtitle: string;
  url: string;
}

const getPageInfo = (pathname: string) => {
  switch (pathname) {
    case '/':
      return { title: 'Dashboard', subtitle: 'Executive overview and key metrics' };
    case '/teams':
      return { title: 'Teams and Roles', subtitle: 'Manage teams and leadership structure' };
    case '/people-matching':
      return { title: 'People Matching', subtitle: 'Review and approve matches between assessment participants and Planning Center people' };
    case '/analytics':
      return { title: 'Analytics', subtitle: 'Data visualization and insights' };
    case '/results':
      return { title: 'Results', subtitle: 'Assessment results and team assignments' };
    case '/insights':
      return { title: 'Insights', subtitle: 'AI-powered recommendations' };
    case '/resources':
      return { title: 'Resources', subtitle: 'Training materials and guides' };
    case '/settings':
      return { title: 'Settings', subtitle: 'Church profile and account settings' };
    default:
      return { title: 'Dashboard', subtitle: 'Executive overview and key metrics' };
  }
};

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, churchId, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { title, subtitle } = getPageInfo(location.pathname);
  const [churchName, setChurchName] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);

  React.useEffect(() => {
    const loadChurchName = async () => {
      if (churchId) {
        try {
          const { data: church } = await supabase
            .from('churches')
            .select('name')
            .eq('id', churchId)
            .single();
          
          if (church) {
            setChurchName(church.name);
          }
        } catch (error) {
          console.error('Error loading church name:', error);
        }
      }
    };

    loadChurchName();
  }, [churchId]);

  // Debounced search effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery.trim());
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, churchId]);

  const performSearch = async (query: string) => {
    if (!churchId) return;

    try {
      setSearchLoading(true);
      // Session is already initialized by the current page using useChurchSession
      const results: SearchResult[] = [];

      // Search assessments (exclude soft-deleted records)
      const { data: assessments } = await supabase
        .from('assessments')
        .select('id, first_name, last_name, email, profile')
        .eq('church_id', churchId)
        .is('deleted_at', null)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

      if (assessments) {
        assessments.forEach(assessment => {
          results.push({
            id: `assessment-${assessment.id}`,
            type: 'assessment',
            title: `${assessment.first_name} ${assessment.last_name}`,
            subtitle: `${assessment.profile} • ${assessment.email}`,
            url: `/results?search=${encodeURIComponent(`${assessment.first_name} ${assessment.last_name}`)}`
          });
        });
      }

      // Search teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, description')
        .eq('church_id', churchId)
        .eq('active', true)
        .ilike('name', `%${query}%`)
        .limit(5);

      if (teams) {
        teams.forEach(team => {
          results.push({
            id: `team-${team.id}`,
            type: 'team',
            title: team.name,
            subtitle: team.description || 'Team',
            url: `/results?team=${team.id}`
          });
        });
      }

      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    const currentPath = location.pathname;
    const resultUrl = new URL(result.url, window.location.origin);
    const targetPath = resultUrl.pathname;

    // If we're already on the target page, force a reload by navigating away and back
    if (currentPath === targetPath) {
      // Navigate to a different path first, then to the target
      navigate('/');
      setTimeout(() => {
        navigate(result.url);
      }, 0);
    } else {
      navigate(result.url);
    }

    setSearchQuery('');
    setShowSearchResults(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile hamburger menu */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
            <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 lg:space-x-6">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10 pr-10 py-2 w-48 lg:w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500 mx-auto"></div>
                  </div>
                ) : (
                  <>
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No results found for "{searchQuery}"
                      </div>
                    ) : (
                      <div className="py-2">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleSearchResultClick(result)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
                          >
                            <div className="flex-shrink-0">
                              {result.type === 'assessment' ? (
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <BarChart3 className="h-4 w-4 text-blue-600" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <Users className="h-4 w-4 text-green-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {result.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {result.subtitle}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className="text-xs text-gray-400 capitalize">
                                {result.type}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Mobile logout button - only show when sidebar is closed */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to sign out?')) {
                signOut();
              }
            }}
            className="sm:hidden p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
          
          {/* Church Name - Prominent Display */}
          {churchName && (
            <div className="hidden sm:flex items-center space-x-3 bg-gradient-to-r from-accent-50 to-accent-100 px-4 py-2 rounded-xl border border-accent-200">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-sm font-bold">
                  {churchName.split(' ').map(word => word[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="text-xs text-accent-600 uppercase tracking-wide font-semibold">
                  {user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user?.email?.split('@')[0] || 'User'
                  }
                </p>
                <p className="text-lg font-black text-accent-900 leading-tight">{churchName}</p>
              </div>
            </div>
          )}
          
          {/* Notifications */}
          <button className="hidden sm:block relative p-2 text-gray-400 hover:text-accent-600 transition-colors rounded-lg hover:bg-accent-50">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-accent-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
  );
};