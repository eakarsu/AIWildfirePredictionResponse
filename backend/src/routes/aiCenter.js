const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

// General AI query endpoint
router.post('/query', auth, async (req, res) => {
  const { prompt, category } = req.body;
  try {
    const systemPrompts = {
      'risk-prediction': 'You are an expert in wildfire risk prediction and assessment. Provide detailed, data-driven risk analyses.',
      'evacuation': 'You are an expert in emergency evacuation planning. Provide actionable evacuation strategies and safety guidelines.',
      'resource-optimization': 'You are an expert in firefighting resource management and logistics optimization.',
      'weather-fire': 'You are a fire weather meteorologist. Analyze weather patterns for wildfire risk and behavior prediction.',
      'damage-recovery': 'You are an expert in post-fire damage assessment and community recovery planning.',
      'prevention': 'You are a wildfire prevention specialist. Provide strategies for fire prevention and community preparedness.',
      'training': 'You are a wildfire firefighting training specialist. Create realistic training scenarios and educational content.',
      'general': 'You are an expert wildfire prediction and response AI assistant. Provide comprehensive, professional analysis.'
    };
    const aiResponse = await queryAI(prompt, systemPrompts[category] || systemPrompts['general']);
    res.json({ response: aiResponse, category, timestamp: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Quick risk assessment
router.post('/quick-risk', auth, async (req, res) => {
  const { location, conditions } = req.body;
  try {
    const aiResponse = await queryAI(`Quick wildfire risk assessment for ${location}. Conditions: ${conditions}. Provide: risk level (1-10), key factors, and immediate recommendations in a concise format.`);
    res.json({ response: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI-powered situation report
router.post('/sitrep', auth, async (req, res) => {
  const { incident_details } = req.body;
  try {
    const aiResponse = await queryAI(`Generate a professional wildfire situation report (SITREP) based on: ${incident_details}. Include: current status, resources deployed, weather outlook, projected fire behavior, strategic objectives, and public information summary.`,
      'You are a wildfire incident commander creating official situation reports. Use ICS format and professional terminology.');
    res.json({ response: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI fire behavior analysis
router.post('/fire-behavior', auth, async (req, res) => {
  const { fuel_type, slope, wind, moisture } = req.body;
  try {
    const aiResponse = await queryAI(`Analyze expected fire behavior: Fuel Type: ${fuel_type}, Slope: ${slope}%, Wind: ${wind}mph, Fuel Moisture: ${moisture}%. Predict: flame length, rate of spread, spotting potential, crown fire potential, and recommended suppression tactics.`);
    res.json({ response: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI prevention recommendations
router.post('/prevention', auth, async (req, res) => {
  const { area_description } = req.body;
  try {
    const aiResponse = await queryAI(`Provide wildfire prevention recommendations for: ${area_description}. Include: defensible space guidelines, vegetation management, community preparedness checklist, building hardening measures, and emergency communication plan.`);
    res.json({ response: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI training scenario generator
router.post('/training-scenario', auth, async (req, res) => {
  const { difficulty, scenario_type, crew_level } = req.body;
  try {
    const aiResponse = await queryAI(`Generate a wildfire training scenario: Difficulty: ${difficulty}, Type: ${scenario_type}, Crew Level: ${crew_level}. Include: scenario description, initial conditions, evolving situation updates, decision points, expected actions, and after-action review questions.`,
      'You are a wildfire training specialist creating realistic simulation scenarios for firefighter education.');
    res.json({ response: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
