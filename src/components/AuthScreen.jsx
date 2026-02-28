// Spanish-app/src/components/AuthScreen.jsx
// This component is restored from the pre-rewrite version of App.jsx

import React, { useState, useEffect } from 'react';
import { PrimaryBtn } from './ui';
import { saveProfile, loadProfile } from '../services/storage';
import { INITIAL_USER_PROFILE_V3 } from '../config/cefr';

const MASCOT_ASSETS = {
  base: "/mascot/chadlingo-default.png",
};

// A simplified version of the MascotSpeechBubble, co-located for simplicity
function MascotSpeechBubble({ text }) {
  return (
    <div style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.38)', borderRadius: 14, padding: "10px 12px", color: "#ddd6fe", fontSize: 12, fontWeight: 700, lineHeight: 1.35, margin: "0 auto 10px", maxWidth: 300 }}>
      {text}
    </div>
  );
}

export function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // A simplified handler. In a real app, this would involve a backend call.
  async function handleAuth() {
    if (!username.trim()) return;
    setLoading(true);
    
    // This is a mock auth system. It checks if a profile exists or creates a new one.
    let profile = loadProfile(); // Uses our new storage service

    if (mode === 'login') {
      // In our simple localStorage model, we just load the profile.
      // A real app would verify username/password against a backend.
      if (!profile) {
        console.error("No profile found for login, creating a new one.");
        profile = { ...INITIAL_USER_PROFILE_V3, displayName: username };
      }
    } else { // Register
      profile = { ...INITIAL_USER_PROFILE_V3, displayName: username };
    }

    saveProfile(profile);
    onLogin(profile);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Outfit', sans-serif", backgroundImage:"radial-gradient(ellipse at 20% 50%, #1a0a3e 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0a1a3e 0%, transparent 50%)" }}>
      <div style={{ background:"rgba(255,255,255,0.04)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, padding:"48px 40px", width:400 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
           <img src={MASCOT_ASSETS.base} alt="Chadlingo mascot" style={{ width:148, height:148, objectFit:"contain", marginBottom:10 }} />
           <MascotSpeechBubble text={mode === "login" ? "¡Hola! Ready for today’s Spanish win?" : "Create your account to start your streak!"} />
          <h1 style={{ color:"#fff", margin:0, fontFamily:"'Playfair Display', serif", fontSize:34 }}>Chadlingo</h1>
        </div>
        <div style={{ display:"flex", background:"rgba(255,255,255,0.06)", borderRadius:12, padding:4, marginBottom:28 }}>
          {["login","register"].map(m => <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"10px 0", borderRadius:9, background:mode===m?"#7c3aed":"transparent", color:mode===m?"#fff":"#9ca3af" }}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>)}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ color:"#9ca3af", fontSize:12, display:"block", marginBottom:6 }}>USERNAME</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your username" style={{ width:"100%", padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }} />
            </div>
            {/* Password field is mocked for this simplified auth */}
            {mode === 'login' && <div>
                <label style={{ color:"#9ca3af", fontSize:12, display:"block", marginBottom:6 }}>PASSWORD</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width:"100%", padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }} />
            </div>}
          <PrimaryBtn onClick={handleAuth} disabled={loading}>{loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}</PrimaryBtn>
           <div style={{ color:"#6b7280", fontSize:11, textAlign:"center", marginTop:8 }}>or</div>
           {/* Placeholder for Google SSO */}
           <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", textAlign: 'center', fontSize: 14 }}>
                Sign In with Google (Coming Soon)
           </div>
          <div style={{ textAlign:"center", marginTop:14 }}>
            <a href="/blog" style={{ color:"#ddd6fe", fontSize:14 }}>
              Explore the Community Learning Blog →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
