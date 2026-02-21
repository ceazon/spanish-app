import React, { useEffect, useState } from "react";
import { shuffle, speak } from "../services/utils";
import { FeedbackBanner, PrimaryBtn, ProgressBar } from "../components/ui";

export function FlashcardLesson({ words, onComplete }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState("en→es");
  const [scores, setScores] = useState([]);
  const [micListening, setMicListening] = useState(false);
  const [micText, setMicText] = useState("");
  const [micScore, setMicScore] = useState(null);
  const [micError, setMicError] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const card = words[idx];
  const spanishTarget = card.es;

  function normalize(text) {
    return text.toLowerCase().replace(/[¿¡.,!?]/g, "").trim();
  }

  function calcScore(spoken, target) {
    const a = normalize(spoken).split(" ").filter(Boolean);
    const b = normalize(target).split(" ").filter(Boolean);
    if (!a.length || !b.length) return 0;
    const overlap = a.filter(w => b.includes(w)).length;
    return Math.round((overlap / b.length) * 100);
  }

  function speakTarget() {
    speak(spanishTarget, 0.85);
  }

  function recordAndCheck() {
    setMicError(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Speech recognition not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setMicListening(true);
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      setMicText(transcript);
      setMicScore(calcScore(transcript, spanishTarget));
      setMicListening(false);
    };
    rec.onerror = () => { setMicListening(false); setMicError("Mic capture failed. Try again."); };
    rec.onend = () => setMicListening(false);
    rec.start();
  }

  function nextCard() {
    const base = micScore === null ? 0 : Math.round(micScore / 5); // 0-20 points
    const earned = hintUsed ? Math.round(base * 0.7) : base;
    const newScores = [...scores, earned];
    setScores(newScores);
    if (idx + 1 >= words.length) {
      const totalPts = newScores.reduce((s, n) => s + n, 0);
      const correct = newScores.filter(n => n >= 14).length; // ~70%
      onComplete(totalPts, correct, words.length);
    } else {
      setFlipped(false);
      setMicText("");
      setMicScore(null);
      setMicError(null);
      setShowHint(false);
      setHintUsed(false);
      setTimeout(() => setIdx(idx + 1), 100);
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <span style={{ color:"#9ca3af", fontSize:13 }}>Direction:</span>
        {["en→es","es→en"].map(d => <button key={d} onClick={() => { setDir(d); setFlipped(false); setMicScore(null); setMicText(""); setMicError(null); setShowHint(false); setHintUsed(false); }} style={{ padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:600, background:dir===d?"#7c3aed":"rgba(255,255,255,0.06)", color:dir===d?"#fff":"#9ca3af", fontFamily:"'Outfit', sans-serif" }}>{d}</button>)}
      </div>
      <ProgressBar current={idx+1} total={words.length} />
      <div onClick={() => setFlipped(!flipped)} style={{ width:320, height:200, perspective:1000, cursor:"pointer" }}>
        <div style={{ width:"100%", height:"100%", position:"relative", transformStyle:"preserve-3d", transition:"transform 0.5s", transform:flipped?"rotateY(180deg)":"rotateY(0deg)" }}>
          {[false, true].map(back => (
            <div key={String(back)} style={{ position:"absolute", width:"100%", height:"100%", backfaceVisibility:"hidden", borderRadius:20, background:back?"linear-gradient(135deg, #14532d33, #166534aa)":"linear-gradient(135deg, #1e1347, #2d1b69)", border:`1px solid ${back?"#22c55e55":"#7c3aed55"}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, transform:back?"rotateY(180deg)":"none" }}>
              <div style={{ color:back?"#86efac":"#a78bfa", fontSize:12, fontWeight:600, letterSpacing:2 }}>{(dir==="en→es"?!back:back)?"ENGLISH":"ESPAÑOL"}</div>
              <div style={{ color:"#fff", fontSize:32, fontWeight:700, fontFamily:"'Playfair Display', serif" }}>{dir==="en→es"?(back?card.es:card.en):(back?card.en:card.es)}</div>
              {!back && <div style={{ color:"#6b7280", fontSize:12 }}>tap to flip</div>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ width:"100%", maxWidth:420, display:"flex", flexDirection:"column", gap:10 }}>
        {!flipped && <div style={{ color:"#a78bfa", fontSize:12 }}>Try pronunciation before flipping the card.</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={speakTarget} style={{ flex:1, padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#e5e7eb", fontWeight:700 }}>🔊 Hear Spanish</button>
          <button onClick={() => { setShowHint(v => !v); setHintUsed(true); }} style={{ flex:1, padding:"12px 14px", borderRadius:10, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24", fontWeight:700 }}>
            {showHint ? "🙈 Hide hint" : "💡 Show hint (-30%)"}
          </button>
        </div>
        {showHint && <div style={{ color:"#fbbf24", fontSize:13 }}>Hint word: <strong>{spanishTarget}</strong></div>}

        <PrimaryBtn onClick={recordAndCheck} disabled={micListening}>{micListening ? "Listening..." : "🎙️ Pronounce & check"}</PrimaryBtn>
        {micError && <div style={{ color:"#f87171", fontSize:12 }}>{micError}</div>}
        {micText && <div style={{ color:"#9ca3af", fontSize:12 }}>Heard: <span style={{ color:"#e5e7eb" }}>{micText}</span></div>}
        {micScore !== null && (
          <div style={{ color: micScore >= 70 ? "#4ade80" : "#fbbf24", fontSize:13, fontWeight:700 }}>
            Pronunciation score: {micScore}% {micScore >= 70 ? "✓" : "(keep practicing)"} {hintUsed ? "• hint penalty active" : ""}
          </div>
        )}
        <PrimaryBtn onClick={nextCard} disabled={micScore === null && !micError}>Next card →</PrimaryBtn>
      </div>
    </div>
  );
}

export function WordMatchLesson({ words, onComplete, difficulty = 1 }) {
  const targetPairs = Math.max(4, Math.min(10, Math.round(3 + difficulty)));
  const pool = words.slice(0, Math.min(targetPairs, words.length));
  const [left] = useState(() => shuffle(pool)); const [right] = useState(() => shuffle(pool));
  const [selL, setSelL] = useState(null); const [selR, setSelR] = useState(null);
  const [matched, setMatched] = useState([]); const [wrong, setWrong] = useState([]);
  const [errors, setErrors] = useState(0);
  useEffect(() => {
    if (selL && selR) {
      if (selL.es === selR.es) {
        const nm = [...matched, selL.en]; setMatched(nm); setSelL(null); setSelR(null);
        if (nm.length === pool.length) onComplete(Math.max(0, pool.length*15-errors*5), pool.length, pool.length);
      } else { setWrong([selL.en, selR.en]); setErrors(e => e+1); setTimeout(() => { setWrong([]); setSelL(null); setSelR(null); }, 800); }
    }
  }, [selL, selR]);
  function bs(word, sel) {
    const m=matched.includes(word.en), w=wrong.includes(word.en), s=sel&&sel.en===word.en;
    return { padding:"12px 20px", borderRadius:10, fontSize:14, fontWeight:600, fontFamily:"'Outfit', sans-serif", cursor:m?"default":"pointer", transition:"all 0.2s", width:140, textAlign:"center",
      background:m?"rgba(34,197,94,0.15)":w?"rgba(239,68,68,0.15)":s?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)",
      border:`1px solid ${m?"#22c55e66":w?"#ef444466":s?"#a855f7":"rgba(255,255,255,0.08)"}`,
      color:m?"#4ade80":w?"#f87171":s?"#c4b5fd":"#e5e7eb", opacity:m?0.5:1 };
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
      <div style={{ color:"#9ca3af", fontSize:13 }}>Match English → Spanish • Errors: {errors}</div>
      <div style={{ display:"flex", gap:40 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ color:"#a78bfa", fontSize:11, fontWeight:700, letterSpacing:2, textAlign:"center", marginBottom:4 }}>ENGLISH</div>
          {left.map(w => <button key={w.en} onClick={() => !matched.includes(w.en) && setSelL(w)} style={bs(w, selL)}>{w.en}</button>)}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ color:"#f59e0b", fontSize:11, fontWeight:700, letterSpacing:2, textAlign:"center", marginBottom:4 }}>ESPAÑOL</div>
          {right.map(w => <button key={w.es} onClick={() => !matched.includes(w.en) && setSelR(w)} style={bs(w, selR)}>{w.es}</button>)}
        </div>
      </div>
    </div>
  );
}

export function FillBlankLesson({ onComplete, sentences = [] }) {
  const [items] = useState(() => shuffle(sentences).slice(0,5));
  const [idx, setIdx] = useState(0); const [input, setInput] = useState(""); const [feedback, setFeedback] = useState(null); const [score, setScore] = useState(0);
  function check() {
    if (!input.trim()) return;
    const ok = input.trim().toLowerCase() === items[idx].answer.toLowerCase();
    setFeedback(ok?"correct":"incorrect");
    const ns = ok?score+1:score; if(ok) setScore(ns);
    setTimeout(() => { if(idx+1>=items.length) onComplete(ns*20,ns,items.length); else { setFeedback(null); setInput(""); setIdx(i=>i+1); } }, 1200);
  }
  const s=items[idx]; const parts=s.template.split("___");
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, maxWidth:480, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"24px 28px", textAlign:"center", width:"100%" }}>
        <div style={{ color:"#9ca3af", fontSize:12, marginBottom:12, letterSpacing:1 }}>HINT: {s.hint}</div>
        <div style={{ color:"#e5e7eb", fontSize:22, fontWeight:500, lineHeight:1.6 }}>
          {parts[0]}<span style={{ display:"inline-block", minWidth:80, borderBottom:"2px solid #7c3aed", color:feedback==="correct"?"#4ade80":feedback==="incorrect"?"#f87171":"#a78bfa", fontWeight:700, padding:"0 4px" }}>{feedback?s.answer:input||" "}</span>{parts[1]}
        </div>
      </div>
      <FeedbackBanner feedback={feedback} correctAnswer={s.answer} />
      <div style={{ display:"flex", gap:12, width:"100%" }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} placeholder="Type the Spanish word…" disabled={!!feedback} style={{ flex:1, padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:15, fontFamily:"'Outfit', sans-serif" }} />
        <PrimaryBtn onClick={check} disabled={!!feedback}>Check</PrimaryBtn>
      </div>
    </div>
  );
}
