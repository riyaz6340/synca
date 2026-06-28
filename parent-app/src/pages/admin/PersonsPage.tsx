import { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/client';

interface Person {
  id: string;
  name: string;
  roll_number?: string;
  admission_number?: string;
  age?: number;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  father_name?: string;
  mother_name?: string;
  guardian_name?: string;
  guardian_relation?: string;
  parent_mobile?: string;
  parent_email?: string;
  address?: string;
  metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

interface PersonForm {
  name: string;
  roll_number: string;
  admission_number: string;
  age: string;
  gender: string;
  date_of_birth: string;
  blood_group: string;
  father_name: string;
  mother_name: string;
  guardian_name: string;
  guardian_relation: string;
  parent_mobile: string;
  parent_email: string;
  address: string;
  metadata: string;
}

const emptyForm: PersonForm = {
  name: '', roll_number: '', admission_number: '', age: '', gender: '',
  date_of_birth: '', blood_group: '', father_name: '', mother_name: '',
  guardian_name: '', guardian_relation: '', parent_mobile: '', parent_email: '',
  address: '', metadata: '{}',
};

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPersons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/persons');
      setPersons(res.data.data ?? []);
    } catch {
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPersons(); }, [fetchPersons]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(person: Person) {
    setEditingId(person.id);
    setForm({
      name: person.name || '',
      roll_number: person.roll_number || '',
      admission_number: person.admission_number || '',
      age: person.age ? String(person.age) : '',
      gender: person.gender || '',
      date_of_birth: person.date_of_birth || '',
      blood_group: person.blood_group || '',
      father_name: person.father_name || '',
      mother_name: person.mother_name || '',
      guardian_name: person.guardian_name || '',
      guardian_relation: person.guardian_relation || '',
      parent_mobile: person.parent_mobile || '',
      parent_email: person.parent_email || '',
      address: person.address || '',
      metadata: JSON.stringify(person.metadata || {}, null, 2),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { window.alert('Student name is required'); return; }
    if (!form.parent_mobile.trim()) { window.alert('Parent/Guardian mobile number is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        roll_number: form.roll_number || null,
        admission_number: form.admission_number || null,
        age: form.age ? parseInt(form.age) : null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        blood_group: form.blood_group || null,
        father_name: form.father_name || null,
        mother_name: form.mother_name || null,
        guardian_name: form.guardian_name || null,
        guardian_relation: form.guardian_relation || null,
        parent_mobile: form.parent_mobile || null,
        parent_email: form.parent_email || null,
        address: form.address || null,
        metadata: form.metadata ? JSON.parse(form.metadata) : {},
      };
      if (editingId) {
        await apiClient.put(`/api/persons/${editingId}`, payload);
      } else {
        const res = await apiClient.post('/api/persons', payload);
        const newPersonId = res.data?.person?.id;
        // Auto-create parent account after adding a student
        if (newPersonId && form.parent_mobile.trim()) {
          try {
            await apiClient.post(`/api/persons/${newPersonId}/create-parent-account`, {});
          } catch {
            // Silently continue — parent account creation is best-effort
          }
        }
      }
      setShowModal(false);
      void fetchPersons();
    } catch {
      window.alert('Failed to save student');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm('Are you sure you want to deactivate this student?')) return;
    try {
      await apiClient.patch(`/api/persons/${id}/deactivate`);
      void fetchPersons();
    } catch {
      window.alert('Failed to deactivate student');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to permanently DELETE "${name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/persons/${id}`);
      void fetchPersons();
    } catch {
      window.alert('Failed to delete student');
    }
  }

  async function handleCreateParent(id: string) {
    try {
      const res = await apiClient.post(`/api/persons/${id}/create-parent-account`, {});
      const creds = res.data.credentials;
      window.alert(`✅ Parent account created!\n\nLogin: ${creds.login}\nPassword: ${creds.password}\n\nSchool: Select your school from dropdown\n\nShare these credentials with the parent.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to create parent account';
      window.alert(msg);
    }
  }

  async function handleResetParentPwd(id: string) {
    try {
      const res = await apiClient.post(`/api/persons/${id}/reset-parent-password`, {});
      const creds = res.data.credentials;
      window.alert(`✅ Password reset!\n\nLogin: ${creds.login}\nNew Password: ${creds.password}\n\nShare these updated credentials with the parent.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to reset password';
      window.alert(msg);
    }
  }

  if (loading) return <p>Loading students...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Students</h1>
        <button onClick={openCreate} style={btnPrimary}>+ Add Student</button>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Roll No.</th>
            <th style={thStyle}>Father&apos;s Name</th>
            <th style={thStyle}>Mobile</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {persons.map((p) => (
            <tr key={p.id}>
              <td style={tdStyle}>
                <strong>{p.name}</strong>
                {p.admission_number && <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Adm: {p.admission_number}</span>}
              </td>
              <td style={tdStyle}>{p.roll_number || '—'}</td>
              <td style={tdStyle}>{p.father_name || '—'}</td>
              <td style={tdStyle}>{p.parent_mobile || '—'}</td>
              <td style={tdStyle}>
                <span style={{ color: p.is_active ? '#16a34a' : '#dc2626' }}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={tdStyle}>
                <button onClick={() => openEdit(p)} style={btnSmall}>Edit</button>
                {p.is_active && (
                  <button onClick={() => void handleDeactivate(p.id)} style={{ ...btnSmall, color: '#dc2626', marginLeft: '0.5rem' }}>
                    Deactivate
                  </button>
                )}
                <button onClick={() => void handleCreateParent(p.id)} style={{ ...btnSmall, color: '#2563eb', marginLeft: '0.5rem' }}>
                  Parent A/C
                </button>
                <button onClick={() => void handleResetParentPwd(p.id)} style={{ ...btnSmall, color: '#d97706', marginLeft: '0.5rem' }}>
                  Reset Pwd
                </button>
                <button onClick={() => void handleDelete(p.id, p.name)} style={{ ...btnSmall, color: '#991b1b', marginLeft: '0.5rem' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {persons.length === 0 && <p style={{ color: '#64748b', marginTop: '1rem' }}>No students found. Click &quot;+ Add Student&quot; to add one.</p>}

      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Student' : 'Add New Student'}</h2>

            <p style={sectionTitle}>Basic Information</p>
            <div style={gridTwo}>
              <div>
                <label style={labelStyle}>Student Name *</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <label style={labelStyle}>Gender</label>
                <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div style={gridThree}>
              <div>
                <label style={labelStyle}>Roll Number</label>
                <input style={inputStyle} value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} placeholder="e.g. 042" />
              </div>
              <div>
                <label style={labelStyle}>Admission No.</label>
                <input style={inputStyle} value={form.admission_number} onChange={(e) => setForm({ ...form, admission_number: e.target.value })} placeholder="e.g. 2024-042" />
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input style={inputStyle} type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              </div>
            </div>
            <div style={gridThree}>
              <div>
                <label style={labelStyle}>Age</label>
                <input style={inputStyle} type="number" min="1" max="100" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Blood Group</label>
                <select style={inputStyle} value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                  <option value="">Select</option>
                  <option value="A+">A+</option><option value="A-">A-</option>
                  <option value="B+">B+</option><option value="B-">B-</option>
                  <option value="O+">O+</option><option value="O-">O-</option>
                  <option value="AB+">AB+</option><option value="AB-">AB-</option>
                </select>
              </div>
              <div></div>
            </div>

            <p style={sectionTitle}>Family Information</p>
            <div style={gridTwo}>
              <div>
                <label style={labelStyle}>Father&apos;s Name</label>
                <input style={inputStyle} value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Mother&apos;s Name</label>
                <input style={inputStyle} value={form.mother_name} onChange={(e) => setForm({ ...form, mother_name: e.target.value })} />
              </div>
            </div>
            <div style={gridTwo}>
              <div>
                <label style={labelStyle}>Guardian Name</label>
                <input style={inputStyle} value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Relation with Student</label>
                <select style={inputStyle} value={form.guardian_relation} onChange={(e) => setForm({ ...form, guardian_relation: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Uncle">Uncle</option>
                  <option value="Aunt">Aunt</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <p style={sectionTitle}>Contact Details</p>
            <div style={gridTwo}>
              <div>
                <label style={labelStyle}>Parent/Guardian Mobile *</label>
                <input style={inputStyle} type="tel" value={form.parent_mobile} onChange={(e) => setForm({ ...form, parent_mobile: e.target.value })} placeholder="+91-9876543210" />
              </div>
              <div>
                <label style={labelStyle}>Parent/Guardian Email</label>
                <input style={inputStyle} type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} placeholder="parent@email.com" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Address</label>
              <textarea style={{ ...inputStyle, minHeight: '60px' }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
            </div>

            <p style={sectionTitle}>Additional Information (Optional)</p>
            <div>
              <label style={labelStyle}>Custom Fields (JSON)</label>
              <textarea style={{ ...inputStyle, minHeight: '50px', fontFamily: 'monospace', fontSize: '0.8rem' }} value={form.metadata} onChange={(e) => setForm({ ...form, metadata: e.target.value })} placeholder='{"transport": "bus", "house": "red"}' />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button onClick={() => void handleSave()} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving...' : editingId ? 'Update Student' : 'Add Student'}
              </button>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' };
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' };
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.45rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' };
const sectionTitle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', margin: '1.25rem 0 0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' };
const gridTwo: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' };
const gridThree: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' };
