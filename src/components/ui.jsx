import React from "react";

export function Toast({ msg, type }) {
  if (!msg) return null;
  return <div style={{ position:"fixed", top:24, right:24, zIndex:1000, background:type==="success"?"#22c55e":type==="error"?"#ef4444":"#f59e0b", color:"#fff", padding:"12px 20px", borderRadius:12, fontFamily:"'Outfit', sans-serif", fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,0.3)", animation:"slideIn 0.3s ease" }}>{msg}</div>;
}

export function ProgressBar({ current, total }) {
  return (
    <div style={{ width:"100%", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ color:"#a78bfa", fontSize:12, fontWeight:600 }}>{current} / {total}</span>
        <span style={{ color:"#6b7280", fontSize:12 }}>{Math.round(current/total*100)}%</span>
      </div>
      <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:4, height:4 }}>
        <div style={{ height:"100%", borderRadius:4, width:`${(current/total)*100}%`, background:"linear-gradient(90deg, #7c3aed, #a855f7)", transition:"width 0.4s" }} />
      </div>
    </div>
  );
}

export function FeedbackBanner({ feedback, correctAnswer }) {
  if (!feedback) return null;
  const ok = feedback === "correct"; const partial = feedback === "partial";
  return (
    <div style={{ padding:"14px 20px", borderRadius:14, textAlign:"center", background:ok?"rgba(34,197,94,0.12)":partial?"rgba(245,158,11,0.12)":"rgba(239,68,68,0.12)", border:`1px solid ${ok?"#22c55e44":partial?"#f59e0b44":"#ef444444"}` }}>
      <div style={{ fontSize:18, fontWeight:800, color:ok?"#4ade80":partial?"#fbbf24":"#f87171", marginBottom:ok?0:6 }}>{ok?"✓ ¡Correcto!":partial?"~ Almost!":"✗ Not quite"}</div>
      {!ok && correctAnswer && <div style={{ color:"#d1d5db", fontSize:14 }}>Answer: <strong style={{ color:"#fff" }}>{correctAnswer}</strong></div>}
    </div>
  );
}

export function PrimaryBtn({ children, onClick, disabled, style = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding:"13px 24px", borderRadius:12, fontSize:14, fontWeight:700, background:disabled?"rgba(255,255,255,0.06)":"linear-gradient(135deg, #7c3aed, #a855f7)", color:disabled?"#6b7280":"#fff", fontFamily:"'Outfit', sans-serif", boxShadow:disabled?"none":"0 4px 16px #7c3aed44", cursor:disabled?"not-allowed":"pointer", ...style }}>{children}</button>;
}

export function TextInput({ value, onChange, onEnter, placeholder, disabled, large }) {
  const Tag = large ? "textarea" : "input";
  return <Tag value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => !large && e.key==="Enter" && onEnter && onEnter()} placeholder={placeholder} disabled={disabled} rows={large?3:undefined}
    style={{ width:"100%", padding:"13px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:15, fontFamily:"'Outfit', sans-serif", resize:large?"none":"undefined", outline:"none" }} />;
}
