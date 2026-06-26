import React, { useState, useEffect } from 'react';
import { Check, CreditCard, Wallet, AlertCircle, Coins, CheckCircle, RefreshCw } from 'lucide-react';
import type { User, BillingSettings } from '../types';
import { apiRequest } from '../api';

interface BillingTabProps {
  currentUser: User | null;
  onUpdateUser: (updatedUser: User) => void;
}

export const BillingTab: React.FC<BillingTabProps> = ({ currentUser, onUpdateUser }) => {
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'basic_monthly' | 'standard_monthly' | 'premium_weekly' | null>(null);
  const [activeCheckoutTab, setActiveCheckoutTab] = useState<'card' | 'paybill'>('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Card checkout inputs
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');

  // Paybill checkout inputs
  const [transactionCode, setTransactionCode] = useState('');

  useEffect(() => {
    // Fetch merchant details (Paybill/Till and exchange rate)
    apiRequest<BillingSettings>('/billing/settings')
      .then(setBillingSettings)
      .catch(err => {
        console.error('Failed to load merchant billing config:', err);
      });
  }, []);

  const handleOpenCheckout = (plan: 'basic_monthly' | 'standard_monthly' | 'premium_weekly') => {
    setSelectedPlan(plan);
    setError(null);
    setSuccessMessage(null);
    setCardNumber('');
    setExpiry('');
    setCvc('');
    setCardName('');
    setTransactionCode('');
    setActiveCheckoutTab('card');
  };

  const handleCardPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    
    if (cardNumber.replace(/\s/g, '').length < 16) {
      setError('Please enter a valid 16-digit card number.');
      return;
    }
    if (!expiry || !cvc || !cardName) {
      setError('Please complete all card details.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{ status: string; message: string; user: User }>('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          planTier: selectedPlan,
          paymentMethod: 'card'
        })
      });

      if (response.status === 'success') {
        onUpdateUser(response.user);
        // Persist local storage update
        localStorage.setItem('timecamp_current_user', JSON.stringify(response.user));
        setSuccessMessage('Subscription activated successfully! Your plan is now active.');
      } else {
        setError(response.message || 'Payment simulation failed.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during card processing.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaybillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    if (!transactionCode || transactionCode.trim().length < 5) {
      setError('Please enter a valid M-Pesa or Bank transaction reference code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{ status: string; message: string }>('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          planTier: selectedPlan,
          paymentMethod: 'paybill',
          transactionCode: transactionCode.trim()
        })
      });

      if (response.status === 'pending') {
        setSuccessMessage(response.message);
      } else {
        setError(response.message || 'Verification submission failed.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  const getPlanPrice = (plan: string): number => {
    if (plan === 'basic_monthly') return 9.00;
    if (plan === 'standard_monthly') return 18.00;
    if (plan === 'premium_weekly') return 30.00;
    return 0.00;
  };

  const getPlanName = (plan: string): string => {
    if (plan === 'basic_monthly') return 'Basic Monthly';
    if (plan === 'standard_monthly') return 'Standard Monthly';
    if (plan === 'premium_weekly') return 'Professional Weekly';
    return 'Free Tier';
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const activeTier = currentUser?.subscriptionTier || 'free';
  const isActive = currentUser?.subscriptionStatus === 'active';
  const expiresAt = currentUser?.subscriptionExpiresAt;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Tab Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>Subscription Billing Plans</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Select a premium plan that matches your invoicing frequency. Upgrade at any time to remove daily creation limits.
        </p>
      </div>

      {/* Active Subscription Status Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.4))',
        borderLeft: '4px solid ' + (isActive ? 'var(--success)' : 'var(--text-muted)'),
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Active Subscription Profile
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {getPlanName(activeTier)}
            </h3>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              color: isActive ? 'var(--success)' : 'var(--text-muted)'
            }}>
              {isActive ? 'Active' : 'Unsubscribed'}
            </span>
          </div>
          {isActive && expiresAt && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Renewal Date: <strong>{new Date(expiresAt).toLocaleDateString()}</strong>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Usage limit</span>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeTier === 'free' && '1 Invoice / day'}
            {activeTier === 'basic_monthly' && '3 Invoices / day'}
            {activeTier === 'standard_monthly' && '6 Invoices / day'}
            {activeTier === 'premium_weekly' && 'Unlimited Invoices'}
          </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginTop: '1rem'
      }}>
        
        {/* Tier 1: Basic Monthly */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: activeTier === 'basic_monthly' && isActive ? '2px solid var(--success)' : '1px solid var(--border-color)',
          position: 'relative'
        }}>
          {activeTier === 'basic_monthly' && isActive && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '20px',
              backgroundColor: 'var(--success)',
              color: '#000000',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: '20px'
            }}>
              Current Plan
            </div>
          )}
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Basic Monthly</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Ideal for freelance developers with few clients.</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '1.5rem 0' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>$9.00</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ month</span>
            </div>
            
            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '1.5rem 0' }} />
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Up to <strong>3 invoices</strong> generated daily</span>
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Access all standard tracking tools</span>
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Export raw reports & summaries</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleOpenCheckout('basic_monthly')}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '2rem', justifyContent: 'center' }}
            disabled={activeTier === 'basic_monthly' && isActive}
          >
            {activeTier === 'basic_monthly' && isActive ? 'Plan Selected' : 'Choose Basic'}
          </button>
        </div>

        {/* Tier 2: Standard Monthly */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: activeTier === 'standard_monthly' && isActive ? '2px solid var(--success)' : '1px solid var(--border-color)',
          position: 'relative'
        }}>
          {activeTier === 'standard_monthly' && isActive && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '20px',
              backgroundColor: 'var(--success)',
              color: '#000000',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: '20px'
            }}>
              Current Plan
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Standard Monthly</h4>
              <span style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600
              }}>
                Popular
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Perfect for active freelancers and small consultancies.</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '1.5rem 0' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>$18.00</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ month</span>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Up to <strong>6 invoices</strong> generated daily</span>
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Access all standard tracking tools</span>
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Priority email customer support</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleOpenCheckout('standard_monthly')}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '2rem', justifyContent: 'center' }}
            disabled={activeTier === 'standard_monthly' && isActive}
          >
            {activeTier === 'standard_monthly' && isActive ? 'Plan Selected' : 'Choose Standard'}
          </button>
        </div>

        {/* Tier 3: Professional Weekly */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: activeTier === 'premium_weekly' && isActive ? '2px solid var(--success)' : '1px solid var(--border-color)',
          position: 'relative'
        }}>
          {activeTier === 'premium_weekly' && isActive && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '20px',
              backgroundColor: 'var(--success)',
              color: '#000000',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: '20px'
            }}>
              Current Plan
            </div>
          )}
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Professional Weekly</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>High-frequency invoicing with unlimited capacity.</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '1.5rem 0' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>$30.00</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ week</span>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span><strong>Unlimited invoices</strong> daily</span>
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>Access all advanced tracking features</span>
              </li>
              <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>VIP 24/7 dedicated support</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleOpenCheckout('premium_weekly')}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '2rem', justifyContent: 'center' }}
            disabled={activeTier === 'premium_weekly' && isActive}
          >
            {activeTier === 'premium_weekly' && isActive ? 'Plan Selected' : 'Choose Professional'}
          </button>
        </div>

      </div>

      {/* Checkout Modal */}
      {selectedPlan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '520px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  Subscribe to {getPlanName(selectedPlan)}
                </h3>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Billing Amount: <strong>${getPlanPrice(selectedPlan).toFixed(2)}</strong> {selectedPlan === 'premium_weekly' ? 'weekly' : 'monthly'}
                </span>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.25rem'
                }}
              >
                &times;
              </button>
            </div>

            {successMessage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', padding: '1.5rem 0' }}>
                <CheckCircle size={48} style={{ color: 'var(--success)' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Payment Processed!</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {successMessage}
                </p>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem', padding: '0.5rem 2rem' }}
                >
                  Close window
                </button>
              </div>
            ) : (
              <>
                {/* Payment Option Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <button
                    onClick={() => setActiveCheckoutTab('card')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeCheckoutTab === 'card' ? '2px solid var(--accent)' : '2px solid transparent',
                      color: activeCheckoutTab === 'card' ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <CreditCard size={14} />
                    <span>Credit/Debit Card</span>
                  </button>
                  <button
                    onClick={() => setActiveCheckoutTab('paybill')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeCheckoutTab === 'paybill' ? '2px solid var(--accent)' : '2px solid transparent',
                      color: activeCheckoutTab === 'paybill' ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Wallet size={14} />
                    <span>Mobile Money / Bank</span>
                  </button>
                </div>

                {error && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Card simulation form */}
                {activeCheckoutTab === 'card' && (
                  <form onSubmit={handleCardPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label>Cardholder Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Card Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        required
                      />
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label>Expiry Date</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="MM/YY"
                          maxLength={5}
                          value={expiry}
                          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>CVC / CVV</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="•••"
                          maxLength={4}
                          value={cvc}
                          onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, ''))}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ marginTop: '1rem', padding: '0.75rem', justifyContent: 'center' }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Simulating transaction...</span>
                        </>
                      ) : (
                        <span>Pay ${getPlanPrice(selectedPlan).toFixed(2)} (Mock Sandbox Upgrade)</span>
                      )}
                    </button>
                  </form>
                )}

                {/* Paybill reference submission form */}
                {activeCheckoutTab === 'paybill' && (
                  <form onSubmit={handlePaybillSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1rem',
                      fontSize: '0.825rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        Payment Instructions
                      </span>
                      <span>
                        1. Make direct transfer to the merchant details below:
                      </span>
                      <div style={{ margin: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '0.5rem', borderLeft: '2px solid var(--accent)' }}>
                        <div><strong>Service:</strong> {billingSettings?.bankName || 'Lipa na M-Pesa (Paybill)'}</div>
                        {billingSettings?.paybillNumber && <div><strong>Business Paybill:</strong> {billingSettings.paybillNumber}</div>}
                        {billingSettings?.tillNumber && <div><strong>Buy Goods Till Number:</strong> {billingSettings.tillNumber}</div>}
                        <div><strong>Account Ref:</strong> TR-{currentUser?.id.substring(0, 8)}</div>
                      </div>
                      
                      {billingSettings && (
                        <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
                          <Coins size={14} />
                          <span>
                            Amount due: <strong>KES {(getPlanPrice(selectedPlan) * billingSettings.usdToKesRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (Ex. Rate {billingSettings.usdToKesRate.toFixed(2)} KES/USD)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Enter Payment Transaction Reference Code</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. RG12345678"
                        style={{ textTransform: 'uppercase' }}
                        value={transactionCode}
                        onChange={(e) => setTransactionCode(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Paste the reference code received from your transaction statement. The system administrator will verify and approve the upgrade.
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ marginTop: '1rem', padding: '0.75rem', justifyContent: 'center' }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit Payment Code</span>
                      )}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
