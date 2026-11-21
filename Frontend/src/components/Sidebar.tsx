import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Plus,
  RotateCcw,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { ApiError } from '../services/api';

interface SidebarProps {
  onOpenActivity: () => void;
  onOpenNewBoard: () => void;
  onReplayTour: () => void;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenActivity,
  onOpenNewBoard,
  onReplayTour,
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
    deleteBoard,
  } = useTenant();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [boardMenuId, setBoardMenuId] = useState<string | null>(null);
  const [boardToDelete, setBoardToDelete] = useState<{ id: string; name: string } | null>(null);
  const [boardNameConfirmation, setBoardNameConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [boardToast, setBoardToast] = useState('');

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

  const canDeleteBoard = (board: (typeof boards)[number]) => {
    const creatorId = typeof board.createdBy === 'string'
      ? board.createdBy
      : board.createdBy?._id || board.createdBy?.id;
    return userRole === 'ORG_ADMIN' || userRole === 'TENANT_ADMIN' || creatorId === user?.id;
  };

  const confirmBoardDeletion = async () => {
    if (!boardToDelete || boardNameConfirmation !== boardToDelete.name || isDeletingBoard) return;
    setIsDeletingBoard(true);
    setDeleteError('');
    try {
      await deleteBoard(boardToDelete.id);
      setBoardToast(`“${boardToDelete.name}” deleted successfully.`);
      setBoardToDelete(null);
      setBoardNameConfirmation('');
      window.setTimeout(() => setBoardToast(''), 4000);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 403) {
        setDeleteError('Only the board creator or an admin can delete this board.');
      } else if (error instanceof ApiError && error.statusCode === 404) {
        setDeleteError('This board no longer exists. Refresh the sidebar and try again.');
      } else if (error instanceof TypeError || (error instanceof ApiError && error.statusCode === 0)) {
        setDeleteError('Could not connect to the server. Check your network and try again.');
      } else {
        setDeleteError(error instanceof Error ? error.message : 'Could not delete this board. Please try again.');
      }
    } finally {
      setIsDeletingBoard(false);
    }
  };

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
            <button
              type="button"
              data-tour="create-board"
              onClick={onOpenNewBoard}
              title="Create board"
              aria-label="Create board"
              className={`p-1 rounded-md text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 ring-1 ring-blue-200 dark:ring-blue-800 transition-colors ${boards.length === 0 ? 'animate-pulse' : ''}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {boards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-3 text-center">
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">No boards yet</p>
                <button type="button" onClick={onOpenNewBoard} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Create Board
                </button>
              </div>
            ) : (
              boards.map(b => {
                const canDelete = canDeleteBoard(b);
                return (
                  <div key={b._id} className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        selectBoard(b._id);
                        onCloseMobile?.();
                      }}
                      className={`min-w-0 flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                        currentBoard?._id === b._id
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Layout className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{b.name}</span>
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        title={`More options for ${b.name}`}
                        aria-label={`More options for ${b.name}`}
                        aria-expanded={boardMenuId === b._id}
                        onClick={() => setBoardMenuId(current => current === b._id ? null : b._id)}
                        className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && boardMenuId === b._id && (
                      <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setBoardToDelete({ id: b._id, name: b.name });
                            setBoardNameConfirmation('');
                            setDeleteError('');
                            setBoardMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete board
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
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
            data-tour="activity-feed"
            onClick={onOpenActivity}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
          >
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Activity Feed</span>
          </button>
        </div>
      </div>

      {boardToast && (
        <div role="status" className="fixed bottom-4 left-4 z-[70] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {boardToast}
        </div>
      )}

      {boardToDelete && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !isDeletingBoard) setBoardToDelete(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-board-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onMouseDown={event => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="delete-board-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">Delete {boardToDelete.name}?</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">This removes all columns and tasks.</p>
              </div>
              <button type="button" disabled={isDeletingBoard} onClick={() => setBoardToDelete(null)} aria-label="Close dialog" className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <label htmlFor="confirm-board-name" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Type the board name to confirm</label>
            <input id="confirm-board-name" autoFocus value={boardNameConfirmation} onChange={event => setBoardNameConfirmation(event.target.value)} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            {deleteError && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isDeletingBoard} onClick={() => setBoardToDelete(null)} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" disabled={isDeletingBoard || boardNameConfirmation !== boardToDelete.name} onClick={confirmBoardDeletion} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{isDeletingBoard ? 'Deleting...' : 'Delete'}</button>
            </div>
          </section>
        </div>,
        document.body
      )}

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
            type="button"
            onClick={onReplayTour}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Replay tour</span>
          </button>
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
