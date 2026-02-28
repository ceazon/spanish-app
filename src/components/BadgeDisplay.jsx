// Spanish-app/src/components/BadgeDisplay.jsx

import React from 'react';
import { BADGES } from '../services/badges';

const Badge = ({ badgeId }) => {
  const badge = BADGES[badgeId];
  if (!badge) {
    return null; // Don't render if badge ID is invalid
  }

  const emoji = badge.name.split(' ')[0];

  return (
    <div title={`${badge.name}\n${badge.description}`} style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      padding: '16px',
      textAlign: 'center',
      transition: 'transform 0.2s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ fontSize: '48px' }}>{emoji}</div>
      <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
        {badge.name.substring(badge.name.indexOf(' ') + 1)}
      </div>
    </div>
  );
};

export function BadgeDisplay({ earnedBadges }) {
  if (!earnedBadges || earnedBadges.length === 0) {
    return (
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px", textAlign: 'center', color: '#9ca3af' }}>
         <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", marginTop: 0 }}>
          Your Badges
        </h3>
        <p>Your collection is just getting started! Complete lessons and hit milestones to earn badges.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px" }}>
      <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", marginTop: 0, marginBottom: 20 }}>
        Your Badges ({earnedBadges.length})
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '16px',
      }}>
        {earnedBadges.map(badgeId => (
          <Badge key={badgeId} badgeId={badgeId} />
        ))}
      </div>
    </div>
  );
}
