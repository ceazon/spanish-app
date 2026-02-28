// Spanish-app/src/components/AuthScreen.jsx
// This version restores the full Google SSO functionality.

import React, { useState, useEffect } from 'react';
import { PrimaryBtn } from './ui';
import { saveProfile, loadProfile } from '../services/storage';
import { INITIAL_USER_PROFILE_V3 } from '../config/cefr';

const MASCOT_ASSETS = { base: "/mascot/chadlingo-default.png" };

function MascotSpeechBubble({ text }) {
  return (
    <div style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.38)', borderRadius: 14, padding: "10px 12px", color: "#ddd6fe", fontSize: 12, fontWeight: 700, margin: "0 auto 10px", maxWidth: 300 }}>
      {text}
    </div>
  );
}

export function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  function showToast(msg, type="error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function decodeJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!googleClientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          const profileData = decodeJwt(response.credential);
          if (!profileData?.sub) {
            showToast("Google sign-in failed.");
            return;
          }
          
          // Use a simple profile lookup/creation for now
          let profile = loadProfile(); 
          if (!profile || !profile.displayName) {
             profile = {
                ...INITIAL_USER_PROFILE_V3,
                displayName: profileData.name || profileData.email,
                email: profileData.email,
             };
          }
          saveProfile(profile);
          onLogin(profile);
        },
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "outline", size: "large", width: '320' }
      );
    };
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, [googleClientId, onLogin]);

  async function handleUsernamePassword() {
    if (!username.trim()) return;
    setLoading(true);
    let profile = loadProfile();
    if (mode === 'login' && !profile) {
        profile = { ...INITIAL_USER_PROFILE_V3, displayName: username };
    } else {
        profile = { ...INITIAL_USER_PROFILE_V3, displayName: username };
    }
    saveProfile(profile);
    onLogin(profile);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Outfit', sans-serif" }}>
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, padding:"48px 40px", width:400 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
           <img src={MASCOT_ASSETS.base} alt="Chadlingo mascot" style={{ width:148, height:148 }} />
           <MascotSpeechBubble text={mode === "login" ? "¡Hola! Ready for today’s Spanish win?" : "Create your account!"} />
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
            {mode === 'login' && <div>
                <label style={{ color:"#9ca3af", fontSize:12, display:"block", marginBottom:6 }}>PASSWORD</label>
                <input type="password" placeholder="••••••••" style={{ width:"100%", padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }} />
            </div>}
          <PrimaryBtn onClick={handleUsernamePassword} disabled={loading}>{loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}</PrimaryBtn>
           <div style={{ color:"#6b7280", fontSize:11, textAlign:"center", marginTop:8 }}>or</div>
           <div id="google-signin-btn" style={{ display:"flex", justifyContent:"center" }} />
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
