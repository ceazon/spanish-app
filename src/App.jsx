import React, { useState, useEffect, useRef, useMemo } from "react";
// Removed old/unused imports like starterPack, VOCAB, etc. as they will be obsolete
import { LESSON_META, LESSON_TYPES, NO_CATEGORY } from "./config/lessons";
import { shuffle, speak } from "./services/utils";

// --- NEW IMPORTS FOR PROGRESSION SYSTEM ---
import { loadProfile, saveProfile } from "./services/storage";
import { updateProfileAfterSession } from "./services/progression";
import { DynamicLessonHost } from "./lessons/DynamicLessonHost";
import { NewDashboard } from "./components/NewDashboard";
// --- END NEW IMPORTS ---

import { Toast, ProgressBar, FeedbackBanner, PrimaryBtn, TextInput } from "./components/ui";

// NOTE: All old data constants (VOCAB, SENTENCES, etc.) and old components are left below
// for reference during refactoring, but are no longer directly used by the main app flow.
// They will be removed in a future cleanup commit.

// ... (rest of the old file content, including AuthScreen, old Dashboard, etc.)

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT (REWRITTEN)
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("loading"); // Start in a loading state
  const [lessonType, setLessonType] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [toast, setToast] = useState(null);

  // Initial profile load
  useEffect(() => {
    const userProfile = loadProfile();
    setProfile(userProfile);
    // For now, we assume if a profile exists, the user is "logged in".
    // The old AuthScreen logic can be integrated back later if needed.
    setScreen("dashboard");
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleStartLesson(type) {
    setLessonType(type);
    setScreen("lesson");
  }

  function handleLogout() {
    // This is simplified. In a real app, you'd clear the profile.
    setProfile(null);
    setScreen("auth"); // Assuming an auth screen exists
    showToast("You have been logged out.");
  }

  async function handleLessonComplete(updatedProfile) {
    setProfile(updatedProfile); // The profile is already updated and saved by DynamicLessonHost
    // For simplicity, we'll just show a toast instead of the old result screen
    showToast("Lesson Complete! Your progress has been saved.", "success");
    setScreen("dashboard");
  }

  // --- Screen Renderer ---
  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return (
          <NewDashboard
            profile={profile}
            onStartLesson={handleStartLesson}
            onLogout={handleLogout}
          />
        );
      case "lesson":
        return (
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px" }}>
             <button onClick={() => setScreen('dashboard')} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", fontFamily:"'Outfit', sans-serif", marginBottom: 24 }}>
              ← Back to Dashboard
            </button>
            <DynamicLessonHost
              lessonType={lessonType}
              onSessionComplete={handleLessonComplete}
            />
          </div>
        );
      case "loading":
        return <div>Loading...</div>;
      // case "auth":
      //   return <AuthScreen onLogin={...} />; // Old auth can be wired back here
      default:
        return <div>Unknown screen</div>;
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", fontFamily:"'Outfit', sans-serif", backgroundImage:"radial-gradient(ellipse at 20% 50%, #1a0a3e 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0a1a3e 0%, transparent 50%)", color:"#e5e7eb" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;900&display=swap'); *{box-sizing:border-box} input,textarea{outline:none} button{cursor:pointer;border:none;background:none}`}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {renderScreen()}
    </div>
  );
}

// ... (The rest of the giant old App.jsx file can be appended here, unrendered)
// For this rewrite, I am only replacing the App() export.
