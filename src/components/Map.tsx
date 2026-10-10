import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import type { LatLngExpression } from 'leaflet';
import type { Project, ProjectStatus } from '../lib/types';
import { MAP_CENTER, MAP_ZOOM } from '../lib/env';
import { WORK_LABELS, STATUS_LABELS } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import 'leaflet/dist/leaflet.css';

const STATUS_COLOR: Record<ProjectStatus, string> = {
  planned: '#5b7cc0', ongoing: '#0f9d8f', delayed: '#e0952a', completed: '#6b7f72', cancelled: '#8b9198',
};

// Fit the view to the data ONCE per unique set of points. Re-renders with the
// same coordinates (e.g. a background refresh) no longer snap the map back, so
// the user's manual zoom/pan is preserved — which fixes the "jumpy zoom".
function Fit({ points, enabled }: { points: [number, number][]; enabled: boolean }) {
  const map = useMap();
  const sig = JSON.stringify(points);
  const done = useRef('');
  useEffect(() => {
    if (!enabled || done.current === sig) return;
    done.current = sig;
    map.invalidateSize();
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15, animate: false });
  }, [sig, map, points, enabled]);
  return null;
}

function ClickPick({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}

export interface MapProps {
  projects?: Project[];
  selection?: { lat: number; lng: number } | null;
  radiusM?: number | null;
  onPick?: (lat: number, lng: number) => void;
  height?: number;
  fit?: boolean;
}

export function Map({ projects = [], selection = null, radiusM = null, onPick, height = 420, fit = true }: MapProps) {
  const [tileError, setTileError] = useState(false);
  const pts = useMemo(() => projects.map((p) => [p.latitude, p.longitude] as [number, number]), [projects]);
  const fitPoints = fit ? [...pts, ...(selection ? [[selection.lat, selection.lng] as [number, number]] : [])] : [];

  return (
    <div className="map-wrap" style={{ height }}>
      {tileError && <div className="map-tile-warning">Map tiles could not load — check the network. Markers still reflect saved data.</div>}
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        scrollWheelZoom={true}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={140}
        zoomAnimation={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <Fit points={fitPoints} enabled={fit} />
        <ClickPick onPick={onPick} />
        {projects.map((p) => (
          <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={8}
            pathOptions={{ color: '#fff', weight: 2, fillColor: STATUS_COLOR[p.status], fillOpacity: 1 }}>
            <Popup>
              <div className="map-popup">
                <StatusBadge status={p.status} />
                <strong>{p.title}</strong>
                <p>{p.road_name} · {WORK_LABELS[p.work_type]}</p>
                <Link to={`/projects/${p.id}`}>View project →</Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {projects.filter((p) => p.segment_end_latitude != null && p.segment_end_longitude != null).map((p) => (
          <Polyline key={`seg-${p.id}`}
            positions={[[p.latitude, p.longitude], [p.segment_end_latitude!, p.segment_end_longitude!]] as LatLngExpression[]}
            pathOptions={{ color: STATUS_COLOR[p.status], weight: 5, opacity: 0.75 }} />
        ))}
        {selection && (
          <>
            <CircleMarker center={[selection.lat, selection.lng]} radius={9}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#be123c', fillOpacity: 1 }}>
              <Popup>Selected location</Popup>
            </CircleMarker>
            {radiusM && <Circle center={[selection.lat, selection.lng]} radius={radiusM}
              pathOptions={{ color: '#be123c', weight: 1, fillColor: '#be123c', fillOpacity: 0.07 }} />}
          </>
        )}
      </MapContainer>
      {onPick && <p className="map-hint">Click the map to place the location. Scroll to zoom, drag to pan.</p>}
      <div className="map-legend">
        {(Object.keys(STATUS_COLOR) as ProjectStatus[]).map((s) => (
          <span key={s}><i style={{ background: STATUS_COLOR[s] }} />{STATUS_LABELS[s]}</span>
        ))}
      </div>
    </div>
  );
}
