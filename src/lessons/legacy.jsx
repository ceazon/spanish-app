// Spanish-app/src/lessons/legacy.jsx
// This file contains lesson components extracted from the pre-rewrite App.jsx

import React, { useState, useEffect, useRef } from 'react';
import { PrimaryBtn, ProgressBar, FeedbackBanner } from '../components/ui';
import { shuffle, speak } from '../services/utils';

// Note: These components are restored to work with the new architecture.
// They still rely on static data passed via props for now.

export function VerbLesson({ onComplete, verbs }) {
  const [vi, setVi] = useState(() => Math.floor(Math.random() * verbs.length));
  const [phase, setPhase] = useState("intro");
  const [pi, setPi] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const verb = verbs[vi];

  function nextQ(ok) {
    const newScore = score + (ok ? 1 : 0);
    setScore(newScore);
    const nextPi = pi + 1;
    if (nextPi >= verb.conjugations.length) {
      onComplete(newScore * 15, newScore, verb.conjugations.length);
    } else {
      setPi(nextPi);
      setInput("");
      setFeedback(null);
    }
  }

  function check() {
    if (!input.trim() || feedback) return;
    const ok = input.trim().toLowerCase() === verb.conjugations[pi].form.toLowerCase();
    setFeedback(ok ? "correct" : "incorrect");
    setTimeout(() => nextQ(ok), 1200);
  }

  if (phase === "intro") {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Intro UI for the verb */}
        <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: "28px" }}>
             <div style={{ color:"#fff", fontSize:40, fontFamily:"'Playfair Display', serif" }}>{verb.infinitive}</div>
             <div style={{ color:"#d1d5db", fontSize:16 }}>{verb.meaning}</div>
        </div>
        <PrimaryBtn onClick={() => setPhase("practice")} style={{ flex: 2 }}>Practice This Verb →</PrimaryBtn>
      </div>
    );
  }

  const currentConjugation = verb.conjugations[pi];
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
      <ProgressBar current={pi + 1} total={verb.conjugations.length} />
       <div style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"32px 28px", textAlign:"center" }}>
        <div style={{ color:"#a78bfa", fontWeight:700 }}>{verb.infinitive} → {currentConjugation.pronoun}</div>
      </div>
      <FeedbackBanner feedback={feedback} correctAnswer={currentConjugation.form} />
      {!feedback && (
        <div style={{ display:"flex", gap:12, width:"100%" }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} autoFocus style={{ flex:1, padding:"13px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }} />
          <PrimaryBtn onClick={check}>Check</PrimaryBtn>
        </div>
      )}
    </div>
  );
}

export function SentenceScrambleLesson({ onComplete, scrambleSentences }) {
  const [items] = useState(() => shuffle(scrambleSentences).slice(0, 5));
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState([]);
  const [pool, setPool] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    setPool(shuffle([...items[idx].words]));
    setChosen([]);
    setFeedback(null);
  }, [idx, items]);

  function check() {
    const ok = chosen.join(" ") === items[idx].correct;
    setFeedback(ok ? "correct" : "incorrect");
    const newScore = score + (ok ? 1 : 0);
    if (ok) setScore(newScore);
    setTimeout(() => {
      if (idx + 1 >= items.length) onComplete(newScore * 15, newScore, items.length);
      else setIdx(i => i + 1);
    }, 1500);
  }

  return (
     <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:520, margin:"0 auto" }}>
      <ProgressBar current={idx + 1} total={items.length} />
      <div style={{ minHeight: 58, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `2px solid ${feedback === "correct" ? "#22c55e" : feedback === "incorrect" ? "#ef4444" : "rgba(124,58,237,0.3)"}` }}>
        {chosen.join(' ') || <span style={{ color: "#6b7280" }}>...</span>}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {pool.map((w, i) => <button key={i} onClick={() => { setPool(p => p.filter((_, pi) => pi !== i)); setChosen(c => [...c, w]); }} style={{ padding:"8px 14px", borderRadius:10, background:"rgba(255,255,255,0.07)", color:"#e5e7eb" }}>{w}</button>)}
      </div>
      <PrimaryBtn onClick={check} disabled={!chosen.length || !!feedback}>Check Sentence</PrimaryBtn>
    </div>
  );
}
