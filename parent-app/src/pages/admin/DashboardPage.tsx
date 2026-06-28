import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

interface DashboardData {
  attendanceCount: number;
  pendingLeaveCount: number;
  notifications: Array<{
    id: string;
    title: string;
    type: string;
    created_at: string;
    delivery_status: string;
  }>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({
    attendanceCount: 0,
    pendingLeaveCount: 0,
    notifications: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [attendanceRes, leaveRes, notificationsRes] = await Promise.all([
          apiClient.get('/api/attendance', { params: { date: today } }),
          apiClient.get('/api/leave-requests', { params: { status: 'Pending' } }),
          apiClient.get('/api/notifications/undeliverable'),
        ]);

        setData({
          attendanceCount: attendanceRes.data?.pagination?.total ?? attendanceRes.data?.data?.length ?? 0,
          pendingLeaveCount: leaveRes.data?.pagination?.total ?? leaveRes.data?.data?.length ?? 0,
          notifications: (notificationsRes.data?.data ?? []).slice(0, 5),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void fetchDashboard();
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Admin Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={widgetClickable} onClick={() => navigate('/admin/attendance')}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Today&apos;s Attendance</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0 0', fontWeight: 600 }}>{data.attendanceCount}</p>
        </div>
        <div style={widgetClickable} onClick={() => navigate('/admin/leave-requests')}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Pending Leave Requests</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0 0', fontWeight: 600 }}>{data.pendingLeaveCount}</p>
        </div>
        <div style={widgetClickable} onClick={() => navigate('/admin/dashboard')}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Undeliverable Notifications</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0 0', fontWeight: 600 }}>{data.notifications.length}</p>
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Recent Undeliverable Notifications</h2>
      {data.notifications.length === 0 ? (
        <p style={{ color: '#64748b' }}>No undeliverable notifications.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.notifications.map((n) => (
              <tr key={n.id}>
                <td style={tdStyle}>{n.title}</td>
                <td style={tdStyle}>{n.type}</td>
                <td style={tdStyle}>{n.delivery_status}</td>
                <td style={tdStyle}>{new Date(n.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const widgetClickable: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1.25rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.2s, transform 0.2s',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  borderBottom: '2px solid #e2e8f0',
  color: '#475569',
  fontSize: '0.8rem',
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '1px solid #f1f5f9',
};
