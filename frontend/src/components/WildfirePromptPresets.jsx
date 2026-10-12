import React from 'react';

const scenarios = [
  {
    label: 'Ridge fire exercise',
    context: 'Fictional exercise: a 1,200 acre ridge fire is moving toward two rural communities. Westerly winds are 25 mph, humidity is 18%, and steep mixed-conifer terrain limits road access. Assume observations need confirmation.',
    request: 'Assess immediate priorities, information gaps, public-safety implications, and actions for the next operational period.',
  },
  {
    label: 'Wind shift exercise',
    context: 'Fictional exercise: a 360 acre grass fire is 8 miles from a town. A forecast wind shift from southwest to north is expected within six hours. Two engines and one crew are available; road status is unverified.',
    request: 'Compare likely scenarios, resource constraints, decision points, and what field observations should be checked first.',
  },
  {
    label: 'Recovery exercise',
    context: 'Fictional exercise: a 4,500 acre fire is contained after affecting a watershed, power lines, and several neighborhoods. Damage surveys and air-quality measurements are incomplete.',
    request: 'Prepare a phased assessment with assumptions, evidence needed, responsible roles, and practical community updates.',
  },
];

export default function WildfirePromptPresets({ topic, onFill, disabled = false }) {
  return <section className="ai-preset-bar" aria-label="Prompt examples">
    <div><strong>Fill a complete example</strong><p>Fictional planning inputs. Review actual incident facts before generating.</p></div>
    <div className="ai-actions">{scenarios.map(({ label, context, request }) =>
      <button key={label} type="button" className="btn btn-secondary" disabled={disabled}
        onClick={() => onFill(`For ${topic}: ${context} ${request}`)}>{label}</button>
    )}</div>
  </section>;
}
