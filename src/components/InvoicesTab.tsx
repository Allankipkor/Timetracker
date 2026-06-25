import React, { useState, useEffect } from 'react';
import { Plus, Eye, Check, Send, Trash2, Printer, AlertTriangle, FileText, Mail, FileCheck, Link as LinkIcon } from 'lucide-react';
import type { Project, Invoice, TimeEntry, InvoiceItem, InvoiceStatus, PayPalSettings } from '../types';
import { PayPalCheckout } from './PayPalCheckout';
import { getCurrencySymbol } from '../types';

interface InvoicesTabProps {
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  paypalSettings: PayPalSettings;
  onAddInvoice: (invoice: Invoice, affectedEntryIds: string[]) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string, affectedEntryIds: string[]) => void;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  projects,
  timeEntries,
  invoices,
  paypalSettings,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice
}) => {
  const symbol = getCurrencySymbol(paypalSettings.currency);
  const code = paypalSettings.currency;

  // Navigation State inside tab
  const [view, setView] = useState<'list' | 'create' | 'view'>('list');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // New Invoice Currency State
  const [invoiceCurrency, setInvoiceCurrency] = useState(paypalSettings.currency);
  const invoiceSymbol = getCurrencySymbol(invoiceCurrency);

  useEffect(() => {
    if (view === 'create') {
      setInvoiceCurrency(paypalSettings.currency);
    }
  }, [paypalSettings.currency, view]);

  // New Invoice Form State
  const [selectedProjId, setSelectedProjId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState(10);
  const [discount, setDiscount] = useState(0);
  const [importedItems, setImportedItems] = useState<InvoiceItem[]>([]);
  const [affectedEntryIds, setAffectedEntryIds] = useState<string[]>([]);
  const [customDescription, setCustomDescription] = useState('');
  const [customHours, setCustomHours] = useState(0);
  const [customRate, setCustomRate] = useState(100);

  // Automatically pre-fill fields when selecting project
  useEffect(() => {
    if (view === 'create' && projects.length > 0) {
      if (!selectedProjId) {
        setSelectedProjId(projects[0].id);
      }
      
      const project = projects.find(p => p.id === selectedProjId);
      if (project) {
        // Fetch un-invoiced entries
        const unbilledEntries = timeEntries.filter(
          e => e.projectId === project.id && e.endTime && e.isBillable && !e.isInvoiceGenerated
        );
        
        // Group entries into line items (by task or consolidated description)
        const entriesByTask: { [key: string]: { duration: number; desc: string } } = {};
        const entryIds: string[] = [];

        unbilledEntries.forEach(entry => {
          entryIds.push(entry.id);
          const taskName = project.tasks.find(t => t.id === entry.taskId)?.name || 'General Support';
          const key = taskName;
          
          if (!entriesByTask[key]) {
            entriesByTask[key] = { duration: 0, desc: `${project.name} - ${taskName}` };
          }
          entriesByTask[key].duration += entry.duration;
        });

        const items: InvoiceItem[] = Object.keys(entriesByTask).map((key, idx) => {
          const hours = Number((entriesByTask[key].duration / 3600).toFixed(2));
          return {
            id: 'item-' + idx + '-' + Math.random().toString(36).substr(2, 5),
            description: entriesByTask[key].desc,
            hours,
            rate: project.hourlyRate,
            amount: Number((hours * project.hourlyRate).toFixed(2))
          };
        });

        setImportedItems(items);
        setAffectedEntryIds(entryIds);
        
        // Default client details if mock client matches
        setClientEmail(project.clientName === 'Acme Corp' ? 'billing@acme.com' : 
                       project.clientName === 'Globex Inc' ? 'accounts@globex.com' : 
                       project.clientName === 'Cyberdyne Systems' ? 'finance@cyberdyne.com' : 'client@example.com');
        
        // Default due date: Today + 14 days
        const d = new Date();
        d.setDate(d.getDate() + 14);
        setDueDate(d.toISOString().split('T')[0]);
      }
    }
  }, [selectedProjId, view, projects, timeEntries]);

  // Form Submissions
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find(p => p.id === selectedProjId);
    if (!project) return;

    if (importedItems.length === 0) {
      alert('Please add at least one line item to generate an invoice.');
      return;
    }

    const subtotal = importedItems.reduce((acc, curr) => acc + curr.amount, 0);
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = Number((subtotal + taxAmount - discount).toFixed(2));

    const invoiceNum = 'INV-' + new Date().getFullYear() + '-' + String(invoices.length + 1).padStart(3, '0');

    const newInvoice: Invoice = {
      id: 'inv-' + Math.random().toString(36).substr(2, 9),
      invoiceNumber: invoiceNum,
      clientName: project.clientName,
      clientEmail: clientEmail.trim(),
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate,
      items: importedItems,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      status: 'Draft',
      projectId: selectedProjId,
      currency: invoiceCurrency
    };

    onAddInvoice(newInvoice, affectedEntryIds);
    
    // Clear forms and route back
    setView('list');
    setSelectedProjId('');
    setImportedItems([]);
    setAffectedEntryIds([]);
  };

  // Add Custom Item manually to current Invoice builder
  const handleAddCustomItem = () => {
    if (customHours <= 0) {
      alert('Please enter a valid number of hours (must be greater than 0).');
      return;
    }

    const desc = customDescription.trim() || 'Custom Services';

    const newItem: InvoiceItem = {
      id: 'item-custom-' + Math.random().toString(36).substr(2, 5),
      description: desc,
      hours: Number(customHours),
      rate: Number(customRate),
      amount: Number((customHours * customRate).toFixed(2))
    };

    setImportedItems([...importedItems, newItem]);
    setCustomDescription('');
    setCustomHours(0);
  };

  // Delete item from current Invoice builder
  const handleRemoveBuilderItem = (itemId: string) => {
    setImportedItems(importedItems.filter(i => i.id !== itemId));
  };

  // Trigger simulated invoice send
  const handleSendInvoice = (inv: Invoice) => {
    const updated = {
      ...inv,
      status: 'Sent' as InvoiceStatus
    };
    onUpdateInvoice(updated);
    alert(`Invoice ${inv.invoiceNumber} email sent successfully to ${inv.clientEmail}! PayPal payment portal is now active.`);
  };

  // Payment Success Handler
  const handlePaymentSuccess = (invoice: Invoice, txId: string) => {
    const updated = {
      ...invoice,
      status: 'Paid' as InvoiceStatus
    };
    onUpdateInvoice(updated);
    alert(`Payment successful!\nInvoice ${invoice.invoiceNumber} has been updated to PAID.\nPayPal Transaction ID: ${txId}`);
  };

  // Fetch current selected invoice details
  const activeInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
  const invoiceViewSymbol = activeInvoice ? getCurrencySymbol(activeInvoice.currency) : symbol;
  const invoiceViewCode = activeInvoice ? activeInvoice.currency : code;


  return (
    <div>
      {view === 'list' && (
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>Invoices & Billing</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Track client billing statements, issue drafts, and collect payments via PayPal.
              </p>
            </div>

            <button className="btn btn-primary" onClick={() => setView('create')}>
              <Plus size={16} />
              <span>Create Invoice</span>
            </button>
          </div>

          {/* List layout */}
          {invoices.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ margin: '0 auto 1rem', display: 'block', strokeWidth: 1.5 }} />
              <p style={{ fontWeight: 500 }}>No invoices created yet.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Select "Create Invoice" to import billable hours.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <th style={{ padding: '1rem' }}>Invoice #</th>
                      <th style={{ padding: '1rem' }}>Client</th>
                      <th style={{ padding: '1rem' }}>Issue Date</th>
                      <th style={{ padding: '1rem' }}>Due Date</th>
                      <th style={{ padding: '1rem' }}>Amount</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: '1rem' }}>{inv.clientName}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{inv.date}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{inv.dueDate}</td>
                        <td style={{ padding: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{getCurrencySymbol(inv.currency)}{inv.total.toFixed(2)}</td>
                        <td style={{ padding: '1rem' }}>
                          <span className={`badge badge-${inv.status.toLowerCase()}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                setSelectedInvoiceId(inv.id);
                                setView('view');
                              }}
                            >
                              <Eye size={14} />
                              <span>View</span>
                            </button>
                            {inv.status !== 'Draft' && (
                              <button
                                className="btn btn-outline"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}${window.location.pathname}#/pay/${inv.id}`;
                                  navigator.clipboard.writeText(shareUrl);
                                  alert(`Payment link copied to clipboard:\n${shareUrl}`);
                                }}
                                title="Copy Shareable Payment Link"
                              >
                                <LinkIcon size={14} />
                                <span>Link</span>
                              </button>
                            )}
                            {inv.status === 'Draft' && (
                              <button
                                className="btn btn-success"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                onClick={() => handleSendInvoice(inv)}
                              >
                                <Send size={14} />
                                <span>Send</span>
                              </button>
                            )}
                            {inv.status === 'Draft' && (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '0.35rem', borderRadius: '4px' }}
                                onClick={() => {
                                  if (confirm('Delete this draft invoice? The hours will revert to un-invoiced state.')) {
                                    onDeleteInvoice(inv.id, affectedEntryIds);
                                  }
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice Creator View */}
      {view === 'create' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setView('list')}>
              ← Back to List
            </button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', marginTop: '0.75rem' }}>Generate New Invoice</h2>
          </div>

          <form onSubmit={handleCreateInvoice} className="invoices-layout-grid">
            {/* Primary Details Panel */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Invoice Line Items
              </h3>

              {/* Project Select & Basic Options */}
              <div className="grid-2">
                <div className="form-group">
                  <label>Billable Project</label>
                  <select
                    value={selectedProjId}
                    onChange={(e) => setSelectedProjId(e.target.value)}
                    required
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.clientName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Client Billing Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="billing@client.com"
                    required
                  />
                </div>
              </div>

              {/* Aggregated Line Items list */}
              {importedItems.length === 0 ? (
                <div style={{
                  padding: '2.5rem',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <AlertTriangle size={32} style={{ margin: '0 auto 0.75rem', strokeWidth: 1.5 }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No unbilled hours found for this project.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Add custom items manually below or log hours first.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {importedItems.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.description}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.hours} hrs @ {invoiceSymbol}{item.rate}/hr
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>
                          {invoiceSymbol}{item.amount.toFixed(2)}
                        </strong>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleRemoveBuilderItem(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Item Section */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Add Custom Work Item</h4>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '2 1 200px', marginBottom: 0 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Task description / Expenses"
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 80px', marginBottom: 0 }}>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Hours"
                      value={customHours || ''}
                      onChange={(e) => setCustomHours(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 80px', marginBottom: 0 }}>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Rate"
                      value={customRate || ''}
                      onChange={(e) => setCustomRate(Number(e.target.value))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddCustomItem}
                    style={{ height: '38px', padding: '0 1.25rem', flexShrink: 0, whiteSpace: 'nowrap', flex: '1 1 auto' }}
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Calculations & Date Options Panel */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Billing Configurations
              </h3>

              <div className="form-group">
                <label>Billing Currency</label>
                <select
                  value={invoiceCurrency}
                  onChange={(e) => setInvoiceCurrency(e.target.value)}
                  required
                >
                  <option value="USD">USD ($) - United States Dollar</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="CAD">CAD (C$) - Canadian Dollar</option>
                  <option value="AUD">AUD (A$) - Australian Dollar</option>
                </select>
              </div>

              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tax Rate (%)</label>
                <input
                  type="number"
                  className="form-control"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Discount Amount ({invoiceSymbol})</label>
                <input
                  type="number"
                  className="form-control"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  required
                />
              </div>

              {/* Subtotals & Totals List */}
              <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <strong>{invoiceSymbol}{importedItems.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tax ({taxRate}%):</span>
                  <strong>
                    {invoiceSymbol}{((importedItems.reduce((acc, curr) => acc + curr.amount, 0) * taxRate) / 100).toFixed(2)}
                  </strong>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Discount:</span>
                    <strong>-{invoiceSymbol}{discount.toFixed(2)}</strong>
                  </div>
                )}
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Grand Total:</strong>
                  <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-display)' }}>
                    {invoiceSymbol}{(
                      importedItems.reduce((acc, curr) => acc + curr.amount, 0) * (1 + taxRate / 100) - discount
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                <Check size={16} />
                <span>Save Draft Invoice</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoice Detail Viewer View */}
      {view === 'view' && activeInvoice && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setView('list')}>
              ← Back to List
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => window.print()} title="Print Invoice">
                <Printer size={16} />
                <span>Print</span>
              </button>
              {activeInvoice.status === 'Draft' && (
                <button className="btn btn-success" onClick={() => handleSendInvoice(activeInvoice)}>
                  <Send size={16} />
                  <span>Send Invoice</span>
                </button>
              )}
            </div>
          </div>

          <div className="invoices-layout-grid">
            {/* The Invoice Document Sheet */}
            <div className="invoice-document-sheet">
              {/* Invoice Header */}
              <div className="responsive-invoice-header">
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-display)' }}>INVOICE</h1>
                  <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>Number: {activeInvoice.invoiceNumber}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Time Tracker</div>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Time Tracking & Automated Billing</span>
                </div>
              </div>

              {/* Sender & Receiver Info */}
              <div className="responsive-invoice-grid-2">
                <div>
                  <h4 style={{ color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.5rem' }}>Billed From:</h4>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>Time Tracker Consultant</strong>
                  <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>100 Innovation Way<br />Silicon Valley, CA 94025</p>
                </div>
                <div>
                  <h4 style={{ color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.5rem' }}>Billed To:</h4>
                  <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{activeInvoice.clientName}</strong>
                  <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>Email: {activeInvoice.clientEmail}</p>
                </div>
              </div>

              {/* Meta Dates Box */}
              <div className="responsive-invoice-dates">
                <div>
                  <span style={{ color: '#6b7280', display: 'block' }}>Date Issued:</span>
                  <strong style={{ color: '#111827' }}>{activeInvoice.date}</strong>
                </div>
                <div>
                  <span style={{ color: '#6b7280', display: 'block' }}>Due Date:</span>
                  <strong style={{ color: '#111827' }}>{activeInvoice.dueDate}</strong>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left', marginBottom: '3rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                    <th style={{ padding: '0.75rem 0' }}>Description</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Hours</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 500 }}>{item.description}</td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>{item.hours.toFixed(2)}</td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>{invoiceViewSymbol}{item.rate}</td>
                      <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 600 }}>{invoiceViewSymbol}{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Calculations */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '250px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                    <span>Subtotal:</span>
                    <strong style={{ color: '#111827' }}>{invoiceViewSymbol}{activeInvoice.subtotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                    <span>Tax ({activeInvoice.taxRate}%):</span>
                    <strong style={{ color: '#111827' }}>{invoiceViewSymbol}{activeInvoice.taxAmount.toFixed(2)}</strong>
                  </div>
                  {activeInvoice.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                      <span>Discount:</span>
                      <strong>-{invoiceViewSymbol}{activeInvoice.discount.toFixed(2)}</strong>
                    </div>
                  )}
                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                    <span style={{ color: '#111827' }}>Total:</span>
                    <span style={{ color: '#3b82f6' }}>{invoiceViewSymbol}{activeInvoice.total.toFixed(2)} {invoiceViewCode}</span>
                  </div>
                </div>
              </div>

              {/* Thank you note */}
              <div style={{ marginTop: '4rem', textAlign: 'center', borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                Thank you for your business! Please settle this invoice within due date details.
              </div>
            </div>

            {/* Sidebar Payment Actions Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Invoice Status</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <span className={`badge badge-${activeInvoice.status.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.8rem' }}>
                    {activeInvoice.status}
                  </span>
                </div>

                {activeInvoice.status !== 'Draft' && (
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', marginBottom: '1.25rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      const shareUrl = `${window.location.origin}${window.location.pathname}#/pay/${activeInvoice.id}`;
                      navigator.clipboard.writeText(shareUrl);
                      alert('Payment link copied to clipboard!');
                    }}
                  >
                    <LinkIcon size={14} />
                    <span>Copy Shareable Link</span>
                  </button>
                )}

                {activeInvoice.status === 'Draft' && (
                  <div style={{ display: 'flex', flexFlow: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <p>This invoice is currently a Draft. Clients cannot view it, and PayPal payment options will not be available.</p>
                    <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => handleSendInvoice(activeInvoice)}>
                      <Send size={16} />
                      <span>Send to Client</span>
                    </button>
                  </div>
                )}

                {activeInvoice.status === 'Sent' && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={14} />
                      <span>Collect Payment:</span>
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Invoice is sent. The client can pay instantly using the secure PayPal sandbox window below.
                    </p>
                    
                    {/* Render the PayPal simulator portal */}
                    <PayPalCheckout
                      invoiceId={activeInvoice.id}
                      amount={activeInvoice.total}
                      clientEmail={activeInvoice.clientEmail}
                      currency={activeInvoice.currency}
                      clientId={paypalSettings.clientId}
                      merchantEmail={paypalSettings.email}
                      onPaymentSuccess={(txId) => handlePaymentSuccess(activeInvoice, txId)}
                    />
                  </div>
                )}

                {activeInvoice.status === 'Paid' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem 0', textAlign: 'center' }}>
                    <FileCheck size={36} color="var(--success)" />
                    <div>
                      <strong style={{ color: 'var(--success)', display: 'block' }}>Successfully Paid</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>via PayPal Sandbox Portal</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
