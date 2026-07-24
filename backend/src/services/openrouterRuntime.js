'use strict';

async function requestAdvice(input, env = process.env) {
  const baseUrl = env.OPENROUTER_BASE_URL;
  const apiKey = env.OPENROUTER_API_KEY;
  const model = env.OPENROUTER_MODEL;
  if (baseUrl !== 'https://openrouter.ai/api/v1' || !apiKey || !model) {
    throw new Error('OpenRouter runtime configuration is incomplete');
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Provide concise wildfire incident planning advice. Do not claim to replace incident command judgment.' },
        { role: 'user', content: JSON.stringify(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}`);
  const body = await response.json();
  const result = body.choices?.[0]?.message?.content;
  if (!result) throw new Error('OpenRouter returned no usable content');
  return { result, model: body.model || model };
}

module.exports = { requestAdvice };
