// Spanish-app/src/lessons/DynamicLessonHost.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { loadProfile, saveProfile } from '../services/storage';
import { getWordsForSession, getSentencesForSession } from '../services/contentResolver';
import { updateProfileAfterSession } from '../services/progression';
import { FlashcardLesson, WordMatchLesson, FillBlankLesson } from './vocab';

const LoadingSpinner = () => <div style={{ color: "#a78bfa", textAlign: 'center' }}>Loading your personalized lesson...</div>;

export function DynamicLessonHost({ lessonType, onSessionComplete }) {
  const [profile, setProfile] = useState(null);
  const [sessionContent, setSessionContent] = useState({ words: [], sentences: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleLessonComplete = useCallback((results) => { // results is now an array of {id, cefr, correct}
    if (!profile) return;
    const updatedProfile = updateProfileAfterSession(profile, results);
    saveProfile(updatedProfile);
    if (onSessionComplete) {
      onSessionComplete(updatedProfile);
    }
  }, [profile, onSessionComplete]);

  // Simplified onComplete wrapper for older components
  const simpleOnComplete = (points, correct, total) => {
    // This is a rough translation; the new system needs per-word results.
    // We'll pass a placeholder. This needs to be refactored in vocab.jsx.
    const mockResults = sessionContent.words.slice(0, total).map((word, i) => ({
      ...word,
      correct: i < correct
    }));
    handleLessonComplete(mockResults);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

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
