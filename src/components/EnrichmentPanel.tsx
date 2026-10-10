import { useResource } from '../hooks/useResource';
import { enrichLocation } from '../services/enrich';
import { openaqEnabled } from '../integrations/openaq';
import { Icon } from './Icon';

// Live open-data context for a project location: weather (construction risk)
// and air quality (dust). Degrades silently if an API is unreachable.
export function EnrichmentPanel({ lat, lng }: { lat: number; lng: number }) {
  const res = useResource(`enrich:${lat.toFixed(3)},${lng.toFixed(3)}`, () => enrichLocation(lat, lng));
  if (res.loading) return <div className="enrich-panel loading-inline">Checking live conditions…</div>;
  const wx = res.data?.weather;
  const air = res.data?.air;
  if (!wx && !air) return null;

  return (
    <div className="enrich-panel">
      {wx && (
        <div className={`enrich-card risk-${wx.risk}`}>
          <div className="enrich-head"><Icon name="drop" size={16} /><span>Weather outlook (3 days)</span></div>
          <p className="enrich-main">{wx.rainMm} mm rain · <strong>{wx.risk} delay risk</strong></p>
          <p className="enrich-note">{wx.summary}</p>
          <span className="enrich-src">Source: Open-Meteo</span>
        </div>
      )}
      {air && air.pm25 != null && (
        <div className={`enrich-card aq-${air.band}`}>
          <div className="enrich-head"><Icon name="wind" size={16} /><span>Air quality nearby</span></div>
          <p className="enrich-main">PM2.5 {air.pm25.toFixed(0)} µg/m³ · <strong>{air.band.replace('_', ' ')}</strong></p>
          <p className="enrich-note">{air.location}</p>
          <span className="enrich-src">Source: OpenAQ</span>
        </div>
      )}
      {!openaqEnabled() && (
        <div className="enrich-card aq-unknown">
          <div className="enrich-head"><Icon name="wind" size={16} /><span>Air quality</span></div>
          <p className="enrich-note">Add a free OpenAQ API key to show PM2.5 near this dig.</p>
        </div>
      )}
    </div>
  );
}
