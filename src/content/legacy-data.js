// Spanish-app/src/content/legacy-data.js
// This file holds static content arrays from the pre-rewrite App.jsx

export const VERBS = [
  { infinitive: "hablar", meaning: "to speak", type: "Regular -ar", conjugations: [{ pronoun: "yo", form: "hablo" }, { pronoun: "tú", form: "hablas" }, { pronoun: "él / ella", form: "habla" }] },
  { infinitive: "comer", meaning: "to eat", type: "Regular -er", conjugations: [{ pronoun: "yo", form: "como" }, { pronoun: "tú", form: "comes" }, { pronoun: "él / ella", form: "come" }] },
  { infinitive: "vivir", meaning: "to live", type: "Regular -ir", conjugations: [{ pronoun: "yo", form: "vivo" }, { pronoun: "tú", form: "vives" }, { pronoun: "él / ella", form: "vive" }] },
];

export const SCRAMBLE_SENTENCES = [
  { words: ["Yo", "hablo", "español"], correct: "Yo hablo español", hint: "I speak Spanish." },
  { words: ["El", "gato", "duerme"], correct: "El gato duerme", hint: "The cat sleeps." },
  { words: ["Ella", "come", "una", "manzana"], correct: "Ella come una manzana", hint: "She eats an apple." },
];

// Add other data arrays here as needed, e.g., for Transcription, Scenarios, etc.
