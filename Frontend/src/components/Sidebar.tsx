import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import {
  Building2,
  GitBranch,
  Layout,
  Activity,
  LogOut,
  ChevronDown,
  Shield,
  Layers,
  Search,
  X,
} from 'lucide-react';

interface SidebarProps {
  onOpenActivity: () => void;
  onOpenNewBoard: () => void;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenActivity,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const {
    organizations,
    currentOrg,
    tenants,
    currentTenant,
    userRole,
    boards,
    currentBoard,
    selectOrganization,
    selectTenant,
    selectBoard,
  } = useTenant();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');

  const orgRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside, blur, or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (orgRef.current && !orgRef.current.contains(target)) {
        setOrgDropdownOpen(false);
      }
      if (tenantRef.current && !tenantRef.current.contains(target)) {
        setTenantDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOrgDropdownOpen(false);
        setTenantDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 flex-shrink-0 flex flex-col h-screen
          border-r border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-900 select-none
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* 1. Org & App Branding */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 relative z-30">
          <div className="flex items-center justify-between gap-1">
            <div className="relative flex-1 min-w-0" ref={orgRef}>
              <button
                onClick={() => {
                  setOrgDropdownOpen(prev => !prev);
                  setTenantDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <img
                    src="/logo.svg"
                    alt="Workspace Logo"
                    className="w-7 h-7 rounded-lg shrink-0 shadow-sm object-contain"
                  />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {currentOrg?.name || 'Select Organization'}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Organization</div>
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Org Selector Dropdown */}
              {orgDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-fade-in">
                  <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Organizations
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {organizations.map(org => (
                      <button
                        key={org._id}
                        onClick={() => {
                          selectOrganization(org._id);
                          setOrgDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                          currentOrg?._id === org._id
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{org.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Close Drawer Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                title="Close Navigation"
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 2. Tenant (Branch) Switcher */}
          <div className="relative mt-2" ref={tenantRef}>
            <button
              onClick={() => {
                setTenantDropdownOpen(prev => !prev);
                setOrgDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                  <GitBranch className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {currentTenant?.name || 'Select Branch'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {userRole && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {userRole === 'ORG_ADMIN' ? 'Org Admin' : userRole === 'TENANT_ADMIN' ? 'Admin' : 'Member'}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${tenantDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Tenant Switcher Dropdown */}
            {tenantDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl z-50 p-2 space-y-2 animate-fade-in">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Filter branch..."
                    value={tenantSearch}
                    onChange={e => setTenantSearch(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredTenants.map(t => (
                    <button
                      key={t._id}
                      onClick={() => {
                        selectTenant(t._id);
                        setTenantDropdownOpen(false);
                        setTenantSearch('');
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                        currentTenant?._id === t._id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="text-[10px] text-slate-400">/{t.slug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* 3. Navigation Links & Boards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Boards
            </span>
          </div>

          <div className="space-y-0.5">
            {boards.length === 0 ? (
              <div className="px-2 py-2 text-xs text-slate-400 italic">No boards yet</div>
            ) : (
              boards.map(b => (
                <button
                  key={b._id}
                  onClick={() => {
                    selectBoard(b._id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                    currentBoard?._id === b._id
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{b.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="px-2 mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Workspace
            </span>
          </div>

          <button
            onClick={onOpenActivity}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
          >
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Activity Feed</span>
          </button>
        </div>
      </div>

      {/* 4. User Profile */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
              alt={user?.name}
              className="w-7 h-7 rounded-full bg-slate-200 shrink-0 border border-slate-300 dark:border-slate-700"
            />
            <div className="min-w-0 truncate">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {user?.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
};
