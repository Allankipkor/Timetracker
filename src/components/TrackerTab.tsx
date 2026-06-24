import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, DollarSign, Clock, Plus, Trash2, Layers, FileText } from 'lucide-react';
import type { Project, TimeEntry, PayPalSettings } from '../types';
import { getCurrencySymbol } from '../types';

interface TrackerTabProps {
  projects: Project[];
  timeEntries: TimeEntry[];
  paypalSettings: PayPalSettings;
  onAddTimeEntry: (entry: TimeEntry) => void;
  onDeleteTimeEntry: (id: string) => void;
}

export const TrackerTab: React.FC<TrackerTabProps> = ({
  projects,
  timeEntries,
  paypalSettings,
  onAddTimeEntry,
  onDeleteTimeEntry
}) => {
  const symbol = getCurrencySymbol(paypalSettings.currency);

  // Timer States
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeStartTime, setActiveStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Manual Log States
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const [manualProjId, setManualProjId] = useState('');
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('17:00');
  const [manualBillable, setManualBillable] = useState(true);

  // References
  const timerRef = useRef<any>(null);

  // Automatically select the first project and its task if list loads
  useEffect(() => {
    if (projects.length > 0) {
      if (!selectedProjectId) {
        setSelectedProjectId(projects[0].id);
        if (projects[0].tasks.length > 0) {
          setSelectedTaskId(projects[0].tasks[0].id);
        }
      }
      if (!manualProjId) {
        setManualProjId(projects[0].id);
        if (projects[0].tasks.length > 0) {
          setManualTaskId(projects[0].tasks[0].id);
        }
      }
    }
  }, [projects]);

  // Project selector change triggers task selector update
  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj && proj.tasks.length > 0) {
      setSelectedTaskId(proj.tasks[0].id);
    } else {
      setSelectedTaskId('');
    }
  };

  const handleManualProjectChange = (projId: string) => {
    setManualProjId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj && proj.tasks.length > 0) {
      setManualTaskId(proj.tasks[0].id);
    } else {
      setManualTaskId('');
    }
  };

  // Timer Tick
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Start / Stop Handlers
  const handleStartTimer = () => {
    setIsTimerRunning(true);
    setActiveStartTime(new Date().toISOString());
    setElapsedSeconds(0);
  };

  const handleStopTimer = () => {
    if (!activeStartTime) return;
    
    const stopTime = new Date().toISOString();
    const entryProjId = selectedProjectId || (projects[0]?.id || '');
    const entryTaskId = selectedTaskId || '';

    const newEntry: TimeEntry = {
      id: 'entry-' + Math.random().toString(36).substr(2, 9),
      description: description.trim(),
      projectId: entryProjId,
      taskId: entryTaskId,
      startTime: activeStartTime,
      endTime: stopTime,
      duration: elapsedSeconds,
      isBillable: isBillable,
      isInvoiceGenerated: false,
      invoiceId: null
    };

    onAddTimeEntry(newEntry);
    
    // Reset state
    setDescription('');
    setIsTimerRunning(false);
    setActiveStartTime(null);
    setElapsedSeconds(0);
  };

  // Manual Log Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const [startH, startM] = manualStart.split(':').map(Number);
    const [endH, endM] = manualEnd.split(':').map(Number);
    
    const startTimeObj = new Date(manualDate);
    startTimeObj.setHours(startH, startM, 0, 0);
    
    const endTimeObj = new Date(manualDate);
    endTimeObj.setHours(endH, endM, 0, 0);
    
    if (endTimeObj <= startTimeObj) {
      alert('End time must be after start time.');
      return;
    }
    
    const duration = Math.floor((endTimeObj.getTime() - startTimeObj.getTime()) / 1000);
    
    const newEntry: TimeEntry = {
      id: 'entry-' + Math.random().toString(36).substr(2, 9),
      description: manualDesc.trim(),
      projectId: manualProjId,
      taskId: manualTaskId,
      startTime: startTimeObj.toISOString(),
      endTime: endTimeObj.toISOString(),
      duration: duration,
      isBillable: manualBillable,
      isInvoiceGenerated: false,
      invoiceId: null
    };
    
    onAddTimeEntry(newEntry);
    
    // Reset
    setManualDesc('');
    setShowManualForm(false);
  };

  // Helper formatting
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const formatShortTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateStr: string): string => {
    const d = new Date(dateStr);
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';

    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDurationString = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Grouping time entries by date
  const groupedEntries: { [key: string]: TimeEntry[] } = {};
  timeEntries.forEach(entry => {
    // Only display completed entries in history
    if (entry.endTime) {
      const dateKey = entry.startTime.split('T')[0];
      if (!groupedEntries[dateKey]) {
        groupedEntries[dateKey] = [];
      }
      groupedEntries[dateKey].push(entry);
    }
  });

  // Sort dates descending
  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  // Compute daily totals
  const getDailyTotal = (entries: TimeEntry[]): number => {
    return entries.reduce((acc, curr) => acc + curr.duration, 0);
  };

  return (
    <div>
      {/* Tracker Bar */}
      <div className={`tracker-bar ${isTimerRunning ? 'pulse-animation' : ''}`} style={{ borderColor: isTimerRunning ? 'rgba(16, 185, 129, 0.4)' : '' }}>
        <div className="tracker-input-wrapper">
          <input
            type="text"
            className="tracker-desc-input"
            placeholder={isTimerRunning ? "Tracking: " + (description || "Untitled Task") : "What are you working on?"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isTimerRunning}
          />
        </div>

        <div className="tracker-selects">
          {/* Project Selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            disabled={isTimerRunning}
            className="tracker-select-btn"
            style={{ width: '150px' }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Task Selector */}
          {selectedProjectId && (
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              disabled={isTimerRunning}
              className="tracker-select-btn"
              style={{ width: '130px' }}
            >
              <option value="">No task</option>
              {projects.find(p => p.id === selectedProjectId)?.tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {/* Billable Toggle */}
          <button
            type="button"
            className={`billable-toggle ${isBillable ? 'active' : ''}`}
            onClick={() => setIsBillable(!isBillable)}
            disabled={isTimerRunning}
            title={isBillable ? "Billable" : "Non-billable"}
          >
            <DollarSign size={16} />
          </button>

          {/* Clock Display */}
          <div className={`timer-display ${isTimerRunning ? 'running' : ''}`}>
            {formatTime(elapsedSeconds)}
          </div>

          {/* Start/Stop Button */}
          {isTimerRunning ? (
            <button className="btn btn-danger" onClick={handleStopTimer} style={{ padding: '0.6rem 1.4rem' }}>
              <Square size={16} fill="white" />
              <span>Stop</span>
            </button>
          ) : (
            <button className="btn btn-success" onClick={handleStartTimer} style={{ padding: '0.6rem 1.4rem' }}>
              <Play size={16} fill="white" />
              <span>Start</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Entry Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>Time Log History</h2>
        
        <button className="btn btn-outline" onClick={() => setShowManualForm(!showManualForm)}>
          <Plus size={16} />
          <span>{showManualForm ? "Cancel Manual Log" : "Add Time Manually"}</span>
        </button>
      </div>

      {/* Manual Entry Form */}
      {showManualForm && (
        <form onSubmit={handleManualSubmit} className="card" style={{ marginBottom: '2rem', animation: 'slideUp 0.2s ease-out' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Log Past Time Log</h3>
          <div className="grid-2">
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="What did you do?"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                className="form-control"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-4" style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label>Project</label>
              <select
                value={manualProjId}
                onChange={(e) => handleManualProjectChange(e.target.value)}
                required
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Task</label>
              <select
                value={manualTaskId}
                onChange={(e) => setManualTaskId(e.target.value)}
              >
                <option value="">No task</option>
                {projects.find(p => p.id === manualProjId)?.tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input
                type="time"
                className="form-control"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input
                type="time"
                className="form-control"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={manualBillable}
                onChange={(e) => setManualBillable(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
              />
              <span>This is billable hours</span>
            </label>
            <button type="submit" className="btn btn-primary">
              <Clock size={16} />
              <span>Save Log Entry</span>
            </button>
          </div>
        </form>
      )}

      {/* History Log List */}
      <div className="logs-section">
        {sortedDates.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Clock size={48} style={{ margin: '0 auto 1rem', display: 'block', strokeWidth: 1.5 }} />
            <p style={{ fontWeight: 500 }}>No time entries recorded yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Start tracking today's tasks above or add a manual log entry.</p>
          </div>
        ) : (
          sortedDates.map(dateKey => {
            const dayEntries = groupedEntries[dateKey];
            return (
              <div key={dateKey} className="date-group">
                <div className="date-group-header">
                  <span>{formatDateLabel(dateKey)}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {getDurationString(getDailyTotal(dayEntries))}
                  </span>
                </div>

                {dayEntries.map(entry => {
                  const project = projects.find(p => p.id === entry.projectId);
                  const task = project?.tasks.find(t => t.id === entry.taskId);
                  
                  return (
                    <div key={entry.id} className="log-item">
                      <div className="log-left">
                        {/* Status color indicator */}
                        <div
                          className="tag-indicator"
                          style={{ backgroundColor: project?.color || 'var(--text-muted)' }}
                        />
                        <div className="log-info">
                          <span className={`log-desc ${!entry.description ? 'no-desc' : ''}`}>
                            {entry.description || 'No description'}
                          </span>
                          <div className="log-meta">
                            {project && (
                              <span
                                className="project-tag"
                                style={{
                                  backgroundColor: `${project.color}20`,
                                  color: project.color
                                }}
                              >
                                {project.name}
                              </span>
                            )}
                            {task && (
                              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Layers size={12} />
                                {task.name}
                              </span>
                            )}
                            {entry.isInvoiceGenerated && (
                              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                <FileText size={12} />
                                Invoiced
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="log-right">
                        <div className="log-time-range">
                          {entry.startTime && entry.endTime && (
                            <>
                              {formatShortTime(entry.startTime)} - {formatShortTime(entry.endTime)}
                            </>
                          )}
                        </div>

                        {entry.isBillable && (
                          <div
                            title={`Billable at ${symbol}${project?.hourlyRate || 0}/hr`}
                            style={{
                              color: entry.isInvoiceGenerated ? 'var(--text-muted)' : 'var(--warning)',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'default'
                            }}
                          >
                            <DollarSign size={16} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, marginLeft: '2px' }}>
                              {symbol}{project ? project.hourlyRate : 0}
                            </span>
                          </div>
                        )}

                        <div className="log-duration">
                          {formatTime(entry.duration)}
                        </div>

                        <div className="log-actions">
                          <button
                            className="btn-icon"
                            onClick={() => onDeleteTimeEntry(entry.id)}
                            disabled={entry.isInvoiceGenerated}
                            title={entry.isInvoiceGenerated ? "Cannot delete invoiced items" : "Delete log entry"}
                            style={{ opacity: entry.isInvoiceGenerated ? 0.3 : 1 }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
