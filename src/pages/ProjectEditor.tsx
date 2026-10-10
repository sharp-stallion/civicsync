import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getDepartments, getProject, createProject, updateProjectDetails } from '../services/projects';
import { geocode, reverseGeocode } from '../integrations/nominatim';
import { useAuth } from '../context/AuthContext';
import { WORK_TYPES, type WorkType } from '../lib/types';
import { WORK_LABELS } from '../lib/format';
import { inSouthChennai } from '../lib/geo';
import { PageHeading, Loading, ErrorPanel, Button, Field, Notice } from '../components/UI';
import { Map } from '../components/Map';
import { Icon } from '../components/Icon';

export default function ProjectEditor() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const { profile } = useAuth();

  const deps = useResource('departments', getDepartments);
  const existing = useResource(`edit:${id}`, () => getProject(id!), { enabled: editing });

  const [f, setF] = useState({
    title: '', description: '', road_name: '', road_segment_id: '', location_description: '',
    work_type: 'road_repair' as WorkType, department_id: '', start_date: '', end_date: '',
    contractor_name: '', estimated_cost_inr: '',
  });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) { if (profile?.department_id) setF((p) => ({ ...p, department_id: profile.department_id! })); return; }
    const p = existing.data;
    if (p) {
      setF({
        title: p.title, description: p.description ?? '', road_name: p.road_name, road_segment_id: p.road_segment_id ?? '',
        location_description: p.location_description ?? '', work_type: p.work_type, department_id: p.department_id,
        start_date: p.start_date, end_date: p.end_date, contractor_name: p.contractor_name ?? '',
        estimated_cost_inr: p.estimated_cost_inr != null ? String(p.estimated_cost_inr) : '',
      });
      setPin({ lat: p.latitude, lng: p.longitude });
    }
  }, [existing.data, editing, profile]);

  const runGeocode = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    try { setResults(await geocode(query)); } finally { setSearching(false); }
  };

  const pickPin = async (lat: number, lng: number) => {
    setPin({ lat, lng });
    if (!f.road_name) { const r = await reverseGeocode(lat, lng); if (r) setF((p) => ({ ...p, road_name: r })); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!pin) throw new Error('Place the work on the map (search, or click the map).');
      const payload = {
        title: f.title.trim(), description: f.description.trim() || null, road_name: f.road_name.trim(),
        road_segment_id: f.road_segment_id.trim() || null, location_description: f.location_description.trim() || null,
        latitude: pin.lat, longitude: pin.lng, segment_end_latitude: null, segment_end_longitude: null,
        work_type: f.work_type, department_id: f.department_id, start_date: f.start_date, end_date: f.end_date,
        status: 'planned' as const, revised_end_date: null, contractor_name: f.contractor_name.trim() || null,
        estimated_cost_inr: f.estimated_cost_inr ? Number(f.estimated_cost_inr) : null,
        created_by: profile?.id ?? null,
      };
      const saved = editing
        ? await updateProjectDetails(id!, payload)
        : await createProject(payload);
      nav(`/projects/${saved.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setBusy(false); }
  };

  if (editing && existing.loading) return <Loading />;

  return (
    <>
      <PageHeading eyebrow={editing ? 'Edit project' : 'Register a public work'}
        title={editing ? f.title || 'Edit project' : 'New public work'}
        description="Give residents the purpose, the responsible department and the window. The map location drives Dig-Once coordination." />

      <form onSubmit={submit} className="panel">
        <div className="form-grid">
          <div className="full-col"><Field id="title" label="Title"><input id="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={3} placeholder="e.g. Resurfacing 1st Main Road, Adyar" /></Field></div>
          <div className="full-col"><Field id="desc" label="Purpose / description"><textarea id="desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What is being done and why." /></Field></div>

          <Field id="work" label="Work type"><select id="work" value={f.work_type} onChange={(e) => setF({ ...f, work_type: e.target.value as WorkType })}>{WORK_TYPES.map((w) => <option key={w} value={w}>{WORK_LABELS[w]}</option>)}</select></Field>
          <Field id="dept" label="Department (responsible)"><select id="dept" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })} required><option value="">Select…</option>{deps.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>

          <Field id="start" label="Start date"><input id="start" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} required /></Field>
          <Field id="end" label="Planned end date"><input id="end" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} required /></Field>

          <Field id="road" label="Road / street name"><input id="road" value={f.road_name} onChange={(e) => setF({ ...f, road_name: e.target.value })} required placeholder="Auto-fills when you place the pin" /></Field>
          <Field id="seg" label="Shared segment ID (optional)" hint="A code the same stretch gets across departments — strengthens matching."><input id="seg" value={f.road_segment_id} onChange={(e) => setF({ ...f, road_segment_id: e.target.value })} placeholder="e.g. SC-ADYAR-1STMAIN-03" /></Field>

          <Field id="contractor" label="Contractor (optional)"><input id="contractor" value={f.contractor_name} onChange={(e) => setF({ ...f, contractor_name: e.target.value })} /></Field>
          <Field id="cost" label="Estimated cost ₹ (optional)"><input id="cost" type="number" min={0} value={f.estimated_cost_inr} onChange={(e) => setF({ ...f, estimated_cost_inr: e.target.value })} /></Field>
          <div className="full-col"><Field id="loc" label="Location note (optional)"><input id="loc" value={f.location_description} onChange={(e) => setF({ ...f, location_description: e.target.value })} placeholder="e.g. Between the signal and the bus stop" /></Field></div>
        </div>

        <Field id="geo" label="Find a location (OpenStreetMap)" hint="Search a South Chennai landmark, then refine by clicking the map.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="geo" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runGeocode(); } }} placeholder="e.g. Adyar signal, Velachery MRTS" />
            <Button type="button" variant="secondary" onClick={runGeocode} disabled={searching}><Icon name="search" size={15} />{searching ? '…' : 'Search'}</Button>
          </div>
        </Field>
        {results.length > 0 && (
          <div className="geocode-results">
            {results.map((r, i) => (
              <button type="button" key={i} onClick={() => { pickPin(r.lat, r.lng); setResults([]); setQuery(r.label.split(',').slice(0, 2).join(',')); }}>{r.label}</button>
            ))}
          </div>
        )}

        <div style={{ margin: '12px 0' }}>
          <Map projects={[]} selection={pin} onPick={pickPin} height={340} fit={false} />
        </div>
        {pin && !inSouthChennai(pin.lat, pin.lng) && <Notice tone="warning">This pin is outside the South Chennai pilot area. You can still save it, but it may not appear on the default map view.</Notice>}
        {pin && <p className="field-hint">Pinned at {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</p>}

        {error && <ErrorPanel message={error} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
          <Button type="button" variant="secondary" onClick={() => nav(-1)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Register project'}</Button>
        </div>
        {deps.error && <ErrorPanel message={deps.error} />}
      </form>
    </>
  );
}
