'use client';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';


import type { Telemetry } from '@/lib/new-sim/simulation';
import type { ModelSimProfile } from '@/lib/new-sim/modelProfiles';
import styles from './ModelBehaviorReadout.module.css';

export default function ModelBehaviorReadout({ telemetry: t, model, onRestart }: { telemetry: Telemetry; model: ModelSimProfile; onRestart: () => void }) {
  const tx = useTextTranslation();
  return <section className={styles.panel} aria-label={tx("Model behavior and supporting feedback")}>
    <div className={styles.heading}><div><span><TranslatedText text={"BEHAVIOR IN MOTION"} /></span><h2>{model.name}</h2></div><button onClick={onRestart}><TranslatedText text={"Restart this model's drive"} /></button></div>
    <div className={styles.metrics}>
      <div><span><TranslatedText text={"Lane position"} /></span><strong><TranslatedText text={Math.abs(t.lanePosition * 100).toFixed(0)} /> <small><TranslatedText text={"cm"} /> <TranslatedText text={Math.abs(t.lanePosition) < 0.02 ? 'centred' : t.lanePosition > 0 ? 'left' : 'right'} /></small></strong><p><TranslatedText text={(t.laneErrorRms * 100).toFixed(0)} />  <TranslatedText text={"cm RMS deviation"} /></p></div>
      <div><span><TranslatedText text={"Front-wheel angle"} /></span><strong><TranslatedText text={Math.abs(t.steering).toFixed(1)} /><small>° <TranslatedText text={Math.abs(t.steering) < 0.1 ? '' : t.steering > 0 ? 'left' : 'right'} /></small></strong><p><TranslatedText text={(Math.abs(t.lateralAcceleration) / 9.81).toFixed(2)} />  <TranslatedText text={"g lateral acceleration"} /></p></div>
      <div><span><TranslatedText text={"Acceleration"} /></span><strong><TranslatedText text={t.acceleration >= 0 ? '+' : ''} /><TranslatedText text={t.acceleration.toFixed(1)} /> <small>m/s²</small></strong><p><TranslatedText text={t.brake ? 'Brake applied' : 'Brake released'} /> · <TranslatedText text={t.peakJerk.toFixed(1)} />  <TranslatedText text={"m/s³ peak jerk"} /></p></div>
      <div><span><TranslatedText text={"Following distance"} /></span><strong>{t.gap === null ? '—' : Math.round(t.gap)} <small>m</small></strong><p><TranslatedText text={model.headway.toFixed(1)} /><TranslatedText text={"s base target ·"} /> <TranslatedText text={model.departureLag.toFixed(1)} /><TranslatedText text={"s departure delay"} /></p></div>
    </div>
    <div className={styles.status} role="status"><span><TranslatedText text={t.modelReaction} /></span><span>{t.stops}  <TranslatedText text={"full stops ·"} /> {t.interventions}  <TranslatedText text={"simulator lane corrections"} /></span></div>
    <details className={styles.evidence}>
      <summary><TranslatedText text={"Why it drives this way"} /> <span><TranslatedText text={model.evidenceCoverage.toLowerCase()} />  <TranslatedText text={"feedback coverage"} /></span></summary>
      <p><TranslatedText text={"Selecting a model restarts the same road and traffic for comparison. Driving pace adjusts its base settings. Parameters approximate reports in the model catalog. Overall sentiment only adjusts the strength of an explicitly reported fault. Missing traits use neutral defaults; vehicle-specific reports may not apply to every car."} /></p>
      {model.sentiment && <div className={styles.sentiment}><span>{Math.round(model.sentiment.positive)}<TranslatedText text={"% positive"} /></span><span>{Math.round(model.sentiment.neutral)}<TranslatedText text={"% neutral"} /></span><span>{Math.round(model.sentiment.negative)}<TranslatedText text={"% negative"} /></span><span><TranslatedText text={model.sentiment.votes === null ? 'Vote count unavailable' : `${model.sentiment.votes} votes`} /></span></div>}
      <div className={styles.evidenceRows}>{model.evidence.length ? model.evidence.map((e, i) => <div key={`${model.id}-${i}`}><span><TranslatedText text={e.dimension} /></span><b><TranslatedText text={e.effect} /></b><blockquote>“<TranslatedText text={e.quote} />”</blockquote><small><TranslatedText text={e.source} /></small></div>) : <p><TranslatedText text={"No specific driving traits are described in the stored feedback."} /></p>}</div>
      <p><TranslatedText text={"The simulator applies a shared lane-containment and collision-avoidance limit. Lane corrections are counted above; they are not evidence that a model recovered by itself. Rolling stops are illustrated only where explicitly reported."} /></p>
      {model.forumUrl && <a href={model.forumUrl} target="_blank" rel="noopener noreferrer"><TranslatedText text={"Read the community discussion ↗"} /></a>}
    </details>
  </section>;
}
