export interface Task {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  color: string; // hex or HSL
  hourlyRate: number;
  tasks: Task[];
}

export interface TimeEntry {
  id: string;
  description: string;
  projectId: string; // Reference to Project
  taskId: string;    // Reference to Task (optional)
  startTime: string; // ISO String
  endTime: string | null;   // ISO String, null if active
  duration: number;  // in seconds
  isBillable: boolean;
  isInvoiceGenerated: boolean;
  invoiceId: string | null;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  date: string; // ISO date
  dueDate: string; // ISO date
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number; // percentage, e.g. 10
  taxAmount: number;
  discount: number; // flat discount amount
  total: number;
  status: InvoiceStatus;
  projectId: string; // associated project
  currency: string; // Invoice currency (e.g. USD, EUR, etc)
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  createdAt: string;
  role?: 'super_admin' | 'user';
  status?: 'approved' | 'pending' | 'rejected';
  subscriptionTier?: string;
  subscriptionStatus?: 'active' | 'inactive';
  subscriptionExpiresAt?: string | null;
}

export interface BillingSettings {
  paybillNumber: string;
  tillNumber: string;
  bankName: string;
  usdToKesRate: number;
}

export interface SubscriptionPayment {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  planTier: string;
  amount: number;
  paymentMethod: string;
  transactionCode: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PayPalSettings {
  email: string;
  clientId: string;
  mode: 'sandbox' | 'live';
  currency: string;
}

export interface AppState {
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  paypalSettings: PayPalSettings;
}

export const getCurrencySymbol = (code: string): string => {
  switch (code) {
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'CAD': return 'C$';
    case 'AUD': return 'A$';
    case 'USD':
    default: return '$';
  }
};
