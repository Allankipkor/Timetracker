import React, { useState } from 'react';
import { Plus, Trash2, Layers, User, Briefcase } from 'lucide-react';
import type { Project, Task, TimeEntry, PayPalSettings } from '../types';
import { getCurrencySymbol } from '../types';

interface ProjectsTabProps {
  projects: Project[];
  timeEntries: TimeEntry[];
  paypalSettings: PayPalSettings;
  onAddProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject: (project: Project) => void;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  projects,
  timeEntries,
  paypalSettings,
  onAddProject,
  onDeleteProject,
  onUpdateProject
}) => {
  const symbol = getCurrencySymbol(paypalSettings.currency);

  // New Project Form State
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [hourlyRate, setHourlyRate] = useState(100);
  const [color, setColor] = useState('#3b82f6');
  const [showAddForm, setShowAddForm] = useState(false);

  // New Task Form State
  const [taskName, setTaskName] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Color Palette suggestions
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#f59e0b', // orange
    '#ec4899', // pink
    '#ef4444', // red
    '#06b6d4', // cyan
    '#6b7280'  // gray
  ];

  // Form submit project
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProject: Project = {
      id: 'proj-' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      clientName: clientName.trim() || 'General Client',
      hourlyRate: Number(hourlyRate),
      color: color,
      tasks: []
    };

    onAddProject(newProject);
    
    // Reset Form
    setName('');
    setClientName('');
    setHourlyRate(100);
    setColor('#3b82f6');
    setShowAddForm(false);
  };

  // Add Task to Project
  const handleAddTask = (projectId: string) => {
    if (!taskName.trim()) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newTask: Task = {
      id: 'task-' + Math.random().toString(36).substr(2, 9),
      name: taskName.trim()
    };

    const updatedProject = {
      ...project,
      tasks: [...project.tasks, newTask]
    };

    onUpdateProject(updatedProject);
    setTaskName('');
    setActiveProjectId(null);
  };

  // Delete Task from Project
  const handleDeleteTask = (projectId: string, taskId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Check if task has logged hours
    const hasHours = timeEntries.some(entry => entry.projectId === projectId && entry.taskId === taskId);
    if (hasHours) {
      alert('Cannot delete this task. It already has time logs recorded against it.');
      return;
    }

    const updatedProject = {
      ...project,
      tasks: project.tasks.filter(t => t.id !== taskId)
    };

    onUpdateProject(updatedProject);
  };

  // Helper metrics
  const getProjectStats = (projId: string) => {
    const entries = timeEntries.filter(e => e.projectId === projId && e.endTime);
    const totalDurationSeconds = entries.reduce((acc, curr) => acc + curr.duration, 0);
    const totalHours = totalDurationSeconds / 3600;

    const billableEntries = entries.filter(e => e.isBillable);
    const billableHours = billableEntries.reduce((acc, curr) => acc + curr.duration, 0) / 3600;
    
    const project = projects.find(p => p.id === projId);
    const rate = project?.hourlyRate || 0;
    const earnings = billableHours * rate;

    return {
      hours: totalHours.toFixed(2),
      earnings: earnings.toFixed(2),
      entriesCount: entries.length
    };
  };

  return (
    <div>
      {/* Header operations */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)' }}>Projects & Clients</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage client profiles, specify billing rates, and review tracked totals.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>

      {/* Add Project Form */}
      {showAddForm && (
        <form onSubmit={handleCreateProject} className="card" style={{ marginBottom: '2.5rem', animation: 'slideUp 0.2s ease-out' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Create New Project</h3>
          
          <div className="grid-3">
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Website Redesign"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Client Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Hourly Billing Rate ({symbol})</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{symbol}</span>
                <input
                  type="number"
                  className="form-control"
                  style={{ paddingLeft: '1.75rem', width: '100%' }}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Math.max(0, Number(e.target.value)))}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Color Accent</label>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    backgroundColor: c,
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: color === c ? '3px solid white' : '2px solid transparent',
                    boxShadow: color === c ? '0 0 8px ' + c : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Project
            </button>
          </div>
        </form>
      )}

      {/* Projects List Grid */}
      <div className="grid-2">
        {projects.map(project => {
          const stats = getProjectStats(project.id);
          
          return (
            <div key={project.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Project Title Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      backgroundColor: `${project.color}15`,
                      color: project.color,
                      padding: '0.6rem',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{project.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <User size={12} />
                      <span>{project.clientName}</span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn-icon btn-danger"
                  style={{ padding: '0.4rem' }}
                  onClick={() => {
                    const hasLogs = timeEntries.some(e => e.projectId === project.id);
                    if (hasLogs) {
                      alert('Cannot delete this project. It has active time log history associated with it. Delete the logs first.');
                      return;
                    }
                    if (confirm(`Are you sure you want to delete ${project.name}?`)) {
                      onDeleteProject(project.id);
                    }
                  }}
                  title="Delete project"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Stats Indicators */}
              <div className="project-stats-grid">
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Logged Hours</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{stats.hours}h</strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Billable Rate</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--warning)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{symbol}</span>{project.hourlyRate}/h
                  </strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Billable Total</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--success)', fontFamily: 'var(--font-display)' }}>{symbol}{stats.earnings}</strong>
                </div>
              </div>

              {/* Tasks Sublist */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Layers size={14} />
                    <span>Project Tasks ({project.tasks.length})</span>
                  </h4>

                  {activeProjectId !== project.id ? (
                    <button
                      className="btn-icon"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                      onClick={() => setActiveProjectId(project.id)}
                    >
                      <Plus size={12} />
                      <span>Add Task</span>
                    </button>
                  ) : null}
                </div>

                {activeProjectId === project.id && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', animation: 'fadeIn 0.15s ease-out' }}>
                    <input
                      type="text"
                      className="form-control"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', flex: 1 }}
                      placeholder="Task Name (e.g. Design UI)"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      required
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => handleAddTask(project.id)}
                    >
                      Add
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => {
                        setTaskName('');
                        setActiveProjectId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {project.tasks.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                    No tasks created. Default tracking goes to project level.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {project.tasks.map(task => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.35rem 0.5rem',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.03)',
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)' }}>{task.name}</span>
                        <button
                          className="btn-icon"
                          style={{ padding: '2px' }}
                          onClick={() => handleDeleteTask(project.id, task.id)}
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
