// Spanish-app/src/lessons/DynamicLessonHost.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { loadProfile, saveProfile } from '../services/storage';
import { getWordsForSession, getSentencesForSession } from '../services/contentResolver';
import { updateProfileAfterSession } from '../services/progression';

// Import the actual lesson components
import { FlashcardLesson, WordMatchLesson, FillBlankLesson } from './vocab';

// A simple loading/placeholder component
const LoadingSpinner = () => <div style={{ color: "#a78bfa" }}>Loading your personalized lesson...</div>;

export function DynamicLessonHost({ lessonType, onSessionComplete }) {
  const [profile, setProfile] = useState(null);
  const [sessionWords, setSessionWords] = useState([]);
  const [sessionSentences, setSessionSentences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load profile and fetch content when the component mounts
  useEffect(() => {
    async function setupSession() {
      try {
        setIsLoading(true);
        const userProfile = loadProfile();
        if (!userProfile) {
          throw new Error("Could not load user profile.");
        }
        setProfile(userProfile);

        // Fetch dynamic content based on the profile
        const words = getWordsForSession(userProfile, 20); // Get 20 words for the session
        setSessionWords(words);
        
        // If the lesson type needs sentences, fetch them
        if (lessonType === 'fill-in-the-blank') {
          const sentences = await getSentencesForSession(userProfile, words, 10);
          setSessionSentences(sentences);
        }

      } catch (e) {
        setError(e.message);
        console.error("Session setup failed:", e);
      } finally {
        setIsLoading(false);
      }
    }

    setupSession();
  }, [lessonType]);

  // This function will be passed to the lesson components
  const handleLessonComplete = useCallback((sessionResults) => {
    if (!profile) return;

    // Update the profile with the results of the session
    const updatedProfile = updateProfileAfterSession(profile, sessionResults);
    
    // Save the new profile to storage
    saveProfile(updatedProfile);

    // Update the state and notify the parent component
    setProfile(updatedProfile);
    if (onSessionComplete) {
      onSessionComplete(updatedProfile);
    }

    console.log("Session complete! Profile updated.", updatedProfile);
  }, [profile, onSessionComplete]);

  // Render the correct lesson component based on the prop
  const renderLesson = () => {
    switch (lessonType) {
      case 'flashcard':
        return <FlashcardLesson words={sessionWords} onComplete={handleLessonComplete} />;
      case 'word-match':
        return <WordMatchLesson words={sessionWords} onComplete={handleLessonComplete} />;
      case 'fill-in-the-blank':
        return <FillBlankLesson sentences={sessionSentences} onComplete={handleLessonComplete} />;
      default:
        return <div style={{color: 'red'}}>Error: Unknown lesson type "{lessonType}"</div>;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div style={{color: 'red'}}>Error: {error}</div>;
  }

  return (
    <div>
      {/* This component now handles all the data logic */}
      {renderLesson()}
    </div>
  );
}
