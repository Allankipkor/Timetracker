import { useState, useEffect } from 'react';
import { Clock, Folder, FileText, BarChart3, Settings, Shield, LogOut } from 'lucide-react';
import type { TimeEntry, Project, Invoice, PayPalSettings, User } from './types';
import { MOCK_PAYPAL_SETTINGS } from './mockData';

// Tab Components
import { TrackerTab } from './components/TrackerTab';
import { ProjectsTab } from './components/ProjectsTab';
import { InvoicesTab } from './components/InvoicesTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { ClientPayment } from './components/ClientPayment';
import { AuthScreen } from './components/AuthScreen';
import { AdminTab } from './components/AdminTab';
import { apiRequest } from './api';

function App() {
  const [activeTab, setActiveTab] = useState<'tracker' | 'projects' | 'invoices' | 'reports' | 'settings' | 'admin'>('tracker');
  const [clientInvoiceId, setClientInvoiceId] = useState<string | null>(null);
  
  // App States
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paypalSettings, setPaypalSettings] = useState<PayPalSettings>(MOCK_PAYPAL_SETTINGS);
  
  // Authentication & Dropdown states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Handle client-facing hash routing detection
  useEffect(() => {
    const checkHashRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/pay/')) {
        const invId = hash.replace('#/pay/', '');
        setClientInvoiceId(invId);
      } else {
        setClientInvoiceId(null);
      }
    };
    checkHashRoute();
    window.addEventListener('hashchange', checkHashRoute);
    return () => window.removeEventListener('hashchange', checkHashRoute);
  }, []);

  const handleClientPaymentSuccess = (_invoiceId: string) => {
    // If merchant is logged in, reload invoices from Postgres to reflect "Paid" checkout state
    if (currentUser) {
      apiRequest<Invoice[]>('/invoices')
        .then(setInvoices)
        .catch(err => console.error('Error reloading invoices after payment:', err));
    }
  };

  // Initialize user session on mount
  useEffect(() => {
    const cachedUser = localStorage.getItem('timecamp_current_user');
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
      } catch {
        localStorage.removeItem('timecamp_current_user');
      }
    }
  }, []);

  // Fetch initial data when user logs in
  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      setTimeEntries([]);
      setInvoices([]);
      setPaypalSettings(MOCK_PAYPAL_SETTINGS);
      return;
    }

    const loadBackendData = async () => {
      try {
        const [projList, entryList, invList, settings] = await Promise.all([
          apiRequest<Project[]>('/projects'),
          apiRequest<TimeEntry[]>('/entries'),
          apiRequest<Invoice[]>('/invoices'),
          apiRequest<PayPalSettings>('/settings').catch(err => {
            console.warn('PayPal settings not found, loading default profile settings:', err);
            return {
              email: currentUser.email,
              clientId: 'test',
              mode: 'sandbox',
              currency: 'USD'
            } as PayPalSettings;
          })
        ]);
        setProjects(projList);
        setTimeEntries(entryList);
        setInvoices(invList);
        setPaypalSettings(settings);
      } catch (err) {
        console.error('Failed to load user backend data:', err);
      }
    };
    loadBackendData();
  }, [currentUser]);

  // Sync state changes to serverless Postgres DB
  const saveProjects = async (updated: Project[]) => {
    setProjects(updated);
    if (!currentUser) return;
    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to sync projects to database:', err);
    }
  };

  const saveTimeEntries = async (updated: TimeEntry[]) => {
    setTimeEntries(updated);
    if (!currentUser) return;
    try {
      await apiRequest('/entries', {
        method: 'POST',
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to sync time entries to database:', err);
    }
  };

  const saveInvoices = async (updated: Invoice[]) => {
    setInvoices(updated);
    if (!currentUser) return;
    try {
      await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to sync invoices to database:', err);
    }
  };

  const saveSettings = async (updated: PayPalSettings) => {
    setPaypalSettings(updated);
    if (!currentUser) return;
    try {
      await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to sync settings to database:', err);
    }
  };

  // State Modifiers
  const handleAddTimeEntry = (newEntry: TimeEntry) => {
    // If the entry is active (no endTime), ensure any existing running timer is stopped first
    let updatedEntries = [...timeEntries];
    if (newEntry.endTime === null) {
      updatedEntries = timeEntries.map(e => {
        if (e.endTime === null) {
          const now = new Date().toISOString();
          const duration = Math.floor((new Date(now).getTime() - new Date(e.startTime).getTime()) / 1000);
          return { ...e, endTime: now, duration };
        }
        return e;
      });
    }
    saveTimeEntries([newEntry, ...updatedEntries]);
  };

  const handleDeleteTimeEntry = (id: string) => {
    saveTimeEntries(timeEntries.filter(e => e.id !== id));
  };

  const handleAddProject = (newProj: Project) => {
    saveProjects([...projects, newProj]);
  };

  const handleDeleteProject = (id: string) => {
    saveProjects(projects.filter(p => p.id !== id));
    // Remove orphaned entries as cleanup
    saveTimeEntries(timeEntries.filter(e => e.projectId !== id));
  };

  const handleUpdateProject = (updatedProj: Project) => {
    saveProjects(projects.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  const handleAddInvoice = (newInv: Invoice, entryIds: string[]) => {
    saveInvoices([newInv, ...invoices]);
    // Mark associated logs as billed
    const updatedLogs = timeEntries.map(entry => {
      if (entryIds.includes(entry.id)) {
        return {
          ...entry,
          isInvoiceGenerated: true,
          invoiceId: newInv.id
        };
      }
      return entry;
    });
    saveTimeEntries(updatedLogs);
  };

  const handleUpdateInvoice = (updatedInv: Invoice) => {
    saveInvoices(invoices.map(inv => inv.id === updatedInv.id ? updatedInv : inv));
  };

  const handleDeleteInvoice = (id: string, entryIds: string[]) => {
    saveInvoices(invoices.filter(inv => inv.id !== id));
    // Revert logs to unbilled status
    const updatedLogs = timeEntries.map(entry => {
      if (entry.invoiceId === id || entryIds.includes(entry.id)) {
        return {
          ...entry,
          isInvoiceGenerated: false,
          invoiceId: null
        };
      }
      return entry;
    });
    saveTimeEntries(updatedLogs);
  };

  // Header Calculations
  const getTodayTrackedSeconds = (): number => {
    const today = new Date().toISOString().split('T')[0];
    return timeEntries
      .filter(e => e.startTime.split('T')[0] === today && e.endTime)
      .reduce((sum, curr) => sum + curr.duration, 0);
  };

  const getWeekTrackedSeconds = (): number => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    return timeEntries
      .filter(e => new Date(e.startTime) >= startOfWeek && e.endTime)
      .reduce((sum, curr) => sum + curr.duration, 0);
  };

  const getUninvoicedBillableSeconds = (): number => {
    return timeEntries
      .filter(e => e.endTime && e.isBillable && !e.isInvoiceGenerated)
      .reduce((sum, curr) => sum + curr.duration, 0);
  };

  const formatHours = (seconds: number): string => {
    return (seconds / 3600).toFixed(1) + 'h';
  };

  // If a public payment link is active, render the client checkout page distraction-free
  if (clientInvoiceId) {
    return (
      <ClientPayment
        invoiceId={clientInvoiceId}
        onPaymentSuccess={handleClientPaymentSuccess}
      />
    );
  }

  // Intercept authentication
  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('timecamp_current_user', JSON.stringify(user));
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* App Header bar */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">T</div>
          <span>TimeCamp <span className="logo-highlight">Flow</span></span>
        </div>

        {/* Global Nav tabs */}
        <nav className="app-nav">
          <button
            className={`nav-link ${activeTab === 'tracker' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracker')}
          >
            <Clock size={16} />
            <span>Time Tracker</span>
          </button>
          <button
            className={`nav-link ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <Folder size={16} />
            <span>Projects & Tasks</span>
          </button>
          <button
            className={`nav-link ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <FileText size={16} />
            <span>Invoicing</span>
          </button>
          <button
            className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>
          <button
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          {currentUser?.role === 'super_admin' && (
            <button
              className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Shield size={16} />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>

        {/* Quick stats & Developer Sandbox Badge */}
        <div className="header-meta">
          <div className="quick-stats">
            <div className="quick-stat-item">
              <span>Today:</span>
              <strong>{formatHours(getTodayTrackedSeconds())}</strong>
            </div>
            <div className="quick-stat-item">
              <span>This Week:</span>
              <strong>{formatHours(getWeekTrackedSeconds())}</strong>
            </div>
            <div className="quick-stat-item">
              <span>Unbilled:</span>
              <strong style={{ color: 'var(--warning)' }}>{formatHours(getUninvoicedBillableSeconds())}</strong>
            </div>
          </div>

          <div
            className="sandbox-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: 'var(--success)',
              background: 'var(--success-light)',
              padding: '0.25rem 0.6rem',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 600
            }}
          >
            <Shield size={12} />
            <span>PayPal Sandbox</span>
          </div>

          {/* User profile section */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                padding: '0.35rem 0.75rem',
                borderRadius: '30px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600,
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
            >
              <div style={{
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {currentUser?.name.substring(0, 2).toUpperCase() || 'US'}
              </div>
              <span>{currentUser?.name.split(' ')[0]}</span>
            </button>

            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                padding: '0.75rem',
                zIndex: 100,
                width: '200px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                textAlign: 'left'
              }}>
                <div style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    localStorage.removeItem('timecamp_current_user');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '0.5rem',
                    background: 'none',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main panel viewport */}
      <main className="main-content">
        {activeTab === 'tracker' && (
          <TrackerTab
            projects={projects}
            timeEntries={timeEntries}
            paypalSettings={paypalSettings}
            onAddTimeEntry={handleAddTimeEntry}
            onDeleteTimeEntry={handleDeleteTimeEntry}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsTab
            projects={projects}
            timeEntries={timeEntries}
            paypalSettings={paypalSettings}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            projects={projects}
            timeEntries={timeEntries}
            invoices={invoices}
            paypalSettings={paypalSettings}
            onAddInvoice={handleAddInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            projects={projects}
            timeEntries={timeEntries}
            paypalSettings={paypalSettings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={paypalSettings}
            onSaveSettings={saveSettings}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'super_admin' && (
          <AdminTab />
        )}
      </main>
    </div>
  );
}

export default App;
