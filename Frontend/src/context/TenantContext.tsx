import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Organization, Tenant, UserRole, Board } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface TenantContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  userRole: UserRole | null;
  boards: Board[];
  currentBoard: Board | null;
  selectOrganization: (orgId: string) => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  selectBoard: (boardId: string) => void;
  deleteBoard: (boardId: string) => Promise<void>;
  refreshBoards: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, memberships } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load theme from localStorage or default
  useEffect(() => {
    const savedTheme = (localStorage.getItem('kanban_theme') as 'light' | 'dark') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('kanban_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // When user or memberships change, load organizations
  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setTenants([]);
      setCurrentTenant(null);
      setBoards([]);
      setCurrentBoard(null);
      return;
    }

    const loadOrgs = async () => {
      try {
        const res = await api.getOrganizations();
        setOrganizations(res.organizations);
        if (res.organizations.length > 0) {
          const defaultOrg = res.organizations[0];
          setCurrentOrg(defaultOrg);
          await loadTenantsForOrg(defaultOrg._id);
        }
      } catch (err) {
        console.error('[TenantContext] Failed to load organizations', err);
      }
    };

    loadOrgs();
  }, [user]);

  const loadTenantsForOrg = async (orgId: string) => {
    try {
      const res = await api.getTenantsInOrg(orgId);
      setTenants(res.tenants);
      if (res.tenants.length > 0) {
        const firstTenant = res.tenants[0];
        setCurrentTenant(firstTenant);
        await loadBoardsForTenant(firstTenant._id);
      } else {
        setCurrentTenant(null);
        setBoards([]);
        setCurrentBoard(null);
      }
    } catch (err) {
      console.error('[TenantContext] Failed to load tenants', err);
    }
  };

  const loadBoardsForTenant = async (tenantId: string) => {
    try {
      const res = await api.getBoards(tenantId);
      setBoards(res.boards);
      setCurrentBoard(current =>
        current && res.boards.some(board => board._id === current._id)
          ? current
          : res.boards[0] || null
      );
    } catch (err) {
      console.error('[TenantContext] Failed to load boards', err);
    }
  };

  const selectOrganization = async (orgId: string) => {
    const found = organizations.find(o => o._id === orgId);
    if (found) {
      setCurrentOrg(found);
      await loadTenantsForOrg(found._id);
    }
  };

  const selectTenant = async (tenantId: string) => {
    const found = tenants.find(t => t._id === tenantId);
    if (found) {
      setCurrentTenant(found);
      await loadBoardsForTenant(found._id);
    }
  };

  const selectBoard = (boardId: string) => {
    const found = boards.find(b => b._id === boardId);
    if (found) {
      setCurrentBoard(found);
    }
  };

  const deleteBoard = async (boardId: string) => {
    if (!currentTenant) throw new Error('Select a branch before deleting a board.');
    await api.deleteBoard(currentTenant._id, boardId);
    const boardIndex = boards.findIndex(board => board._id === boardId);
    const remainingBoards = boards.filter(board => board._id !== boardId);
    setBoards(remainingBoards);
    if (currentBoard?._id === boardId) {
      setCurrentBoard(remainingBoards[Math.min(Math.max(boardIndex, 0), remainingBoards.length - 1)] || null);
    }
  };

  // Determine user's effective role in current tenant
  let userRole: UserRole | null = null;
  if (currentOrg && currentTenant && memberships) {
    const orgMembership = memberships.find(
      m => m.organization?._id === currentOrg._id && m.tenant === null && m.role === 'ORG_ADMIN'
    );
    if (orgMembership) {
      userRole = 'ORG_ADMIN';
    } else {
      const tenantMembership = memberships.find(
        m => m.tenant?._id === currentTenant._id
      );
      if (tenantMembership) {
        userRole = tenantMembership.role;
      }
    }
  }

  return (
    <TenantContext.Provider
      value={{
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
        refreshBoards: () => (currentTenant ? loadBoardsForTenant(currentTenant._id) : Promise.resolve()),
        refreshTenants: () => (currentOrg ? loadTenantsForOrg(currentOrg._id) : Promise.resolve()),
        theme,
        toggleTheme,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
