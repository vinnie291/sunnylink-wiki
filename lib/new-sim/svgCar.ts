import type { Vehicle } from './simulation';

const PAINT = ['#d5d9db', '#647383', '#783f43', '#bab4a7', '#365359', '#3d444c', '#a0a9ad'];

/** Rear/front elevations in metres: body width, glass and ride height are not exaggerated. */
export function trafficCarSvg(car: Pick<Vehicle, 'id' | 'kind' | 'direction' | 'braking' | 'lateral' | 'laneChange'>, time: number): string {
  const paint = PAINT[car.id % PAINT.length];
  const front = car.direction !== 1;
  const light = front ? '#f2eddb' : car.braking ? '#ff5556' : '#962d33';
  const blink = car.laneChange && Math.floor(time * 2.5) % 2 === 0;
  const indicator = blink ? `<rect x="${car.lateral > 0 ? .72 : -.85}" y="-.66" width=".13" height=".08" rx=".02" fill="#ffbf42"/>` : '';
  if (car.kind === 'motorcycle') return `<ellipse cy="0" rx=".48" ry=".09" fill="#071017" opacity=".5"/>
    <rect x="-.1" y="-.57" width=".2" height=".57" rx=".09" fill="#11161c"/><path d="M-.22,-.48L-.18,-.86H.18L.22,-.48Z" fill="${paint}"/>
    <path d="M-.31,-.44L-.25,-.92M.31,-.44L.25,-.92" stroke="#38434b" stroke-width=".13"/>
    <path d="M-.27,-.9L-.2,-1.36Q0,-1.47 .2,-1.36L.27,-.9Z" fill="#414b52"/>
    <path d="M-.17,-1.29L-.38,-1.02M.17,-1.29L.38,-1.02" stroke="#404a50" stroke-width=".12"/>
    <path d="M-.4,-1.02H.4" stroke="#9aa5ab" stroke-width=".045"/>
    <ellipse cy="-1.57" rx=".17" ry=".2" fill="${car.id % 2 ? '#d7d9d5' : '#334550'}"/><path d="M-.14,-1.6Q0,-1.65 .14,-1.6" stroke="#16252f" stroke-width=".09"/>
    <rect x="-.11" y="-.7" width=".22" height=".09" rx=".035" fill="${light}"/><rect x="-.085" y="-.54" width=".17" height=".1" fill="#d5dad9"/>
    ${blink ? '<circle cx=".3" cy="-.72" r=".06" fill="#ffbf42"/>' : ''}`;
  if (car.kind === 'truck') return front
    ? `<path d="M-1.22,-.48V-3.1Q-1.18,-3.65-.8,-3.7H.8Q1.18,-3.65 1.22,-3.1V-.48Z" fill="${paint}"/><path d="M-1.03,-2.9H1.03V-1.92H-1.03Z" fill="#243440"/><path d="M-.78,-1.55H.78V-.69H-.78Z" fill="#26313a"/><path d="M-.76,-1.3H.76M-.76,-1.1H.76M-.76,-.9H.76" stroke="#8b959a" stroke-width=".055"/><path d="M-1.2,-.55H1.2" stroke="#afb5b5" stroke-width=".19"/><path d="M-1.12,-.82H-.86M.86,-.82H1.12" stroke="${light}" stroke-width=".15"/><path d="M-1.1,0V-.43M1.1,0V-.43" stroke="#10171c" stroke-width=".28"/>`
    : `<path d="M-1.12,0V-.68M1.12,0V-.68" stroke="#12191f" stroke-width=".3"/><rect x="-1.27" y="-3.95" width="2.54" height="3.15" rx=".025" fill="#b9bdba" stroke="#606d73" stroke-width=".045"/>
      <path d="M0,-3.92V-.84M-1.18,-3.82H1.18V-.92H-1.18Z" fill="none" stroke="#82908f" stroke-width=".025"/>
      <path d="M-.55,-3.7V-1.04M.55,-3.7V-1.04" stroke="#e0e2da" stroke-width=".04"/><path d="M-.7,-1.5H-.42M.42,-1.5H.7" stroke="#5e6c70" stroke-width=".055"/>
      <path d="M-1.18,-.72H1.18M-1.03,-.4H1.03" stroke="#929c9c" stroke-width=".1"/><path d="M-.92,-.4V-.68M.92,-.4V-.68" stroke="#66747a" stroke-width=".08"/>
      <path d="M-1.15,-.84H1.15" stroke="#e3e1d5" stroke-width=".09" stroke-dasharray=".18 .15"/><path d="M-1.1,-.65H-.86M.86,-.65H1.1" stroke="${light}" stroke-width=".11"/>${indicator}`;
  const van = car.kind === 'van', suv = car.kind === 'suv';
  const height = van ? 2.05 : suv ? 1.73 : 1.45;
  const roof = van ? .83 : suv ? .75 : .68;
  const glassBase = van ? 1.12 : suv ? 1.03 : .93;
  return `<ellipse cy="-.01" rx="1.04" ry=".13" fill="#040810" opacity=".5"/>
    <path d="M-.82,0V-.49M.82,0V-.49" stroke="#11191f" stroke-width=".22"/>
    <path d="M-.94,-.3V-.79Q-.94,-.94-.84,-1.02L-${roof},-${height - .14}Q-.6,-${height} 0,-${height}Q.6,-${height} ${roof},-${height - .14}L.84,-1.02Q.94,-.94 .94,-.79V-.3Q.85,-.19 .65,-.19H-.65Q-.85,-.19-.94,-.3Z" fill="${paint}" stroke="#23303a" stroke-width=".025"/>
    <path d="M-${roof - .08},-${height - .17}Q0,-${height - .1} ${roof - .08},-${height - .17}L.73,-${glassBase}Q0,-${glassBase - .045}-.73,-${glassBase}Z" fill="#233640"/>
    <path d="M-${roof - .08},-${height - .18}Q0,-${height - .12} ${roof - .08},-${height - .18}" stroke="#aeb9bd" stroke-width=".02" fill="none"/>
    <path d="M-.9,-.81Q0,-.72 .9,-.81M-.88,-.38Q0,-.31 .88,-.38" fill="none" stroke="#202e37" stroke-opacity=".5" stroke-width=".025"/>
    <path d="M-.91,-.78H-.54V-.65H-.9ZM.91,-.78H.54V-.65H.9Z" fill="${light}"/>
    <path d="M-.85,-1.02H-1.04V-.94H-.9M.85,-1.02H1.04V-.94H.9" fill="${paint}"/>
    <path d="M-.9,-.3Q0,-.23 .9,-.3" stroke="#253139" stroke-width=".09" fill="none"/>
    ${front ? '<path d="M-.43,-.65H.43L.34,-.4H-.34Z" fill="#17232b"/>' : '<rect x="-.18" y="-.58" width=".36" height=".11" rx=".014" fill="#d8ddda"/>'}
    ${!front && car.braking ? `<path d="M-.16,-${glassBase + .04}H.16" stroke="#ff5e5e" stroke-width=".035"/>` : ''}
    ${suv ? `<path d="M-.67,-${height + .015}H.67" stroke="#65737b" stroke-width=".035"/>` : ''}
    ${van ? '<path d="M0,-1.85V-.68" stroke="#647278" stroke-width=".02"/>' : ''}${indicator}`;
}

export function cyclistSvg(id: number, time: number): string {
  const pedal = Math.sin(time * 5 + id) * .12;
  return `<ellipse rx=".4" ry=".08" fill="#081615" opacity=".4"/><path d="M0,-.65V-.06" stroke="#111c24" stroke-width=".07"/>
    <path d="M0,-.66L-.23,-.87M0,-.66L.23,-.87" stroke="#9ba9ac" stroke-width=".035"/>
    <path d="M-.15,-.83L-.2,-${.4 + pedal}L-.06,-.3M.15,-.83L.2,-${.4 - pedal}L.06,-.3" fill="none" stroke="#334350" stroke-width=".085"/>
    <path d="M-.22,-.86L-.17,-1.25Q0,-1.35 .17,-1.25L.22,-.86Z" fill="${id % 2 ? '#d9a55f' : '#72abb0'}"/>
    <path d="M-.16,-1.22L-.3,-1M.16,-1.22L.3,-1" stroke="#b8977c" stroke-width=".075"/>
    <path d="M-.33,-1H.33" stroke="#889898" stroke-width=".035"/><ellipse cy="-1.47" rx=".14" ry=".16" fill="#d5ddd5"/>
    <path d="M-.1,-1.55H.1" stroke="#829599" stroke-width=".025"/><rect x="-.06" y="-.76" width=".12" height=".065" fill="#d2443e"/>`;
}
