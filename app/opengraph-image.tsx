import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Sunnylink Wiki — The Complete openpilot & Sunnypilot Reference';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Glow effects */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '200px',
            background: 'rgba(6, 182, 212, 0.15)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '300px',
            width: '400px',
            height: '400px',
            borderRadius: '200px',
            background: 'rgba(139, 92, 246, 0.15)',
            filter: 'blur(80px)',
          }}
        />

        {/* Top Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 20px',
            borderRadius: '9999px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            color: '#22d3ee',
            fontSize: '18px',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          <span>SUNNYPILOT & OPENPILOT ADAS DATABASE</span>
        </div>

        {/* Center Main Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: 0,
              background: 'linear-gradient(to right, #ffffff, #94a3b8)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Sunnylink Wiki
          </h1>
          <p
            style={{
              fontSize: '26px',
              color: '#94a3b8',
              margin: 0,
              maxWidth: '900px',
              lineHeight: 1.4,
            }}
          >
            The complete community guide to 136+ driving models, 100+ toggles, MADS/NNLC controls, and 330+ supported vehicles.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              fontSize: '18px',
              fontWeight: 500,
              color: '#cbd5e1',
            }}
          >
            🧠 136+ Driving Models
          </div>
          <div
            style={{
              display: 'flex',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              fontSize: '18px',
              fontWeight: 500,
              color: '#cbd5e1',
            }}
          >
            🚗 330+ Compatible Cars
          </div>
          <div
            style={{
              display: 'flex',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              fontSize: '18px',
              fontWeight: 500,
              color: '#cbd5e1',
            }}
          >
            ⚙️ 100+ Toggles & Settings
          </div>
          <div
            style={{
              display: 'flex',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              fontSize: '18px',
              fontWeight: 500,
              color: '#38bdf8',
            }}
          >
            🌐 sunnylink.wiki
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
