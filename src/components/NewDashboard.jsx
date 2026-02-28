// Spanish-app/src/components/NewDashboard.jsx
// Final version with dynamic lesson grid

import React, { useState } from 'react';
import { CEFR_LEVELS, LEVEL_TITLES } from '../config/cefr';
import { LESSON_META, LESSON_GROUPS } from '../config/lessons-meta';
import { JourneyMap } from './JourneyMap';
import { BadgeDisplay } from './BadgeDisplay';

// ... (StatBar component remains the same)
const StatBar = ({ label, value, max, color, unit = '' }) => (
  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px" }}>
    <div style={{ color: "#9ca3af", fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>{label.toUpperCase()}</div>
    <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>
      {value}{unit}
    </div>
  </div>
);


const LessonButton = ({ type, onClick }) => {
    const meta = LESSON_META[type] || { icon: '❓' };
    const typeTitle = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return (
        <button onClick={() => onClick(type)} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"18px 16px", textAlign:"left"}}>
            <div style={{fontSize: 24, marginBottom: 8}}>{meta.icon}</div>
            <div style={{color: "#fff", fontWeight: 700, fontSize: 13}}>{typeTitle}</div>
        </button>
    );
};

export function NewDashboard({ profile, onStartLesson, onLogout }) {
  const [showJourney, setShowJourney] = useState(false);

  if (!profile) return <div>Loading profile...</div>;

  const { cefrBand, sublevel, bandProgress, bandStrength, streak, totalWordsIntroduced, totalCorrect, totalAttempts, badges } = profile;
  const levelTitle = LEVEL_TITLES[cefrBand]?.[sublevel] || 'Learner';
  const overallLevel = (['A1', 'A2', 'B1', 'B2'].indexOf(cefrBand) * 10) + sublevel + 1;
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 20px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ color: "#a78bfa", fontSize: 12, letterSpacing: 2 }}>LEVEL {overallLevel} OF 40</div>
          <h1 style={{ color: "#fff", margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 32 }}>🌟 {levelTitle}</h1>
        </div>
        <button onClick={onLogout} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>Sign Out</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <StatBar label="Progress to Next Level" value={Math.floor(bandProgress * 100)} max={100} unit="%" color="linear-gradient(90deg, #7c3aed, #a855f7)" />
             <StatBar label={`${CEFR_LEVELS[cefrBand]} Strength`} value={bandStrength} max={10} color="linear-gradient(90deg, #16a34a, #22c55e)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatBar label="Streak" value={`${streak}d`} />
            <StatBar label="Words Seen" value={totalWordsIntroduced} />
            <StatBar label="Accuracy" value={accuracy} unit="%" />
        </div>
      </div>
      
      {LESSON_GROUPS.map(group => (
        <div key={group} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px", marginBottom: 28 }}>
            <div style={{ color: "#e5e7eb", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{group}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                {Object.keys(LESSON_META).filter(type => LESSON_META[type].group === group).map(type => (
                    <LessonButton key={type} type={type} onClick={onStartLesson} />
                ))}
            </div>
        </div>
      ))}

      <div style={{ marginTop: 24 }}>
        <button onClick={() => setShowJourney(s => !s)} style={{ width: '100%', textAlign: 'center', color: '#a78bfa', fontSize: 14, fontWeight: 'bold', marginBottom: 16 }}>
          {showJourney ? 'Hide' : 'Show'} Full Journey Map {showJourney ? '↑' : '↓'}
        </button>
        {showJourney && <JourneyMap profile={profile} />}
      </div>
      <div style={{ marginTop: 24 }}>
        <BadgeDisplay earnedBadges={badges} />
      </div>
    </div>
  );
}
