// Spanish-app/src/App.jsx

import React, { useState, useEffect } from "react";
import { loadProfile, saveProfile } from "./services/storage";
import { NewDashboard } from "./components/NewDashboard";
import { DynamicLessonHost } from "./lessons/DynamicLessonHost";
import { AuthScreen } from "./components/AuthScreen";
import { Toast } from "./components/ui";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("loading");
  const [lessonType, setLessonType] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const userProfile = loadProfile();
    if (userProfile && userProfile.displayName) {
      setProfile(userProfile);
      setScreen("dashboard");
    } else {
      setScreen("auth");
    }
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleLogin(newProfile) {
    setProfile(newProfile);
    setScreen("dashboard");
    showToast(`¡Bienvenido, ${newProfile.displayName}!`, "success");
  }

  function handleStartLesson(type) {
    setLessonType(type);
    setScreen("lesson");
  }

  function handleLogout() {
    saveProfile(null); // Clear the profile from storage
    setProfile(null);
    setScreen("auth");
    showToast("You have been logged out.");
  }

  function handleLessonComplete(updatedProfile) {
    setProfile(updatedProfile);
    showToast("¡Buen trabajo! Progress saved.", "success");
    setScreen("dashboard");
  }

  const renderScreen = () => {
    switch (screen) {
      case "auth":
        return <AuthScreen onLogin={handleLogin} />;
      case "dashboard":
        return <NewDashboard profile={profile} onStartLesson={handleStartLesson} onLogout={handleLogout} />;
      case "lesson":
        return (
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px" }}>
            <button onClick={() => setScreen('dashboard')} style={{ marginBottom: 24, background: "none", color: "#9ca3af", fontSize: 13 }}>
              ← Back to Dashboard
            </button>
            <DynamicLessonHost lessonType={lessonType} onSessionComplete={handleLessonComplete} />
          </div>
        );
      case "loading":
        return <div style={{ textAlign: 'center', paddingTop: '40vh' }}>Loading Chadlingo...</div>;
      default:
        return <div>Error: Unknown screen state.</div>;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0a1e", fontFamily: "'Outfit', sans-serif", color: "#e5e7eb" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Playfair+Display:wght@700;900&display=swap'); *{box-sizing:border-box} button{cursor:pointer;border:none;background:none}`}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {renderScreen()}
    </div>
  );
}
