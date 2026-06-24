import React, { useState } from 'react';
import { Shield, Lock, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { getCurrencySymbol } from '../types';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface PayPalCheckoutProps {
  invoiceId: string;
  amount: number;
  clientEmail: string;
  currency?: string;
  clientId: string;
  onPaymentSuccess: (transactionId: string) => void;
  onClose?: () => void;
}

export const PayPalCheckout: React.FC<PayPalCheckoutProps> = ({
  invoiceId,
  amount,
  clientEmail,
  currency,
  clientId,
  onPaymentSuccess,
  onClose
}) => {
  const code = currency || 'USD';
  const symbol = getCurrencySymbol(code);
  const isMockId = !clientId || clientId.includes('MOCK_CLIENT_ID');
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'login' | 'review' | 'processing' | 'success'>('login');
  const [email, setEmail] = useState(clientEmail || 'buyer@example.com');
  const [password, setPassword] = useState('••••••••');
  const [error, setError] = useState<string | null>(null);

  const handleOpenCheckout = () => {
    setIsOpen(true);
    setStep('login');
    setError(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your PayPal email.');
      return;
    }
    setStep('processing');
    setTimeout(() => {
      setStep('review');
    }, 1200);
  };

  const handleCompletePayment = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('success');
      setTimeout(() => {
        const txId = 'PAYID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        onPaymentSuccess(txId);
        setIsOpen(false);
        if (onClose) onClose();
      }, 1500);
    }, 1800);
  };

  return (
    <div className="paypal-integration-container">
      {/* PayPal Smart Buttons */}
      {!isMockId ? (
        <div style={{ width: '100%', maxWidth: '320px', margin: '1rem 0' }}>
          <PayPalScriptProvider options={{ 
            clientId: clientId,
            currency: code,
            intent: "capture"
          }}>
            <PayPalButtons
              style={{ layout: "vertical", height: 38 }}
              createOrder={(_data, actions) => {
                return actions.order.create({
                  intent: "CAPTURE",
                  purchase_units: [
                    {
                      amount: {
                        currency_code: code,
                        value: amount.toFixed(2)
                      },
                      description: `Invoice ${invoiceId}`
                    }
                  ]
                });
              }}
              onApprove={(_data, actions) => {
                if (actions.order) {
                  return actions.order.capture().then((details) => {
                    const txId = details.id || 'PAYID-REAL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    onPaymentSuccess(txId);
                  });
                }
                return Promise.resolve();
              }}
              onError={(err) => {
                console.error("PayPal checkout SDK error:", err);
                alert("Payment processing error. Please check your credentials or sandbox configuration.");
              }}
            />
          </PayPalScriptProvider>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '320px', margin: '1rem 0' }}>
          <button
            onClick={handleOpenCheckout}
            className="paypal-button-yellow"
            style={{
              background: '#ffc439',
              color: '#111',
              fontWeight: 700,
              fontSize: '1rem',
              padding: '0.65rem 1rem',
              borderRadius: '4px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <span style={{ fontStyle: 'italic', fontSize: '1.1rem', fontWeight: 900 }}>PayPal</span>
          </button>

          <button
            onClick={handleOpenCheckout}
            className="paypal-button-black"
            style={{
              background: '#2c2e2f',
              color: '#fff',
              fontWeight: 500,
              fontSize: '0.9rem',
              padding: '0.65rem 1rem',
              borderRadius: '4px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <CreditCard size={16} />
            <span>Debit or Credit Card</span>
          </button>
        </div>
      )}

      {/* Simulated PayPal Popup Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            color: '#333333',
            width: '100%',
            maxWidth: '450px',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e5e5e5',
              backgroundColor: '#fcfcfc'
            }}>
              {/* PayPal Blue Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#003087', fontStyle: 'italic' }}>Pay</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0079c1', fontStyle: 'italic' }}>Pal</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '1.25rem',
                  color: '#666',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '2rem 1.5rem', flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              {step === 'login' && (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#2c2e2f', marginBottom: '0.5rem' }}>Pay with PayPal</h3>
                    <p style={{ fontSize: '0.85rem', color: '#666' }}>Enter your sandbox buyer email to complete checkout simulation.</p>
                  </div>

                  {error && (
                    <div style={{
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        padding: '0.65rem',
                        border: '1px solid #a6a6a6',
                        borderRadius: '4px',
                        fontSize: '0.95rem',
                        color: '#333',
                        outline: 'none'
                      }}
                      placeholder="buyer@example.com"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        padding: '0.65rem',
                        border: '1px solid #a6a6a6',
                        borderRadius: '4px',
                        fontSize: '0.95rem',
                        color: '#333',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: '#0070ba',
                      color: '#fff',
                      fontWeight: 600,
                      padding: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      marginTop: '0.5rem',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    Log In
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#666', fontSize: '0.75rem' }}>
                    <Shield size={14} color="#0079c1" />
                    <span>PayPal Sandbox Secure Checkout</span>
                  </div>
                </form>
              )}

              {step === 'review' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#2c2e2f', marginBottom: '0.25rem' }}>Review your payment</h3>
                    <p style={{ fontSize: '0.85rem', color: '#666' }}>Invoice ID: {invoiceId}</p>
                  </div>

                  {/* Payment Details Box */}
                  <div style={{
                    backgroundColor: '#f5f7fa',
                    border: '1px solid #e1e4e8',
                    borderRadius: '6px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: '#555' }}>Pay to:</span>
                      <strong style={{ color: '#333' }}>TimeCamp Merchant</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: '#555' }}>Funding source:</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#333' }}>
                        PayPal Balance ({email})
                      </span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid #e1e4e8' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                      <strong style={{ color: '#333' }}>Total:</strong>
                      <strong style={{ color: '#0070ba' }}>{symbol}{amount.toFixed(2)} {code}</strong>
                    </div>
                  </div>

                  <button
                    onClick={handleCompletePayment}
                    style={{
                      background: '#ffc439',
                      color: '#111',
                      fontWeight: 700,
                      padding: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      marginTop: 'auto',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    Pay Now
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#666', fontSize: '0.75rem' }}>
                    <Lock size={12} />
                    <span>Secure SSL connection. Money won't leave your real account.</span>
                  </div>
                </div>
              )}

              {step === 'processing' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  gap: '1.5rem',
                  minHeight: '200px'
                }}>
                  {/* CSS Spinner */}
                  <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid rgba(0, 112, 186, 0.1)',
                    borderTop: '4px solid #0070ba',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ fontSize: '1rem', color: '#333', fontWeight: 500 }}>Processing simulated transaction...</p>
                  
                  {/* Embedding standard spin keyframes */}
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              )}

              {step === 'success' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  gap: '1rem',
                  minHeight: '200px'
                }}>
                  <CheckCircle2 size={64} color="#10b981" />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#10b981' }}>Payment Successful!</h3>
                  <p style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                    Your simulated transaction has been processed. The invoice status will be updated immediately.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              padding: '1rem',
              borderTop: '1px solid #f1f1f1',
              backgroundColor: '#fcfcfc',
              fontSize: '0.75rem',
              color: '#999'
            }}>
              <span>User Agreement</span>
              <span>Privacy Policy</span>
              <span>Help & Feedback</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
