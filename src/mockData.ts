import type { Project, TimeEntry, Invoice, PayPalSettings } from './types';

// Helper to get past dates
const getPastDate = (daysAgo: number, hoursOffset: number = 0, minutesOffset: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hoursOffset, minutesOffset, 0, 0);
  return d.toISOString();
};

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Acme Website Redesign',
    clientName: 'Acme Corp',
    color: '#3b82f6', // Neon blue
    hourlyRate: 120,
    tasks: [
      { id: 'task-1-1', name: 'UI/UX Design' },
      { id: 'task-1-2', name: 'Frontend Development' },
      { id: 'task-1-3', name: 'Testing & QA' },
      { id: 'task-1-4', name: 'Client Feedback Meeting' }
    ]
  },
  {
    id: 'proj-2',
    name: 'Globex Mobile App',
    clientName: 'Globex Inc',
    color: '#10b981', // Emerald green
    hourlyRate: 150,
    tasks: [
      { id: 'task-2-1', name: 'API Integration' },
      { id: 'task-2-2', name: 'React Native Setup' },
      { id: 'task-2-3', name: 'App Store Submission' }
    ]
  },
  {
    id: 'proj-3',
    name: 'Cyberdyne AI Consultation',
    clientName: 'Cyberdyne Systems',
    color: '#8b5cf6', // Violet
    hourlyRate: 200,
    tasks: [
      { id: 'task-3-1', name: 'LLM Architecture Design' },
      { id: 'task-3-2', name: 'Feasibility Study' },
      { id: 'task-3-3', name: 'Executive Presentation' }
    ]
  },
  {
    id: 'proj-4',
    name: 'Non-Billable Internal Admin',
    clientName: 'Internal',
    color: '#6b7280', // Slate gray
    hourlyRate: 0,
    tasks: [
      { id: 'task-4-1', name: 'Internal Standup' },
      { id: 'task-4-2', name: 'Email Maintenance' }
    ]
  }
];

export const MOCK_TIME_ENTRIES: TimeEntry[] = [
  // 3 Days Ago
  {
    id: 'entry-1',
    description: 'Sketching out dashboard wireframes and color scheme',
    projectId: 'proj-1',
    taskId: 'task-1-1',
    startTime: getPastDate(3, 9, 0),
    endTime: getPastDate(3, 12, 30),
    duration: 12600, // 3.5 hrs
    isBillable: true,
    isInvoiceGenerated: true,
    invoiceId: 'inv-1'
  },
  {
    id: 'entry-2',
    description: 'Setting up Git repo and Tailwind config',
    projectId: 'proj-1',
    taskId: 'task-1-2',
    startTime: getPastDate(3, 13, 30),
    endTime: getPastDate(3, 17, 0),
    duration: 12600, // 3.5 hrs
    isBillable: true,
    isInvoiceGenerated: true,
    invoiceId: 'inv-1'
  },
  // 2 Days Ago
  {
    id: 'entry-3',
    description: 'Integrating payment API endpoints',
    projectId: 'proj-2',
    taskId: 'task-2-1',
    startTime: getPastDate(2, 9, 30),
    endTime: getPastDate(2, 13, 0),
    duration: 12600, // 3.5 hrs
    isBillable: true,
    isInvoiceGenerated: true,
    invoiceId: 'inv-2'
  },
  {
    id: 'entry-4',
    description: 'Reviewing LLM deployment pipelines',
    projectId: 'proj-3',
    taskId: 'task-3-1',
    startTime: getPastDate(2, 14, 0),
    endTime: getPastDate(2, 17, 30),
    duration: 12600, // 3.5 hrs
    isBillable: true,
    isInvoiceGenerated: false,
    invoiceId: null
  },
  // Yesterday
  {
    id: 'entry-5',
    description: 'Developing navigation bar and routing',
    projectId: 'proj-1',
    taskId: 'task-1-2',
    startTime: getPastDate(1, 9, 0),
    endTime: getPastDate(1, 12, 0),
    duration: 10800, // 3 hrs
    isBillable: true,
    isInvoiceGenerated: false,
    invoiceId: null
  },
  {
    id: 'entry-6',
    description: 'Weekly team meeting and sync',
    projectId: 'proj-4',
    taskId: 'task-4-1',
    startTime: getPastDate(1, 12, 0),
    endTime: getPastDate(1, 13, 0),
    duration: 3600, // 1 hr
    isBillable: false,
    isInvoiceGenerated: false,
    invoiceId: null
  },
  {
    id: 'entry-7',
    description: 'Refining landing page layouts based on client comments',
    projectId: 'proj-1',
    taskId: 'task-1-1',
    startTime: getPastDate(1, 14, 0),
    endTime: getPastDate(1, 17, 0),
    duration: 10800, // 3 hrs
    isBillable: true,
    isInvoiceGenerated: false,
    invoiceId: null
  },
  // Today
  {
    id: 'entry-8',
    description: 'Conducting unit tests on user auth flow',
    projectId: 'proj-1',
    taskId: 'task-1-3',
    startTime: getPastDate(0, 9, 30),
    endTime: getPastDate(0, 11, 45),
    duration: 8100, // 2.25 hrs
    isBillable: true,
    isInvoiceGenerated: false,
    invoiceId: null
  },
  {
    id: 'entry-9',
    description: 'Responding to client emails',
    projectId: 'proj-4',
    taskId: 'task-4-2',
    startTime: getPastDate(0, 13, 0),
    endTime: getPastDate(0, 13, 45),
    duration: 2700, // 0.75 hrs
    isBillable: false,
    isInvoiceGenerated: false,
    invoiceId: null
  }
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-001',
    clientName: 'Acme Corp',
    clientEmail: 'billing@acme.com',
    date: getPastDate(3),
    dueDate: getPastDate(-11), // 14 days terms
    items: [
      {
        id: 'item-1-1',
        description: 'Acme Website Redesign - UI/UX Design (3.5 hours @ $120/hr)',
        hours: 3.5,
        rate: 120,
        amount: 420
      },
      {
        id: 'item-1-2',
        description: 'Acme Website Redesign - Frontend Development (3.5 hours @ $120/hr)',
        hours: 3.5,
        rate: 120,
        amount: 420
      }
    ],
    subtotal: 840,
    taxRate: 10,
    taxAmount: 84,
    discount: 0,
    total: 924,
    status: 'Paid',
    projectId: 'proj-1',
    currency: 'USD'
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2026-002',
    clientName: 'Globex Inc',
    clientEmail: 'accounts@globex.com',
    date: getPastDate(2),
    dueDate: getPastDate(-12),
    items: [
      {
        id: 'item-2-1',
        description: 'Globex Mobile App - API Integration (3.5 hours @ $150/hr)',
        hours: 3.5,
        rate: 150,
        amount: 525
      }
    ],
    subtotal: 525,
    taxRate: 8,
    taxAmount: 42,
    discount: 25, // discount
    total: 542,
    status: 'Sent',
    projectId: 'proj-2',
    currency: 'USD'
  }
];

export const MOCK_PAYPAL_SETTINGS: PayPalSettings = {
  email: 'merchant@timecampflow.com',
  clientId: 'Aef_9X8D...MOCK_CLIENT_ID...zY2',
  mode: 'sandbox',
  currency: 'USD'
};
