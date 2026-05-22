import React from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip, Popup } from 'react-leaflet';

// EvacuationMap: zone polygons, evacuation route polylines, and shelter markers.
export default function EvacuationMap({ data }) {
  if (!data) return <div style={{ padding: 20 }}>Loading evacuation map...</div>;
  const { center = [37.5, -120.5], zoom = 6, zones = [], routes = [], shelters = [] } = data;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <div><span style={{ background: '#b71c1c', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>Mandatory</span></div>
        <div><span style={{ background: '#ff5722', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>Warning</span></div>
        <div><span style={{ background: '#ffc107', padding: '2px 8px', borderRadius: 4 }}>Advisory</span></div>
        <div>Shelters: <strong>{shelters.length}</strong></div>
        <div>Routes: <strong>{routes.length}</strong></div>
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

        {zones.map(z => (
          <Polygon
            key={z.id}
            positions={z.coordinates}
            pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.25, weight: 2, dashArray: '4 4' }}
          >
            <Tooltip>{z.zone_name} ({z.order})</Tooltip>
            <Popup>
              <strong>{z.zone_name}</strong><br />
              Order: {z.order}<br />
              Population est: {z.population_estimate.toLocaleString()}
            </Popup>
          </Polygon>
        ))}

        {routes.map(r => (
          <Polyline
            key={r.id}
            positions={r.coordinates}
            pathOptions={{ color: r.color, weight: 4, opacity: 0.9 }}
          >
            <Tooltip>{r.name} - {r.status}</Tooltip>
            <Popup>
              <strong>{r.name}</strong><br />
              Status: {r.status}
            </Popup>
          </Polyline>
        ))}

        {shelters.map(s => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={9}
            pathOptions={{ color: '#0d47a1', fillColor: '#42a5f5', fillOpacity: 0.95, weight: 2 }}
          >
            <Tooltip>{s.name}</Tooltip>
            <Popup>
              <strong>{s.name}</strong><br />
              Capacity: {s.capacity}<br />
              Pet friendly: {s.pet_friendly ? 'Yes' : 'No'}<br />
              ADA accessible: {s.ada_accessible ? 'Yes' : 'No'}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
