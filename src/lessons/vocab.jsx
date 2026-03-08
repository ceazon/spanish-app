import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [answerMode, setAnswerMode] = useState("speak");
  const [typedText, setTypedText] = useState("");
  const [typedScore, setTypedScore] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const card = words[idx];
  const targetWord = dir === "en→es" ? card.es : card.en;
  const targetLabel = dir === "en→es" ? "Spanish" : "English";

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
    speak(targetWord, dir === "en→es" ? 0.85 : 0.95);
  }

  function recordAndCheck() {
    setMicError(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Speech recognition not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = dir === "en→es" ? "es-ES" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setMicListening(true);
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      setMicText(transcript);
      setMicScore(calcScore(transcript, targetWord));
      setMicListening(false);
    };
    rec.onerror = () => { setMicListening(false); setMicError("Mic capture failed. Try again."); };
    rec.onend = () => setMicListening(false);
    rec.start();
  }

  function checkTypedAnswer() {
    if (!typedText.trim()) return;
    setTypedScore(calcScore(typedText, targetWord));
  }

  function nextCard() {
    const bestScore = Math.max(micScore ?? 0, typedScore ?? 0);
    const base = bestScore === 0 ? 0 : Math.round(bestScore / 5); // 0-20 points
    const earned = hintUsed ? Math.round(base * 0.7) : base;
    const newScores = [...scores, earned];
    setScores(newScores);
    if (idx + 1 >= words.length) {
      const totalPts = newScores.reduce((s, n) => s + n, 0);
      const correct = newScores.filter(n => n >= 14).length; // ~70%
      const wordResults = words.map((w, i) => {
        const earned = newScores[i] || 0;
        const seen = 1;
        const correctHit = earned >= 14 ? 1 : 0;
        return { id: w.id || w.es, cefr: w.cefr || "A1", bucket: w._bucket || w.bucket || 'current', seen, correct: correctHit };
      });
      onComplete(totalPts, correct, words.length, { wordResults });
    } else {
      setFlipped(false);
      setMicText("");
      setMicScore(null);
      setMicError(null);
      setTypedText("");
      setTypedScore(null);
      setShowHint(false);
      setHintUsed(false);
      setTimeout(() => setIdx(idx + 1), 100);
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <span style={{ color:"#9ca3af", fontSize:13 }}>Direction:</span>
        {["en→es", "es→en"].map(d => <button key={d} onClick={() => { setDir(d); setFlipped(false); setMicScore(null); setMicText(""); setMicError(null); setTypedText(""); setTypedScore(null); setShowHint(false); setHintUsed(false); }} style={{ padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:600, background:dir===d?"#7c3aed":"rgba(255,255,255,0.06)", color:dir===d?"#fff":"#9ca3af", fontFamily:"'Outfit', sans-serif" }}>{d}</button>)}
      </div>
      <ProgressBar current={idx+1} total={words.length} />
      <div onClick={() => setFlipped(!flipped)} style={{ width:320, height:200, perspective:1000, cursor:"pointer" }}>
        <div style={{ width:"100%", height:"100%", position:"relative", transformStyle:"preserve-3d", transition:"transform 0.5s", transform:flipped?"rotateY(180deg)":"rotateY(0deg)" }}>
          {[false, true].map(back => (
            <div key={String(back)} style={{ position:"absolute", width:"100%", height:"100%", backfaceVisibility:"hidden", borderRadius:20, background:back?"linear-gradient(135deg, #14532d33, #166534aa)":"linear-gradient(135deg, #1e1347, #2d1b69)", border:`1px solid ${back?"#22c55e55":"#7c3aed55"}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, transform:back?"rotateY(180deg)":"none" }}>
              <div style={{ color:back?"#86efac":"#a78bfa", fontSize:12, fontWeight:600, letterSpacing:2 }}>{(dir==="en→es"?!back:back)?"ENGLISH":"ESPAÑOL"}</div>
              <div translate="no" className="notranslate" style={{ color:"#fff", fontSize:32, fontWeight:700, fontFamily:"'Playfair Display', serif" }}>{dir==="en→es"?(back?card.es:card.en):(back?card.en:card.es)}</div>
              {!back && <div style={{ color:"#6b7280", fontSize:12 }}>tap to flip</div>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ width:"100%", maxWidth:420, display:"flex", flexDirection:"column", gap:10 }}>
        {!flipped && <div style={{ color:"#a78bfa", fontSize:12 }}>Choose how you want to answer: speak or type.</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={speakTarget} style={{ flex:1, padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#e5e7eb", fontWeight:700 }}>🔊 Hear {targetLabel}</button>
          <button onClick={() => { setShowHint(v => !v); setHintUsed(true); }} style={{ flex:1, padding:"12px 14px", borderRadius:10, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24", fontWeight:700 }}>
            {showHint ? "🙈 Hide hint" : "💡 Show hint (-30%)"}
          </button>
        </div>
        {showHint && <div style={{ color:"#fbbf24", fontSize:13 }}>Hint word: <strong>{targetWord}</strong></div>}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => { setAnswerMode("speak"); setTypedScore(null); }} style={{ flex:1, padding:"8px 10px", borderRadius:8, background:answerMode==="speak"?"#7c3aed":"rgba(255,255,255,0.06)", color:answerMode==="speak"?"#fff":"#9ca3af", fontWeight:700 }}>🎙️ Speak</button>
          <button onClick={() => { setAnswerMode("type"); setMicScore(null); setMicText(""); setMicError(null); }} style={{ flex:1, padding:"8px 10px", borderRadius:8, background:answerMode==="type"?"#7c3aed":"rgba(255,255,255,0.06)", color:answerMode==="type"?"#fff":"#9ca3af", fontWeight:700 }}>⌨️ Type</button>
        </div>

        {answerMode === "speak" ? (
          <>
            <PrimaryBtn onClick={recordAndCheck} disabled={micListening}>{micListening ? "Listening..." : `🎙️ Pronounce & check`}</PrimaryBtn>
            {micError && <div style={{ color:"#f87171", fontSize:12 }}>{micError}</div>}
            {micText && <div style={{ color:"#9ca3af", fontSize:12 }}>Heard: <span style={{ color:"#e5e7eb" }}>{micText}</span></div>}
            {micScore !== null && (
              <div style={{ color: micScore >= 70 ? "#4ade80" : "#fbbf24", fontSize:13, fontWeight:700 }}>
                Pronunciation score: {micScore}% {micScore >= 70 ? "✓" : "(keep practicing)"} {hintUsed ? "• hint penalty active" : ""}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display:"flex", gap:8 }}>
              <input value={typedText} onChange={(e)=>setTypedText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&checkTypedAnswer()} placeholder={`Type the ${targetLabel} word`} style={{ flex:1, padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff" }} />
              <PrimaryBtn onClick={checkTypedAnswer}>Check</PrimaryBtn>
            </div>
            {typedScore !== null && (
              <div style={{ color: typedScore >= 70 ? "#4ade80" : "#fbbf24", fontSize:13, fontWeight:700 }}>
                Typing score: {typedScore}% {typedScore >= 70 ? "✓" : "(keep practicing)"} {hintUsed ? "• hint penalty active" : ""}
              </div>
            )}
          </>
        )}

        <PrimaryBtn onClick={nextCard} disabled={micScore === null && typedScore === null && !micError}>Next card →</PrimaryBtn>
      </div>
    </div>
  );
}

export function WordMatchLesson({ words, onComplete, difficulty = 1 }) {
  const targetPairs = Math.max(4, Math.min(12, Math.round(3 + difficulty * 1.4)));
  const [left, setLeft] = useState([]);
  const [right, setRight] = useState([]);
  const [selL, setSelL] = useState(null);
  const [selR, setSelR] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrong, setWrong] = useState([]);
  const [errors, setErrors] = useState(0);
  const settleTimerRef = useRef(null);
  const resolvingRef = useRef(false);

  const wordsSignature = useMemo(
    () => (Array.isArray(words) ? words.map((w) => `${w?.id || ''}:${w?.en || ''}:${w?.es || ''}`).join('|') : ''),
    [words]
  );

  useEffect(() => {
    const pool = (words || []).slice(0, Math.min(targetPairs, words?.length || 0));
    setLeft(shuffle(pool));
    setRight(shuffle(pool));
    setSelL(null);
    setSelR(null);
    setMatched([]);
    setWrong([]);
    setErrors(0);
    resolvingRef.current = false;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, [wordsSignature, targetPairs]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selL || !selR || resolvingRef.current) return;
    resolvingRef.current = true;

    if (selL.es === selR.es) {
      setMatched((prev) => {
        const nm = [...prev, token(selL)];
        if (nm.length === left.length && left.length > 0) {
          const basePerPair = 10 + Math.round(difficulty * 2);
          const penalty = 4 + Math.round(difficulty);
          const pts = Math.max(0, left.length * basePerPair - errors * penalty);
          const wordResults = left.map((w) => ({ id: w.id || w.es, cefr: w.cefr || "A1", bucket: w._bucket || w.bucket || 'current', seen: 1, correct: 1 }));
          onComplete(pts, left.length, left.length, { wordResults });
        }
        return nm;
      });
      setSelL(null);
      setSelR(null);
      resolvingRef.current = false;
    } else {
      setWrong([token(selL), token(selR)]);
      setErrors((e) => e + 1);
      settleTimerRef.current = setTimeout(() => {
        setWrong([]);
        setSelL(null);
        setSelR(null);
        resolvingRef.current = false;
      }, 800);
    }
  }, [selL, selR, left, difficulty, errors, onComplete]);

  function token(word) { return word?.id || `${word?.en || ''}:${word?.es || ''}`; }

  function bs(word, sel) {
    const t = token(word);
    const m=matched.includes(t), w=wrong.includes(t), s=sel&&token(sel)===t;
    return { padding:"12px 20px", borderRadius:10, fontSize:14, fontWeight:600, fontFamily:"'Outfit', sans-serif", cursor:m?"default":"pointer", transition:"all 0.2s", width:140, textAlign:"center",
      background:m?"rgba(34,197,94,0.15)":w?"rgba(239,68,68,0.15)":s?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)",
      border:`1px solid ${m?"#22c55e66":w?"#ef444466":s?"#a855f7":"rgba(255,255,255,0.08)"}`,
      color:m?"#4ade80":w?"#f87171":s?"#c4b5fd":"#e5e7eb", opacity:m?0.5:1 };
  }

  if (!words?.length) {
    return <div style={{ color:"#9ca3af", textAlign:"center" }}>No words available for this category yet.</div>;
  }

  if (!left.length || !right.length) {
    return <div style={{ color:"#9ca3af", textAlign:"center" }}>Preparing word match cards…</div>;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
      <div style={{ color:"#9ca3af", fontSize:13 }}>Match English → Spanish • Errors: {errors}</div>
      <div style={{ display:"flex", gap:40 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ color:"#a78bfa", fontSize:11, fontWeight:700, letterSpacing:2, textAlign:"center", marginBottom:4 }}>ENGLISH</div>
          {left.map(w => <button key={token(w)} onClick={() => !matched.includes(token(w)) && setSelL(w)} style={bs(w, selL)}>{w.en}</button>)}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ color:"#f59e0b", fontSize:11, fontWeight:700, letterSpacing:2, textAlign:"center", marginBottom:4 }}>ESPAÑOL</div>
          {right.map(w => <button key={`${token(w)}:r`} onClick={() => !matched.includes(token(w)) && setSelR(w)} style={bs(w, selR)}>{w.es}</button>)}
        </div>
      </div>
    </div>
  );
}

export function FillBlankLesson({ onComplete, sentences = [], difficulty = 1 }) {
  const target = Math.max(5, Math.min(10, 4 + Number(difficulty || 1)));
  const [items] = useState(() => shuffle(sentences).slice(0, Math.min(target, sentences.length)));
  const [idx, setIdx] = useState(0); const [input, setInput] = useState(""); const [feedback, setFeedback] = useState(null); const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  function check() {
    if (!items.length || !input.trim()) return;
    const ok = input.trim().toLowerCase() === items[idx].answer.toLowerCase();
    setFeedback(ok?"correct":"incorrect");
    const ns = ok?score+1:score; if(ok) setScore(ns);
    const item = items[idx];
    const nextResults = [...results, {
      id: item.wordId || item.answer,
      cefr: item.cefr || 'A1',
      bucket: item.bucket || item._bucket || 'current',
      seen: 1,
      correct: ok ? 1 : 0,
    }];
    setResults(nextResults);
    setTimeout(() => {
      if(idx+1>=items.length) {
        const perCorrect = 14 + Math.round((Number(difficulty || 1) - 1) * 1.5);
        onComplete(ns * perCorrect, ns, items.length, { wordResults: nextResults });
      } else { setFeedback(null); setInput(""); setIdx(i=>i+1); }
    }, 1200);
  }
  if (!items.length) {
    return <div style={{ color:"#9ca3af", textAlign:"center" }}>No sentence items available yet.</div>;
  }
  const s=items[idx]; const parts=s.template.split("___");
  const targetEnglish = s.targetEnglish || (typeof s.hint === 'string' && s.hint.includes('"')
    ? (s.hint.match(/"([^"]+)"/)?.[1] || null)
    : (typeof s.hint === 'string' && !s.hint.includes('___') && s.hint.trim().split(/\s+/).length <= 4 ? s.hint : null));
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, maxWidth:480, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"24px 28px", textAlign:"center", width:"100%" }}>
        {targetEnglish && <div style={{ color:"#67e8f9", fontSize:12, marginBottom:6, letterSpacing:1 }}>TARGET WORD: <strong>{targetEnglish}</strong></div>}
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
