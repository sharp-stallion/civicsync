import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getProject, projectsNear } from '../services/projects';
import { submitReport, uploadReportPhoto } from '../services/reports';
import { reverseGeocode } from '../integrations/nominatim';
import { REPORT_CATEGORIES, type ReportCategory, type NearbyProject } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { PageHeading, Button, Field, ErrorPanel, Notice, Loading } from '../components/UI';
import { Map } from '../components/Map';
import { Icon } from '../components/Icon';

export default function Report() {
  const [params] = useSearchParams();
  const preProject = params.get('project');
  const pre = useResource(`rep-pre:${preProject}`, () => getProject(preProject!), { enabled: !!preProject });

  const [mode, setMode] = useState<'registered' | 'unregistered'>(preProject ? 'registered' : 'unregistered');
  const [projectId, setProjectId] = useState<string | null>(preProject);
  const [projectTitle, setProjectTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory>('safety');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [road, setRoad] = useState('');
  const [nearby, setNearby] = useState<NearbyProject[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (pre.data) { setProjectId(pre.data.id); setProjectTitle(pre.data.title); setMode('registered'); } }, [pre.data]);

  const pick = async (lat: number, lng: number) => {
    setPin({ lat, lng });
    const [r, near] = await Promise.all([reverseGeocode(lat, lng), projectsNear(lat, lng, 200)]);
    if (r) setRoad(r);
    setNearby(near);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      let photoPath: string | null = null;
      if (file) photoPath = await uploadReportPhoto(file);
      await submitReport({
        isUnregistered: mode === 'unregistered',
        projectId: mode === 'registered' ? projectId : null,
        latitude: pin?.lat ?? null, longitude: pin?.lng ?? null, roadName: road || null,
        category, description, photoPath,
      });
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit.'); setBusy(false); }
  };

  if (saved) return (
    <div className="panel success-panel" style={{ maxWidth: 520, margin: '40px auto' }}>
      <span className="success-symbol"><Icon name="check" size={30} /></span>
      <h2>Your report is on record</h2>
      <p className="page-sub" style={{ margin: '8px auto 18px' }}>The responsible department can now see it. Track its status from My reports.</p>
      <Link className="btn btn-primary" to="/my-reports">View my reports <Icon name="arrow" size={16} /></Link>
    </div>
  );

  return (
    <>
      <PageHeading eyebrow="Citizen voice" title="Report an issue"
        description="Something unsafe, delayed, or digging nobody announced? Tell the city — with a location and, if you can, a photo." />

      <div className="toggle-pills">
        <button className={mode === 'unregistered' ? 'on' : ''} onClick={() => setMode('unregistered')}>Digging not on the register</button>
        <button className={mode === 'registered' ? 'on' : ''} onClick={() => setMode('registered')}>About a known project</button>
      </div>

      <form onSubmit={submit} className="panel">
        {mode === 'registered' ? (
          <Field id="proj" label="Which project?" hint={projectTitle ? undefined : 'Open a project and use its “Report an issue” button, or drop a pin below to find nearby works.'}>
            <input id="proj" value={projectTitle} readOnly placeholder="No project selected" />
          </Field>
        ) : (
          <Notice tone="info">Reporting unregistered digging puts it on the public map so the city can trace who is responsible — exactly the gap this project is about.</Notice>
        )}

        <Field id="map" label="Where is it?" hint="Click the map to drop a pin.">
          <Map projects={[]} selection={pin} onPick={pick} height={300} fit={false} />
        </Field>
        {road && <p className="field-hint">Near: {road}</p>}
        {mode === 'registered' && nearby.length > 0 && !projectId && (
          <Notice tone="info">Nearby registered works: {nearby.slice(0, 3).map((n) => <button key={n.id} type="button" className="text-link" style={{ marginRight: 10 }} onClick={() => { setProjectId(n.id); setProjectTitle(n.title); }}>{n.title} ({fmtDistance(n.distance_m)})</button>)}</Notice>
        )}

        <div className="row-2">
          {mode === 'registered' && (
            <Field id="cat" label="Category"><select id="cat" value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>{REPORT_CATEGORIES.filter((c) => c !== 'unregistered_work').map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></Field>
          )}
          <Field id="photo" label="Photo (optional)" hint="JPEG/PNG/WebP, up to 5 MB."><input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        </div>
        <Field id="desc" label="What did you see?" hint="Describe the location and issue — not assumptions about who caused it."><textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} /></Field>

        {error && <ErrorPanel message={error} />}
        <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</Button>
      </form>
      {pre.loading && <Loading />}
    </>
  );
}
