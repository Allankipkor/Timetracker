import { useState, useEffect } from 'react';
import { Clock, Folder, FileText, BarChart3, Settings, Shield } from 'lucide-react';
import type { TimeEntry, Project, Invoice, PayPalSettings } from './types';
import { MOCK_PROJECTS, MOCK_TIME_ENTRIES, MOCK_INVOICES, MOCK_PAYPAL_SETTINGS } from './mockData';

// Tab Components
import { TrackerTab } from './components/TrackerTab';
import { ProjectsTab } from './components/ProjectsTab';
import { InvoicesTab } from './components/InvoicesTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { ClientPayment } from './components/ClientPayment';

function App() {
  const [activeTab, setActiveTab] = useState<'tracker' | 'projects' | 'invoices' | 'reports' | 'settings'>('tracker');
  const [clientInvoiceId, setClientInvoiceId] = useState<string | null>(null);
  
  // App States
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paypalSettings, setPaypalSettings] = useState<PayPalSettings>(MOCK_PAYPAL_SETTINGS);

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

  const handleClientPaymentSuccess = (invoiceId: string) => {
    const updated = invoices.map(inv => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'Paid' as const
        };
      }
      return inv;
    });
    saveInvoices(updated);
  };

  // Initialize from LocalStorage or Mock Data
  useEffect(() => {
    const cachedProjects = localStorage.getItem('timecamp_projects');
    const cachedEntries = localStorage.getItem('timecamp_entries');
    const cachedInvoices = localStorage.getItem('timecamp_invoices');
    const cachedSettings = localStorage.getItem('timecamp_settings');

    if (cachedProjects) setProjects(JSON.parse(cachedProjects));
    else {
      setProjects(MOCK_PROJECTS);
      localStorage.setItem('timecamp_projects', JSON.stringify(MOCK_PROJECTS));
    }

    if (cachedEntries) setTimeEntries(JSON.parse(cachedEntries));
    else {
      setTimeEntries(MOCK_TIME_ENTRIES);
      localStorage.setItem('timecamp_entries', JSON.stringify(MOCK_TIME_ENTRIES));
    }

    if (cachedInvoices) setInvoices(JSON.parse(cachedInvoices));
    else {
      setInvoices(MOCK_INVOICES);
      localStorage.setItem('timecamp_invoices', JSON.stringify(MOCK_INVOICES));
    }

    if (cachedSettings) setPaypalSettings(JSON.parse(cachedSettings));
    else {
      setPaypalSettings(MOCK_PAYPAL_SETTINGS);
      localStorage.setItem('timecamp_settings', JSON.stringify(MOCK_PAYPAL_SETTINGS));
    }
  }, []);

  // Sync state changes to LocalStorage
  const saveProjects = (updated: Project[]) => {
    setProjects(updated);
    localStorage.setItem('timecamp_projects', JSON.stringify(updated));
  };

  const saveTimeEntries = (updated: TimeEntry[]) => {
    setTimeEntries(updated);
    localStorage.setItem('timecamp_entries', JSON.stringify(updated));
  };

  const saveInvoices = (updated: Invoice[]) => {
    setInvoices(updated);
    localStorage.setItem('timecamp_invoices', JSON.stringify(updated));
  };

  const saveSettings = (updated: PayPalSettings) => {
    setPaypalSettings(updated);
    localStorage.setItem('timecamp_settings', JSON.stringify(updated));
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
        invoices={invoices}
        projects={projects}
        paypalSettings={paypalSettings}
        onPaymentSuccess={handleClientPaymentSuccess}
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
      </main>
    </div>
  );
}

export default App;
