'use client';

import type { Telemetry } from '@/lib/new-sim/simulation';
import type { ModelSimProfile } from '@/lib/new-sim/modelProfiles';
import styles from './ModelBehaviorReadout.module.css';

export default function ModelBehaviorReadout({ telemetry: t, model, onRestart }: { telemetry: Telemetry; model: ModelSimProfile; onRestart: () => void }) {
  return <section className={styles.panel} aria-label="Model behavior and supporting feedback">
    <div className={styles.heading}><div><span>BEHAVIOR IN MOTION</span><h2>{model.name}</h2></div><button onClick={onRestart}>Restart this model&apos;s drive</button></div>
    <div className={styles.metrics}>
      <div><span>Lane position</span><strong>{Math.abs(t.lanePosition * 100).toFixed(0)} <small>cm {Math.abs(t.lanePosition) < 0.02 ? 'centred' : t.lanePosition > 0 ? 'left' : 'right'}</small></strong><p>{(t.laneErrorRms * 100).toFixed(0)} cm RMS deviation</p></div>
      <div><span>Front-wheel angle</span><strong>{Math.abs(t.steering).toFixed(1)}<small>° {Math.abs(t.steering) < 0.1 ? '' : t.steering > 0 ? 'left' : 'right'}</small></strong><p>{(Math.abs(t.lateralAcceleration) / 9.81).toFixed(2)} g lateral acceleration</p></div>
      <div><span>Acceleration</span><strong>{t.acceleration >= 0 ? '+' : ''}{t.acceleration.toFixed(1)} <small>m/s²</small></strong><p>{t.brake ? 'Brake applied' : 'Brake released'} · {t.peakJerk.toFixed(1)} m/s³ peak jerk</p></div>
      <div><span>Following distance</span><strong>{t.gap === null ? '—' : Math.round(t.gap)} <small>m</small></strong><p>{model.headway.toFixed(1)}s base target · {model.departureLag.toFixed(1)}s departure delay</p></div>
    </div>
    <div className={styles.status} role="status"><span>{t.modelReaction}</span><span>{t.stops} full stops · {t.interventions} simulator lane corrections</span></div>
    <details className={styles.evidence}>
      <summary>Why it drives this way <span>{model.evidenceCoverage.toLowerCase()} feedback coverage</span></summary>
      <p>Selecting a model restarts the same road and traffic for comparison. Driving pace adjusts its base settings. Parameters approximate reports in the model catalog. Overall sentiment only adjusts the strength of an explicitly reported fault. Missing traits use neutral defaults; vehicle-specific reports may not apply to every car.</p>
      {model.sentiment && <div className={styles.sentiment}><span>{Math.round(model.sentiment.positive)}% positive</span><span>{Math.round(model.sentiment.neutral)}% neutral</span><span>{Math.round(model.sentiment.negative)}% negative</span><span>{model.sentiment.votes === null ? 'Vote count unavailable' : `${model.sentiment.votes} votes`}</span></div>}
      <div className={styles.evidenceRows}>{model.evidence.length ? model.evidence.map((e, i) => <div key={`${model.id}-${i}`}><span>{e.dimension}</span><b>{e.effect}</b><blockquote>“{e.quote}”</blockquote><small>{e.source}</small></div>) : <p>No specific driving traits are described in the stored feedback.</p>}</div>
      <p>The simulator applies a shared lane-containment and collision-avoidance limit. Lane corrections are counted above; they are not evidence that a model recovered by itself. Rolling stops are illustrated only where explicitly reported.</p>
      {model.forumUrl && <a href={model.forumUrl} target="_blank" rel="noopener noreferrer">Read the community discussion ↗</a>}
    </details>
  </section>;
}
