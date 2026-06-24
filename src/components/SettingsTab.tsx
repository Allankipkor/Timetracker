import React, { useState } from 'react';
import { Save, ShieldAlert, Key, Mail, CheckCircle } from 'lucide-react';
import type { PayPalSettings } from '../types';

interface SettingsTabProps {
  settings: PayPalSettings;
  onSaveSettings: (settings: PayPalSettings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSaveSettings }) => {
  const [email, setEmail] = useState(settings.email);
  const [clientId, setClientId] = useState(settings.clientId);
  const [mode, setMode] = useState<'sandbox' | 'live'>(settings.mode);
  const [currency, setCurrency] = useState(settings.currency || 'USD');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      email,
      clientId,
      mode,
      currency
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>Settings & Integrations</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Configure your billing details, PayPal merchant profile, and sandbox integration keys.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          PayPal Merchant Account Setup
        </h3>

        {saved && (
          <div style={{
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s'
          }}>
            <CheckCircle size={16} />
            <span>PayPal merchant settings saved successfully!</span>
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Mail size={14} />
            <span>Merchant PayPal Email Address</span>
          </label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="merchant@yourdomain.com"
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            This is the email address where client payments will be sent.
          </span>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Key size={14} />
            <span>PayPal REST Client ID</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Aef_..."
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Your credential key fetched from the PayPal Developer Dashboard under Apps & Credentials.
          </span>
        </div>

        <div className="form-group">
          <label>Integration Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="sandbox">Sandbox (Testing Simulator - Recommended)</option>
            <option value="live">Live Production (Real Transactions)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Default Invoice Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD ($) - United States Dollar</option>
            <option value="GBP">GBP (£) - British Pound</option>
            <option value="EUR">EUR (€) - Euro</option>
            <option value="CAD">CAD (C$) - Canadian Dollar</option>
            <option value="AUD">AUD (A$) - Australian Dollar</option>
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            This currency will be applied to all newly generated invoices, report totals, and PayPal payment portals.
          </span>
        </div>

        {/* Informative notice block */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '0.75rem'
        }}>
          <ShieldAlert size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>Developer Sandbox Notice</strong>
            <span>
              This application has a high-fidelity payment processor simulator enabled. Changing keys here saves details to the system profile. In live production, standard integrations involve importing <code>@paypal/react-paypal-js</code> and rendering real script providers.
            </span>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          <Save size={16} />
          <span>Save Changes</span>
        </button>
      </form>
    </div>
  );
};
