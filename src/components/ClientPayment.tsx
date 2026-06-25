import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Invoice, PayPalSettings } from '../types';
import { getCurrencySymbol } from '../types';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface ClientPaymentProps {
  invoiceId: string;
  onPaymentSuccess?: (invoiceId: string) => void;
}

export const ClientPayment: React.FC<ClientPaymentProps> = ({
  invoiceId,
  onPaymentSuccess
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paypalSettings, setPaypalSettings] = useState<PayPalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPayPalReceipt, setShowPayPalReceipt] = useState(false);
  const [paypalTxId, setPaypalTxId] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Dynamic currency variables
  const code = invoice ? invoice.currency : (paypalSettings?.currency || 'USD');
  const symbol = getCurrencySymbol(code);
  const rawClientId = paypalSettings?.clientId;
  const isMockPlaceholder = !rawClientId || rawClientId.includes('MOCK_CLIENT_ID');
  const resolvedClientId = isMockPlaceholder ? 'test' : rawClientId;

  // PayPal checkout flow states
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/invoices?id=${invoiceId}`)
      .then(res => {
        if (!res.ok) throw new Error('Invoice not found or database connection failed');
        return res.json();
      })
      .then(data => {
        setInvoice(data.invoice);
        setPaypalSettings(data.paypalSettings || {
          email: data.invoice.clientEmail || 'admin@timecamp.com',
          clientId: 'test',
          mode: 'sandbox',
          currency: data.invoice.currency || 'USD'
        });
        if (data.invoice.status === 'Paid') {
          setIsAlreadyPaid(true);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching client invoice details:', err);
        setLoadError(err.message);
        setLoading(false);
      });
  }, [invoiceId]);

  const handleCompleteBackendPayment = async () => {
    try {
      const res = await fetch(`/api/invoices?id=${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' })
      });
      if (!res.ok) throw new Error('Failed to update invoice status in database');

      if (invoice) {
        setInvoice({ ...invoice, status: 'Paid' });
        setIsAlreadyPaid(true);
      }
      setShowPayPalReceipt(false);
      if (onPaymentSuccess) {
        onPaymentSuccess(invoiceId);
      }
      // Redirect to home/login page of the application
      window.location.href = window.location.origin;
    } catch (err) {
      console.error(err);
      alert('Error updating payment status on server. Please contact support.');
    }
  };

  // Redirection countdown effect
  useEffect(() => {
    if (!showPayPalReceipt || !invoice || invoice.status === 'Paid') return;

    if (redirectCountdown <= 0) {
      handleCompleteBackendPayment();
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showPayPalReceipt, redirectCountdown, invoice, invoiceId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0e17',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.1)',
          borderTop: '4px solid var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1.5rem'
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Loading secure checkout portal...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (loadError || !invoice) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0e17',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <AlertCircle size={64} color="var(--danger)" style={{ marginBottom: '1.5rem' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Invoice Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {loadError || 'The requested invoice link is invalid, expired, or has been deleted.'}
        </p>
        <a href="/" className="btn btn-primary">Return to Dashboard</a>
      </div>
    );
  }

  if (isAlreadyPaid) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0e17',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle accent border */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(to right, var(--success), var(--accent))'
          }} />

          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            backgroundColor: 'var(--success-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--success)'
          }}>
            <CheckCircle2 size={40} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Invoice Settled</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              This invoice has already been paid. The payment link is deactivated to prevent duplicate charges.
            </p>
          </div>

          <div style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'left',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Invoice:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{invoice.invoiceNumber}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Client:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{invoice.clientName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Amount Paid:</span>
              <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-display)' }}>{symbol}{invoice.total.toFixed(2)} {code}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge badge-paid" style={{ padding: '0.15rem 0.6rem', fontSize: '0.7rem' }}>Paid</span>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
            No further actions are required. A receipt has been issued to <strong style={{ color: 'var(--text-secondary)' }}>{invoice.clientEmail}</strong>.
          </p>

          <a href="/" className="btn btn-outline" style={{ width: '100%', marginTop: '0.5rem' }}>
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Render High-Fidelity PayPal Success Page (mimicking screenshot)
  if (showPayPalReceipt) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '100vh',
        backgroundColor: '#f5f7fa',
        color: '#2c2e2f',
        padding: '2rem 1rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        {/* Container */}
        <div style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Top Header PayPal Logo */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '1.5rem',
            borderBottom: '1px solid #eef2f5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#003087', fontStyle: 'italic', letterSpacing: '-0.5px' }}>Pay</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0079c1', fontStyle: 'italic', letterSpacing: '-0.5px' }}>Pal</span>
            </div>
          </div>

          {/* Body Section */}
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            
            {/* Amount details card */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.95rem',
              fontWeight: 500,
              color: '#333',
              marginBottom: '1.25rem',
              textAlign: 'left'
            }}>
              <span>You made a payment of</span>
              <strong style={{ fontSize: '1.1rem', fontWeight: 700 }}>{symbol}{invoice.total.toFixed(2)} {code}</strong>
            </div>

            {/* Collapsed Receipt list */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              padding: '1rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>Trimetracker Services Summary</span>
                <span>{symbol}{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.25rem', marginBottom: '0.5rem' }}>
                Transaction ID: {paypalTxId}
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                <span>Total</span>
                <span>{symbol}{invoice.total.toFixed(2)} {code}</span>
              </div>
            </div>

            {/* Payment Sent Confirmation Text */}
            <p style={{ fontSize: '1.05rem', fontWeight: 500, color: '#2c2e2f', marginBottom: '1.25rem' }}>
              Your payment has been sent
            </p>

            {/* Green Circular Success Checkmark */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={36} color="#ffffff" strokeWidth={2.5} />
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>
              From buyer, you've completed your payment.
            </p>
            <p style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '2.5rem' }}>
              An email receipt has been sent to <strong style={{ color: '#1f2937' }}>{invoice.clientEmail}</strong>
            </p>

            {/* Return Link & Redirect Notification */}
            <button
              onClick={handleCompleteBackendPayment}
              style={{
                border: 'none',
                background: 'none',
                color: '#0070ba',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                marginBottom: '1rem',
                display: 'block',
                margin: '0 auto 0.75rem'
              }}
            >
              Return to PayPal
            </button>

            {invoice.status !== 'Paid' ? (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                You will be redirected to PayPal in {redirectCountdown} seconds...
              </p>
            ) : (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                Redirected successfully. Invoice is settled.
              </p>
            )}

          </div>
        </div>
      </div>
    );
  }

  // Render Direct PayPal Checkout View (unpaid status, matching screenshot)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: '100vh',
      backgroundColor: '#f5f7fa',
      color: '#2c2e2f',
      padding: '1.5rem 0.5rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Container */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Header (Back, PayPal logo, Share button) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #eef2f5'
        }}>
          <button 
            style={{ border: 'none', background: 'none', color: '#666', fontSize: '1.25rem', cursor: 'pointer', fontWeight: 'bold' }} 
            onClick={() => window.history.back()}
          >
            ✕
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 950, color: '#003087', fontStyle: 'italic', letterSpacing: '-0.5px' }}>Pay</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 950, color: '#0079c1', fontStyle: 'italic', letterSpacing: '-0.5px' }}>Pal</span>
          </div>
          <button style={{ border: 'none', background: 'none', color: '#0070ba', fontSize: '1.25rem', cursor: 'pointer', transform: 'rotate(-45deg)' }}>
            ➔
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem 1.25rem' }}>
          
          {/* Collapsible Payment Summary card */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            padding: '1.15rem 1rem',
            marginBottom: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            >
              <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#2c2e2f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Your payment summary
                <span style={{ transform: isSummaryExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', fontSize: '0.75rem', transition: 'transform 0.2s' }}>
                  ▼
                </span>
              </span>
              <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>
                {symbol}{invoice.total.toFixed(2)} {code}
              </strong>
            </div>

            {isSummaryExpanded && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                      <th style={{ padding: '0.4rem 0' }}>Description</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc', color: '#334155' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 500 }}>{item.description}</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{symbol}{item.amount.toFixed(2)} {code}</td>
                      </tr>
                    ))}
                    {invoice.discount > 0 && (
                      <tr style={{ color: 'var(--danger)' }}>
                        <td style={{ padding: '0.6rem 0' }}>Discount</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right' }}>-{symbol}{invoice.discount.toFixed(2)} {code}</td>
                      </tr>
                    )}
                    <tr style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.75rem 0', borderTop: '1px solid #e2e8f0' }}>Total</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'right', borderTop: '1px solid #e2e8f0' }}>{symbol}{invoice.total.toFixed(2)} {code}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Flows */}
          {paypalSettings ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: '100%', padding: '0 0.5rem', boxSizing: 'border-box', margin: '0.5rem 0' }}>
                <PayPalScriptProvider options={{ 
                  clientId: resolvedClientId,
                  currency: code,
                  intent: "capture"
                }}>
                  <PayPalButtons
                    style={{ layout: "vertical", height: 42 }}
                    createOrder={(_data, actions) => {
                      return actions.order.create({
                        intent: "CAPTURE",
                        purchase_units: [
                          {
                            amount: {
                              currency_code: code,
                              value: invoice.total.toFixed(2)
                            },
                            payee: {
                              email_address: paypalSettings.email
                            },
                            description: `Invoice ${invoice.invoiceNumber}`
                          }
                        ]
                      });
                    }}
                    onApprove={(_data, actions) => {
                      if (actions.order) {
                        return actions.order.capture().then((details) => {
                          const txId = details.id || 'PAYID-REAL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                          setPaypalTxId(txId);
                          setShowPayPalReceipt(true);
                        });
                      }
                      return Promise.resolve();
                    }}
                    onError={(err) => {
                      console.error("PayPal client checkout error:", err);
                      alert("Payment processing error. Please check your credentials or sandbox configuration.");
                    }}
                  />
                </PayPalScriptProvider>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
              Loading PayPal checkout...
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#fcfcfc',
          borderTop: '1px solid #f1f5f9',
          padding: '1rem',
          textAlign: 'center',
          fontSize: '0.7rem',
          color: '#94a3b8',
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <span>User Agreement</span>
          <span>Privacy Policy</span>
          <span>Help</span>
        </div>

      </div>
    </div>
  );
};
