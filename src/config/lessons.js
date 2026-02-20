export const LESSON_META = {
  "Flashcards":         { icon: "🃏", desc: "Flip cards & test memory",          group: "📖 Vocabulary" },
  "Word Match":         { icon: "🎯", desc: "Match words to translations",        group: "📖 Vocabulary" },
  "Fill in the Blank":  { icon: "✍️", desc: "Complete sentences",                 group: "📖 Vocabulary" },
  "Learn Verbs":        { icon: "📖", desc: "Learn & practice conjugations",      group: "⚙️ Grammar" },
  "Speed Round":        { icon: "⚡", desc: "Timed conjugation challenge",         group: "⚙️ Grammar" },
  "Sentence Scramble":  { icon: "🔀", desc: "Arrange words in correct order",     group: "⚙️ Grammar" },
  "Transcription":      { icon: "🎧", desc: "Listen and type what you hear",      group: "👂 Listening" },
  "Audio Shadowing":    { icon: "🎤", desc: "Shadow native speaker rhythm",       group: "👂 Listening" },
  "Pronunciation Coach":{ icon: "🗣️", desc: "Speak into mic + get pronunciation score", group: "👂 Listening" },
  "Scenario Builder":   { icon: "🗣️", desc: "Pick culturally correct responses",  group: "💬 Conversation" },
  "Chat Partner":       { icon: "🤖", desc: "AI conversation partner",            group: "💬 Conversation" },
  "Image Labeling":     { icon: "🖼️", desc: "Label objects in scenes",            group: "👁️ Visual" },
  "Picture Description":{ icon: "🌄", desc: "Describe images in Spanish (AI)",   group: "👁️ Visual" },
  "Placement Test":     { icon: "🧪", desc: "Find your level + adaptive path",    group: "🎯 Adaptive" },
};

export const LESSON_TYPES = Object.keys(LESSON_META);
export const NO_CATEGORY = new Set([
  "Learn Verbs",
  "Transcription",
  "Audio Shadowing",
  "Pronunciation Coach",
  "Scenario Builder",
  "Chat Partner",
  "Image Labeling",
  "Picture Description",
  "Speed Round",
  "Sentence Scramble",
  "Placement Test",
]);
