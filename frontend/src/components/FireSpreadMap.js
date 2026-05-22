import React from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip, Popup } from 'react-leaflet';

// FireSpreadMap: renders fire perimeter polygons severity-colored, with wind direction arrows.
export default function FireSpreadMap({ data }) {
  if (!data) return <div style={{ padding: 20 }}>Loading fire spread map...</div>;
  const { center = [37.5, -120.5], zoom = 6, perimeters = [], severity_legend = {} } = data;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {Object.entries(severity_legend).map(([sev, color]) => (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              background: color, borderRadius: 3, border: '1px solid #222',
            }} />
            <span style={{ textTransform: 'capitalize', fontSize: 13 }}>{sev}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>➤</span>
          <span style={{ fontSize: 13 }}>Wind direction</span>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: 520, width: '100%', borderRadius: 8, border: '1px solid #333' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {perimeters.map(p => (
          <React.Fragment key={p.id}>
            <Polygon
              positions={p.coordinates}
              pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.45, weight: 2 }}
            >
              <Tooltip>{p.incident_name} ({p.severity})</Tooltip>
              <Popup>
                <strong>{p.incident_name}</strong><br />
                Region: {p.region}<br />
                Severity: <span style={{ color: p.color }}>{p.severity}</span><br />
                Acres burned: {p.acres_burned.toLocaleString()}<br />
                Containment: {p.containment_pct}%<br />
                Wind: {p.wind.speed_mph} mph @ {p.wind.direction_deg}&deg;
              </Popup>
            </Polygon>

            {/* Wind direction arrow as a polyline + arrowhead marker at the tip */}
            <Polyline
              positions={p.wind.arrow}
              pathOptions={{ color: '#000', weight: 3, opacity: 0.85, dashArray: '6 4' }}
            />
            <CircleMarker
              center={p.wind.arrow[1]}
              radius={5}
              pathOptions={{ color: '#000', fillColor: '#fff', fillOpacity: 1, weight: 2 }}
            >
              <Tooltip>Wind {p.wind.speed_mph} mph @ {p.wind.direction_deg}&deg;</Tooltip>
            </CircleMarker>
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
