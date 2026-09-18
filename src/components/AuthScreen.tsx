import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, ShieldCheck, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import type { User } from '../types';
import { apiRequest } from '../api';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup' && !name) {
      setError('Please enter your name.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      if (mode === 'signup') {
        await apiRequest<User>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password
          })
        });
        // Switch to login, clear password fields, and notify success of pending approval
        setSuccessMessage('Account created successfully! Your request is pending admin approval. You will be able to log in once approved.');
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } else {
        const user = await apiRequest<User>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password
          })
        });
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at 10% 20%, rgba(12, 21, 38, 1) 0%, rgba(6, 10, 18, 1) 90%)',
      fontFamily: 'var(--font-sans)',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glowing blurs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '20%',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '20%',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      {/* Main Container */}
      <div className="card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '2.5rem',
        borderRadius: '16px',
        backgroundColor: 'rgba(18, 24, 36, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        zIndex: 10
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            color: 'white',
            width: '3.25rem',
            height: '3.25rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.5rem',
            boxShadow: '0 0 25px rgba(59, 130, 246, 0.5)'
          }}>
            T
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Time <span className="logo-highlight">Tracker</span>
            </h1>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {mode === 'login' 
              ? 'Track time, issue invoices, and process live payments.' 
              : 'Start organizing your freelance work in seconds.'}
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: 'var(--success)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s'
          }}>
            <ShieldCheck size={16} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {mode === 'signup' && (
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Full Name (e.g. Jane Doe)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="form-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '0.5rem',
              background: 'linear-gradient(135deg, var(--accent), #1d4ed8)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
            }}
          >
            <span>{mode === 'login' ? 'Log In' : 'Create Account'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Footer Toggle */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1rem'
        }}>
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Log In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
