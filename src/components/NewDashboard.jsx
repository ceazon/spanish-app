// Spanish-app/src/components/NewDashboard.jsx

import React from 'react';
import { CEFR_LEVELS, LEVEL_TITLES } from '../config/cefr';
import { PrimaryBtn } from './ui'; // Reusing the button component

/**
 * A reusable progress bar component for the new dashboard.
 */
const StatBar = ({ label, value, max, color, unit = '' }) => (
  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px" }}>
    <div style={{ color: "#9ca3af", fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>{label.toUpperCase()}</div>
    <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>
      {value}{unit}
    </div>
    {max && (
      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ height: "100%", borderRadius: 6, width: `${(value / max) * 100}%`, background: color, transition: "width 0.5s" }} />
      </div>
    )}
  </div>
);

export function NewDashboard({ profile, onStartLesson, onLogout }) {
  if (!profile) {
    return <div>Loading profile...</div>;
  }

  const {
    cefrBand,
    sublevel,
    bandProgress,
    bandStrength,
    streak,
    totalWordsIntroduced,
    totalCorrect,
    totalAttempts,
  } = profile;

  const levelTitle = LEVEL_TITLES[cefrBand]?.[sublevel] || 'Learner';
  const nextLevelTitle = LEVEL_TITLES[cefrBand]?.[sublevel + 1] || 'the next level';
  const overallLevel = ((CEFR_LEVELS[cefrBand] || 0) * 10) + sublevel + 1;
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 20px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ color: "#a78bfa", fontSize: 12, letterSpacing: 2 }}>LEVEL {overallLevel} OF 40</div>
          <h1 style={{ color: "#fff", margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 32 }}>
            🌟 {levelTitle}
          </h1>
        </div>
        <button onClick={onLogout} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>
          Sign Out
        </button>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Left Column: Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding: "16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <div style={{ color:"#9ca3af", fontSize:11, letterSpacing:1 }}>PROGRESS TO {nextLevelTitle.toUpperCase()}</div>
              <div style={{ color:"#fff", fontWeight: "bold" }}>{Math.floor(bandProgress * 100)}%</div>
            </div>
            <div style={{ background:"rgba(0,0,0,0.2)", borderRadius: 6, height: 10, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: "100%", borderRadius: 6, width: `${bandProgress * 100}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)", transition: "width 0.5s" }} />
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding: "16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <div style={{ color:"#9ca3af", fontSize:11, letterSpacing:1 }}>{CEFR_LEVELS[cefrBand].toUpperCase()} STRENGTH</div>
              <div style={{ color:"#fff", fontWeight: "bold" }}>{bandStrength} / 10</div>
            </div>
            <div style={{ background:"rgba(0,0,0,0.2)", borderRadius: 6, height: 10, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: "100%", borderRadius: 6, width: `${bandStrength * 10}%`, background: "linear-gradient(90deg, #16a34a, #22c55e)", transition: "width 0.5s" }} />
            </div>
          </div>
        </div>
        
        {/* Right Column: Key Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatBar label="Streak" value={`${streak}d`} color="#ef4444" />
            <StatBar label="Words Seen" value={totalWordsIntroduced} color="#f59e0b" />
            <StatBar label="Accuracy" value={accuracy} unit="%" color="#22c55e" />
        </div>
      </div>

      {/* Call to Action */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <PrimaryBtn onClick={() => onStartLesson('flashcard')} style={{ padding: "16px 48px", fontSize: 18 }}>
          Start Next Lesson
        </PrimaryBtn>
        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>Let's keep building your streak!</p>
      </div>

      {/* TODO: Add Journey Map and Badge Display components here in the future */}

    </div>
  );
}
