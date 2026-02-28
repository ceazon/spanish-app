// Spanish-app/src/App.jsx

import React, { useState, useEffect } from "react";
import { loadProfile } from "./services/storage";
import { NewDashboard } from "./components/NewDashboard";
import { DynamicLessonHost } from "./lessons/DynamicLessonHost";
import { Toast } from "./components/ui";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("loading");
  const [lessonType, setLessonType] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const userProfile = loadProfile();
    setProfile(userProfile);
    // This simplified auth assumes if a profile is loaded, they are logged in.
    setScreen("dashboard"); 
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleStartLesson(type) {
    setLessonType(type);
    setScreen("lesson");
  }

  function handleLogout() {
    // In a real app, you'd clear localStorage or send a request to a server.
    // For now, we just simulate the logged-out state.
    setProfile(null); 
    setScreen("auth"); // A real app would have an AuthScreen component here.
    showToast("You have been logged out.");
  }

  function handleLessonComplete(updatedProfile) {
    setProfile(updatedProfile);
    showToast("¡Buen trabajo! Progress saved.", "success");
    setScreen("dashboard");
  }

  const renderScreen = () => {
    switch (screen) {
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
      case "auth":
         return <div style={{ textAlign: 'center', paddingTop: '40vh' }}>You are logged out. Please log in to continue.</div>;
      default:
        return <div>Error: Unknown screen.</div>;
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
