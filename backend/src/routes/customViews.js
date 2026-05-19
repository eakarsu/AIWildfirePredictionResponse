// Custom view endpoints for visual map features
// Synthesizes geospatial fixtures around California wildfire-prone regions.
const router = require('express').Router();
const auth = require('../middleware/auth');

// Anchor points across California wildfire-prone regions
const REGIONS = [
  { name: 'Paradise (Butte County)',     lat: 39.7596, lng: -121.6219 },
  { name: 'Big Sur (Monterey County)',   lat: 36.2704, lng: -121.8081 },
  { name: 'Malibu (Los Angeles County)', lat: 34.0259, lng: -118.7798 },
  { name: 'Napa Valley (Napa County)',   lat: 38.5025, lng: -122.2654 },
  { name: 'Lake Tahoe (El Dorado)',      lat: 38.9399, lng: -120.0426 },
  { name: 'Yosemite NP (Mariposa)',      lat: 37.8651, lng: -119.5383 },
];

const SEVERITY = ['low', 'moderate', 'high', 'extreme'];
const SEVERITY_COLORS = {
  low: '#ffeb3b',
  moderate: '#ff9800',
  high: '#f44336',
  extreme: '#7b1fa2',
};

// Build a rough polygon ring around a center point (degrees)
function ringAround(lat, lng, radiusDeg, points, jitter = 0.25) {
  const ring = [];
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    const r = radiusDeg * (1 + (Math.sin(i * 1.7) * jitter));
    ring.push([
      +(lat + r * Math.cos(theta)).toFixed(5),
      +(lng + r * Math.sin(theta) * 1.3).toFixed(5),
    ]);
  }
  ring.push(ring[0]);
  return ring;
}

// GET /api/custom-views/fire-spread-map
router.get('/fire-spread-map', auth, (req, res) => {
  try {
    const perimeters = REGIONS.map((region, idx) => {
      const severity = SEVERITY[idx % SEVERITY.length];
      const radius = 0.04 + (idx % 3) * 0.025;
      const coordinates = ringAround(region.lat, region.lng, radius, 18, 0.22);
      const acres = Math.round(800 + (idx + 1) * 1320 + Math.abs(Math.sin(idx)) * 1800);
      const wind_deg = (35 + idx * 47) % 360;
      const wind_mph = 8 + (idx * 3) % 22;
      return {
        id: `fire-${idx + 1}`,
        incident_name: `${region.name.split(' ')[0]} Complex`,
        region: region.name,
        center: [region.lat, region.lng],
        severity,
        color: SEVERITY_COLORS[severity],
        acres_burned: acres,
        containment_pct: Math.max(5, (idx * 13) % 80),
        coordinates,
        wind: {
          direction_deg: wind_deg,
          speed_mph: wind_mph,
          // arrow tail->head: 0.08deg vector along wind direction
          arrow: [
            [region.lat, region.lng],
            [
              +(region.lat + Math.cos((wind_deg * Math.PI) / 180) * 0.09).toFixed(5),
              +(region.lng + Math.sin((wind_deg * Math.PI) / 180) * 0.09).toFixed(5),
            ],
          ],
        },
      };
    });

    res.json({
      center: [37.5, -120.5], // California center-ish
      zoom: 6,
      generated_at: new Date().toISOString(),
      severity_legend: SEVERITY_COLORS,
      perimeters,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/custom-views/evacuation-map
router.get('/evacuation-map', auth, (req, res) => {
  try {
    const zones = REGIONS.map((region, idx) => {
      const radius = 0.06 + (idx % 2) * 0.03;
      const ring = ringAround(region.lat, region.lng, radius, 14, 0.18);
      const orderLevels = ['advisory', 'warning', 'mandatory'];
      const order = orderLevels[idx % orderLevels.length];
      const zoneColors = { advisory: '#ffc107', warning: '#ff5722', mandatory: '#b71c1c' };
      return {
        id: `zone-${idx + 1}`,
        zone_name: `${region.name.split(' ')[0]} Zone ${idx + 1}`,
        region: region.name,
        order,
        color: zoneColors[order],
        coordinates: ring,
        population_estimate: 1200 + idx * 870,
      };
    });

    const shelters = REGIONS.map((region, idx) => ({
      id: `shelter-${idx + 1}`,
      name: `${region.name.split(' ')[0]} Evacuation Shelter`,
      lat: +(region.lat - 0.15 - idx * 0.01).toFixed(5),
      lng: +(region.lng + 0.18 + idx * 0.01).toFixed(5),
      capacity: 250 + (idx * 75),
      pet_friendly: idx % 2 === 0,
      ada_accessible: true,
    }));

    // Routes go from each zone center out to its corresponding shelter,
    // with a couple of waypoints to give the polyline some shape.
    const routes = REGIONS.map((region, idx) => {
      const shelter = shelters[idx];
      const midLat = (region.lat + shelter.lat) / 2 + (idx % 2 === 0 ? 0.05 : -0.05);
      const midLng = (region.lng + shelter.lng) / 2 + (idx % 2 === 0 ? -0.06 : 0.06);
      return {
        id: `route-${idx + 1}`,
        name: `Route ${idx + 1}: ${region.name.split(' ')[0]} -> Shelter`,
        from_zone: `zone-${idx + 1}`,
        to_shelter: `shelter-${idx + 1}`,
        status: ['open', 'congested', 'open', 'restricted'][idx % 4],
        color: ['#1976d2', '#fb8c00', '#43a047', '#7b1fa2'][idx % 4],
        coordinates: [
          [region.lat, region.lng],
          [+midLat.toFixed(5), +midLng.toFixed(5)],
          [shelter.lat, shelter.lng],
        ],
      };
    });

    res.json({
      center: [37.5, -120.5],
      zoom: 6,
      generated_at: new Date().toISOString(),
      zones,
      shelters,
      routes,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Custom feature #3: Evacuation Order Broadcast
// ---------------------------------------------------------------------------
async function ensureBroadcastTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evacuation_orders (
      id SERIAL PRIMARY KEY,
      zones TEXT[] NOT NULL,
      message TEXT NOT NULL,
      channels TEXT[] NOT NULL,
      est_recipients INTEGER NOT NULL,
      issued_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

router.post('/evacuation-broadcast', auth, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureBroadcastTable(pool);

    const { zones = [], message = '', channels = [] } = req.body || {};
    if (!Array.isArray(zones) || zones.length === 0) {
      return res.status(400).json({ error: 'zones[] required' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message required' });
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ error: 'channels[] required' });
    }

    // Estimate recipients: based on zone population from REGIONS map
    const popPerZone = {};
    REGIONS.forEach((region, idx) => {
      popPerZone[`zone-${idx + 1}`] = 1200 + idx * 870;
    });
    const estRecipients = zones.reduce((total, z) => {
      return total + (popPerZone[z] || 1500);
    }, 0);

    const issuedBy = req.user?.email || 'unknown';
    const ins = await pool.query(
      `INSERT INTO evacuation_orders (zones, message, channels, est_recipients, issued_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [zones, message, channels, estRecipients, issuedBy]
    );

    res.json({
      order_id: ins.rows[0].id,
      channels_used: channels,
      est_recipients: estRecipients,
      created_at: ins.rows[0].created_at,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/evacuation-broadcast', auth, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureBroadcastTable(pool);
    const r = await pool.query(
      `SELECT id, zones, message, channels, est_recipients, issued_by, created_at
       FROM evacuation_orders
       ORDER BY created_at DESC
       LIMIT 25`
    );
    // Provide zone catalog so the UI knows what's pickable
    const zoneCatalog = REGIONS.map((region, idx) => ({
      id: `zone-${idx + 1}`,
      zone_name: `${region.name.split(' ')[0]} Zone ${idx + 1}`,
      region: region.name,
      population_estimate: 1200 + idx * 870,
    }));
    res.json({
      zones: zoneCatalog,
      recent_orders: r.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Custom feature #4: Incident Command wizard
// ---------------------------------------------------------------------------
async function ensureIncidentTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incident_command (
      id SERIAL PRIMARY KEY,
      incident_name VARCHAR(255) NOT NULL,
      incident_type VARCHAR(100) NOT NULL,
      location VARCHAR(255) NOT NULL,
      severity VARCHAR(50) NOT NULL,
      commander VARCHAR(255) NOT NULL,
      resources JSONB NOT NULL,
      notes TEXT,
      submitted_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

router.post('/incident-command', auth, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureIncidentTable(pool);

    const {
      incident_name,
      incident_type,
      location,
      severity,
      commander,
      resources,
      notes,
    } = req.body || {};

    const required = { incident_name, incident_type, location, severity, commander };
    for (const [k, v] of Object.entries(required)) {
      if (!v || typeof v !== 'string') {
        return res.status(400).json({ error: `${k} is required` });
      }
    }
    if (!resources || typeof resources !== 'object') {
      return res.status(400).json({ error: 'resources object required' });
    }

    const submittedBy = req.user?.email || 'unknown';
    const ins = await pool.query(
      `INSERT INTO incident_command
        (incident_name, incident_type, location, severity, commander, resources, notes, submitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, created_at`,
      [
        incident_name,
        incident_type,
        location,
        severity,
        commander,
        JSON.stringify(resources),
        notes || '',
        submittedBy,
      ]
    );

    res.json({
      incident_id: ins.rows[0].id,
      created_at: ins.rows[0].created_at,
      status: 'submitted',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/incident-command', auth, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureIncidentTable(pool);
    const r = await pool.query(
      `SELECT id, incident_name, incident_type, location, severity, commander,
              resources, notes, submitted_by, created_at
       FROM incident_command
       ORDER BY created_at DESC
       LIMIT 25`
    );
    res.json({
      incident_types: ['Wildfire', 'Structure Fire', 'Vehicle Accident', 'HazMat', 'Medical', 'Search & Rescue'],
      severity_levels: ['Low', 'Moderate', 'High', 'Extreme'],
      resource_catalog: [
        'Engine Crews',
        'Hand Crews',
        'Helicopters',
        'Air Tankers',
        'Bulldozers',
        'Water Tenders',
        'Ambulances',
      ],
      recent_incidents: r.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
