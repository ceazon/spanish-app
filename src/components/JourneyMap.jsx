// Spanish-app/src/components/JourneyMap.jsx

import React from 'react';
import { CEFR_LEVELS, LEVEL_TITLES } from '../config/cefr';

const JourneyNode = ({ level, title, status, isLastInBand }) => {
  const statusStyles = {
    completed: {
      bg: 'linear-gradient(135deg, #16a34a, #22c55e)',
      border: '#22c55e',
      icon: '✓',
      textColor: '#dcfce7',
    },
    current: {
      bg: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      border: '#a855f7',
      icon: '▶',
      textColor: '#fff',
    },
    locked: {
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.1)',
      icon: '🔒',
      textColor: '#6b7280',
    },
  };

  const style = statusStyles[status] || statusStyles.locked;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: style.bg,
        border: `2px solid ${style.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
        flexShrink: 0,
        boxShadow: status === 'current' ? `0 0 15px ${style.border}` : 'none',
      }}>
        {style.icon}
      </div>
      <div>
        <div style={{ color: style.textColor, fontWeight: 'bold', fontSize: 14 }}>{title}</div>
        <div style={{ color: '#9ca3af', fontSize: 11 }}>Level {level}</div>
      </div>
      {!isLastInBand && (
        <div style={{
          position: 'absolute',
          left: 20,
          top: 40,
          height: '100%',
          width: 2,
          background: status === 'completed' ? style.border : 'rgba(255,255,255,0.1)',
        }} />
      )}
    </div>
  );
};

export function JourneyMap({ profile }) {
  const { cefrBand, sublevel } = profile;
  const bandsToShow = ['A1', 'A2']; // For now, we only show implemented bands
  const bandOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentBandIndex = bandOrder.indexOf(cefrBand);

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px" }}>
      <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700, marginBottom: 24, fontFamily: "'Playfair Display', serif" }}>
        Your Learning Journey
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bandsToShow.map((bandId, bandIdx) => (
          <div key={bandId}>
            <div style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 16, borderLeft: '3px solid #a78bfa', paddingLeft: 12 }}>
              {CEFR_LEVELS[bandId].toUpperCase()}
            </div>
            <div style={{ position: 'relative', display: 'grid', gap: 16, marginLeft: 20 }}>
              {LEVEL_TITLES[bandId].map((title, levelIdx) => {
                const overallLevel = (bandIdx * 10) + levelIdx + 1;
                let status = 'locked';
                if (bandIdx < currentBandIndex) {
                  status = 'completed';
                } else if (bandIdx === currentBandIndex) {
                  if (levelIdx < sublevel) status = 'completed';
                  else if (levelIdx === sublevel) status = 'current';
                }
                
                return (
                  <div key={title} style={{ position: 'relative' }}>
                    <JourneyNode
                      level={overallLevel}
                      title={title}
                      status={status}
                      isLastInBand={levelIdx === LEVEL_TITLES[bandId].length - 1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{textAlign: 'center', color: '#6b7280', fontSize: 13, marginTop: 16}}>
          More levels for B1 and B2 coming soon!
        </div>
      </div>
    </div>
  );
}
