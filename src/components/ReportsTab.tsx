import React, { useState } from 'react';
import { BarChart3, PieChart, DollarSign, Clock, Filter } from 'lucide-react';
import type { Project, TimeEntry, PayPalSettings } from '../types';
import { getCurrencySymbol } from '../types';

interface ReportsTabProps {
  projects: Project[];
  timeEntries: TimeEntry[];
  paypalSettings: PayPalSettings;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ projects, timeEntries, paypalSettings }) => {
  const symbol = getCurrencySymbol(paypalSettings.currency);
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [filterBilling, setFilterBilling] = useState<'all' | 'billable' | 'non-billable'>('all');

  // Filter completed logs
  const completedLogs = timeEntries.filter(e => e.endTime);

  // Apply filters
  const filteredLogs = completedLogs.filter(entry => {
    const projectMatch = filterProjectId === 'all' || entry.projectId === filterProjectId;
    const billingMatch = 
      filterBilling === 'all' || 
      (filterBilling === 'billable' && entry.isBillable) || 
      (filterBilling === 'non-billable' && !entry.isBillable);
    
    return projectMatch && billingMatch;
  });

  // KPI calculations
  const totalSeconds = filteredLogs.reduce((acc, curr) => acc + curr.duration, 0);
  const totalHours = totalSeconds / 3600;

  const billableSeconds = filteredLogs.filter(e => e.isBillable).reduce((acc, curr) => acc + curr.duration, 0);
  const billableHours = billableSeconds / 3600;
  const nonBillableHours = totalHours - billableHours;

  const totalEarnings = filteredLogs.reduce((acc, curr) => {
    if (!curr.isBillable) return acc;
    const project = projects.find(p => p.id === curr.projectId);
    const rate = project?.hourlyRate || 0;
    return acc + (curr.duration / 3600) * rate;
  }, 0);

  // Breakdown by Project for charts
  const projectBreakdown = projects.map(proj => {
    const projLogs = filteredLogs.filter(e => e.projectId === proj.id);
    const durationSec = projLogs.reduce((acc, curr) => acc + curr.duration, 0);
    const hours = durationSec / 3600;
    
    const billableHoursProj = projLogs.filter(e => e.isBillable).reduce((acc, curr) => acc + curr.duration, 0) / 3600;
    const earnings = billableHoursProj * proj.hourlyRate;

    return {
      ...proj,
      hours,
      earnings
    };
  }).filter(p => p.hours > 0);

  // SVG Donut Calculations
  const radius = 40;
  const strokeWidth = 10;
  const center = 50;
  const circumference = 2 * Math.PI * radius;
  const billablePercent = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
  const billableStroke = (billablePercent / 100) * circumference;

  // Maximum hours for scaling bar chart
  const maxProjHours = Math.max(...projectBreakdown.map(p => p.hours), 1);

  // Date Formatter
  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };



  return (
    <div>
      {/* Filters Toolbar */}
      <div className="card report-filter-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <Filter size={16} />
          <strong style={{ fontWeight: 600 }}>Filter:</strong>
        </div>

        {/* Project Filter */}
        <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ whiteSpace: 'nowrap' }}>Project</label>
          <select 
            value={filterProjectId} 
            onChange={(e) => setFilterProjectId(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Billing Filter */}
        <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ whiteSpace: 'nowrap' }}>Billing Type</label>
          <select 
            value={filterBilling} 
            onChange={(e) => setFilterBilling(e.target.value as any)}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          >
            <option value="all">All Time</option>
            <option value="billable">Billable Only</option>
            <option value="non-billable">Non-Billable Only</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing {filteredLogs.length} matching logs
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', padding: '0.75rem', borderRadius: '10px' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Tracked Time</span>
            <h3 style={{ fontSize: '1.5rem', marginTop: '0.15rem', fontFamily: 'var(--font-display)' }}>
              {totalHours.toFixed(2)}h
            </h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', padding: '0.75rem', borderRadius: '10px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Billable Hours Ratio</span>
            <h3 style={{ fontSize: '1.5rem', marginTop: '0.15rem', fontFamily: 'var(--font-display)', color: 'var(--warning)' }}>
              {billablePercent.toFixed(0)}% <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>({billableHours.toFixed(1)}h)</span>
            </h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '0.75rem', borderRadius: '10px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Billable Amount Earned</span>
            <h3 style={{ fontSize: '1.5rem', marginTop: '0.15rem', fontFamily: 'var(--font-display)', color: 'var(--success)' }}>
              {symbol}{totalEarnings.toFixed(2)}
            </h3>
          </div>
        </div>
      </div>

      {/* SVG Charts section */}
      <div className="grid-2" style={{ marginBottom: '2.5rem' }}>
        {/* Project Bar Chart */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} color="var(--accent)" />
            <span>Time Distribution by Project</span>
          </h3>

          {projectBreakdown.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No project metrics logged in this scope.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
              {projectBreakdown.map(p => {
                const percent = (p.hours / maxProjHours) * 100;
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <strong style={{ color: 'var(--text-secondary)' }}>
                        {p.hours.toFixed(2)}h ({symbol}{p.earnings.toFixed(0)})
                      </strong>
                    </div>
                    {/* SVG Progress bar */}
                    <svg width="100%" height="10" style={{ borderRadius: '5px', overflow: 'hidden' }}>
                      <rect width="100%" height="100%" fill="var(--bg-tertiary)" />
                      <rect width={`${percent}%`} height="100%" fill={p.color} style={{ transition: 'width 0.8s ease-out' }} />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Donut Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} color="var(--warning)" />
            <span>Billable vs Non-Billable Allocation</span>
          </h3>

          {totalHours === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No time records tracked.
            </div>
          ) : (
            <div className="donut-chart-container">
              {/* Donut SVG */}
              <svg width="120" height="120" viewBox="0 0 100 100">
                {/* Background track (Non-Billable) */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke="var(--bg-tertiary)"
                  strokeWidth={strokeWidth}
                />
                
                {/* Non-Billable section */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke="var(--text-muted)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={0}
                  transform={`rotate(-90 ${center} ${center})`}
                />

                {/* Billable overlay */}
                {billablePercent > 0 && (
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke="var(--warning)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - billableStroke}
                    transform={`rotate(-90 ${center} ${center})`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                  />
                )}
                
                {/* Percentage label in center */}
                <text
                  x="50%"
                  y="53%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="var(--font-display)"
                >
                  {billablePercent.toFixed(0)}%
                </text>
              </svg>

              {/* Legend List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--warning)' }} />
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Billable time</span>
                    <strong style={{ fontSize: '0.95rem' }}>{billableHours.toFixed(1)} hrs</strong>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Non-billable time</span>
                    <strong style={{ fontSize: '0.95rem' }}>{nonBillableHours.toFixed(1)} hrs</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Structured Logs Breakdown Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Detailed Audit Trail</h3>
        
        {filteredLogs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No matching time logs found under selected filter conditions.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Billing</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Hours</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Earnings</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(entry => {
                  const project = projects.find(p => p.id === entry.projectId);
                  const entryHours = entry.duration / 3600;
                  const itemEarnings = entry.isBillable && project ? entryHours * project.hourlyRate : 0;
                  
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(entry.startTime)}</td>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: project?.color || 'var(--text-muted)' }} />
                          {project?.name || 'Unknown Project'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.description}>
                        {entry.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {entry.isBillable ? (
                          <span className="badge badge-sent" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Billable</span>
                        ) : (
                          <span className="badge badge-draft" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Non-billable</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                        {entryHours.toFixed(2)}h
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 600, color: itemEarnings > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {itemEarnings > 0 ? `${symbol}${itemEarnings.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
