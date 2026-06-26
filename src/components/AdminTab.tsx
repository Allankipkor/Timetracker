import React, { useState, useEffect } from 'react';
import { Shield, Check, X, Users, Mail, Clock, AlertCircle, CreditCard, ListChecks } from 'lucide-react';
import type { User, SubscriptionPayment } from '../types';
import { apiRequest } from '../api';

export const AdminTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subActionLoading, setSubActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<User[]>('/admin/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<SubscriptionPayment[]>('/admin/subscriptions');
      setSubscriptions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscriptions list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchSubscriptions();
    }
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchSubscriptions();
    }
  };

  const handleUpdateStatus = async (targetUserId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setActionLoading(targetUserId);
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, status: newStatus }),
      });
      setUsers(prev =>
        prev.map(u => (u.id === targetUserId ? { ...u, status: newStatus } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (targetUserId: string, currentRole: 'super_admin' | 'user') => {
    const newRole = currentRole === 'super_admin' ? 'user' : 'super_admin';
    const confirmChange = window.confirm(
      `Are you sure you want to change this user's role to ${newRole === 'super_admin' ? 'Administrator' : 'Standard User'}?`
    );
    if (!confirmChange) return;

    try {
      setActionLoading(targetUserId);
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, role: newRole }),
      });
      setUsers(prev =>
        prev.map(u => (u.id === targetUserId ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubscriptionAction = async (paymentId: string, action: 'approve' | 'reject') => {
    const confirmAction = window.confirm(
      `Are you sure you want to ${action} this subscription payment?`
    );
    if (!confirmAction) return;

    try {
      setSubActionLoading(paymentId);
      await apiRequest('/admin/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ paymentId, action }),
      });
      
      // Refresh the subscriptions list
      await fetchSubscriptions();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} subscription payment.`);
    } finally {
      setSubActionLoading(null);
    }
  };

  // Stats Calculations
  const totalUsers = users.length;
  const pendingUsers = users.filter(u => u.status === 'pending').length;
  const approvedUsers = users.filter(u => u.status === 'approved').length;
  const rejectedUsers = users.filter(u => u.status === 'rejected').length;

  const totalSubs = subscriptions.length;
  const pendingSubs = subscriptions.filter(s => s.status === 'pending').length;
  const approvedSubs = subscriptions.filter(s => s.status === 'approved').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div className="animate-pulse">Loading administrator console...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Tab Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Admin Control Console</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Review pending registrations, manage user permissions, and audit billing subscriptions.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          Refresh List
        </button>
      </div>

      {/* Sub-tab view buttons */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'users' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'users' ? '2px solid var(--accent)' : '2px solid transparent',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <Users size={16} />
          <span>User Accounts</span>
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'subscriptions' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'subscriptions' ? '2px solid var(--accent)' : '2px solid transparent',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <CreditCard size={16} />
          <span>Subscription Approvals {pendingSubs > 0 && <span style={{ backgroundColor: 'var(--warning)', color: '#000000', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>{pendingSubs}</span>}</span>
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'users' ? (
        <>
          {/* Summary Cards */}
          <div className="project-stats-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Accounts</span>
                <Users size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {totalUsers}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderLeft: '3px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--warning)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pending Approval</span>
                <AlertCircle size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {pendingUsers}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderLeft: '3px solid var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--success)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Approved</span>
                <Check size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {approvedUsers}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderLeft: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f87171' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rejected</span>
                <X size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {rejectedUsers}
              </div>
            </div>
          </div>

          {/* Users Table / List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>User Details</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Registered On</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const isPending = user.status === 'pending';
                    const isApproved = user.status === 'approved';
                    const isRejected = user.status === 'rejected';
                    const isAdmin = user.role === 'super_admin';

                    return (
                      <tr key={user.id} style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: actionLoading === user.id ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}>
                        {/* User Profile / Email */}
                        <td style={{ padding: '1.25rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{user.name}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              <Mail size={12} />
                              <span>{user.email}</span>
                              <span style={{ color: 'var(--border-color)' }}>|</span>
                              <span>ID: {user.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Registration Time */}
                        <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} color="var(--text-muted)" />
                            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>

                        {/* Role Management */}
                        <td style={{ padding: '1.25rem 1rem' }}>
                          <button
                            onClick={() => handleToggleRole(user.id, user.role || 'user')}
                            disabled={actionLoading !== null || user.id === 'usr_admin'}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: user.id === 'usr_admin' ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: isAdmin ? 'var(--accent)' : 'var(--text-muted)'
                            }}
                          >
                            <Shield size={14} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, textDecoration: user.id === 'usr_admin' ? 'none' : 'underline' }}>
                              {isAdmin ? 'Administrator' : 'User'}
                            </span>
                          </button>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '1.25rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: isApproved 
                              ? 'rgba(16, 185, 129, 0.1)' 
                              : isPending 
                                ? 'rgba(245, 158, 11, 0.1)' 
                                : 'rgba(239, 68, 68, 0.1)',
                            color: isApproved 
                              ? 'var(--success)' 
                              : isPending 
                                ? 'var(--warning)' 
                                : '#f87171'
                          }}>
                            {isApproved && <Check size={12} />}
                            {isPending && <AlertCircle size={12} />}
                            {isRejected && <X size={12} />}
                            {user.status ? user.status.toUpperCase() : 'PENDING'}
                          </span>
                        </td>

                        {/* Approval/Rejection Actions */}
                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                          {user.id === 'usr_admin' ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              System Account
                            </span>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              {(isPending || isRejected) && (
                                <button
                                  onClick={() => handleUpdateStatus(user.id, 'approved')}
                                  disabled={actionLoading !== null}
                                  className="btn btn-primary"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'linear-gradient(135deg, var(--success), #059669)',
                                    border: 'none',
                                    boxShadow: 'none'
                                  }}
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                              )}
                              {(isPending || isApproved) && (
                                <button
                                  onClick={() => handleUpdateStatus(user.id, 'rejected')}
                                  disabled={actionLoading !== null}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                                  }}
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No user accounts registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Subscriptions Summary Cards */}
          <div className="project-stats-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Payments</span>
                <ListChecks size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {totalSubs}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderLeft: '3px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--warning)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pending Approvals</span>
                <AlertCircle size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {pendingSubs}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderLeft: '3px solid var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--success)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Approved</span>
                <Check size={18} />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {approvedSubs}
              </div>
            </div>
          </div>

          {/* Subscriptions Table / List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>User Details</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Plan Selected</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Payment Info</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Submitted On</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(sub => {
                    const isPending = sub.status === 'pending';
                    const isApproved = sub.status === 'approved';
                    const isRejected = sub.status === 'rejected';

                    // Format plan tier display name
                    let planName = sub.planTier;
                    if (sub.planTier === 'basic_monthly') planName = 'Basic Monthly ($9.00)';
                    else if (sub.planTier === 'standard_monthly') planName = 'Standard Monthly ($18.00)';
                    else if (sub.planTier === 'premium_weekly') planName = 'Professional Weekly ($30.00)';

                    return (
                      <tr key={sub.id} style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: subActionLoading === sub.id ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}>
                        {/* User Details */}
                        <td style={{ padding: '1.25rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{sub.userName || 'Unknown User'}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              <Mail size={12} />
                              <span>{sub.userEmail}</span>
                            </div>
                          </div>
                        </td>

                        {/* Selected Tier */}
                        <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>{planName}</strong>
                        </td>

                        {/* Payment Info */}
                        <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {sub.paymentMethod.toUpperCase()} Checkout
                            </span>
                            <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
                              Code: {sub.transactionCode}
                            </span>
                          </div>
                        </td>

                        {/* Date Created */}
                        <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} color="var(--text-muted)" />
                            <span>{new Date(sub.createdAt).toLocaleString()}</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '1.25rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: isApproved 
                              ? 'rgba(16, 185, 129, 0.1)' 
                              : isPending 
                                ? 'rgba(245, 158, 11, 0.1)' 
                                : 'rgba(239, 68, 68, 0.1)',
                            color: isApproved 
                              ? 'var(--success)' 
                              : isPending 
                                ? 'var(--warning)' 
                                : '#f87171'
                          }}>
                            {isApproved && <Check size={12} />}
                            {isPending && <AlertCircle size={12} />}
                            {isRejected && <X size={12} />}
                            {sub.status.toUpperCase()}
                          </span>
                        </td>

                        {/* Approval actions */}
                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button
                                onClick={() => handleSubscriptionAction(sub.id, 'approve')}
                                disabled={subActionLoading !== null}
                                className="btn btn-primary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'linear-gradient(135deg, var(--success), #059669)',
                                  border: 'none',
                                  boxShadow: 'none'
                                }}
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleSubscriptionAction(sub.id, 'reject')}
                                disabled={subActionLoading !== null}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                                }}
                              >
                                <X size={12} />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Processed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No subscription transaction references submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
