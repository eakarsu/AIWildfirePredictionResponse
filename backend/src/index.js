require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Database pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.locals.pool = pool;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/risk-assessments', require('./routes/riskAssessments'));
app.use('/api/fire-detections', require('./routes/fireDetections'));
app.use('/api/evacuation-plans', require('./routes/evacuationPlans'));
app.use('/api/resource-allocations', require('./routes/resourceAllocations'));
app.use('/api/weather-analyses', require('./routes/weatherAnalyses'));
app.use('/api/smoke-reports', require('./routes/smokeReports'));
app.use('/api/community-alerts', require('./routes/communityAlerts'));
app.use('/api/damage-assessments', require('./routes/damageAssessments'));
app.use('/api/spread-predictions', require('./routes/spreadPredictions'));
app.use('/api/water-sources', require('./routes/waterSources'));
app.use('/api/crew-deployments', require('./routes/crewDeployments'));
app.use('/api/equipment-tracking', require('./routes/equipmentTracking'));
app.use('/api/ai-center', require('./routes/aiCenter'));
app.use('/api/ai', require('./routes/aiFeatures'));
app.use('/api/ext', require('./routes/extensions')); // Apply pass 5: backlog
app.use('/api/custom', require('./routes/customFeatures'));
app.use('/api/custom-views', require('./routes/customViews'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// // === Batch 09 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-aiwildfirepredictionresponse', require('./routes/batch09GapAi')); // // === Batch 09 Gaps & Frontend Mounts ===
app.use('/api/gap-nonai-aiwildfirepredictionresponse', require('./routes/batch09GapNonai')); // // === Batch 09 Gaps & Frontend Mounts ===

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});


