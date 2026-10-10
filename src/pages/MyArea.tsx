import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { projectsNear } from '../services/projects';
import { getMySubscriptions, addSubscription, removeSubscription } from '../services/subscriptions';
import { reverseGeocode } from '../integrations/nominatim';
import { useAuth } from '../context/AuthContext';
import { SOUTH_CHENNAI_AREAS, fmtDistance } from '../lib/geo';
import { buildICS, downloadICS } from '../lib/ics';
import { WORK_LABELS, STATUS_LABELS, formatDate } from '../lib/format';
import type { NearbyProject } from '../lib/types';
import { PageHeading, Button, Field, Loading, EmptyState, Notice } from '../components/UI';
import { Map } from '../components/Map';
import { Icon } from '../components/Icon';

export default function MyArea() {
  const { userId } = useAuth();
  const [pin, setPin] = useState<{ lat: number; lng: number }>({ lat: 13.0012, lng: 80.2565 });
  const [label, setLabel] = useState('Adyar');
  const [radius, setRadius] = useState(800);
  const [results, setResults] = useState<NearbyProject[] | null>(null);
  const [loading, setLoading] = useState(false);

  const subs = useResource('subs', getMySubscriptions, { enabled: !!userId });

  const look = async (lat = pin.lat, lng = pin.lng, r = radius) => {
    setLoading(true);
    try {
      const [near, road] = await Promise.all([projectsNear(lat, lng, r), reverseGeocode(lat, lng)]);
      setResults(near);
      if (road) setLabel(road.split(',')[0]);
    } finally { setLoading(false); }
  };

  const pick = (lat: number, lng: number) => { setPin({ lat, lng }); look(lat, lng); };

  const save = async () => { await addSubscription({ label, latitude: pin.lat, longitude: pin.lng, radius_m: radius }); subs.reload(); };

  const exportICS = () => {
    if (!results?.length) return;
    downloadICS(`civicsync-${label.replace(/\s+/g, '-').toLowerCase()}.ics`, buildICS(label, results));
  };

  return (
    <>
      <PageHeading eyebrow="Plan around disruptions" title="Works near you"
        description="Pick a spot, set a radius, and see every upcoming dig nearby. Download it to your calendar so roadwork never surprises you." />

      <div className="detail-grid">
        <section className="panel">
          <div className="filter-bar">
            {SOUTH_CHENNAI_AREAS.map((a) => (
              <button key={a.name} className="btn btn-secondary sm" onClick={() => { setPin({ lat: a.lat, lng: a.lng }); setLabel(a.name); look(a.lat, a.lng); }}>{a.name}</button>
            ))}
          </div>
          <Map projects={(results ?? []).map((n) => ({ ...n, description: null, road_segment_id: null, location_description: null, segment_end_latitude: null, segment_end_longitude: null, actual_end_date: null, revised_end_date: null, progress_percent: 0, contractor_name: null, estimated_cost_inr: null, version: 1, created_at: '', updated_at: '' }))}
            selection={pin} radiusM={radius} onPick={pick} height={360} fit={false} />
          <div className="row-2" style={{ marginTop: 14 }}>
            <Field id="radius" label={`Radius: ${radius} m`}><input id="radius" type="range" min={200} max={3000} step={100} value={radius} onChange={(e) => { setRadius(Number(e.target.value)); }} onMouseUp={() => look()} onTouchEnd={() => look()} /></Field>
            <Field id="label" label="Label this area"><input id="label" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button onClick={() => look()}><Icon name="search" size={15} />Find works</Button>
            <Button variant="secondary" onClick={exportICS} disabled={!results?.length}><Icon name="calendar" size={15} />Add to calendar (.ics)</Button>
            {userId && <Button variant="ghost" onClick={save}><Icon name="pin" size={15} />Save this area</Button>}
          </div>
        </section>

        <div>
          <section className="panel">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Upcoming near {label}</h2>
            {loading && <Loading />}
            {!loading && results && (results.length === 0
              ? <EmptyState icon="check" title="Nothing scheduled" description="No active works within this radius." />
              : <ul className="timeline">
                  {results.map((n) => (
                    <li key={n.id}>
                      <div className="tl-head"><strong style={{ fontSize: 14 }}>{n.title}</strong><span className="field-hint">{fmtDistance(n.distance_m)}</span></div>
                      <p style={{ fontSize: 13 }}>{WORK_LABELS[n.work_type]} · {STATUS_LABELS[n.status]} · {formatDate(n.start_date)}–{formatDate(n.end_date)}</p>
                    </li>
                  ))}
                </ul>)}
            {!results && !loading && <p className="field-hint">Pick an area or click the map to begin.</p>}
          </section>

          {userId && subs.data && subs.data.length > 0 && (
            <section className="panel">
              <h2 style={{ fontSize: 16, marginBottom: 10 }}>Saved areas</h2>
              {subs.data.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <button className="text-link" onClick={() => { setPin({ lat: s.latitude, lng: s.longitude }); setLabel(s.label); setRadius(s.radius_m); look(s.latitude, s.longitude, s.radius_m); }}>{s.label} · {s.radius_m} m</button>
                  <button className="icon-btn" onClick={async () => { await removeSubscription(s.id); subs.reload(); }} aria-label="Remove">×</button>
                </div>
              ))}
            </section>
          )}
          {!userId && <Notice tone="info">Sign in to save your areas for next time.</Notice>}
        </div>
      </div>
    </>
  );
}
