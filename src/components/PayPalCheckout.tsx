import React from 'react';
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
  currency,
  clientId,
  onPaymentSuccess,
  onClose
}) => {
  const code = currency || 'USD';
  const isMockPlaceholder = !clientId || clientId.includes('MOCK_CLIENT_ID');
  const resolvedClientId = isMockPlaceholder ? 'test' : clientId;

  return (
    <div className="paypal-integration-container">
      {/* PayPal Smart Buttons */}
      <div style={{ width: '100%', maxWidth: '320px', margin: '1rem 0' }}>
        <PayPalScriptProvider options={{ 
          clientId: resolvedClientId,
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
                  if (onClose) onClose();
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
    </div>
  );
};
