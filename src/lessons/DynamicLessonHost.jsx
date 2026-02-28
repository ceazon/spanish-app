// Spanish-app/src/lessons/DynamicLessonHost.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { loadProfile, saveProfile } from '../services/storage';
import { getWordsForSession, getSentencesForSession } from '../services/contentResolver';
import { updateProfileAfterSession } from '../services/progression';
import { checkNewBadges } from '../services/badges';
import { FlashcardLesson, WordMatchLesson, FillBlankLesson } from './vocab';
import { Celebration } from '../components/Celebration';
import { LEVEL_TITLES } from '../config/cefr';

const LoadingSpinner = () => <div style={{ color: "#a78bfa", textAlign: 'center' }}>Loading your personalized lesson...</div>;

export function DynamicLessonHost({ lessonType, onSessionComplete }) {
  const [profile, setProfile] = useState(null);
  const [sessionContent, setSessionContent] = useState({ words: [], sentences: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [celebration, setCelebration] = useState(null); // { type: 'sublevel' | 'band', title: 'Explorer' }

  useEffect(() => {
    async function setupSession() {
      try {
        setIsLoading(true);
        const userProfile = loadProfile();
        setProfile(userProfile);

        const words = getWordsForSession(userProfile, 20);
        let sentences = [];
        if (lessonType === 'fill-in-the-blank') { // This logic can be expanded
          sentences = await getSentencesForSession(userProfile, words, 10);
        }
        setSessionContent({ words, sentences });
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    setupSession();
  }, [lessonType]);

  const handleLessonComplete = useCallback((results) => {
    if (!profile) return;

    const oldSublevel = profile.sublevel;
    const oldBand = profile.cefrBand;

    const updatedProfile = updateProfileAfterSession(profile, results);
    
    const newBadges = checkNewBadges(updatedProfile, results);
    if (newBadges.length > 0) {
      updatedProfile.badges = [...new Set([...updatedProfile.badges, ...newBadges])];
    }

    saveProfile(updatedProfile);
    setProfile(updatedProfile); // Update profile state immediately

    // Check for level up or band completion to trigger celebration
    if (updatedProfile.cefrBand !== oldBand) {
      setCelebration({ type: 'band', title: LEVEL_TITLES[updatedProfile.cefrBand][0] });
    } else if (updatedProfile.sublevel > oldSublevel) {
      setCelebration({ type: 'sublevel', title: LEVEL_TITLES[updatedProfile.cefrBand][updatedProfile.sublevel] });
    } else {
      // If no celebration, complete immediately
      if (onSessionComplete) onSessionComplete(updatedProfile);
    }
  }, [profile, onSessionComplete]);

  const onCelebrationEnd = () => {
    setCelebration(null);
    if (onSessionComplete) {
      onSessionComplete(profile);
    }
  };

  // Simplified onComplete wrapper
  const simpleOnComplete = (points, correct, total) => {
    const mockResults = sessionContent.words.slice(0, total).map((word, i) => ({
      ...word,
      correct: i < correct
    }));
    handleLessonComplete(mockResults);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  const renderLesson = () => {
     switch (lessonType) {
      case 'flashcard':
        return <FlashcardLesson words={sessionContent.words} onComplete={simpleOnComplete} />;
      case 'word-match':
        return <WordMatchLesson words={sessionContent.words} onComplete={simpleOnComplete} />;
      case 'fill-in-the-blank':
        return <FillBlankLesson sentences={sessionContent.sentences} onComplete={simpleOnComplete} />;
      default:
        return <div style={{ color: 'red' }}>Error: Unknown lesson type "{lessonType}"</div>;
    }
  }

  return (
    <>
      {renderLesson()}
      {celebration && (
        <Celebration
          type={celebration.type}
          title={celebration.title}
          onComplete={onCelebrationEnd}
        />
      )}
    </>
  );
}
