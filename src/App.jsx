import React, { useState, useEffect, useRef, useMemo } from "react";
import starterPack from "./content/packs/starter-pack.json";
import approvedVocab from "./content/approved-vocab-1000.json";
import cefrVocab from "./content/cefr-vocab.json";
import { LESSON_META, LESSON_TYPES, NO_CATEGORY } from "./config/lessons";
import { LEVEL_TITLES, getLevelLabel } from "./config/cefr.js";
import { shuffle, speak } from "./services/utils";
import { loadUser, saveUser, loadActiveContentPack, saveActiveContentPack, clearActiveContentPack } from "./services/storage";
import { getDailyQuestState, recomputeProfileFromHistory, placementFromScore, getAdaptiveDifficulty, updateLearningProfile } from "./services/progression";
import { selectWordsForModule, getFillBlankItemsForModule } from "./services/contentResolver";
import { ensurePathState, getNextPathStep, completePathStep } from "./services/learningPath";
import { Toast, ProgressBar, FeedbackBanner, PrimaryBtn, TextInput } from "./components/ui";
import { FlashcardLesson, WordMatchLesson, FillBlankLesson } from "./lessons/vocab";

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const VOCAB = {
  "Greetings": [
    { en: "Hello", es: "Hola" }, { en: "Goodbye", es: "Adiós" },
    { en: "Good morning", es: "Buenos días" }, { en: "Good night", es: "Buenas noches" },
    { en: "Thank you", es: "Gracias" }, { en: "Please", es: "Por favor" },
    { en: "Yes", es: "Sí" }, { en: "No", es: "No" },
    { en: "Excuse me", es: "Perdón" }, { en: "Sorry", es: "Lo siento" },
  ],
  "Numbers": [
    { en: "One", es: "Uno" }, { en: "Two", es: "Dos" }, { en: "Three", es: "Tres" },
    { en: "Four", es: "Cuatro" }, { en: "Five", es: "Cinco" }, { en: "Six", es: "Seis" },
    { en: "Seven", es: "Siete" }, { en: "Eight", es: "Ocho" }, { en: "Nine", es: "Nueve" }, { en: "Ten", es: "Diez" },
  ],
  "Colors": [
    { en: "Red", es: "Rojo" }, { en: "Blue", es: "Azul" }, { en: "Green", es: "Verde" },
    { en: "Yellow", es: "Amarillo" }, { en: "Black", es: "Negro" }, { en: "White", es: "Blanco" },
    { en: "Orange", es: "Naranja" }, { en: "Purple", es: "Morado" }, { en: "Pink", es: "Rosa" }, { en: "Brown", es: "Marrón" },
  ],
  "Food": [
    { en: "Apple", es: "Manzana" }, { en: "Bread", es: "Pan" }, { en: "Water", es: "Agua" },
    { en: "Milk", es: "Leche" }, { en: "Chicken", es: "Pollo" }, { en: "Rice", es: "Arroz" },
    { en: "Fish (food)", es: "Pescado" }, { en: "Egg", es: "Huevo" }, { en: "Cheese", es: "Queso" }, { en: "Coffee", es: "Café" },
  ],
  "Animals": [
    { en: "Dog", es: "Perro" }, { en: "Cat", es: "Gato" }, { en: "Bird", es: "Pájaro" },
    { en: "Horse", es: "Caballo" }, { en: "Fish (animal)", es: "Pez" }, { en: "Rabbit", es: "Conejo" },
    { en: "Lion", es: "León" }, { en: "Tiger", es: "Tigre" }, { en: "Bear", es: "Oso" }, { en: "Elephant", es: "Elefante" },
  ],
};

const SENTENCES = [
  { template: "Yo ___ un estudiante.", answer: "soy", hint: "I ___ a student." },
  { template: "Ella ___ en casa.", answer: "está", hint: "She ___ at home." },
  { template: "Nosotros ___ español.", answer: "hablamos", hint: "We ___ Spanish." },
  { template: "El gato ___ en la silla.", answer: "está", hint: "The cat ___ on the chair." },
  { template: "Yo ___ café por la mañana.", answer: "bebo", hint: "I ___ coffee in the morning." },
  { template: "Ellos ___ mucho.", answer: "comen", hint: "They ___ a lot." },
  { template: "Tú ___ muy bien.", answer: "hablas", hint: "You speak very well." },
  { template: "Él ___ un libro.", answer: "lee", hint: "He ___ a book." },
  { template: "Yo ___ hambre.", answer: "tengo", hint: "I ___ hungry." },
  { template: "Ella ___ bonita.", answer: "es", hint: "She ___ beautiful." },
];

const VERBS = [
  { infinitive: "hablar", meaning: "to speak", type: "Regular -ar", example: "Yo hablo español todos los días.", exampleEn: "I speak Spanish every day.",
    conjugations: [{ pronoun: "yo", form: "hablo", meaning: "I speak" }, { pronoun: "tú", form: "hablas", meaning: "you speak" }, { pronoun: "él / ella", form: "habla", meaning: "he/she speaks" }, { pronoun: "nosotros", form: "hablamos", meaning: "we speak" }, { pronoun: "vosotros", form: "habláis", meaning: "you all speak" }, { pronoun: "ellos / ellas", form: "hablan", meaning: "they speak" }] },
  { infinitive: "comer", meaning: "to eat", type: "Regular -er", example: "Ella come pizza los viernes.", exampleEn: "She eats pizza on Fridays.",
    conjugations: [{ pronoun: "yo", form: "como", meaning: "I eat" }, { pronoun: "tú", form: "comes", meaning: "you eat" }, { pronoun: "él / ella", form: "come", meaning: "he/she eats" }, { pronoun: "nosotros", form: "comemos", meaning: "we eat" }, { pronoun: "vosotros", form: "coméis", meaning: "you all eat" }, { pronoun: "ellos / ellas", form: "comen", meaning: "they eat" }] },
  { infinitive: "vivir", meaning: "to live", type: "Regular -ir", example: "Nosotros vivimos en Madrid.", exampleEn: "We live in Madrid.",
    conjugations: [{ pronoun: "yo", form: "vivo", meaning: "I live" }, { pronoun: "tú", form: "vives", meaning: "you live" }, { pronoun: "él / ella", form: "vive", meaning: "he/she lives" }, { pronoun: "nosotros", form: "vivimos", meaning: "we live" }, { pronoun: "vosotros", form: "vivís", meaning: "you all live" }, { pronoun: "ellos / ellas", form: "viven", meaning: "they live" }] },
  { infinitive: "ser", meaning: "to be (permanent)", type: "Irregular", example: "Él es médico.", exampleEn: "He is a doctor.",
    conjugations: [{ pronoun: "yo", form: "soy", meaning: "I am" }, { pronoun: "tú", form: "eres", meaning: "you are" }, { pronoun: "él / ella", form: "es", meaning: "he/she is" }, { pronoun: "nosotros", form: "somos", meaning: "we are" }, { pronoun: "vosotros", form: "sois", meaning: "you all are" }, { pronoun: "ellos / ellas", form: "son", meaning: "they are" }] },
  { infinitive: "estar", meaning: "to be (temporary)", type: "Irregular", example: "¿Cómo estás tú hoy?", exampleEn: "How are you today?",
    conjugations: [{ pronoun: "yo", form: "estoy", meaning: "I am" }, { pronoun: "tú", form: "estás", meaning: "you are" }, { pronoun: "él / ella", form: "está", meaning: "he/she is" }, { pronoun: "nosotros", form: "estamos", meaning: "we are" }, { pronoun: "vosotros", form: "estáis", meaning: "you all are" }, { pronoun: "ellos / ellas", form: "están", meaning: "they are" }] },
  { infinitive: "tener", meaning: "to have", type: "Irregular", example: "Yo tengo dos hermanos.", exampleEn: "I have two siblings.",
    conjugations: [{ pronoun: "yo", form: "tengo", meaning: "I have" }, { pronoun: "tú", form: "tienes", meaning: "you have" }, { pronoun: "él / ella", form: "tiene", meaning: "he/she has" }, { pronoun: "nosotros", form: "tenemos", meaning: "we have" }, { pronoun: "vosotros", form: "tenéis", meaning: "you all have" }, { pronoun: "ellos / ellas", form: "tienen", meaning: "they have" }] },
  { infinitive: "ir", meaning: "to go", type: "Irregular", example: "Vamos al mercado esta tarde.", exampleEn: "We are going to the market.",
    conjugations: [{ pronoun: "yo", form: "voy", meaning: "I go" }, { pronoun: "tú", form: "vas", meaning: "you go" }, { pronoun: "él / ella", form: "va", meaning: "he/she goes" }, { pronoun: "nosotros", form: "vamos", meaning: "we go" }, { pronoun: "vosotros", form: "vais", meaning: "you all go" }, { pronoun: "ellos / ellas", form: "van", meaning: "they go" }] },
  { infinitive: "querer", meaning: "to want / love", type: "Stem-changing (e→ie)", example: "Ellos quieren aprender español.", exampleEn: "They want to learn Spanish.",
    conjugations: [{ pronoun: "yo", form: "quiero", meaning: "I want" }, { pronoun: "tú", form: "quieres", meaning: "you want" }, { pronoun: "él / ella", form: "quiere", meaning: "he/she wants" }, { pronoun: "nosotros", form: "queremos", meaning: "we want" }, { pronoun: "vosotros", form: "queréis", meaning: "you all want" }, { pronoun: "ellos / ellas", form: "quieren", meaning: "they want" }] },
];

const LISTEN_SENTENCES = [
  { es: "Hola, ¿cómo estás?", en: "Hello, how are you?" },
  { es: "Buenos días, me llamo Carlos.", en: "Good morning, my name is Carlos." },
  { es: "Quiero un café, por favor.", en: "I want a coffee, please." },
  { es: "El gato está en la casa.", en: "The cat is in the house." },
  { es: "Ella habla español muy bien.", en: "She speaks Spanish very well." },
  { es: "Nosotros comemos arroz y pollo.", en: "We eat rice and chicken." },
  { es: "¿Dónde está el baño?", en: "Where is the bathroom?" },
  { es: "El libro está sobre la mesa.", en: "The book is on the table." },
  { es: "Me gustan los perros y los gatos.", en: "I like dogs and cats." },
  { es: "Mañana vamos al mercado.", en: "Tomorrow we are going to the market." },
];

const SCENARIOS = [
  {
    setting: "🍽️ At a Restaurant",
    context: "You've just sat down. The waiter approaches.",
    dialogue: [{ speaker: "Waiter", line: "¡Buenas noches! ¿Qué desea ordenar?" }, { speaker: "", line: "Good evening! What would you like to order?" }],
    options: [
      { text: "Quiero el menú del día, por favor.", correct: true, feedback: "¡Perfecto! Polite and natural - asking for the set menu." },
      { text: "Dame comida ahora.", correct: false, feedback: "'Give me food now' - too abrupt and rude without 'por favor'." },
      { text: "Yo no sé español.", correct: false, feedback: "'I don't speak Spanish' - not ideal when you're trying to order!" },
      { text: "¿Tienes pizza?", correct: false, feedback: "OK but skipping pleasantries feels abrupt. Better to greet first." },
    ],
  },
  {
    setting: "🛒 At a Market",
    context: "You want to know the price of some mangoes.",
    dialogue: [{ speaker: "Vendor", line: "¡Buenos días! ¿En qué le puedo ayudar?" }, { speaker: "", line: "Good morning! How can I help you?" }],
    options: [
      { text: "¿Cuánto cuestan los mangos?", correct: true, feedback: "¡Excelente! The natural way to ask 'How much do the mangoes cost?'" },
      { text: "Mangos, precio.", correct: false, feedback: "Too telegraphic. Always use a proper question in conversation." },
      { text: "Los mangos son caros.", correct: false, feedback: "'The mangoes are expensive' - an opinion, not a question!" },
      { text: "¿Dónde están los mangos?", correct: false, feedback: "Asking where they are when you can already see them. Ask the price!" },
    ],
  },
  {
    setting: "🏥 At a Pharmacy",
    context: "You have a headache and need medicine.",
    dialogue: [{ speaker: "Pharmacist", line: "¿Cómo le puedo ayudar hoy?" }, { speaker: "", line: "How can I help you today?" }],
    options: [
      { text: "Tengo dolor de cabeza. ¿Tiene algo para eso?", correct: true, feedback: "¡Muy bien! 'I have a headache. Do you have something for that?' - clear and polite." },
      { text: "Estoy muy enfermo y necesito todo.", correct: false, feedback: "'I'm very sick and need everything' - too vague to be helpful." },
      { text: "Medicina para la cabeza.", correct: false, feedback: "Gets the idea across but sounds like caveman Spanish. Use full sentences!" },
      { text: "Mi cabeza no es buena hoy.", correct: false, feedback: "Creative but not how natives express a headache in Spanish." },
    ],
  },
  {
    setting: "🚌 On a Bus",
    context: "You're not sure if this bus goes to the city center.",
    dialogue: [{ speaker: "Passenger", line: "¿Va usted al centro también?" }, { speaker: "", line: "Are you also going to the city center?" }],
    options: [
      { text: "No estoy seguro. ¿Este autobús va al centro?", correct: true, feedback: "¡Perfecto! 'I'm not sure. Does this bus go to the center?' - honest and sensible." },
      { text: "Sí, claro que sí.", correct: false, feedback: "You don't actually know! Saying 'Yes, of course' could mislead you both." },
      { text: "No hablo contigo.", correct: false, feedback: "'I don't speak with you' - incredibly rude to a friendly stranger!" },
      { text: "El autobús es muy grande.", correct: false, feedback: "'The bus is very big' - completely irrelevant to the question." },
    ],
  },
];

const SCENES = [
  {
    name: "La Cocina (The Kitchen)",
    items: [
      { label: "Mesa", en: "Table", emoji: "🪑", x: 20, y: 68 },
      { label: "Ventana", en: "Window", emoji: "🪟", x: 65, y: 15 },
      { label: "Leche", en: "Milk", emoji: "🥛", x: 50, y: 42 },
      { label: "Pan", en: "Bread", emoji: "🍞", x: 75, y: 58 },
      { label: "Café", en: "Coffee", emoji: "☕", x: 18, y: 42 },
      { label: "Silla", en: "Chair", emoji: "🪑", x: 38, y: 78 },
    ],
  },
  {
    name: "El Parque (The Park)",
    items: [
      { label: "Árbol", en: "Tree", emoji: "🌳", x: 15, y: 20 },
      { label: "Perro", en: "Dog", emoji: "🐕", x: 60, y: 70 },
      { label: "Flor", en: "Flower", emoji: "🌸", x: 40, y: 80 },
      { label: "Pájaro", en: "Bird", emoji: "🐦", x: 78, y: 22 },
      { label: "Banco", en: "Bench", emoji: "🪑", x: 25, y: 62 },
      { label: "Sol", en: "Sun", emoji: "☀️", x: 80, y: 10 },
    ],
  },
];

const SCRAMBLE_SENTENCES = [
  { words: ["Yo", "hablo", "español", "todos", "los", "días"], correct: "Yo hablo español todos los días", hint: "I speak Spanish every day." },
  { words: ["El", "gato", "negro", "duerme", "en", "la", "silla"], correct: "El gato negro duerme en la silla", hint: "The black cat sleeps on the chair." },
  { words: ["Ella", "come", "una", "manzana", "roja"], correct: "Ella come una manzana roja", hint: "She eats a red apple." },
  { words: ["Nosotros", "vamos", "al", "mercado", "mañana"], correct: "Nosotros vamos al mercado mañana", hint: "We are going to the market tomorrow." },
  { words: ["El", "perro", "grande", "corre", "muy", "rápido"], correct: "El perro grande corre muy rápido", hint: "The big dog runs very fast." },
  { words: ["Tú", "tienes", "un", "libro", "interesante"], correct: "Tú tienes un libro interesante", hint: "You have an interesting book." },
];

const CHAT_TOPICS = [
  { id: "tacos", label: "🌮 Ordering Tacos", systemPrompt: "You are a friendly taco stand vendor in Mexico City named Pepe. ONLY speak in simple, beginner-level Spanish (max 15 words per message). If the user writes in English, respond in Spanish but add a gentle '(¡en español, por favor!)'. Topics: tacos, fillings (carne, pollo, vegetariano), salsa, price (20 pesos each), drinks (agua, limonada). Be warm, use ¡Órale! and ¡Claro que sí!" },
  { id: "hotel", label: "🏨 Checking into a Hotel", systemPrompt: "You are a polite hotel receptionist in Madrid named Carmen. ONLY speak in simple, beginner-level Spanish (max 15 words per message). Topics: reservations (reserva), rooms (habitación sencilla/doble), check-in at 3pm, check-out at noon, key (llave), breakfast included (desayuno incluido). Encourage Spanish responses." },
  { id: "market", label: "🛒 Shopping at a Market", systemPrompt: "You are an enthusiastic market vendor in Barcelona named Miguel selling fruits and vegetables. ONLY speak in simple, beginner-level Spanish (max 15 words per message). Topics: prices (¿cuánto cuesta?), quantities (un kilo, medio kilo), items (manzanas, tomates, naranjas), bargaining. Use ¡Muy bien! to encourage learners." },
  { id: "directions", label: "🗺️ Asking for Directions", systemPrompt: "You are a helpful local in Seville named Ana. ONLY speak in simple, beginner-level Spanish (max 15 words per message). Topics: places (banco, farmacia, metro, plaza), directions (todo recto, a la derecha, a la izquierda, cerca, lejos). Keep it very short and clear." },
];

const PICTURE_SCENES = [
  { emoji: "🐕 🌳 ☀️", description: "A dog playing under a tree on a sunny day", prompt: "Un perro juega bajo un árbol en un día soleado." },
  { emoji: "👨‍🍳 🍕 🔥", description: "A chef making pizza", prompt: "Un cocinero hace pizza." },
  { emoji: "👩 📚 ☕", description: "A woman reading books and drinking coffee", prompt: "Una mujer lee libros y bebe café." },
  { emoji: "🚗 🏔️ 🌅", description: "A car driving toward mountains at sunset", prompt: "Un coche conduce hacia las montañas al atardecer." },
  { emoji: "👦 ⚽ 🏟️", description: "A boy playing soccer in a stadium", prompt: "Un niño juega al fútbol en un estadio." },
];

const CATEGORIES = Object.keys(approvedVocab?.vocab || VOCAB);
const FLASHCARD_HISTORY_KEY = "spanish_app_flashcard_recent_v1";
const FILLBLANK_HISTORY_KEY = "spanish_app_fillblank_recent_v1";
const SCRAMBLE_HISTORY_KEY = "spanish_app_scramble_recent_v1";
const LISTEN_HISTORY_KEY = "spanish_app_listen_recent_v1";

function buildCanonicalTranslationMap() {
  const out = {};
  for (const [category, items] of Object.entries(approvedVocab?.vocab || {})) {
    for (const item of items || []) {
      if (!item?.approved) continue;
      const enKey = normalizeSimple(item.en);
      const categoryKey = `${category}::${enKey}`;
      out[categoryKey] = item.es;
      if (!out[enKey]) out[enKey] = item.es;
    }
  }
  return out;
}

function buildApprovedVocabMap() {
  const out = {};
  for (const [category, items] of Object.entries(approvedVocab?.vocab || {})) {
    out[category] = (items || [])
      .filter((item) => item?.approved && item?.en && item?.es)
      .map(({ en, es, difficulty }) => ({ en, es, difficulty: Number(difficulty) || undefined }));
  }
  return out;
}

const APPROVED_VOCAB_MAP = buildApprovedVocabMap();
const CANONICAL_TRANSLATION_MAP = buildCanonicalTranslationMap();
const APP_COMMIT = typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : "unknown";

const MASCOT_ASSETS = {
  base: "/mascot/chadlingo-default.png",
  success: "/mascot/chadlingo-success.png",
  progress: "/mascot/chadlingo-progress.png",
  streak: "/mascot/chadlingo-streak.png",
};

const STORY_CHALLENGES = [
  "Flashcards",
  "Word Match",
  "Fill in the Blank",
  "Sentence Scramble",
  "Transcription",
  "Scenario Builder",
  "Placement Test",
];

const STORY_EPISODES = [
  {
    id: "madrid-arrival",
    title: "Arrival in Madrid",
    vibe: "Get oriented and warm up your core Spanish.",
    nodes: ["Flashcards", "Word Match", "Fill in the Blank"],
  },
  {
    id: "cafe-run",
    title: "Café Mission",
    vibe: "Order confidently and respond fast.",
    nodes: ["Sentence Scramble", "Transcription", "Scenario Builder"],
  },
  {
    id: "street-survival",
    title: "Street Survival",
    vibe: "Handle mixed real-world prompts under pressure.",
    nodes: ["Word Match", "Fill in the Blank", "Placement Test"],
  },
];

function buildStoryPlan(minutes = 10, aiStatus = { anyAvailable: true }) {
  const targetCount = Math.max(3, Math.min(12, Math.round((Number(minutes) || 10) / 2)));
  const available = STORY_CHALLENGES.filter((type) => !(AI_REQUIRED_LESSONS.has(type) && !aiStatus?.anyAvailable));
  const episodePool = STORY_EPISODES.map((ep) => ({
    ...ep,
    nodes: ep.nodes.filter((n) => available.includes(n)),
  })).filter((ep) => ep.nodes.length > 0);

  if (!episodePool.length) return { plan: [], episodeTitle: "Story Run", episodeVibe: "" };

  const selected = episodePool[Math.floor(Math.random() * episodePool.length)];
  const plan = [];
  for (let i = 0; i < targetCount; i += 1) plan.push(selected.nodes[i % selected.nodes.length]);
  return { plan, episodeTitle: selected.title, episodeVibe: selected.vibe };
}

function localDayKey(now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function hashCode(input = "") {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickSeeded(list = [], seed = 0, avoidKey = null, keyFn = (x) => x?.id || x?.es || x?.en || x) {
  if (!Array.isArray(list) || !list.length) return null;
  const filtered = avoidKey ? list.filter((x) => keyFn(x) !== avoidKey) : list;
  const pool = filtered.length ? filtered : list;
  return pool[Math.abs(seed) % pool.length];
}

function getFriendlyPathName(profile = {}) {
  const band = profile?.cefrBand || 'A1';
  const sub = Math.max(0, Math.min(9, Number(profile?.sublevel || 0)));
  const title = LEVEL_TITLES?.[band]?.[sub] || 'Learner';
  return `${title} path`;
}

function formatStrengthNodeLabel(strengthKey = '') {
  const [band, subRaw] = String(strengthKey || '').split(':');
  const sub = Number(subRaw);
  if (!band || !Number.isFinite(sub)) return 'current learning path';
  const title = LEVEL_TITLES?.[band]?.[Math.max(0, Math.min(9, sub))] || 'Learning node';
  return title;
}

function getDailyFocusBundle(profile = {}, username = "guest", now = new Date()) {
  const key = localDayKey(now);
  const currentBand = profile?.cefrBand || "A1";
  const currentSub = Math.max(0, Math.min(9, Number(profile?.sublevel || 0)));
  const allWords = (cefrVocab?.vocab || []).filter(Boolean);
  const bandWords = allWords.filter((w) => (w?.cefr || "A1") === currentBand);
  const rankedBandWords = bandWords.map((w, idx) => {
    const exposure = profile?.wordExposure?.[w?.id || w?.es] || {};
    const seen = Number(exposure?.seen || 0);
    const correct = Number(exposure?.correct || 0);
    const acc = seen > 0 ? correct / seen : 0;
    const derivedSub = Math.max(0, Math.min(9, Math.floor((idx / Math.max(1, bandWords.length)) * 10)));
    return { ...w, _seen: seen, _acc: acc, _sub: derivedSub };
  });

  const reviewPool = rankedBandWords.filter((w) => w._sub < currentSub).sort((a, b) => (a._acc - b._acc) || (a._seen - b._seen));
  const currentPool = rankedBandWords.filter((w) => w._sub === currentSub).sort((a, b) => (a._seen - b._seen) || (a._acc - b._acc));
  const stretchPool = rankedBandWords.filter((w) => w._sub > currentSub).sort((a, b) => (a._seen - b._seen));
  const blendedPool = [...currentPool.slice(0, 40), ...reviewPool.slice(0, 20), ...stretchPool.slice(0, 20)];

  const verbDifficulty = Number(profile?.globalDifficulty || 1);
  const verbsRanked = [...VERBS].sort((a, b) => {
    const aIrregular = String(a?.type || '').toLowerCase().includes('irregular') ? 1 : 0;
    const bIrregular = String(b?.type || '').toLowerCase().includes('irregular') ? 1 : 0;
    return aIrregular - bIrregular;
  });
  const verbStart = Math.max(0, Math.min(Math.max(0, verbsRanked.length - 1), Math.floor(((currentSub + verbDifficulty) / 11) * verbsRanked.length)));
  const verbPool = verbsRanked.slice(Math.max(0, verbStart - 2), Math.min(verbsRanked.length, verbStart + 4));

  const storedWordId = profile?.dailyFocusWordId || null;
  const storedVerbInf = profile?.dailyFocusVerb || null;
  const seed = hashCode(`${username}:${Date.now()}:${currentBand}:${currentSub}:${verbDifficulty}`);

  const word = pickSeeded(
    blendedPool.length ? blendedPool : (rankedBandWords.length ? rankedBandWords : allWords),
    seed + Math.floor(Math.random() * 9999),
    storedWordId
  ) || { id: "hola", es: "hola", en: "hello", cefr: currentBand };

  const verb = pickSeeded(
    verbPool.length ? verbPool : VERBS,
    seed + 29 + Math.floor(Math.random() * 9999),
    storedVerbInf,
    (v) => v?.infinitive
  ) || { infinitive: "hablar", meaning: "to speak", conjugations: [] };

  return {
    key,
    word: {
      id: word?.id || word?.es || word?.en,
      es: word?.es || "hola",
      en: word?.en || "hello",
      cefr: word?.cefr || currentBand,
    },
    verb: {
      infinitive: verb?.infinitive || "hablar",
      meaning: verb?.meaning || "to speak",
      description: `Today’s power verb for your ${getFriendlyPathName(profile)} is ${verb?.infinitive || "hablar"} (${verb?.meaning || "to speak"}).`,
      conjugations: Array.isArray(verb?.conjugations) ? verb.conjugations : [],
    },
  };
}

function MascotSpeechBubble({ text, tone = "default", style = {} }) {
  const toneStyles = {
    default: { bg: "rgba(124,58,237,0.18)", border: "rgba(124,58,237,0.38)", color: "#ddd6fe" },
    success: { bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.38)", color: "#bbf7d0" },
    hype: { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.42)", color: "#fde68a" },
  };
  const t = toneStyles[tone] || toneStyles.default;
  return (
    <div style={{ background:t.bg, border:`1px solid ${t.border}`, borderRadius:14, padding:"10px 12px", color:t.color, fontSize:12, fontWeight:700, lineHeight:1.35, ...style }}>
      {text}
    </div>
  );
}

function loadAllUsersFromLocalStorage() {
  if (typeof localStorage === "undefined") return [];
  const users = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("user:")) continue;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.username) users.push(parsed);
    } catch {}
  }
  return users;
}

function summarizeAdminStats(users = []) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const totalUsers = users.length;
  const newThisWeek = users.filter((u) => {
    const joined = Date.parse(u?.joined || "");
    return Number.isFinite(joined) && joined >= weekAgo;
  }).length;

  const weeklyActiveUsers = users.filter((u) => {
    const last = Date.parse(u?.lastLogin || "");
    return Number.isFinite(last) && last >= weekAgo;
  }).length;

  const monthlyActiveUsers = users.filter((u) => {
    const last = Date.parse(u?.lastLogin || "");
    return Number.isFinite(last) && last >= monthAgo;
  }).length;

  const totalLessons = users.reduce((sum, u) => sum + (Array.isArray(u?.history) ? u.history.length : 0), 0);
  const totalPoints = users.reduce((sum, u) => sum + (Number(u?.points) || 0), 0);
  const totalActiveMinutes = Math.round(users.reduce((sum, u) => sum + (Array.isArray(u?.history) ? u.history.reduce((s, h) => s + (Number(h?.meta?.durationSec) || 0), 0) : 0), 0) / 60);

  const lessonMix = {};
  users.forEach((u) => {
    (Array.isArray(u?.history) ? u.history : []).forEach((entry) => {
      const key = entry?.type || entry?.category || "Unknown";
      lessonMix[key] = (lessonMix[key] || 0) + 1;
    });
  });

  const topLessons = Object.entries(lessonMix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return {
    totalUsers,
    newThisWeek,
    weeklyActiveUsers,
    monthlyActiveUsers,
    totalLessons,
    totalPoints,
    totalActiveMinutes,
    topLessons,
  };
}

function estimateWordDifficulty(item = {}) {
  if (Number.isFinite(Number(item?.difficulty))) {
    return Math.max(1, Math.min(5, Number(item.difficulty)));
  }
  const es = (item.es || "").trim();
  if (!es) return 1;
  const tokens = es.split(/\s+/).filter(Boolean);
  const lettersOnly = es.replace(/[^\p{L}]/gu, "");
  const hasAccent = /[áéíóúñü]/i.test(es);

  let score = 1;
  if (tokens.length >= 2) score += 1;
  if (lettersOnly.length >= 7) score += 1;
  if (lettersOnly.length >= 11) score += 1;
  if (hasAccent) score += 0.5;

  return Math.max(1, Math.min(5, Math.round(score)));
}

function targetMixForDifficulty(level = 1) {
  const d = Math.max(1, Math.min(5, Number(level) || 1));
  if (d <= 1) return { easy: 0.78, medium: 0.2, hard: 0.02 };
  if (d === 2) return { easy: 0.62, medium: 0.3, hard: 0.08 };
  if (d === 3) return { easy: 0.42, medium: 0.4, hard: 0.18 };
  if (d === 4) return { easy: 0.26, medium: 0.42, hard: 0.32 };
  return { easy: 0.14, medium: 0.36, hard: 0.5 };
}

function readRecentFlashcards(userKey, category) {
  try {
    const raw = localStorage.getItem(FLASHCARD_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return Array.isArray(data?.[userKey]?.[category]) ? data[userKey][category] : [];
  } catch {
    return [];
  }
}

function writeRecentFlashcards(userKey, category, words = []) {
  try {
    const raw = localStorage.getItem(FLASHCARD_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const userData = data[userKey] || {};
    const prior = Array.isArray(userData[category]) ? userData[category] : [];
    const next = [...words.map(w => w.es), ...prior]
      .filter(Boolean)
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, 150);
    data[userKey] = { ...userData, [category]: next };
    localStorage.setItem(FLASHCARD_HISTORY_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

function selectAdaptiveFlashcards(pool = [], { difficulty = 1, target = 8, userKey = "guest", category = "General" } = {}) {
  const strictCategory = CATEGORIES.includes(category);
  const unique = Object.values(
    (pool || []).reduce((acc, w) => {
      if (!w?.en && !w?.es) return acc;
      const en = (w?.en || "").trim();
      const enKey = normalizeSimple(en);
      const esKey = normalizeSimple(w?.es || "");
      const canonical = CANONICAL_TRANSLATION_MAP[`${category}::${enKey}`] || CANONICAL_TRANSLATION_MAP[enKey] || null;

      let normalized = null;
      if (canonical) {
        normalized = { ...w, en, es: canonical };
      } else if (!strictCategory && esKey && esKey !== enKey) {
        normalized = { ...w, en };
      }

      if (normalized?.es) acc[`${normalizeSimple(normalized.en || "")}|${normalizeSimple(normalized.es || "")}`] = normalized;
      return acc;
    }, {}),
  );

  if (!unique.length) {
    if (strictCategory) return (APPROVED_VOCAB_MAP[category] || []).slice(0, target);
    return [];
  }

  const recent = readRecentFlashcards(userKey, category);
  const mix = targetMixForDifficulty(difficulty);

  const scored = unique
    .map((w) => {
      const diff = estimateWordDifficulty(w);
      const recencyIdx = recent.indexOf(w.es);
      const noveltyBoost = recencyIdx === -1 ? 1 : Math.max(0, 1 - recencyIdx / Math.max(1, recent.length));
      const desired = Math.max(1, Math.min(5, Number(difficulty) || 1));
      const fitBoost = 1 - Math.min(1, Math.abs(diff - desired) / 4);
      const spacingBoost = recencyIdx >= 6 && recencyIdx <= 20 ? 0.18 : 0;
      const randomBoost = Math.random() * 0.2;
      return { ...w, _diff: diff, _score: noveltyBoost * 0.55 + fitBoost * 0.35 + spacingBoost + randomBoost };
    })
    .sort((a, b) => b._score - a._score);

  const easy = scored.filter((w) => w._diff <= 2);
  const medium = scored.filter((w) => w._diff === 3);
  const hard = scored.filter((w) => w._diff >= 4);

  const wantEasy = Math.max(1, Math.round(target * mix.easy));
  const wantMedium = Math.max(1, Math.round(target * mix.medium));
  const wantHard = Math.max(0, target - wantEasy - wantMedium);

  const chosen = [
    ...easy.slice(0, wantEasy),
    ...medium.slice(0, wantMedium),
    ...hard.slice(0, wantHard),
  ];

  const fallback = scored.filter((w) => !chosen.find((c) => c.es === w.es));
  while (chosen.length < Math.min(target, scored.length) && fallback.length) {
    chosen.push(fallback.shift());
  }

  return shuffle(chosen.map(({ _diff, _score, ...w }) => w));
}

function estimateFillBlankDifficulty(item = {}) {
  const answer = (item.answer || "").trim();
  const answerTokens = answer.split(/\s+/).filter(Boolean);
  const answerLetters = answer.replace(/[^\p{L}]/gu, "");
  const templateTokens = (item.template || "").split(/\s+/).filter(Boolean).length;
  const hasAccent = /[áéíóúñü]/i.test(answer);

  let score = 1;
  if (answerTokens.length >= 2) score += 1;
  if (answerLetters.length >= 7) score += 1;
  if (templateTokens >= 7) score += 1;
  if (hasAccent) score += 0.5;

  return Math.max(1, Math.min(5, Math.round(score)));
}

function readRecentFillBlanks(userKey, category) {
  try {
    const raw = localStorage.getItem(FILLBLANK_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return Array.isArray(data?.[userKey]?.[category]) ? data[userKey][category] : [];
  } catch {
    return [];
  }
}

function writeRecentFillBlanks(userKey, category, sentences = []) {
  try {
    const raw = localStorage.getItem(FILLBLANK_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const userData = data[userKey] || {};
    const prior = Array.isArray(userData[category]) ? userData[category] : [];
    const next = [...sentences.map((s) => s.template), ...prior]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 180);
    data[userKey] = { ...userData, [category]: next };
    localStorage.setItem(FILLBLANK_HISTORY_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

function selectAdaptiveFillBlanks(pool = [], { difficulty = 1, target = 6, userKey = "guest", category = "General" } = {}) {
  const unique = Object.values(
    (pool || []).reduce((acc, s) => {
      if (s?.template) acc[s.template] = s;
      return acc;
    }, {}),
  );

  if (!unique.length) return [];

  const recent = readRecentFillBlanks(userKey, category);
  const mix = targetMixForDifficulty(difficulty);

  const scored = unique
    .map((s) => {
      const diff = estimateFillBlankDifficulty(s);
      const recencyIdx = recent.indexOf(s.template);
      const noveltyBoost = recencyIdx === -1 ? 1 : Math.max(0, 1 - recencyIdx / Math.max(1, recent.length));
      const randomBoost = Math.random() * 0.3;
      return { ...s, _diff: diff, _score: noveltyBoost + randomBoost };
    })
    .sort((a, b) => b._score - a._score);

  const easy = scored.filter((s) => s._diff <= 2);
  const medium = scored.filter((s) => s._diff === 3);
  const hard = scored.filter((s) => s._diff >= 4);

  const wantEasy = Math.max(1, Math.round(target * mix.easy));
  const wantMedium = Math.max(1, Math.round(target * mix.medium));
  const wantHard = Math.max(0, target - wantEasy - wantMedium);

  const chosen = [
    ...easy.slice(0, wantEasy),
    ...medium.slice(0, wantMedium),
    ...hard.slice(0, wantHard),
  ];

  const fallback = scored.filter((s) => !chosen.find((c) => c.template === s.template));
  while (chosen.length < Math.min(target, scored.length) && fallback.length) {
    chosen.push(fallback.shift());
  }

  return shuffle(chosen.map(({ _diff, _score, ...s }) => s));
}

function estimateScrambleDifficulty(item = {}) {
  const words = Array.isArray(item.words) ? item.words : [];
  const text = words.join(" ");
  const longWords = words.filter((w) => (w || "").length >= 6).length;
  const hasAccent = /[áéíóúñü]/i.test(text);

  let score = 1;
  if (words.length >= 5) score += 1;
  if (words.length >= 7) score += 1;
  if (longWords >= 2) score += 1;
  if (hasAccent) score += 0.5;

  return Math.max(1, Math.min(5, Math.round(score)));
}

function readRecentScrambles(userKey, category) {
  try {
    const raw = localStorage.getItem(SCRAMBLE_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return Array.isArray(data?.[userKey]?.[category]) ? data[userKey][category] : [];
  } catch {
    return [];
  }
}

function writeRecentScrambles(userKey, category, items = []) {
  try {
    const raw = localStorage.getItem(SCRAMBLE_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const userData = data[userKey] || {};
    const prior = Array.isArray(userData[category]) ? userData[category] : [];
    const next = [...items.map((s) => s.correct), ...prior]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 180);
    data[userKey] = { ...userData, [category]: next };
    localStorage.setItem(SCRAMBLE_HISTORY_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

function selectAdaptiveScrambles(pool = [], { difficulty = 1, target = 6, userKey = "guest", category = "Sentence Scramble" } = {}) {
  const unique = Object.values(
    (pool || []).reduce((acc, s) => {
      if (s?.correct) acc[s.correct] = s;
      return acc;
    }, {}),
  );

  if (!unique.length) return [];

  const recent = readRecentScrambles(userKey, category);
  const mix = targetMixForDifficulty(difficulty);

  const scored = unique
    .map((s) => {
      const diff = estimateScrambleDifficulty(s);
      const recencyIdx = recent.indexOf(s.correct);
      const noveltyBoost = recencyIdx === -1 ? 1 : Math.max(0, 1 - recencyIdx / Math.max(1, recent.length));
      const randomBoost = Math.random() * 0.25;
      return { ...s, _diff: diff, _score: noveltyBoost + randomBoost };
    })
    .sort((a, b) => b._score - a._score);

  const easy = scored.filter((s) => s._diff <= 2);
  const medium = scored.filter((s) => s._diff === 3);
  const hard = scored.filter((s) => s._diff >= 4);

  const wantEasy = Math.max(1, Math.round(target * mix.easy));
  const wantMedium = Math.max(1, Math.round(target * mix.medium));
  const wantHard = Math.max(0, target - wantEasy - wantMedium);

  const chosen = [
    ...easy.slice(0, wantEasy),
    ...medium.slice(0, wantMedium),
    ...hard.slice(0, wantHard),
  ];

  const fallback = scored.filter((s) => !chosen.find((c) => c.correct === s.correct));
  while (chosen.length < Math.min(target, scored.length) && fallback.length) {
    chosen.push(fallback.shift());
  }

  return shuffle(chosen.map(({ _diff, _score, ...s }) => s));
}

function estimateListenDifficulty(item = {}) {
  const es = (item.es || "").trim();
  const tokens = es.split(/\s+/).filter(Boolean);
  const letters = es.replace(/[^\p{L}]/gu, "");
  const hasPunctuation = /[¿?¡!,.;:]/.test(es);

  let score = 1;
  if (tokens.length >= 5) score += 1;
  if (tokens.length >= 8) score += 1;
  if (letters.length >= 24) score += 1;
  if (hasPunctuation) score += 0.5;

  return Math.max(1, Math.min(5, Math.round(score)));
}

function readRecentListen(userKey, category) {
  try {
    const raw = localStorage.getItem(LISTEN_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return Array.isArray(data?.[userKey]?.[category]) ? data[userKey][category] : [];
  } catch {
    return [];
  }
}

function writeRecentListen(userKey, category, items = []) {
  try {
    const raw = localStorage.getItem(LISTEN_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const userData = data[userKey] || {};
    const prior = Array.isArray(userData[category]) ? userData[category] : [];
    const next = [...items.map((s) => s.es), ...prior]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 180);
    data[userKey] = { ...userData, [category]: next };
    localStorage.setItem(LISTEN_HISTORY_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

function selectAdaptiveListenSentences(pool = [], { difficulty = 1, target = 6, userKey = "guest", category = "Transcription" } = {}) {
  const unique = Object.values(
    (pool || []).reduce((acc, s) => {
      if (s?.es) acc[s.es] = s;
      return acc;
    }, {}),
  );

  if (!unique.length) return [];

  const recent = readRecentListen(userKey, category);
  const mix = targetMixForDifficulty(difficulty);

  const scored = unique
    .map((s) => {
      const diff = estimateListenDifficulty(s);
      const recencyIdx = recent.indexOf(s.es);
      const noveltyBoost = recencyIdx === -1 ? 1 : Math.max(0, 1 - recencyIdx / Math.max(1, recent.length));
      const randomBoost = Math.random() * 0.25;
      return { ...s, _diff: diff, _score: noveltyBoost + randomBoost };
    })
    .sort((a, b) => b._score - a._score);

  const easy = scored.filter((s) => s._diff <= 2);
  const medium = scored.filter((s) => s._diff === 3);
  const hard = scored.filter((s) => s._diff >= 4);

  const wantEasy = Math.max(1, Math.round(target * mix.easy));
  const wantMedium = Math.max(1, Math.round(target * mix.medium));
  const wantHard = Math.max(0, target - wantEasy - wantMedium);

  const chosen = [
    ...easy.slice(0, wantEasy),
    ...medium.slice(0, wantMedium),
    ...hard.slice(0, wantHard),
  ];

  const fallback = scored.filter((s) => !chosen.find((c) => c.es === s.es));
  while (chosen.length < Math.min(target, scored.length) && fallback.length) {
    chosen.push(fallback.shift());
  }

  return shuffle(chosen.map(({ _diff, _score, ...s }) => s));
}

const SUSPICIOUS_SPANISH_VALUES = new Set(["bye", "hello", "thanks", "please", "sorry", "goodbye"]);

function normalizeSimple(text = "") {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function buildStarterVocabMaps(pack) {
  const byCategory = {};
  const byEnglish = {};
  for (const [category, items] of Object.entries(pack?.vocab || {})) {
    for (const item of items || []) {
      const enKey = normalizeSimple(item.en);
      const categoryKey = `${category}::${enKey}`;
      byCategory[categoryKey] = item.es;
      if (!byEnglish[enKey]) byEnglish[enKey] = item.es;
    }
  }
  return { byCategory, byEnglish };
}

function looksSuspiciousSpanish(en, es) {
  const enNorm = normalizeSimple(en);
  const esNorm = normalizeSimple(es);
  if (!esNorm) return true;
  if (esNorm === enNorm) return true;
  if (SUSPICIOUS_SPANISH_VALUES.has(esNorm)) return true;
  return false;
}

function validateAndSanitizeContentPack(pack) {
  const starterMaps = buildStarterVocabMaps(starterPack);
  const cloned = JSON.parse(JSON.stringify(pack || {}));
  const issues = [];

  if (cloned?.vocab && typeof cloned.vocab === "object") {
    for (const [category, items] of Object.entries(cloned.vocab)) {
      if (!Array.isArray(items)) continue;
      cloned.vocab[category] = items.map((item) => {
        const en = item?.en || "";
        const es = item?.es || "";
        const enKey = normalizeSimple(en);
        const categoryKey = `${category}::${enKey}`;
        const fallback = starterMaps.byCategory[categoryKey] || starterMaps.byEnglish[enKey] || null;

        if (fallback && normalizeSimple(es) !== normalizeSimple(fallback)) {
          issues.push(`${category}: "${en}" had non-canonical Spanish "${es}" → replaced with "${fallback}"`);
          return { ...item, es: fallback };
        }

        if (looksSuspiciousSpanish(en, es) && !fallback) {
          issues.push(`${category}: "${en}" has suspicious Spanish "${es}" and no trusted fallback`);
        }

        if (!en || !es) {
          issues.push(`${category}: missing en/es for one vocab item`);
        }

        return item;
      });
    }
  }

  return { pack: cloned, issues };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [toast, setToast] = useState(null); const [loading, setLoading] = useState(false);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const isGoogleClientIdValid = /^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(googleClientId);
  const showGoogleAuthDebug = !!import.meta.env.DEV;
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";

  function showToast(msg, type="error") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1];
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  useEffect(() => {
    if (!googleClientId || !isGoogleClientIdValid) return;

    const mount = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp) => {
          const profile = decodeJwt(resp.credential || "");
          if (!profile?.sub) {
            showToast("Google sign-in failed");
            return;
          }
          const usernameKey = `google:${profile.sub}`;
          const existing = await loadUser(usernameKey);
          const user = existing || {
            username: usernameKey,
            password: null,
            displayName: profile.name || profile.email || "Google User",
            email: profile.email || null,
            authProvider: "google",
            points: 0,
            streak: 0,
            lastLogin: null,
            history: [],
            profile: {},
            joined: new Date().toISOString(),
          };
          await saveUser(user);
          onLogin(user);
        },
      });

      const el = document.getElementById("google-signin-btn");
      if (el) {
        el.innerHTML = "";
        window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", width: 320, text: "signin_with" });
      }
    };

    if (window.google?.accounts?.id) {
      mount();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = mount;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [googleClientId, isGoogleClientIdValid]);

  async function handle() {
    if (!username.trim() || !password.trim()) { showToast("Please fill in all fields"); return; }
    setLoading(true);
    if (mode === "login") {
      const user = await loadUser(username.toLowerCase());
      if (!user || user.password !== password) { showToast("Invalid credentials"); setLoading(false); return; }
      onLogin(user);
    } else {
      const existing = await loadUser(username.toLowerCase());
      if (existing) { showToast("Username already taken"); setLoading(false); return; }
      const user = { username: username.toLowerCase(), password, displayName: username, points:0, streak:0, lastLogin:null, history:[], profile:{}, joined:new Date().toISOString() };
      await saveUser(user); showToast("Account created!", "success"); setTimeout(() => onLogin(user), 800);
    }
    setLoading(false);
  }
  return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Outfit', sans-serif", backgroundImage:"radial-gradient(ellipse at 20% 50%, #1a0a3e 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0a1a3e 0%, transparent 50%)" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;900&display=swap');@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}*{box-sizing:border-box}input,textarea{outline:none}button{cursor:pointer;border:none;background:none}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#7c3aed55;border-radius:2px}`}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <div style={{ position:"fixed", top:"-10%", left:"-10%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(#7c3aed33, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:"-10%", right:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(#f59e0b22, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ background:"rgba(255,255,255,0.04)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, padding:"48px 40px", width:400 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <img
            src={MASCOT_ASSETS.base}
            alt="Chadlingo mascot"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ width:148, height:148, objectFit:"contain", marginBottom:10, filter:"drop-shadow(0 10px 20px rgba(124,58,237,0.35))" }}
          />
          <MascotSpeechBubble text={mode === "login" ? "¡Hola! Ready for today’s Spanish win?" : "Let’s build your streak — create your account!"} tone="default" style={{ margin:"0 auto 10px", maxWidth:300 }} />
          <h1 style={{ color:"#fff", margin:0, fontFamily:"'Playfair Display', serif", fontSize:34, fontWeight:900, lineHeight:1.1 }}>Chadlingo</h1>
          <p style={{ color:"#a78bfa", margin:"8px 0 0", fontSize:12, fontWeight:300, letterSpacing:3 }}>LEARN SPANISH WITH CHADLINGO</p>
        </div>
        <div style={{ display:"flex", background:"rgba(255,255,255,0.06)", borderRadius:12, padding:4, marginBottom:28 }}>
          {["login","register"].map(m => <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"10px 0", borderRadius:9, fontSize:13, fontWeight:600, fontFamily:"'Outfit', sans-serif", transition:"all 0.2s", background:mode===m?"#7c3aed":"transparent", color:mode===m?"#fff":"#9ca3af" }}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>)}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {["Username","Password"].map((label, i) => (
            <div key={label}>
              <label style={{ color:"#9ca3af", fontSize:12, fontWeight:600, letterSpacing:1, display:"block", marginBottom:6 }}>{label.toUpperCase()}</label>
              <input type={i===1?"password":"text"} value={i===0?username:password} onChange={e => i===0?setUsername(e.target.value):setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} placeholder={i===0?"your username":"••••••••"} style={{ width:"100%", padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:15, fontFamily:"'Outfit', sans-serif" }} />
            </div>
          ))}
          <PrimaryBtn onClick={handle} disabled={loading} style={{ marginTop:8 }}>{loading ? "…" : mode==="login" ? "Sign In →" : "Create Account →"}</PrimaryBtn>
          {googleClientId && isGoogleClientIdValid && (
            <>
              <div style={{ color:"#6b7280", fontSize:11, textAlign:"center", marginTop:8 }}>or</div>
              <div id="google-signin-btn" style={{ display:"flex", justifyContent:"center", marginTop:8 }} />
            </>
          )}
          {googleClientId && !isGoogleClientIdValid && (
            <div style={{ marginTop:12, background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.45)", borderRadius:10, padding:"10px 12px", color:"#fecaca", fontSize:12, lineHeight:1.4 }}>
              Google Sign-In config error: <code style={{ color:"#fff" }}>VITE_GOOGLE_CLIENT_ID</code> format looks invalid.
              <br />
              Expected: <code style={{ color:"#fff" }}>123...-abc.apps.googleusercontent.com</code>
            </div>
          )}
          {showGoogleAuthDebug && (
            <div style={{ marginTop:12, background:"rgba(59,130,246,0.10)", border:"1px solid rgba(59,130,246,0.35)", borderRadius:10, padding:"10px 12px", color:"#bfdbfe", fontSize:11, lineHeight:1.45 }}>
              <div><strong style={{ color:"#dbeafe" }}>Auth debug (dev only)</strong></div>
              <div>Origin: <code style={{ color:"#fff" }}>{currentOrigin || "(unknown)"}</code></div>
              <div>Client ID set: <code style={{ color:"#fff" }}>{googleClientId ? "yes" : "no"}</code></div>
              <div>Client ID format: <code style={{ color:"#fff" }}>{isGoogleClientIdValid ? "valid" : "invalid"}</code></div>
              <div style={{ marginTop:4, opacity:0.9 }}>Make sure this origin is added under Google OAuth → Authorized JavaScript origins.</div>
            </div>
          )}
          <div style={{ textAlign:"center", marginTop:14 }}>
            <a href="/blog" style={{ display:"inline-block", padding:"12px 24px", borderRadius:16, background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.3)", color:"#ddd6fe", fontSize:14, fontWeight:700, textDecoration:"none", transition:"all 0.2s", cursor:"pointer" }} onMouseOver={(e)=>{e.currentTarget.style.background="rgba(124,58,237,0.25)";e.currentTarget.style.borderColor="rgba(124,58,237,0.5)";}} onMouseOut={(e)=>{e.currentTarget.style.background="rgba(124,58,237,0.15)";e.currentTarget.style.borderColor="rgba(124,58,237,0.3)";}}>
              Explore the Community Learning Blog →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAMMAR LESSONS
// ═══════════════════════════════════════════════════════════════════════════════

function VerbLesson({ onComplete, verbs = VERBS }) {
  const [vi, setVi] = useState(() => Math.floor(Math.random()*verbs.length));
  const [phase, setPhase] = useState("intro"); const [pi, setPi] = useState(0);
  const [input, setInput] = useState(""); const [feedback, setFeedback] = useState(null); const [score, setScore] = useState(0);
  const verb = verbs[vi];
  function nextQ(ok) {
    const ns=score+(ok?1:0); setScore(ns);
    const n=pi+1;
    if(n>=verb.conjugations.length) onComplete(ns*15,ns,verb.conjugations.length);
    else { setPi(n); setInput(""); setFeedback(null); }
  }
  function check() {
    if(!input.trim()||feedback) return;
    const ok=input.trim().toLowerCase()===verb.conjugations[pi].form.toLowerCase();
    setFeedback(ok?"correct":"incorrect"); setTimeout(()=>nextQ(ok),1200);
  }
  if(phase==="intro") {
    const tc=verb.type.startsWith("Irregular")?"#f59e0b":verb.type.startsWith("Stem")?"#ec4899":"#22c55e";
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:520, margin:"0 auto" }}>
        <div style={{ background:"linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))", border:"1px solid rgba(124,58,237,0.3)", borderRadius:20, padding:"28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div style={{ color:"#a78bfa", fontSize:11, letterSpacing:2, marginBottom:6 }}>INFINITIVE</div>
              <div style={{ color:"#fff", fontSize:40, fontWeight:900, fontFamily:"'Playfair Display', serif" }}>{verb.infinitive}</div>
              <div style={{ color:"#d1d5db", fontSize:16, marginTop:4 }}>{verb.meaning}</div>
            </div>
            <span style={{ background:`${tc}22`, color:tc, border:`1px solid ${tc}55`, borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700 }}>{verb.type.toUpperCase()}</span>
          </div>
          <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:10, padding:"12px 16px", borderLeft:"3px solid #7c3aed" }}>
            <div style={{ color:"#e5e7eb", fontSize:15, fontStyle:"italic" }}>"{verb.example}"</div>
            <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>"{verb.exampleEn}"</div>
          </div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", color:"#e5e7eb", fontSize:14, fontWeight:700 }}>Present Tense Conjugations</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
            {verb.conjugations.map((c,i) => (
              <div key={i} style={{ padding:"14px 20px", borderBottom:i<4?"1px solid rgba(255,255,255,0.05)":"none", borderRight:i%2===0?"1px solid rgba(255,255,255,0.05)":"none" }}>
                <div style={{ color:"#a78bfa", fontSize:12, fontWeight:600 }}>{c.pronoun}</div>
                <div style={{ color:"#fff", fontSize:18, fontWeight:700 }}>{c.form}</div>
                <div style={{ color:"#6b7280", fontSize:11 }}>{c.meaning}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={() => { setVi((vi+1)%verbs.length); setPhase("intro"); }} style={{ flex:1, padding:"13px", borderRadius:12, fontSize:14, fontWeight:600, background:"rgba(255,255,255,0.06)", color:"#9ca3af", fontFamily:"'Outfit', sans-serif", border:"1px solid rgba(255,255,255,0.08)" }}>Try Another</button>
          <PrimaryBtn onClick={() => { setPhase("practice"); setPi(0); setInput(""); setFeedback(null); setScore(0); }} style={{ flex:2 }}>Practice This Verb →</PrimaryBtn>
        </div>
      </div>
    );
  }
  const cur=verb.conjugations[pi];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:22, maxWidth:480, margin:"0 auto" }}>
      <ProgressBar current={pi+1} total={verb.conjugations.length} />
      <div style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"32px 28px", textAlign:"center" }}>
        <div style={{ color:"#9ca3af", fontSize:13, marginBottom:12, letterSpacing:1 }}>CONJUGATE <span style={{ color:"#a78bfa", fontWeight:700 }}>{verb.infinitive}</span> FOR:</div>
        <div style={{ color:"#fff", fontSize:42, fontWeight:900, fontFamily:"'Playfair Display', serif", marginBottom:8 }}>{cur.pronoun}</div>
        <div style={{ color:"#6b7280", fontSize:13 }}>{cur.meaning}</div>
      </div>
      <FeedbackBanner feedback={feedback} correctAnswer={cur.form} />
      {!feedback && (
        <div style={{ display:"flex", gap:12, width:"100%" }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} placeholder={`Form for "${cur.pronoun}"…`} autoFocus style={{ flex:1, padding:"13px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:16, fontFamily:"'Outfit', sans-serif" }} />
          <PrimaryBtn onClick={check}>Check</PrimaryBtn>
        </div>
      )}
      <div style={{ color:"#6b7280", fontSize:13 }}>Score: {score} correct</div>
    </div>
  );
}

function SpeedRoundLesson({ onComplete, verbs = VERBS }) {
  const TOTAL=60;
  const [started, setStarted] = useState(false); const [timeLeft, setTimeLeft] = useState(TOTAL);
  const [questions] = useState(() => { const qs=[]; for(let i=0;i<40;i++){const v=verbs[Math.floor(Math.random()*verbs.length)];const c=v.conjugations[Math.floor(Math.random()*v.conjugations.length)];qs.push({verb:v.infinitive,pronoun:c.pronoun,answer:c.form,meaning:v.meaning});}return qs; });
  const [qi, setQi] = useState(0); const [input, setInput] = useState(""); const [flash, setFlash] = useState(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { if(!started) return; const t=setInterval(()=>setTimeLeft(tl=>{if(tl<=1){clearInterval(t);onComplete(score*10,score,Math.max(total,1));return 0;}return tl-1;}),1000); return ()=>clearInterval(t); },[started]);
  useEffect(() => { if(started) inputRef.current?.focus(); },[started, qi]);
  function check() {
    if(!input.trim()||!started||timeLeft<=0) return;
    const ok=input.trim().toLowerCase()===questions[qi].answer.toLowerCase();
    setFlash(ok?"correct":questions[qi].answer); setTotal(t=>t+1); if(ok) setScore(s=>s+1);
    setTimeout(()=>{ setFlash(null); setInput(""); setQi(i=>i+1); }, ok?300:800);
  }
  const tc=timeLeft>30?"#22c55e":timeLeft>10?"#f59e0b":"#ef4444";
  if(!started) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, maxWidth:460, margin:"0 auto", textAlign:"center" }}>
      <div style={{ fontSize:64 }}>⚡</div>
      <h2 style={{ color:"#fff", fontFamily:"'Playfair Display', serif", margin:0 }}>Speed Round</h2>
      <p style={{ color:"#9ca3af", fontSize:14 }}>60 seconds to conjugate as many verbs as possible. Type and press Enter to move on!</p>
      <PrimaryBtn onClick={()=>setStarted(true)} style={{ padding:"16px 48px", fontSize:16, fontWeight:800 }}>¡Empezar! →</PrimaryBtn>
    </div>
  );
  if(timeLeft<=0||qi>=questions.length) return null;
  const q=questions[qi];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, maxWidth:460, margin:"0 auto" }}>
      <div style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ color:"#9ca3af", fontSize:13 }}>Score: <strong style={{ color:"#4ade80" }}>{score}</strong> / {total}</div>
        <div style={{ color:tc, fontSize:28, fontWeight:900, fontFamily:"'Playfair Display', serif" }}>{timeLeft}s</div>
      </div>
      <div style={{ width:"100%", background:"rgba(255,255,255,0.06)", borderRadius:4, height:6 }}>
        <div style={{ height:"100%", borderRadius:4, width:`${(timeLeft/TOTAL)*100}%`, background:`linear-gradient(90deg, ${tc}, ${tc}88)`, transition:"width 1s linear" }} />
      </div>
      <div style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"32px 28px", textAlign:"center" }}>
        <div style={{ color:"#9ca3af", fontSize:12, letterSpacing:2, marginBottom:12 }}>CONJUGATE</div>
        <div style={{ color:"#a78bfa", fontSize:16, marginBottom:4 }}>{q.meaning}</div>
        <div style={{ color:"#fff", fontSize:42, fontWeight:900, fontFamily:"'Playfair Display', serif", marginBottom:8 }}>{q.verb}</div>
        <div style={{ color:"#f59e0b", fontSize:24, fontWeight:700 }}>→ {q.pronoun}</div>
      </div>
      <div style={{ height:24, color:flash==="correct"?"#4ade80":"#f87171", fontSize:flash==="correct"?24:14, fontWeight:800 }}>
        {flash&&(flash==="correct"?"✓":"✗ "+flash)}
      </div>
      <div style={{ display:"flex", gap:10, width:"100%" }}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} placeholder="Type conjugation & press Enter…" style={{ flex:1, padding:"14px 16px", borderRadius:12, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:16, fontFamily:"'Outfit', sans-serif" }} />
        <PrimaryBtn onClick={check}>→</PrimaryBtn>
      </div>
    </div>
  );
}

function SentenceScrambleLesson({ onComplete, scrambleSentences = SCRAMBLE_SENTENCES }) {
  const [items] = useState(() => shuffle(scrambleSentences).slice(0,5));
  const [idx, setIdx] = useState(0); const [chosen, setChosen] = useState([]); const [pool, setPool] = useState([]); const [feedback, setFeedback] = useState(null); const [score, setScore] = useState(0);
  useEffect(() => { setPool(shuffle([...items[idx].words])); setChosen([]); setFeedback(null); },[idx]);
  function addWord(w,i) { if(feedback) return; const p=[...pool]; p.splice(i,1); setPool(p); setChosen(c=>[...c,w]); }
  function removeWord(w,i) { if(feedback) return; const c=[...chosen]; c.splice(i,1); setChosen(c); setPool(p=>[...p,w]); }
  function check() {
    const ok=chosen.join(" ")===items[idx].correct;
    setFeedback(ok?"correct":"incorrect"); if(ok) setScore(s=>s+1);
    setTimeout(()=>{ if(idx+1>=items.length) onComplete((score+(ok?1:0))*15,(score+(ok?1:0)),items.length); else setIdx(i=>i+1); },1500);
  }
  const item=items[idx];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:520, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"16px 20px" }}>
        <div style={{ color:"#9ca3af", fontSize:11, letterSpacing:2, marginBottom:6 }}>HINT</div>
        <div style={{ color:"#e5e7eb", fontSize:15 }}>{item.hint}</div>
      </div>
      <div>
        <div style={{ color:"#a78bfa", fontSize:11, letterSpacing:2, marginBottom:10 }}>YOUR SENTENCE (tap words to remove):</div>
        <div style={{ minHeight:58, padding:"12px 16px", borderRadius:14, background:"rgba(255,255,255,0.04)", border:`2px solid ${feedback==="correct"?"#22c55e":feedback==="incorrect"?"#ef4444":"rgba(124,58,237,0.3)"}`, display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", transition:"border-color 0.3s" }}>
          {chosen.length===0&&<span style={{ color:"#6b7280", fontSize:14 }}>Click words below to build your sentence…</span>}
          {chosen.map((w,i)=><button key={i} onClick={()=>removeWord(w,i)} style={{ padding:"6px 12px", borderRadius:8, background:"rgba(124,58,237,0.25)", border:"1px solid #7c3aed55", color:"#c4b5fd", fontSize:14, fontWeight:600, fontFamily:"'Outfit', sans-serif" }}>{w}</button>)}
        </div>
      </div>
      {feedback&&<FeedbackBanner feedback={feedback} correctAnswer={feedback==="incorrect"?item.correct:null} />}
      <div>
        <div style={{ color:"#9ca3af", fontSize:11, letterSpacing:2, marginBottom:10 }}>AVAILABLE WORDS:</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {pool.map((w,i)=><button key={i} onClick={()=>addWord(w,i)} disabled={!!feedback} style={{ padding:"8px 14px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#e5e7eb", fontSize:14, fontWeight:600, fontFamily:"'Outfit', sans-serif" }}>{w}</button>)}
        </div>
      </div>
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={()=>{ setPool(shuffle([...item.words])); setChosen([]); }} disabled={!!feedback} style={{ padding:"12px 20px", borderRadius:10, fontSize:13, fontWeight:600, background:"rgba(255,255,255,0.06)", color:"#9ca3af", fontFamily:"'Outfit', sans-serif" }}>Clear</button>
        <PrimaryBtn onClick={check} disabled={chosen.length===0||!!feedback} style={{ flex:1 }}>Check Sentence</PrimaryBtn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTENING LESSONS
// ═══════════════════════════════════════════════════════════════════════════════

function TranscriptionLesson({ onComplete, listenSentences = LISTEN_SENTENCES }) {
  const [items] = useState(() => shuffle(listenSentences).slice(0,6));
  const [idx, setIdx] = useState(0); const [input, setInput] = useState(""); const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0); const [hasListened, setHasListened] = useState(false);
  function norm(s) { return s.toLowerCase().replace(/[¿¡.,!?]/g,"").trim(); }
  function check() {
    if(!input.trim()||!hasListened) return;
    const ok=norm(input)===norm(items[idx].es);
    const words=norm(input).split(" "); const target=norm(items[idx].es).split(" ");
    const partial=words.filter(w=>target.includes(w)).length/target.length;
    const fb=ok?"correct":partial>0.5?"partial":"incorrect";
    setFeedback(fb); if(ok) setScore(s=>s+1);
    setTimeout(()=>{ if(idx+1>=items.length) onComplete((score+(ok?1:0))*15,(score+(ok?1:0)),items.length); else { setFeedback(null); setInput(""); setIdx(i=>i+1); setHasListened(false); } },2000);
  }
  const item=items[idx];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, maxWidth:500, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"32px", textAlign:"center", width:"100%" }}>
        <div style={{ color:"#9ca3af", fontSize:12, letterSpacing:2, marginBottom:20 }}>🎧 LISTEN & TYPE WHAT YOU HEAR</div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
          <button onClick={()=>{ speak(item.es,0.8); setHasListened(true); }} style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 32px", borderRadius:16, background:"linear-gradient(135deg, #7c3aed, #a855f7)", color:"#fff", fontSize:16, fontWeight:700, fontFamily:"'Outfit', sans-serif", boxShadow:"0 4px 20px #7c3aed44" }}>🔊 Play Audio</button>
          <button onClick={()=>{ speak(item.es,0.5); setHasListened(true); }} style={{ color:"#6b7280", fontSize:12, fontFamily:"'Outfit', sans-serif" }}>🐌 Play slowly</button>
        </div>
        {!hasListened&&<div style={{ color:"#6b7280", fontSize:13, marginTop:16 }}>Press Play to hear the sentence</div>}
      </div>
      {feedback&&(
        <div style={{ padding:"16px 20px", borderRadius:14, width:"100%", background:feedback==="correct"?"rgba(34,197,94,0.12)":feedback==="partial"?"rgba(245,158,11,0.12)":"rgba(239,68,68,0.12)", border:`1px solid ${feedback==="correct"?"#22c55e44":feedback==="partial"?"#f59e0b44":"#ef444444"}` }}>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:8, color:feedback==="correct"?"#4ade80":feedback==="partial"?"#fbbf24":"#f87171" }}>{feedback==="correct"?"✓ ¡Perfecto!":feedback==="partial"?"~ Almost there!":"✗ Try again"}</div>
          <div style={{ color:"#d1d5db", fontSize:14 }}>Correct: <strong style={{ color:"#fff" }}>{item.es}</strong></div>
          <div style={{ color:"#9ca3af", fontSize:12, marginTop:4 }}>({item.en})</div>
        </div>
      )}
      <div style={{ display:"flex", gap:12, width:"100%" }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} placeholder={hasListened?"Type exactly what you heard…":"Listen first, then type…"} disabled={!!feedback} style={{ flex:1, padding:"13px 16px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:15, fontFamily:"'Outfit', sans-serif" }} />
        <PrimaryBtn onClick={check} disabled={!hasListened||!!feedback}>Check</PrimaryBtn>
      </div>
      <div style={{ color:"#6b7280", fontSize:12 }}>Tip: Punctuation like ¿ and ¡ is not required</div>
    </div>
  );
}

function AudioShadowingLesson({ onComplete, listenSentences = LISTEN_SENTENCES }) {
  const [items] = useState(() => shuffle(listenSentences).slice(0,5));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [micText, setMicText] = useState("");
  const [micScore, setMicScore] = useState(null);
  const [micListening, setMicListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [micMode, setMicMode] = useState("normal");

  const item=items[idx];
  function getSyllables(text) { return text.replace(/[¿¡.,!?]/g,"").split(" ").map(w=>({ word:w, syllables:Math.max(1,(w.match(/[aeiouáéíóúü]+/gi)||[]).length) })); }
  const pattern=getSyllables(item.es);

  function normalize(text) {
    return text.toLowerCase().replace(/[¿¡.,!?]/g,"").trim();
  }

  function similarityScore(spoken, target) {
    const a = normalize(spoken).split(" ").filter(Boolean);
    const b = normalize(target).split(" ").filter(Boolean);
    if (!a.length || !b.length) return 0;
    const overlap = a.filter(w => b.includes(w)).length;
    return Math.round((overlap / b.length) * 100);
  }

  function startMicCapture() {
    setMicError(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Mic recognition is not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setMicListening(true);

    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      const scorePct = similarityScore(transcript, item.es);
      setMicText(transcript);
      setMicScore(scorePct);
      setMicListening(false);
    };
    rec.onerror = () => {
      setMicListening(false);
      setMicError("Mic capture failed. Please try again.");
    };
    rec.onend = () => setMicListening(false);
    rec.start();
  }

  const MIC_THRESHOLDS = { easy: 60, normal: 70, strict: 82 };
  const activeThreshold = MIC_THRESHOLDS[micMode] ?? MIC_THRESHOLDS.normal;

  function goNext() {
    const earned = micScore !== null && micScore >= activeThreshold ? 2 : 0;
    if (earned > 0) setScore(s=>s+earned);
    if(idx+1>=items.length) onComplete((score+earned)*12,(score+earned),items.length);
    else {
      setIdx(i=>i+1);
      setMicText("");
      setMicScore(null);
      setMicError(null);
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, maxWidth:520, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"28px", width:"100%", textAlign:"center" }}>
        <div style={{ color:"#a78bfa", fontSize:11, letterSpacing:2, marginBottom:16 }}>🎤 SHADOW THIS SENTENCE</div>
        <div style={{ color:"#fff", fontSize:22, fontWeight:600, lineHeight:1.8, marginBottom:12, fontFamily:"'Playfair Display', serif" }}>{item.es}</div>
        <div style={{ color:"#6b7280", fontSize:14 }}>"{item.en}"</div>
      </div>
      <div style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"20px" }}>
        <div style={{ color:"#9ca3af", fontSize:11, letterSpacing:2, marginBottom:14 }}>STRESS PATTERN - taller = stressed</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:14, alignItems:"flex-end" }}>
          {pattern.map((w,wi)=>(
            <div key={wi} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ display:"flex", gap:3, alignItems:"flex-end" }}>
                {Array.from({length:w.syllables}).map((_,si)=><div key={si} style={{ width:10, borderRadius:3, background:si===0?"#a855f7":"#4c1d95", height:si===0?28:16 }} />)}
              </div>
              <div style={{ color:"#9ca3af", fontSize:10 }}>{w.word}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:12, width:"100%" }}>
        <button onClick={()=>speak(item.es,0.85)} style={{ flex:1, padding:"14px", borderRadius:12, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#e5e7eb", fontSize:14, fontWeight:600, fontFamily:"'Outfit', sans-serif" }}>🔊 Native Speed</button>
        <button onClick={()=>speak(item.es,0.5)} style={{ flex:1, padding:"14px", borderRadius:12, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#e5e7eb", fontSize:14, fontWeight:600, fontFamily:"'Outfit', sans-serif" }}>🐌 Slow</button>
      </div>

      <div style={{ width:"100%" }}>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {["easy","normal","strict"].map(mode => (
            <button key={mode} onClick={() => setMicMode(mode)} style={{ flex:1, padding:"8px 10px", borderRadius:10, fontSize:12, fontWeight:700, background:micMode===mode?"rgba(124,58,237,0.25)":"rgba(255,255,255,0.06)", border:`1px solid ${micMode===mode?"#7c3aed":"rgba(255,255,255,0.12)"}`, color:micMode===mode?"#d8b4fe":"#9ca3af" }}>
              {mode.toUpperCase()} ({MIC_THRESHOLDS[mode]}%)
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <PrimaryBtn onClick={startMicCapture} disabled={micListening} style={{ flex:1 }}>
            {micListening ? "Listening..." : "🎙️ Record my shadow"}
          </PrimaryBtn>
        </div>
      </div>
      {micError && <div style={{ color:"#f87171", fontSize:12 }}>{micError}</div>}
      {micText && (
        <div style={{ width:"100%", background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:12, padding:"12px 14px" }}>
          <div style={{ color:"#c4b5fd", fontSize:12 }}>Heard:</div>
          <div style={{ color:"#fff", fontSize:14, marginTop:4 }}>{micText}</div>
          <div style={{ color:(micScore>=activeThreshold?"#4ade80":"#fbbf24"), fontSize:12, marginTop:6 }}>
            Match score: {micScore}% • Mode: {micMode.toUpperCase()} ({activeThreshold}%) {micScore>=activeThreshold?"(+bonus)":""}
          </div>
        </div>
      )}

      <div style={{ width:"100%" }}>
        <PrimaryBtn onClick={goNext} disabled={micScore===null && !micError} style={{ width:"100%" }}>
          {idx+1>=items.length ? "Finish →" : "Next phrase →"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION LESSONS
// ═══════════════════════════════════════════════════════════════════════════════

function ScenarioBuilderLesson({ onComplete, scenariosData = SCENARIOS }) {
  const [scenarios] = useState(() => shuffle(scenariosData));
  const [idx, setIdx] = useState(0); const [selected, setSelected] = useState(null); const [shown, setShown] = useState(false); const [score, setScore] = useState(0);
  const [shuffledOptions] = useState(() => scenarios.map(s=>shuffle(s.options)));
  const sc=scenarios[idx];
  function choose(opt) { if(shown) return; setSelected(opt); setShown(true); if(opt.correct) setScore(s=>s+1); }
  function next() { if(idx+1>=scenarios.length) onComplete((score+(selected?.correct?1:0))*20,(score+(selected?.correct?1:0)),scenarios.length); else { setIdx(i=>i+1); setSelected(null); setShown(false); } }
  const opts=shuffledOptions[idx]||sc.options;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:540, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={scenarios.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"24px" }}>
        <div style={{ color:"#a78bfa", fontSize:13, fontWeight:700, marginBottom:8 }}>{sc.setting}</div>
        <div style={{ color:"#9ca3af", fontSize:13, marginBottom:16, fontStyle:"italic" }}>{sc.context}</div>
        {sc.dialogue.map((d,i)=>(
          <div key={i} style={{ display:"flex", gap:10, marginBottom:i===0?8:0 }}>
            {d.speaker&&<span style={{ color:"#f59e0b", fontSize:12, fontWeight:700, minWidth:70 }}>{d.speaker}:</span>}
            <span style={{ color:i===0?"#e5e7eb":"#6b7280", fontSize:i===0?16:13 }}>{d.line}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ color:"#9ca3af", fontSize:12, letterSpacing:1 }}>YOUR RESPONSE:</div>
        {opts.map((opt,i)=>{
          const isSel=selected===opt; const ok=opt.correct;
          const bg=shown&&ok?"rgba(34,197,94,0.15)":shown&&isSel&&!ok?"rgba(239,68,68,0.15)":isSel?"rgba(124,58,237,0.15)":"rgba(255,255,255,0.04)";
          const border=shown&&ok?"#22c55e55":shown&&isSel&&!ok?"#ef444455":isSel?"#7c3aed55":"rgba(255,255,255,0.08)";
          return (
            <button key={i} onClick={()=>choose(opt)} style={{ padding:"14px 18px", borderRadius:12, textAlign:"left", background:bg, border:`1px solid ${border}`, color:"#e5e7eb", fontSize:14, fontFamily:"'Outfit', sans-serif", transition:"all 0.2s", cursor:shown?"default":"pointer" }}>
              <div style={{ fontWeight:600 }}>{opt.text}</div>
              {shown&&(isSel||ok)&&<div style={{ color:ok?"#86efac":"#fca5a5", fontSize:12, marginTop:4 }}>{isSel?opt.feedback:ok&&!isSel?"✓ This was the best response":""}</div>}
            </button>
          );
        })}
      </div>
      {shown&&<PrimaryBtn onClick={next}>{idx+1>=scenarios.length?"Finish →":"Next Scenario →"}</PrimaryBtn>}
    </div>
  );
}

function ChatPartnerLesson({ onBack, onComplete, chatTopics = CHAT_TOPICS }) {
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState(0);
  const [lastScore, setLastScore] = useState(null); // {pts, delta, grade, feedback, correction}
  const [hintLoading, setHintLoading] = useState(false);
  const [translateHint, setTranslateHint] = useState(null);   // translation of last AI message
  const [suggestHint, setSuggestHint] = useState(null);       // suggested Spanish response
  const [hintsUsedThisTurn, setHintsUsedThisTurn] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  // Get last assistant message
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

  async function callClaude(system, userMessages, maxTokens = 250) {
    const res = await fetch("/api/anthropic/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages: userMessages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || `AI request failed (${res.status})`;
      throw new Error(msg);
    }
    return data.content?.[0]?.text || "";
  }

  async function startChat(t) {
    setTopic(t); setLoading(true); setPoints(0); setLastScore(null);
    try {
      const greeting = await callClaude(t.systemPrompt, [{ role:"user", content:"¡Hola! Quiero practicar español." }]);
      setMessages([{ role:"user", content:"¡Hola! Quiero practicar español." }, { role:"assistant", content: greeting || "¡Hola! ¿Cómo estás?" }]);
    } catch {
      setMessages([{ role:"assistant", content:"¡Hola! ¿Cómo estás? Estoy aquí para ayudarte." }]);
    }
    setHintsUsedThisTurn([]); setTranslateHint(null); setSuggestHint(null);
    setLoading(false);
  }

  async function getTranslation() {
    if (!lastAssistantMsg || hintLoading) return;
    setHintLoading(true); setHintsUsedThisTurn(h => [...new Set([...h, "translate"])]);
    try {
      const result = await callClaude(
        "You are a translator. Translate the Spanish text to English. Reply with ONLY the English translation, nothing else.",
        [{ role:"user", content: lastAssistantMsg.content }], 150
      );
      setTranslateHint(result);
    } catch { setTranslateHint("Could not translate - try again."); }
    setHintLoading(false);
  }

  async function getSuggestion() {
    if (!lastAssistantMsg || hintLoading) return;
    setHintLoading(true); setHintsUsedThisTurn(h => [...new Set([...h, "suggest"])]);
    try {
      const result = await callClaude(
        `You are a Spanish tutor helping a beginner. Given the conversation context and the last message from ${topic.label}, suggest ONE short, natural Spanish response the learner could say. Reply with ONLY the Spanish sentence (5-12 words), nothing else. No explanation.`,
        [...messages, { role:"user", content:`The AI just said: "${lastAssistantMsg.content}". What's a good beginner Spanish response?` }], 100
      );
      setSuggestHint(result.replace(/["""]/g, "").trim());
    } catch { setSuggestHint("No se puede generar una sugerencia ahora."); }
    setHintLoading(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    const hintPenalty = hintsUsedThisTurn.length; // each hint used = -1 from multiplier
    const um = { role:"user", content: userText };
    const nm = [...messages, um];
    setMessages(nm); setInput(""); setLoading(true);
    setTranslateHint(null); setSuggestHint(null); setHintsUsedThisTurn([]);

    // Simultaneously: evaluate the user's Spanish AND get the partner's reply
    try {
      const [evalResult, partnerReply] = await Promise.all([
        // Score the user's Spanish response
        callClaude(
          `You are a strict but encouraging Spanish language evaluator for beginners. Evaluate this Spanish message from a learner in the context of a conversation about "${topic.label}".
Score the response on:
1. Is it a proper Spanish sentence? (not just English, not just one word)
2. Grammar correctness
3. Relevance to the conversation
4. Vocabulary quality

Respond ONLY with valid JSON (no markdown):
{
  "grade": "excellent"|"good"|"ok"|"poor"|"english",
  "points": number between -10 and 30,
  "feedback": "one encouraging sentence in English (max 15 words)",
  "correction": "corrected Spanish sentence if needed, otherwise empty string"
}

Grade meanings: excellent=native-like (20-30pts), good=clear with minor errors (10-19pts), ok=understandable but issues (1-9pts), poor=major errors or too short (-5pts), english=wrote in English (-10pts)`,
          [{ role:"user", content: `Conversation topic: ${topic.label}. Last AI message: "${lastAssistantMsg?.content}". Learner wrote: "${userText}"` }], 200
        ),
        // Get the partner's conversational reply
        callClaude(topic.systemPrompt, nm, 200),
      ]);

      // Parse score
      let scoreData = { grade:"ok", points:5, feedback:"Keep going!", correction:"" };
      try {
        const cleaned = evalResult.replace(/```json|```/g, "").trim();
        scoreData = JSON.parse(cleaned);
      } catch {}

      // Apply hint penalty
      const hintMultiplier = Math.max(0.3, 1 - hintPenalty * 0.25);
      const rawPts = scoreData.points || 0;
      const finalPts = rawPts > 0 ? Math.round(rawPts * hintMultiplier) : rawPts;
      const hintNote = hintPenalty > 0 && rawPts > 0 ? ` (-${Math.round(rawPts - finalPts)} hint penalty)` : "";

      setPoints(p => Math.max(0, p + finalPts));
      setLastScore({ ...scoreData, pts: finalPts, delta: finalPts, hintNote });

      // Add the scored user message back with metadata, then partner reply
      setMessages(m => [
        ...m.slice(0, -1),
        { ...um, score: scoreData },
        { role:"assistant", content: partnerReply || "Lo siento, no entendí." },
      ]);
    } catch {
      setMessages(m => [...m, { role:"assistant", content:"Lo siento, hay un problema temporal. ¡Intenta de nuevo!" }]);
    }
    setLoading(false);
  }

  const gradeColors = { excellent:"#a855f7", good:"#22c55e", ok:"#f59e0b", poor:"#ef4444", english:"#ef4444" };
  const gradeLabels = { excellent:"✨ Excelente!", good:"✓ Bien hecho!", ok:"~ Casi...", poor:"✗ Needs work", english:"✗ En español, por favor!" };

  function finishSession() {
    const attempts = messages.filter(m => m.role === "user" && m.score).length || 1;
    const correct = messages.filter(m => m.role === "user" && m.score && ["excellent", "good", "ok"].includes(m.score.grade)).length;
    onComplete?.(Math.max(0, points), correct, attempts);
  }

  if (!topic) return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:500, margin:"0 auto" }}>
      <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:600, marginBottom:4 }}>Choose a Conversation Topic</div>
      <div style={{ color:"#9ca3af", fontSize:13, marginBottom:8 }}>Chat in Spanish and earn points! Use hints if you're stuck (small penalty applies).</div>
      {chatTopics.map(t => (
        <button key={t.id} onClick={() => startChat(t)} style={{ padding:"18px 20px", borderRadius:14, textAlign:"left", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#e5e7eb", fontSize:15, fontWeight:600, fontFamily:"'Outfit', sans-serif", transition:"all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="#7c3aed"; e.currentTarget.style.background="rgba(124,58,237,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", maxWidth:560, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, padding:"12px 16px", background:"rgba(255,255,255,0.04)", borderRadius:14, border:"1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{topic.label}</div>
          <div style={{ color:"#9ca3af", fontSize:12 }}>Session points: <span style={{ color:"#f59e0b", fontWeight:700 }}>{points}</span></div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={finishSession} style={{ color:"#4ade80", fontSize:12, fontWeight:700, fontFamily:"'Outfit', sans-serif", background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.35)", padding:"6px 12px", borderRadius:8 }}>Finish Session</button>
          <button onClick={() => { setTopic(null); setMessages([]); setPoints(0); setLastScore(null); }} style={{ color:"#9ca3af", fontSize:12, fontFamily:"'Outfit', sans-serif", background:"rgba(255,255,255,0.06)", padding:"6px 12px", borderRadius:8 }}>Change Topic</button>
        </div>
      </div>

      {/* Last score banner */}
      {lastScore && (
        <div style={{ marginBottom:10, padding:"10px 16px", borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center",
          background: lastScore.delta >= 10 ? "rgba(168,85,247,0.12)" : lastScore.delta > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border:`1px solid ${lastScore.delta >= 10 ? "#a855f733" : lastScore.delta > 0 ? "#22c55e33" : "#ef444433"}` }}>
          <div>
            <span style={{ color: gradeColors[lastScore.grade] || "#9ca3af", fontWeight:800, fontSize:14 }}>{gradeLabels[lastScore.grade] || "~"}</span>
            {lastScore.correction && <div style={{ color:"#a78bfa", fontSize:12, marginTop:2 }}>💡 {lastScore.correction}</div>}
            <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{lastScore.feedback}{lastScore.hintNote && <span style={{ color:"#f59e0b" }}>{lastScore.hintNote}</span>}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color: lastScore.delta >= 0 ? "#4ade80" : "#f87171", fontSize:20, fontWeight:900, fontFamily:"'Playfair Display', serif" }}>
              {lastScore.delta >= 0 ? "+" : ""}{lastScore.delta}
            </div>
            <div style={{ color:"#6b7280", fontSize:10 }}>pts</div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ height:"42vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:12, paddingRight:4, marginBottom:12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"82%", padding:"12px 16px", borderRadius:16,
              background: m.role==="user" ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(255,255,255,0.07)",
              border: m.role==="user" ? "none" : "1px solid rgba(255,255,255,0.08)",
              borderBottomRightRadius: m.role==="user" ? 4 : 16,
              borderBottomLeftRadius: m.role==="assistant" ? 4 : 16,
              color:"#fff", fontSize:14, lineHeight:1.6 }}>
              {m.role==="assistant" && <div style={{ fontSize:10, color:"#a78bfa", fontWeight:700, letterSpacing:1, marginBottom:4 }}>🤖 CHAD</div>}
              {m.content}
              {m.role==="assistant" && (
                <button onClick={() => speak(m.content)} style={{ display:"block", marginTop:8, color:"#7c3aed", fontSize:11 }}>🔊 Listen</button>
              )}
            </div>
            {/* Score badge on user messages */}
            {m.role==="user" && m.score && (
              <div style={{ marginTop:4, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                background:`${gradeColors[m.score.grade] || "#9ca3af"}22`,
                color: gradeColors[m.score.grade] || "#9ca3af",
                border:`1px solid ${gradeColors[m.score.grade] || "#9ca3af"}44` }}>
                {gradeLabels[m.score.grade]}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", justifyContent:"flex-start" }}>
            <div style={{ padding:"12px 18px", borderRadius:16, borderBottomLeftRadius:4, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display:"flex", gap:4 }}>{[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#7c3aed", animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Hint panels */}
      {(translateHint || suggestHint) && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
          {translateHint && (
            <div style={{ padding:"10px 14px", borderRadius:12, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.25)" }}>
              <div style={{ color:"#f59e0b", fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:3 }}>🌐 TRANSLATION</div>
              <div style={{ color:"#e5e7eb", fontSize:13 }}>{translateHint}</div>
            </div>
          )}
          {suggestHint && (
            <div style={{ padding:"10px 14px", borderRadius:12, background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.25)", cursor:"pointer" }}
              onClick={() => setInput(suggestHint)}>
              <div style={{ color:"#a78bfa", fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:3 }}>💡 SUGGESTED RESPONSE <span style={{ fontWeight:400 }}>(tap to use)</span></div>
              <div style={{ color:"#e5e7eb", fontSize:13, fontStyle:"italic" }}>{suggestHint}</div>
            </div>
          )}
        </div>
      )}

      {/* Hint buttons */}
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <button onClick={getTranslation} disabled={hintLoading || !lastAssistantMsg || loading} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 12px", borderRadius:10, fontSize:12, fontWeight:600, fontFamily:"'Outfit', sans-serif",
          background: hintsUsedThisTurn.includes("translate") ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
          border:`1px solid ${hintsUsedThisTurn.includes("translate") ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
          color: hintsUsedThisTurn.includes("translate") ? "#f59e0b" : "#9ca3af",
          opacity: hintLoading || !lastAssistantMsg || loading ? 0.4 : 1 }}>
          🌐 Translate {hintsUsedThisTurn.includes("translate") && <span style={{ fontSize:10 }}>(-25%)</span>}
        </button>
        <button onClick={getSuggestion} disabled={hintLoading || !lastAssistantMsg || loading} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 12px", borderRadius:10, fontSize:12, fontWeight:600, fontFamily:"'Outfit', sans-serif",
          background: hintsUsedThisTurn.includes("suggest") ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.05)",
          border:`1px solid ${hintsUsedThisTurn.includes("suggest") ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
          color: hintsUsedThisTurn.includes("suggest") ? "#c4b5fd" : "#9ca3af",
          opacity: hintLoading || !lastAssistantMsg || loading ? 0.4 : 1 }}>
          💡 Suggest {hintsUsedThisTurn.includes("suggest") && <span style={{ fontSize:10 }}>(-25%)</span>}
        </button>
        {hintsUsedThisTurn.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"0 10px", color:"#6b7280", fontSize:11 }}>
            -{Math.round(hintsUsedThisTurn.length * 25)}% pts
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{ display:"flex", gap:10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && send()} placeholder="Escribe en español…"
          style={{ flex:1, padding:"13px 16px", borderRadius:12, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:14, fontFamily:"'Outfit', sans-serif" }} />
        <PrimaryBtn onClick={send} disabled={loading || !input.trim()}>→</PrimaryBtn>
      </div>
      <div style={{ color:"#6b7280", fontSize:11, textAlign:"center", marginTop:8 }}>
        Proper Spanish sentences earn points · Hints reduce your score · Mistakes cost points
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL LESSONS
// ═══════════════════════════════════════════════════════════════════════════════

function ImageLabelingLesson({ onComplete, scenes = SCENES }) {
  const [sceneIdx] = useState(()=>Math.floor(Math.random()*scenes.length));
  const scene=scenes[sceneIdx];
  const [matched, setMatched] = useState([]); const [errors, setErrors] = useState(0); const [dragLabel, setDragLabel] = useState(null);
  const [available, setAvailable] = useState(()=>shuffle(scene.items.map(i=>i.label)));
  function tryPlace(targetLabel) {
    if(!dragLabel) return;
    if(dragLabel===targetLabel) {
      const nm=[...matched,targetLabel]; setMatched(nm); setAvailable(a=>a.filter(l=>l!==dragLabel));
      if(nm.length===scene.items.length) onComplete(Math.max(0,scene.items.length*15-errors*3),nm.length,scene.items.length);
    } else { setErrors(e=>e+1); }
    setDragLabel(null);
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:560, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ color:"#e5e7eb", fontWeight:700, fontSize:16 }}>{scene.name}</div>
        <div style={{ color:"#9ca3af", fontSize:13 }}>Placed: {matched.length}/{scene.items.length} • Errors: {errors}</div>
      </div>
      <div style={{ position:"relative", height:320, background:"linear-gradient(160deg, #1e1347 0%, #0f1a2e 100%)", borderRadius:20, border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" }} />
        {scene.items.map(item=>{
          const isPlaced=matched.includes(item.label);
          return (
            <div key={item.label} onDragOver={e=>e.preventDefault()} onDrop={()=>tryPlace(item.label)} onClick={()=>tryPlace(item.label)}
              style={{ position:"absolute", left:`${item.x}%`, top:`${item.y}%`, transform:"translate(-50%,-50%)", display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:dragLabel?"pointer":"default" }}>
              <div style={{ fontSize:28 }}>{item.emoji}</div>
              <div style={{ padding:"4px 10px", borderRadius:8, fontSize:12, fontWeight:700, background:isPlaced?"rgba(34,197,94,0.2)":dragLabel?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.08)", border:`1px solid ${isPlaced?"#22c55e66":dragLabel?"#7c3aed55":"rgba(255,255,255,0.15)"}`, color:isPlaced?"#4ade80":dragLabel?"#c4b5fd":"#9ca3af", minWidth:60, textAlign:"center", transition:"all 0.2s" }}>
                {isPlaced?item.label:"?"}
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ color:"#9ca3af", fontSize:11, letterSpacing:2, marginBottom:10 }}>DRAG OR TAP A LABEL, THEN TAP THE MATCHING OBJECT:</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {available.map(label=>{
            const item=scene.items.find(i=>i.label===label);
            return (
              <div key={label} draggable onDragStart={()=>setDragLabel(label)} onDragEnd={()=>setDragLabel(null)} onClick={()=>setDragLabel(dragLabel===label?null:label)}
                style={{ padding:"10px 16px", borderRadius:10, fontSize:14, fontWeight:700, background:dragLabel===label?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.07)", border:`1px solid ${dragLabel===label?"#7c3aed":"rgba(255,255,255,0.12)"}`, color:dragLabel===label?"#c4b5fd":"#e5e7eb", cursor:"grab", userSelect:"none", transition:"all 0.15s", fontFamily:"'Outfit', sans-serif" }}>
                {label}
                <div style={{ color:"#6b7280", fontSize:10, fontWeight:400 }}>{item?.en}</div>
              </div>
            );
          })}
          {available.length===0&&<div style={{ color:"#22c55e", fontWeight:600, fontSize:14 }}>¡Perfecto! All labeled! 🎉</div>}
        </div>
      </div>
    </div>
  );
}

function PictureDescriptionLesson({ onComplete, pictureScenes = PICTURE_SCENES }) {
  const [items] = useState(()=>shuffle(pictureScenes).slice(0,4));
  const [idx, setIdx] = useState(0); const [input, setInput] = useState(""); const [feedback, setFeedback] = useState(null); const [loading, setLoading] = useState(false); const [score, setScore] = useState(0);
  const item=items[idx];
  async function check() {
    if(!input.trim()||loading) return;
    setLoading(true);
    try {
      const res=await fetch("/api/anthropic/messages",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:200, system:`You are a Spanish tutor evaluating a beginner's scene description. The scene: "${item.description}". A good answer: "${item.prompt}". Evaluate the student's Spanish. Respond ONLY with JSON: {"score":1-3,"feedback":"short encouraging feedback in English","correction":"a better Spanish sentence if needed"}. Score 3=great Spanish describing the scene, 2=minor errors or partially correct, 1=major errors or off topic.`, messages:[{role:"user",content:`Student wrote: "${input}"`}] }) });
      const data=await res.json().catch(() => ({}));
      if(!res.ok) throw new Error(data?.error || `AI request failed (${res.status})`);
      const text=data.content?.[0]?.text||'{"score":2,"feedback":"Good try!","correction":""}';
      const result=JSON.parse(text.replace(/```json|```/g,"").trim());
      setFeedback(result); if(result.score>=2) setScore(s=>s+1);
    } catch (err) { setFeedback({score:1,feedback:"AI is temporarily unavailable. Please try again shortly.",correction:""}); }
    setLoading(false);
  }
  function next() { if(idx+1>=items.length) onComplete(score*20,score,items.length); else { setIdx(i=>i+1); setInput(""); setFeedback(null); } }
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, maxWidth:500, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"32px", textAlign:"center", width:"100%" }}>
        <div style={{ fontSize:60, letterSpacing:8, marginBottom:16 }}>{item.emoji}</div>
        <div style={{ color:"#9ca3af", fontSize:12, letterSpacing:2 }}>DESCRIBE THIS SCENE IN SPANISH</div>
        <div style={{ color:"#6b7280", fontSize:12, marginTop:8 }}>Write 1-2 sentences. Don't worry about perfection!</div>
      </div>
      {feedback&&(
        <div style={{ width:"100%", padding:"16px 20px", borderRadius:14, background:feedback.score===3?"rgba(34,197,94,0.12)":feedback.score===2?"rgba(245,158,11,0.12)":"rgba(239,68,68,0.12)", border:`1px solid ${feedback.score===3?"#22c55e44":feedback.score===2?"#f59e0b44":"#ef444444"}` }}>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:8, color:feedback.score===3?"#4ade80":feedback.score===2?"#fbbf24":"#f87171" }}>{"⭐".repeat(feedback.score)} {feedback.score===3?"¡Excelente!":feedback.score===2?"¡Bien hecho!":"Keep Practicing!"}</div>
          <div style={{ color:"#d1d5db", fontSize:14, marginBottom:feedback.correction?8:0 }}>{feedback.feedback}</div>
          {feedback.correction&&<div style={{ color:"#a78bfa", fontSize:13, fontStyle:"italic" }}>💡 Try: "{feedback.correction}"</div>}
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%" }}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Escribe tu descripción aquí…" rows={3} disabled={!!feedback||loading} style={{ padding:"13px 16px", borderRadius:12, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", fontSize:15, fontFamily:"'Outfit', sans-serif", resize:"none", outline:"none" }} />
        {!feedback ? <PrimaryBtn onClick={check} disabled={loading||!input.trim()}>{loading?"Evaluating…":"Check My Description →"}</PrimaryBtn> : <PrimaryBtn onClick={next}>{idx+1>=items.length?"Finish →":"Next Scene →"}</PrimaryBtn>}
      </div>
    </div>
  );
}

function PlacementTestLesson({ onComplete, vocab = VOCAB, sentences = SENTENCES, verbs = VERBS }) {
  const vocabPool = Object.values(vocab).flat();
  const [questions] = useState(() => {
    const q = [];
    shuffle(vocabPool).slice(0, 4).forEach(item => {
      const opts = shuffle([item.es, ...shuffle(vocabPool.filter(v => v.es !== item.es)).slice(0, 3).map(v => v.es)]);
      q.push({ type: "vocab", prompt: `"${item.en}" in Spanish is…`, answer: item.es, options: opts });
    });
    shuffle(sentences).slice(0, 2).forEach(s => q.push({ type: "blank", prompt: s.template, answer: s.answer }));
    shuffle(verbs).slice(0, 2).forEach(v => {
      const c = v.conjugations[Math.floor(Math.random() * v.conjugations.length)];
      q.push({ type: "verb", prompt: `Conjugate ${v.infinitive} for ${c.pronoun}`, answer: c.form });
    });
    return shuffle(q).slice(0, 8);
  });
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);

  function submit(ans) {
    const q = questions[idx];
    const guess = (ans ?? input).trim().toLowerCase();
    if (!guess) return;
    const ok = guess === q.answer.toLowerCase();
    if (ok) setScore(s => s + 1);
    setFeedback(ok ? "correct" : "incorrect");
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        const finalCorrect = score + (ok ? 1 : 0);
        const { level, recommendedLessons } = placementFromScore(finalCorrect, questions.length);
        onComplete(finalCorrect * 15, finalCorrect, questions.length, { level, recommendedLessons });
      } else {
        setIdx(i => i + 1);
        setInput("");
        setFeedback(null);
      }
    }, 700);
  }

  const q = questions[idx];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18, maxWidth:560, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={questions.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"22px" }}>
        <div style={{ color:"#a78bfa", fontSize:12, marginBottom:10 }}>Question {idx+1}</div>
        <div style={{ color:"#fff", fontSize:22, fontWeight:700 }}>{q.prompt}</div>
      </div>
      {q.options ? (
        <div style={{ display:"grid", gap:10 }}>
          {q.options.map(opt => (
            <button key={opt} onClick={() => submit(opt)} disabled={!!feedback} style={{ padding:"12px 14px", borderRadius:10, textAlign:"left", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#e5e7eb", fontWeight:600 }}>{opt}</button>
          ))}
        </div>
      ) : (
        <div style={{ display:"flex", gap:10 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ flex:1, padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }} />
          <PrimaryBtn onClick={() => submit()}>Check</PrimaryBtn>
        </div>
      )}
      <FeedbackBanner feedback={feedback} correctAnswer={q.answer} />
    </div>
  );
}

function PronunciationCoachLesson({ onComplete, listenSentences = LISTEN_SENTENCES }) {
  const [items] = useState(() => shuffle(listenSentences).slice(0, 5));
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);

  function similarity(a, b) {
    const aa = a.toLowerCase().replace(/[¿¡.,!?]/g,"").split(" ").filter(Boolean);
    const bb = b.toLowerCase().replace(/[¿¡.,!?]/g,"").split(" ").filter(Boolean);
    if (!aa.length || !bb.length) return 0;
    const overlap = aa.filter(w => bb.includes(w)).length;
    return overlap / bb.length;
  }

  function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setFeedback({ ok:false, msg:"Speech recognition not supported in this browser." }); return; }
    const rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript || "";
      setTranscript(said);
      const target = items[idx].es;
      const sim = similarity(said, target);
      const ok = sim >= 0.7;
      if (ok) setScore(s => s + 1);
      setFeedback({ ok, msg: ok ? "Great pronunciation match!" : `Try again. Heard: \"${said}\"` });
      setListening(false);
    };
    rec.onerror = () => { setListening(false); setFeedback({ ok:false, msg:"Mic error. Try again." }); };
    rec.onend = () => setListening(false);
    rec.start();
  }

  function next() {
    if (idx + 1 >= items.length) onComplete(score * 18, score, items.length);
    else { setIdx(i => i + 1); setTranscript(""); setFeedback(null); }
  }

  const cur = items[idx];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18, maxWidth:560, margin:"0 auto" }}>
      <ProgressBar current={idx+1} total={items.length} />
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"20px" }}>
        <div style={{ color:"#a78bfa", fontSize:12 }}>Target sentence</div>
        <div style={{ color:"#fff", fontSize:24, fontWeight:700, marginTop:6 }}>{cur.es}</div>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:6 }}>{cur.en}</div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={() => speak(cur.es, 0.8)} style={{ flex:1, padding:"12px", borderRadius:10, background:"rgba(255,255,255,0.06)", color:"#e5e7eb", border:"1px solid rgba(255,255,255,0.1)" }}>🔊 Play</button>
        <PrimaryBtn onClick={startMic} disabled={listening}>{listening ? "Listening…" : "🎤 Record"}</PrimaryBtn>
      </div>
      {transcript && <div style={{ color:"#c4b5fd", fontSize:14 }}>You said: {transcript}</div>}
      {feedback && <div style={{ color: feedback.ok ? "#4ade80" : "#f87171", fontWeight:700 }}>{feedback.msg}</div>}
      <PrimaryBtn onClick={next} disabled={!feedback}>Next</PrimaryBtn>
    </div>
  );
}

function DictionaryBookLesson({ user, onComplete, onPractice, onPracticeWord, contentPack }) {
  const words = useMemo(() => {
    const base = (cefrVocab?.vocab || []).filter((w) => ['A1', 'A2'].includes(w?.cefr));
    const approved = Object.entries(approvedVocab?.vocab || {}).flatMap(([topic, list]) =>
      (list || [])
        .filter((x) => x?.approved && x?.es && x?.en)
        .map((x) => ({ id: x?.id || `${normalizeSimple(x.es)}:${normalizeSimple(x.en)}`, es: x.es, en: x.en, topic: x?.topic || topic, pos: x?.pos || 'word', cefr: x?.cefr || 'A1' }))
    );
    const packWords = Object.entries(contentPack?.vocab || {}).flatMap(([topic, list]) =>
      (list || [])
        .filter((x) => x?.es && x?.en)
        .map((x) => ({ id: x?.id || `${normalizeSimple(x.es)}:${normalizeSimple(x.en)}`, es: x.es, en: x.en, topic: x?.topic || topic, pos: x?.pos || 'word', cefr: x?.cefr || 'A1' }))
    );

    const map = new Map();
    [...base, ...approved, ...packWords].forEach((w) => {
      const key = w?.id || `${normalizeSimple(w?.es || '')}:${normalizeSimple(w?.en || '')}`;
      if (!key) return;
      if (!map.has(key)) map.set(key, w);
    });

    return [...map.values()]
      .filter((w) => ['A1', 'A2'].includes(w?.cefr || 'A1'))
      .sort((a, b) => (a?.es || '').localeCompare(b?.es || ''));
  }, [contentPack]);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [pageFlip, setPageFlip] = useState(false);
  const perPage = 16;

  function wordStatus(w) {
    const e = user?.profile?.wordExposure?.[w?.id || w?.es] || { seen: 0, correct: 0 };
    const seen = Number(e?.seen || 0);
    const correct = Number(e?.correct || 0);
    const acc = seen > 0 ? correct / seen : 0;
    if (seen <= 0) return { key: 'unseen', label: 'Unseen', color: '#9ca3af' };
    if (acc < 0.7) return { key: 'needs', label: 'Needs review', color: '#f87171' };
    return { key: 'learned', label: 'Learned', color: '#4ade80' };
  }

  const topics = useMemo(() => {
    const s = new Set(words.map((w) => w?.topic || 'General'));
    return ['all', ...[...s].sort((a, b) => String(a).localeCompare(String(b)))];
  }, [words]);

  const filtered = useMemo(() => {
    const q = normalizeSimple(query || '');
    return words.filter((w) => {
      const st = wordStatus(w).key;
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (topicFilter !== 'all' && (w?.topic || 'General') !== topicFilter) return false;
      if (!q) return true;
      return normalizeSimple(w?.es || '').includes(q) || normalizeSimple(w?.en || '').includes(q);
    });
  }, [words, query, statusFilter, topicFilter, user]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.max(0, Math.min(page, pageCount - 1));
  const pageWords = filtered.slice(safePage * perPage, (safePage + 1) * perPage);
  const unseenCount = words.filter((w) => wordStatus(w).key === 'unseen').length;
  const needsCount = words.filter((w) => wordStatus(w).key === 'needs').length;
  const learnedCount = words.filter((w) => wordStatus(w).key === 'learned').length;

  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  useEffect(() => {
    setPageFlip(true);
    const t = setTimeout(() => setPageFlip(false), 320);
    return () => clearTimeout(t);
  }, [safePage]);

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder='Search Spanish or English...' style={{ flex:1, minWidth:220, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff' }} />
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, background:'#1f1638', color:'#fff', border:'1px solid rgba(255,255,255,0.14)' }}>
          <option value='all'>All words</option>
          <option value='learned'>Learned (green)</option>
          <option value='needs'>Needs review (red)</option>
          <option value='unseen'>Unseen (grey)</option>
        </select>
        <select value={topicFilter} onChange={(e)=>setTopicFilter(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, background:'#1f1638', color:'#fff', border:'1px solid rgba(255,255,255,0.14)' }}>
          {topics.map((t) => <option key={t} value={t}>{t === 'all' ? 'All topics' : t}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div style={{ background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.35)', color:'#86efac', borderRadius:999, padding:'4px 10px', fontSize:12 }}>Learned: {learnedCount}</div>
        <div style={{ background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.35)', color:'#fca5a5', borderRadius:999, padding:'4px 10px', fontSize:12 }}>Needs review: {needsCount}</div>
        <div style={{ background:'rgba(156,163,175,0.12)', border:'1px solid rgba(156,163,175,0.35)', color:'#d1d5db', borderRadius:999, padding:'4px 10px', fontSize:12 }}>Unseen: {unseenCount}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:12 }}>
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:12 }}>
          <div style={{ color:'#a78bfa', fontSize:12, marginBottom:8 }}>Dictionary Book · Page {safePage + 1}/{pageCount}</div>
          <div key={`page:${safePage}`} style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8, transformOrigin:'left center', animation: pageFlip ? 'bookFlip 0.32s ease' : 'none' }}>
            {pageWords.map((w) => {
              const st = wordStatus(w);
              return (
                <button key={w.id || w.es} onClick={() => setSelected(w)} style={{ textAlign:'left', borderRadius:10, padding:'9px 10px', background:'rgba(255,255,255,0.03)', border:`1px solid ${st.color}66` }}>
                  <div style={{ color:'#fff', fontWeight:700 }}>{w.es}</div>
                  <div style={{ color:'#cbd5e1', fontSize:12 }}>{w.en}</div>
                  <div style={{ color:st.color, fontSize:11, marginTop:4 }}>{st.label}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, alignItems:'center', gap:8 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} style={{ color:'#ddd6fe' }}>← Prev</button>
            <button onClick={() => {
              const pageSet = pageWords.map((w) => ({ id: w.id || w.es, es: w.es, en: w.en, cefr: w.cefr || 'A1' }));
              if (pageSet.length) onPractice?.(pageSet);
            }} style={{ padding:'6px 10px', borderRadius:8, background:'rgba(6,182,212,0.2)', color:'#67e8f9', fontWeight:700 }}>
              Practice this page
            </button>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} style={{ color:'#ddd6fe' }}>Next →</button>
          </div>
        </div>

        <div style={{ background:'rgba(124,58,237,0.12)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:14, padding:12 }}>
          <img src={MASCOT_ASSETS.base} alt='mascot' style={{ width:72, height:72, objectFit:'contain' }} onError={(e)=>{e.currentTarget.style.display='none';}} />
          {selected ? (
            <>
              <div style={{ color:'#fff', fontSize:22, fontWeight:900, marginTop:6 }}>{selected.es}</div>
              <div style={{ color:'#c4b5fd', marginBottom:6 }}>{selected.en}</div>
              <div style={{ color:'#9ca3af', fontSize:12 }}>Topic: {selected.topic || 'General'}</div>
              <div style={{ color:'#9ca3af', fontSize:12 }}>Type: {selected.pos || 'word'}</div>
              <MascotSpeechBubble text={`Great choice. Practice “${selected.es}” in your next module.`} tone='default' style={{ marginTop:10 }} />
              <button onClick={() => onPracticeWord?.({ id: selected.id || selected.es, es: selected.es, en: selected.en, cefr: selected.cefr || 'A1' })} style={{ marginTop:10, width:'100%', padding:'9px 10px', borderRadius:10, background:'rgba(124,58,237,0.3)', color:'#fff', fontWeight:700 }}>
                Practice this word
              </button>
            </>
          ) : (
            <MascotSpeechBubble text='Tap a word to preview it with mascot guidance.' tone='default' style={{ marginTop:8 }} />
          )}
          <button onClick={() => {
            const weak = words.filter((w) => wordStatus(w).key === 'needs').slice(0, 8).map((w) => ({ id: w.id || w.es, es: w.es, en: w.en, cefr: w.cefr || 'A1' }));
            if (weak.length) onPractice?.(weak);
          }} style={{ marginTop:10, width:'100%', padding:'9px 10px', borderRadius:10, background:'rgba(239,68,68,0.2)', color:'#fecaca', fontWeight:700 }}>
            Practice weak words
          </button>
        </div>
      </div>

      <PrimaryBtn onClick={() => onComplete(0, 0, 1, { wordResults: [] })}>Done Browsing</PrimaryBtn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function ResultScreen({ points, correct, total, onBack, progression }) {
  const pct=Math.round(correct/total*100);
  const progEarned = Number(progression?.progressPointsEarned || 0);
  const strengthEarned = Number(progression?.strengthPointsEarned || 0);
  const progBand = progression?.cefrBand || null;
  const strengthenedLevelKey = progression?.strengthenedLevelKey || null;
  const progPct = Math.round(Number(progression?.bandProgress || 0) * 100);
  const learningPct = Math.round(Number(progression?.learningProgress || 0) * 100);
  const mascot = pct >= 80 ? MASCOT_ASSETS.success : pct >= 50 ? MASCOT_ASSETS.progress : MASCOT_ASSETS.base;
  const bubble = pct >= 80 ? "¡Excelente! You crushed it 🔥" : pct >= 50 ? "Nice work — keep pushing, you’re leveling up." : "Great effort. One more round and you’ll nail it 💪";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:"20px 0" }}>
      <img src={mascot} alt="Chadlingo mascot feedback" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width:180, height:180, objectFit:"contain" }} />
      <MascotSpeechBubble text={bubble} tone={pct >= 80 ? "success" : pct >= 50 ? "default" : "hype"} style={{ maxWidth:360, textAlign:"center" }} />
      <h2 style={{ color:"#fff", margin:0, fontFamily:"'Playfair Display', serif", fontSize:28 }}>{pct>=80?"¡Excelente!":pct>=50?"¡Bien hecho!":"Keep Practicing!"}</h2>
      <div style={{ background:"rgba(124,58,237,0.15)", border:"1px solid #7c3aed44", borderRadius:16, padding:"24px 40px", textAlign:"center" }}>
        <div style={{ color:"#a78bfa", fontSize:13, letterSpacing:2, marginBottom:8 }}>POINTS EARNED</div>
        <div style={{ color:"#fff", fontSize:48, fontWeight:800, fontFamily:"'Playfair Display', serif" }}>+{points}</div>
        <div style={{ color:"#9ca3af", fontSize:14, marginTop:8 }}>{correct}/{total} correct ({pct}%)</div>
      </div>
      {progression && (
        <div style={{ width:'100%', maxWidth:420, background:'rgba(6,182,212,0.10)', border:'1px solid rgba(34,211,238,0.35)', borderRadius:14, padding:'12px 14px' }}>
          <div style={{ color:'#67e8f9', fontSize:11, letterSpacing:2, marginBottom:8 }}>PROGRESSION BOOST</div>
          <div style={{ color:'#ecfeff', fontSize:15, fontWeight:800 }}>+{progEarned.toFixed(2)} progress points</div>
          <div style={{ color:'#a7f3d0', fontSize:13, marginTop:4, fontWeight:700 }}>+{strengthEarned.toFixed(2)} level strength</div>
          <div style={{ color:'#bae6fd', fontSize:12, marginTop:4 }}>
            {progBand ? 'Your learning path' : 'Current path'} • Mastery {progPct}% • Learning {learningPct}%
          </div>
          {strengthenedLevelKey && <div style={{ color:'#bbf7d0', fontSize:12, marginTop:4 }}>🛡️ Reinforced learning node: {formatStrengthNodeLabel(strengthenedLevelKey)}</div>}
          {progEarned >= 2.5 && <div style={{ color:'#86efac', fontSize:12, marginTop:6, fontWeight:700 }}>✨ Stretch bonus momentum unlocked!</div>}
        </div>
      )}
      <PrimaryBtn onClick={onBack}>Back to Dashboard</PrimaryBtn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

const AI_REQUIRED_LESSONS = new Set(["Chat Partner", "Picture Description"]);

function ContentPackManager({ contentPackMeta, onImportPack, onResetPack }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState(null);

  async function importPack() {
    try {
      const parsed = JSON.parse(json);
      if (!parsed?.id || !parsed?.vocab) throw new Error("Pack requires id + vocab");
      await onImportPack(parsed);
      setMsg({ type: "ok", text: `Imported ${parsed.name || parsed.id}` });
      setJson("");
    } catch (e) {
      setMsg({ type: "err", text: e?.message || "Invalid JSON" });
    }
  }

  return (
    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:"20px", marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700 }}>Content Pack Manager</div>
        <button onClick={() => setOpen(v => !v)} style={{ color:"#a78bfa", fontSize:12 }}>{open ? "Hide" : "Import"}</button>
      </div>
      <div style={{ color:"#9ca3af", fontSize:12 }}>Active: <span style={{ color:"#e5e7eb" }}>{contentPackMeta?.name || contentPackMeta?.id || "starter-pack"}</span></div>
      {open && (
        <div style={{ display:"grid", gap:8, marginTop:10 }}>
          <textarea value={json} onChange={e=>setJson(e.target.value)} rows={6} placeholder='Paste content pack JSON' style={{ padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", fontSize:12, fontFamily:"monospace" }} />
          <div style={{ display:"flex", gap:8 }}>
            <PrimaryBtn onClick={importPack}>Import Pack</PrimaryBtn>
            <button onClick={onResetPack} style={{ padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.06)", color:"#9ca3af" }}>Reset Starter</button>
          </div>
          {msg && <div style={{ color:msg.type==="ok"?"#4ade80":"#f87171", fontSize:12 }}>{msg.text}</div>}
        </div>
      )}
    </div>
  );
}

function Dashboard({ user, onStartLesson, onLogout, aiStatus, onOpenStoryMode }) {
  const [showProgressMap, setShowProgressMap] = useState(false);
  const [levelPreview, setLevelPreview] = useState(null);
  const today=new Date().toDateString();
  const { quests, todayPts, todayLessons, todayListening } = getDailyQuestState(user.history, new Date());
  const dayLabels=[],dayPoints=[];
  for(let i=6;i>=0;i--){ const d=new Date();d.setDate(d.getDate()-i);dayLabels.push(d.toLocaleDateString("en",{weekday:"short"}));dayPoints.push(user.history.filter(h=>new Date(h.date).toDateString()===d.toDateString()).reduce((s,h)=>s+h.points,0)); }
  const maxPts=Math.max(...dayPoints,50);
  const recommended = user.profile?.recommendedLessons || [];
  const level = user.profile?.level || null;
  const pathView = getNextPathStep(user.profile || {});
  const pathPlan = pathView.plan;
  const nextPathStep = pathView.nextStep;
  const nextSuggested = nextPathStep?.moduleType || recommended[0] || "Flashcards";
  const masteryEntries = Object.entries(user.profile?.mastery || {});
  const weakest = [...masteryEntries].sort((a,b)=>(a[1]?.score||50)-(b[1]?.score||50)).slice(0,3);
  const strongest = [...masteryEntries].sort((a,b)=>(b[1]?.score||50)-(a[1]?.score||50)).slice(0,3);
  const recentAcc = user.profile?.recentAccuracies || [];
  const avgAcc = recentAcc.length ? Math.round(recentAcc.reduce((s,n)=>s+n,0)/recentAcc.length) : null;
  const groups={};
  LESSON_TYPES.forEach(t=>{ const g=LESSON_META[t].group; if(!groups[g]) groups[g]=[]; groups[g].push(t); });
  const dashboardMascot = user.streak >= 3 ? MASCOT_ASSETS.streak : MASCOT_ASSETS.base;
  const mascotLine = user.streak >= 7
    ? `🔥 ${user.streak}-day streak! You’re unstoppable.`
    : user.streak >= 3
      ? `Nice streak, ${user.displayName}. Let’s keep it alive today.`
      : "Small steps daily. Let’s get your streak rolling!";

  const bandProgressRaw = Number(user.profile?.bandProgress || 0);
  const learningProgressRaw = Number(user.profile?.learningProgress || 0);
  const canonicalLabel = getLevelLabel(user.profile?.cefrBand || 'A1', Math.max(0, Math.min(1, bandProgressRaw)));
  const learningProgressPct = Math.max(0, Math.min(100, Math.round(learningProgressRaw * 100)));
  const [learningPulse, setLearningPulse] = useState(false);
  const prevLearningProgressRef = useRef(learningProgressPct);

  useEffect(() => {
    if (learningProgressPct > prevLearningProgressRef.current) {
      setLearningPulse(true);
      const t = setTimeout(() => setLearningPulse(false), 650);
      prevLearningProgressRef.current = learningProgressPct;
      return () => clearTimeout(t);
    }
    prevLearningProgressRef.current = learningProgressPct;
  }, [learningProgressPct]);

  const progressBands = ['A1', 'A2'];
  const currentBand = user.profile?.cefrBand || 'A1';
  const currentBandIdx = progressBands.indexOf(currentBand);
  const currentSublevel = Number(canonicalLabel.sublevel || 0);
  const currentSublevelProgress = Math.max(0, Math.min(100, Number(canonicalLabel.pctWithinSublevel || 0)));

  function buildLevelPreview(node) {
    const allWords = (cefrVocab?.vocab || []).filter((w) => (w?.cefr || 'A1') === node.band);
    const start = Math.floor((node.sublevel / 10) * allWords.length);
    const end = Math.max(start + 1, Math.floor(((node.sublevel + 1) / 10) * allWords.length));
    const bucketWords = allWords.slice(start, end);
    const sampledWords = (bucketWords.length ? bucketWords : allWords).slice(0, 4).map((w) => ({ es: w.es, en: w.en }));

    const verbStart = Math.floor((node.sublevel / 10) * VERBS.length);
    const sampledVerbs = VERBS.slice(verbStart, verbStart + 2).map((v) => ({
      infinitive: v.infinitive,
      meaning: v.meaning,
      conjugations: (v.conjugations || []).slice(0, 3),
    }));

    const concepts = node.sublevel < 3
      ? ['Core vocabulary', 'Simple sentence building', 'Listening recognition']
      : node.sublevel < 7
        ? ['Conversation flow', 'Grammar in context', 'Word retrieval speed']
        : ['Confidence speaking', 'Real-life phrasing', 'Advanced review'];

    return { ...node, words: sampledWords, verbs: sampledVerbs, concepts };
  }

  const progressionMap = progressBands.flatMap((band, bandIdx) => {
    const titles = LEVEL_TITLES[band] || [];
    return titles.map((title, subIdx) => {
      let pct = 0;
      if (bandIdx < currentBandIdx) pct = 100;
      else if (bandIdx === currentBandIdx) {
        if (subIdx < currentSublevel) pct = 100;
        else if (subIdx === currentSublevel) pct = currentSublevelProgress;
      }
      const strengthKey = `${band}:${subIdx}`;
      const strengthRaw = Number(user.profile?.strengthByLevel?.[strengthKey] || 0);
      const strengthPct = Math.max(0, Math.min(100, Math.round((strengthRaw / 10) * 100)));
      return {
        band,
        sublevel: subIdx,
        title,
        levelNumber: bandIdx * 10 + subIdx + 1,
        percent: pct,
        strengthPct,
        strengthRaw,
        isCurrent: bandIdx === currentBandIdx && subIdx === currentSublevel,
      };
    });
  });
  return (
    <div style={{ maxWidth:880, margin:"0 auto", padding:"0 20px 60px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"28px 0 24px" }}>
        <div>
          <div style={{ color:"#a78bfa", fontSize:12, letterSpacing:2, marginBottom:4 }}>BIENVENIDO</div>
          <h1 style={{ color:"#fff", margin:0, fontFamily:"'Playfair Display', serif", fontSize:28 }}>
            {user.displayName} · {canonicalLabel.title || user.profile?.levelTitle || user.profile?.level || "Newcomer"}
          </h1>
          <button
            onClick={() => setShowProgressMap(true)}
            style={{ marginTop:4, background:'transparent', padding:0, textAlign:'left' }}
            title="View your progress map"
          >
            <div style={{ color:"#9ca3af", fontSize:12 }}>
              Level {canonicalLabel.overallLevel || user.profile?.overallLevel || 1} • {currentSublevelProgress}% to {canonicalLabel.nextTitle || user.profile?.nextLevelTitle || user.profile?.levelTitle || 'Next'}
            </div>
            <div style={{ marginTop:8, width:320, maxWidth:'100%', height:8, borderRadius:8, background:'rgba(255,255,255,0.12)', overflow:'hidden' }}>
              <div style={{ width:`${Math.max(0, Math.min(100, currentSublevelProgress || 0))}%`, height:'100%', background:'linear-gradient(90deg, #7c3aed, #a855f7)', transition:'width 0.35s ease' }} />
            </div>
            <div style={{ color:'#9ca3af', fontSize:11, marginTop:8 }}>Learning Progress</div>
            <div style={{ marginTop:6, width:320, maxWidth:'100%', height:7, borderRadius:8, background:'rgba(255,255,255,0.10)', overflow:'hidden' }}>
              <div style={{ width:`${learningProgressPct}%`, height:'100%', background:'linear-gradient(90deg, #06b6d4, #22d3ee)', transition:'width 0.35s ease, filter 0.25s ease', filter: learningPulse ? 'brightness(1.35)' : 'brightness(1)' }} />
            </div>
            {learningPulse && <div style={{ marginTop:6, color:'#67e8f9', fontSize:11, fontWeight:700 }}>✨ Nice progress!</div>}
          </button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src={dashboardMascot} alt="Chadlingo mascot" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width:84, height:84, objectFit:"contain", borderRadius:14, background:"rgba(124,58,237,0.12)", padding:4 }} />
          <button onClick={onLogout} style={{ padding:"8px 18px", borderRadius:8, fontSize:12, fontWeight:600, background:"rgba(255,255,255,0.06)", color:"#9ca3af", fontFamily:"'Outfit', sans-serif" }}>Sign Out</button>
        </div>
      </div>
      <div style={{ background:"linear-gradient(140deg, rgba(124,58,237,0.22), rgba(6,182,212,0.16))", border:"1px solid rgba(124,58,237,0.4)", borderRadius:18, padding:"16px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div>
            <div style={{ color:"#c4b5fd", fontSize:11, letterSpacing:2 }}>FEATURED MODE</div>
            <div style={{ color:"#fff", fontSize:24, fontWeight:900, fontFamily:"'Playfair Display', serif" }}>🎮 Hop into Story Mode</div>
            <div style={{ color:"#ddd6fe", fontSize:13, marginTop:4 }}>Take on a timed challenge run and finish with a mission report.</div>
          </div>
          <PrimaryBtn onClick={onOpenStoryMode} style={{ whiteSpace:"nowrap" }}>Take on the Challenge</PrimaryBtn>
        </div>
      </div>
      <MascotSpeechBubble text={mascotLine} tone={user.streak >= 7 ? "success" : "default"} style={{ marginBottom:16, maxWidth:430 }} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[{label:"Total Points",value:user.points,icon:"⚡",color:"#f59e0b"},{label:"Today",value:todayPts,icon:"📅",color:"#22c55e"},{label:"Streak",value:`${user.streak}d`,icon:"🔥",color:"#ef4444"},{label:"Lessons",value:user.history.length,icon:"📚",color:"#a78bfa"}].map(s=>(
          <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"16px 18px" }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
            <div style={{ color:"#9ca3af", fontSize:10, letterSpacing:1, marginBottom:4 }}>{s.label.toUpperCase()}</div>
            <div style={{ color:s.color, fontSize:26, fontWeight:800, fontFamily:"'Playfair Display', serif" }}>{s.value}</div>
          </div>
        ))}
      </div>
      {!aiStatus?.anyAvailable && (
        <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.35)", borderRadius:14, padding:"12px 16px", marginBottom:20 }}>
          <div style={{ color:"#fca5a5", fontSize:13, fontWeight:700 }}>AI lessons unavailable right now</div>
          <div style={{ color:"#d1d5db", fontSize:12, marginTop:4 }}>Chat Partner and Picture Description are disabled until at least one AI provider is healthy.</div>
        </div>
      )}
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:"20px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700 }}>Daily Quests</div>
          <div style={{ color:"#6b7280", fontSize:12 }}>{quests.filter(q=>q.done).length}/3 complete</div>
        </div>
        <div style={{ display:"grid", gap:8 }}>
          {quests.map(q => <div key={q.label} style={{ color:q.done?"#4ade80":"#9ca3af", fontSize:13 }}>{q.done?"✓":"○"} {q.label}</div>)}
        </div>
      </div>

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:"20px", marginBottom:20 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700, marginBottom:10 }}>Guided Learning Path</div>
        {!level ? (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
            <div style={{ color:"#9ca3af", fontSize:13 }}>Take a placement test to personalize your study path.</div>
            <PrimaryBtn onClick={() => onStartLesson("Placement Test")} style={{ padding:"10px 14px" }}>Start Test</PrimaryBtn>
          </div>
        ) : (
          <div>
            <div style={{ color:"#a78bfa", fontSize:13, marginBottom:8 }}>
              Current level: <strong>{level}</strong>
            </div>
            <div style={{ color:"#9ca3af", fontSize:12, marginBottom:10 }}>
              Today’s focus: <strong style={{ color:'#e5e7eb' }}>{pathPlan?.focus || 'Core practice'}</strong>
            </div>

            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
              <PrimaryBtn onClick={() => onStartLesson(nextSuggested, { path: true, pathStepId: nextPathStep?.id })} style={{ padding:"8px 12px" }}>
                Continue Path: {nextSuggested} →
              </PrimaryBtn>
              <button onClick={() => onStartLesson("Placement Test")} style={{ padding:"8px 12px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#9ca3af", fontSize:12 }}>Retake Test</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8 }}>
              {(pathPlan?.steps || []).map((s) => (
                <div key={s.id} style={{
                  padding:'8px 10px',
                  borderRadius:10,
                  border:'1px solid rgba(255,255,255,0.10)',
                  background:s.status === 'done' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  color:s.status === 'done' ? '#86efac' : '#d1d5db',
                  fontSize:12,
                  fontWeight:700
                }}>
                  {s.status === 'done' ? '✓' : '○'} {s.moduleType}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:"20px", marginBottom:20 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700, marginBottom:10 }}>Learning Analytics</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:10 }}>
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"12px" }}>
            <div style={{ color:"#9ca3af", fontSize:11, marginBottom:6 }}>Recent accuracy</div>
            <div style={{ color:"#fff", fontSize:22, fontWeight:800 }}>{avgAcc===null?"—":`${avgAcc}%`}</div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"12px" }}>
            <div style={{ color:"#9ca3af", fontSize:11, marginBottom:6 }}>Profile XP</div>
            <div style={{ color:"#fff", fontSize:22, fontWeight:800 }}>{user.profile?.xp || 0}</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <div style={{ color:"#fca5a5", fontSize:11, marginBottom:6 }}>Needs work</div>
            {(weakest.length?weakest:[["No data",{score:0}]]) .map(([k,v]) => <div key={k} style={{ color:"#d1d5db", fontSize:12, marginBottom:4 }}>{k} <span style={{ color:"#6b7280" }}>({v?.score ?? 0})</span></div>)}
          </div>
          <div>
            <div style={{ color:"#86efac", fontSize:11, marginBottom:6 }}>Strongest</div>
            {(strongest.length?strongest:[["No data",{score:0}]]) .map(([k,v]) => <div key={k} style={{ color:"#d1d5db", fontSize:12, marginBottom:4 }}>{k} <span style={{ color:"#6b7280" }}>({v?.score ?? 0})</span></div>)}
          </div>
        </div>
      </div>

      {/* Content Pack Manager hidden for now (admin feature) */}

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:"24px", marginBottom:28 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:600, marginBottom:20 }}>Weekly Progress</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:90 }}>
          {dayPoints.map((p,i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <div style={{ color:"#a78bfa", fontSize:10 }}>{p>0?p:""}</div>
              <div style={{ width:"100%", background:"linear-gradient(180deg, #7c3aed, #a855f755)", borderRadius:"6px 6px 0 0", height:p===0?4:Math.max(8,(p/maxPts)*72), transition:"height 0.5s" }} />
              <div style={{ color:"#6b7280", fontSize:11 }}>{dayLabels[i]}</div>
            </div>
          ))}
        </div>
      </div>
      {Object.entries(groups).map(([group,types])=>(
        <div key={group} style={{ marginBottom:28 }}>
          <div style={{ color:"#9ca3af", fontSize:11, fontWeight:700, letterSpacing:3, marginBottom:14 }}>{group.toUpperCase()}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {types.map(type=>{
              const meta=LESSON_META[type];
              const aiRequired = AI_REQUIRED_LESSONS.has(type);
              const aiBlocked = aiRequired && !aiStatus?.anyAvailable;
              const lockReason = aiBlocked ? "AI temporarily unavailable" : null;
              return (
                <button key={type} onClick={()=>!aiBlocked && onStartLesson(type)} disabled={aiBlocked} style={{ background:aiBlocked?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"18px 16px", textAlign:"left", cursor:aiBlocked?"not-allowed":"pointer", fontFamily:"'Outfit', sans-serif", transition:"all 0.2s", opacity:aiBlocked?0.55:1 }}
                  onMouseEnter={e=>{ if(aiBlocked) return; e.currentTarget.style.borderColor="#7c3aed66";e.currentTarget.style.background="rgba(124,58,237,0.1)";}}
                  onMouseLeave={e=>{ if(aiBlocked) return; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.background="rgba(255,255,255,0.04)";}}>
                  <div style={{ fontSize:24, marginBottom:8 }}>{meta.icon}</div>
                  <div style={{ color:"#fff", fontWeight:700, fontSize:13, marginBottom:4 }}>{type}</div>
                  <div style={{ color:"#6b7280", fontSize:11 }}>{meta.desc}</div>
                  {lockReason && <div style={{ color:"#f87171", fontSize:10, marginTop:6 }}>{lockReason}</div>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {showProgressMap && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ width:'min(980px, 96vw)', maxHeight:'86vh', overflowY:'auto', background:'#120a22', border:'1px solid rgba(255,255,255,0.12)', borderRadius:18, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <img src={dashboardMascot} alt="Chadlingo mascot" style={{ width:56, height:56, objectFit:'contain', borderRadius:10, background:'rgba(124,58,237,0.12)', padding:4 }} />
                <div>
                  <div style={{ color:'#a78bfa', fontSize:11, letterSpacing:2 }}>YOUR JOURNEY</div>
                  <h3 style={{ color:'#fff', margin:'4px 0 0', fontFamily:"'Playfair Display', serif" }}>
                    {user.displayName} · {canonicalLabel.title || user.profile?.levelTitle || 'Newcomer'}
                  </h3>
                </div>
              </div>
              <button onClick={() => setShowProgressMap(false)} style={{ padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.08)', color:'#e5e7eb', fontWeight:700 }}>Close</button>
            </div>

            <div style={{ color:'#c4b5fd', fontSize:13, marginBottom:6, fontWeight:700 }}>
              Keep going — every strong answer fills your journey map.
            </div>
            <div style={{ color:'#9ca3af', fontSize:12, marginBottom:14 }}>
              Tap a level tile to preview words, verbs, and concepts with your mascot.
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
              {progressionMap.map((node) => {
                const isComplete = node.percent >= 100;
                const isCurrent = node.isCurrent;
                return (
                  <button
                    key={`${node.band}-${node.levelNumber}`}
                    onClick={() => setLevelPreview(buildLevelPreview(node))}
                    style={{
                      textAlign:'left',
                      padding:14,
                      borderRadius:14,
                      background: isCurrent ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCurrent ? 'rgba(168,85,247,0.8)' : 'rgba(255,255,255,0.09)'}`,
                      opacity: node.percent > 0 ? 1 : 0.72,
                      cursor:'pointer'
                    }}
                    title={`Level ${node.levelNumber}: ${node.title}`}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div style={{ color:'#fff', fontSize:13, fontWeight:700 }}>Level {node.levelNumber}</div>
                      <div style={{ color:isComplete ? '#4ade80' : '#a78bfa', fontSize:11, fontWeight:700 }}>{node.percent}%</div>
                    </div>
                    <div style={{ color:'#d1d5db', fontSize:12, marginBottom:10 }}>{node.title}</div>
                    <div style={{ height:7, borderRadius:8, background:'rgba(255,255,255,0.10)', overflow:'hidden' }}>
                      <div style={{ width:`${Math.max(0, Math.min(100, node.percent))}%`, height:'100%', background:isComplete ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#7c3aed,#a855f7)' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, marginBottom:4 }}>
                      <div style={{ color:'#86efac', fontSize:10, letterSpacing:1 }}>STRENGTH</div>
                      <div style={{ color:'#86efac', fontSize:10, fontWeight:700 }}>{node.strengthPct}%</div>
                    </div>
                    <div style={{ height:5, borderRadius:8, background:'rgba(34,197,94,0.16)', overflow:'hidden' }}>
                      <div style={{ width:`${node.strengthPct}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#86efac)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {levelPreview && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ width:'min(760px, 95vw)', maxHeight:'86vh', overflowY:'auto', background:'#120a22', border:'1px solid rgba(255,255,255,0.12)', borderRadius:18, padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <img src={MASCOT_ASSETS.progress} alt='mascot' style={{ width:56, height:56, objectFit:'contain', borderRadius:10, background:'rgba(124,58,237,0.12)', padding:4 }} />
                <div>
                  <div style={{ color:'#a78bfa', fontSize:11, letterSpacing:2 }}>LEVEL PREVIEW</div>
                  <div style={{ color:'#fff', fontWeight:800 }}>Level {levelPreview.levelNumber} · {levelPreview.title}</div>
                </div>
              </div>
              <button onClick={() => setLevelPreview(null)} style={{ padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.08)', color:'#e5e7eb', fontWeight:700 }}>Close</button>
            </div>

            <MascotSpeechBubble text="Here are a few words, verbs, and focus concepts for this level. Want to train them now?" tone='success' style={{ marginBottom:12, maxWidth:520 }} />

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div style={{ background:'rgba(6,182,212,0.10)', border:'1px solid rgba(34,211,238,0.35)', borderRadius:14, padding:12 }}>
                <div style={{ color:'#67e8f9', fontSize:11, letterSpacing:2, marginBottom:8 }}>WORDS</div>
                {(levelPreview.words || []).map((w, i) => (
                  <div key={`${w.es}:${i}`} style={{ color:'#e0f2fe', fontSize:13, marginBottom:6 }}>
                    <strong>{w.es}</strong> — {w.en}
                  </div>
                ))}
              </div>

              <div style={{ background:'rgba(124,58,237,0.14)', border:'1px solid rgba(168,85,247,0.35)', borderRadius:14, padding:12 }}>
                <div style={{ color:'#c4b5fd', fontSize:11, letterSpacing:2, marginBottom:8 }}>VERBS</div>
                {(levelPreview.verbs || []).map((v, i) => (
                  <div key={`${v.infinitive}:${i}`} style={{ color:'#e9d5ff', fontSize:13, marginBottom:8 }}>
                    <strong>{v.infinitive}</strong> ({v.meaning})
                    <div style={{ color:'#ddd6fe', fontSize:12, marginTop:2 }}>
                      {(v.conjugations || []).map((c) => `${c.pronoun} ${c.form}`).join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:'rgba(34,197,94,0.10)', border:'1px solid rgba(134,239,172,0.35)', borderRadius:14, padding:12, marginBottom:12 }}>
              <div style={{ color:'#86efac', fontSize:11, letterSpacing:2, marginBottom:8 }}>CONCEPTS TO MASTER</div>
              {(levelPreview.concepts || []).map((c, i) => <div key={`${c}:${i}`} style={{ color:'#dcfce7', fontSize:13, marginBottom:4 }}>• {c}</div>)}
            </div>

            <PrimaryBtn onClick={() => { onStartLesson('Flashcards', { challengeWords: (levelPreview.words || []).map((w) => ({ es: w.es, en: w.en })) }); setLevelPreview(null); setShowProgressMap(false); }}>
              Practice this level now
            </PrimaryBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON SCREEN (router)
// ═══════════════════════════════════════════════════════════════════════════════

function LessonScreen({ type, onComplete, onBack, contentPack, aiStatus, difficulty = 1, user, launchOptions, onStartLesson }) {
  const SELECTOR_MODULES = new Set(["Scenario Builder", "Image Labeling", "Picture Description"]);
  const needsCategory = !NO_CATEGORY.has(type) || SELECTOR_MODULES.has(type);
  const [category, setCategory] = useState(needsCategory ? null : type);
  const [words, setWords] = useState([]);
  const vocabMap = APPROVED_VOCAB_MAP;
  const categories = Object.keys(vocabMap);
  const fillBlankSentences = contentPack?.sentences || SENTENCES;
  const verbs = contentPack?.verbs || VERBS;
  const listenSentences = contentPack?.listenSentences || LISTEN_SENTENCES;
  const scenariosData = contentPack?.scenarios || SCENARIOS;
  const scenes = contentPack?.scenes || SCENES;
  const scrambleSentences = contentPack?.scrambleSentences || SCRAMBLE_SENTENCES;
  const chatTopics = contentPack?.chatTopics || CHAT_TOPICS;
  const pictureScenes = contentPack?.pictureScenes || PICTURE_SCENES;
  const userKey = user?.username || "guest";

  const scenarioOptions = scenariosData.map((s) => s.setting);
  const sceneOptions = scenes.map((s) => s.name);
  const pictureOptions = pictureScenes.map((s, i) => `${s.emoji} Scene ${i + 1}`);
  const categoryOptions = type === "Fill in the Blank"
    ? [...categories, "General"]
    : type === "Scenario Builder"
      ? scenarioOptions
      : type === "Image Labeling"
        ? sceneOptions
        : type === "Picture Description"
          ? pictureOptions
          : categories;

  const vocabTarget = Math.min(12, 4 + difficulty * 2);
  const sentenceTarget = Math.min(10, 3 + difficulty * 2);
  const forcedWords = Array.isArray(launchOptions?.challengeWords) ? launchOptions.challengeWords : [];
  const forcedFillItems = Array.isArray(launchOptions?.challengeFillItems) ? launchOptions.challengeFillItems : [];
  const dailyFocusWord = launchOptions?.dailyFocusWord || null;
  const dailyFocusVerb = launchOptions?.dailyFocusVerb || user?.profile?.dailyFocusVerb || null;

  const pronouns = ["yo", "tú", "él / ella", "nosotros", "vosotros", "ellos / ellas"];
  const rotationSeed = `${new Date().toDateString()}:${userKey}:${type}`;
  const rotationIndex = [...rotationSeed].reduce((a, c) => a + c.charCodeAt(0), 0) % pronouns.length;

  function withDailyFocusWord(items = [], chance = 0.65) {
    if (!dailyFocusWord?.es || !dailyFocusWord?.en) return items || [];
    const source = Array.isArray(items) ? items : [];
    const key = `${normalizeSimple(dailyFocusWord.en)}::${normalizeSimple(dailyFocusWord.es)}`;
    const seen = new Set(source.map((w) => `${normalizeSimple(w?.en || "")}::${normalizeSimple(w?.es || "")}`));
    if (seen.has(key)) return source;
    if (Math.random() > chance) return source;
    return [{ id: dailyFocusWord.id || dailyFocusWord.es, en: dailyFocusWord.en, es: dailyFocusWord.es, cefr: dailyFocusWord.cefr || user?.profile?.cefrBand || 'A1' }, ...source];
  }

  function getDailyVerbCard() {
    if (!dailyFocusVerb) return null;
    const verb = (verbs || []).find((v) => normalizeSimple(v?.infinitive || "") === normalizeSimple(dailyFocusVerb));
    if (!verb) return null;
    const preferredPronoun = pronouns[rotationIndex];
    const form = (verb.conjugations || []).find((c) => normalizeSimple(c?.pronoun || "") === normalizeSimple(preferredPronoun)) || verb.conjugations?.[rotationIndex % Math.max(1, verb.conjugations?.length || 1)] || verb.conjugations?.[0];
    if (!form?.form) return null;
    return {
      id: `focus-verb-card:${verb.infinitive}:${form.pronoun}`,
      es: form.form,
      en: form.meaning || `${form.pronoun} ${verb.meaning || verb.infinitive}`,
      cefr: user?.profile?.cefrBand || 'A1',
    };
  }

  const wordsForLesson = useMemo(() => {
    const base = forcedWords.length
      ? forcedWords
      : category === "General"
        ? selectWordsForModule({ profile: user?.profile, moduleType: type, count: Math.max(4, vocabTarget) })
        : selectAdaptiveFlashcards(words, {
            difficulty,
            target: Math.max(4, vocabTarget),
            userKey,
            category: category || type,
          });

    const withWord = withDailyFocusWord(base, 0.62);
    const verbCard = getDailyVerbCard();
    if (!verbCard || Math.random() > 0.45) return withWord;
    const exists = withWord.some((w) => normalizeSimple(w?.es || "") === normalizeSimple(verbCard.es));
    return exists ? withWord : [verbCard, ...withWord];
  }, [words, difficulty, vocabTarget, userKey, category, type, user, forcedWords, dailyFocusVerb]);
  const fillForLesson = useMemo(() => {
    const injectDynamicDailyFill = (items = []) => {
      let out = Array.isArray(items) ? [...items] : [];

      if (dailyFocusWord?.es && dailyFocusWord?.en && Math.random() < 0.62) {
        const sentence = {
          template: `Hoy practicamos la palabra ___ (${dailyFocusWord.en}).`,
          answer: dailyFocusWord.es,
          hint: `Use the Spanish word for "${dailyFocusWord.en}".`,
          wordId: dailyFocusWord.id || dailyFocusWord.es,
          cefr: dailyFocusWord.cefr || user?.profile?.cefrBand || 'A1',
        };
        const hasAlready = out.some((s) => normalizeSimple(s?.answer || "") === normalizeSimple(dailyFocusWord.es));
        if (!hasAlready) out = [sentence, ...out];
      }

      if (dailyFocusVerb && Math.random() < 0.58) {
        const verb = (verbs || []).find((v) => normalizeSimple(v?.infinitive || "") === normalizeSimple(dailyFocusVerb));
        const preferredPronoun = pronouns[rotationIndex];
        const form = (verb?.conjugations || []).find((c) => normalizeSimple(c?.pronoun || "") === normalizeSimple(preferredPronoun))
          || verb?.conjugations?.[rotationIndex % Math.max(1, verb?.conjugations?.length || 1)]
          || verb?.conjugations?.[0];
        if (verb && form?.form) {
          const prompt = {
            template: `${form.pronoun} ___ español todos los días.`,
            answer: form.form,
            hint: `${form.pronoun} ${verb.meaning || verb.infinitive}`,
            wordId: `${verb.infinitive}:${form.pronoun}`,
            cefr: user?.profile?.cefrBand || 'A1',
          };
          const hasVerb = out.some((s) => normalizeSimple(s?.answer || "") === normalizeSimple(form.form));
          if (!hasVerb) out = [prompt, ...out];
        }
      }

      return shuffle(out).slice(0, Math.max(5, sentenceTarget));
    };

    const base = forcedFillItems.length
      ? forcedFillItems
      : category === "General"
        ? getFillBlankItemsForModule({ profile: user?.profile, count: Math.max(5, sentenceTarget) })
        : selectAdaptiveFillBlanks(fillBlankSentences, {
            difficulty,
            target: Math.max(5, sentenceTarget),
            userKey,
            category: category || "General",
          });

    return injectDynamicDailyFill(base);
  }, [fillBlankSentences, difficulty, sentenceTarget, userKey, category, user, forcedFillItems, dailyFocusWord, dailyFocusVerb, verbs, rotationIndex]);
  const flashcardsForLesson = useMemo(() => {
    const fixed = (wordsForLesson || []).map((w) => {
      const enKey = normalizeSimple(w?.en || "");
      const canonical = CANONICAL_TRANSLATION_MAP[`${category}::${enKey}`] || CANONICAL_TRANSLATION_MAP[enKey] || w?.es;
      return { ...w, es: canonical || w?.es };
    }).filter((w) => normalizeSimple(w?.en || "") !== normalizeSimple(w?.es || ""));

    return fixed.length ? fixed : (APPROVED_VOCAB_MAP[category] || []).slice(0, Math.max(4, vocabTarget));
  }, [wordsForLesson, category, vocabTarget]);

  const wordsForMatch = useMemo(() => {
    if (category === "General") {
      return withDailyFocusWord(selectWordsForModule({ profile: user?.profile, moduleType: "Word Match", count: Math.max(4, vocabTarget) }));
    }
    const fallback = withDailyFocusWord((APPROVED_VOCAB_MAP[category] || []).slice(0, Math.max(4, vocabTarget)));
    return (wordsForLesson && wordsForLesson.length) ? wordsForLesson : fallback;
  }, [wordsForLesson, category, vocabTarget, user, dailyFocusWord]);
  const verbsForLesson = shuffle(verbs).slice(0, Math.max(4, 2 + difficulty * 2));
  const listenForLesson = shuffle(listenSentences).slice(0, Math.max(5, 3 + difficulty));

  const transcriptionSourcePool = useMemo(() => {
    const basePool = Array.isArray(listenSentences) ? [...listenSentences] : [];
    const band = user?.profile?.cefrBand || "A1";

    const levelTemplates = band === "A2"
      ? [
          { es: "Mañana {yoVerb} con {wordEs} en el mercado.", en: "Tomorrow I {verbEn} with {wordEn} at the market." },
          { es: "Esta tarde voy a usar {wordEs} cuando {yoVerb}.", en: "This afternoon I will use {wordEn} when I {verbEn}." },
          { es: "En mi rutina, yo {yoVerb} y practico la palabra {wordEs}.", en: "In my routine, I {verbEn} and practice the word {wordEn}." },
        ]
      : [
          { es: "Hoy yo {yoVerb} y digo {wordEs}.", en: "Today I {verbEn} and say {wordEn}." },
          { es: "Yo practico {wordEs} cuando {yoVerb}.", en: "I practice {wordEn} when I {verbEn}." },
          { es: "Ahora yo {yoVerb} con {wordEs}.", en: "Now I {verbEn} with {wordEn}." },
        ];

    const verbPool = Array.isArray(verbs) ? verbs : [];
    const focusVerbObj = verbPool.find((v) => normalizeSimple(v?.infinitive || "") === normalizeSimple(dailyFocusVerb || ""));
    const chosenVerbPool = shuffle(focusVerbObj ? [focusVerbObj, ...verbPool.filter((v) => v !== focusVerbObj)] : verbPool).slice(0, 6);

    const levelWords = (wordsForLesson || []).filter((w) => w?.es && w?.en).slice(0, 12);
    const focusWord = dailyFocusWord?.es && dailyFocusWord?.en ? dailyFocusWord : null;
    const chosenWords = shuffle(focusWord ? [focusWord, ...levelWords.filter((w) => normalizeSimple(w?.es || "") !== normalizeSimple(focusWord.es))] : levelWords).slice(0, 12);

    const generated = [];
    for (const tpl of levelTemplates) {
      for (const word of chosenWords.slice(0, 4)) {
        for (const verb of chosenVerbPool.slice(0, 3)) {
          const yoForm = (verb?.conjugations || []).find((c) => normalizeSimple(c?.pronoun || "") === "yo")?.form || verb?.infinitive || "practico";
          const verbEn = verb?.meaning || "practice";
          generated.push({
            id: `dyn:${band}:${normalizeSimple(word?.es || "")}:${normalizeSimple(verb?.infinitive || "")}:${normalizeSimple(tpl.es)}`,
            es: tpl.es
              .replaceAll("{yoVerb}", yoForm)
              .replaceAll("{wordEs}", word.es),
            en: tpl.en
              .replaceAll("{verbEn}", verbEn)
              .replaceAll("{wordEn}", word.en),
            cefr: band,
          });
        }
      }
    }

    const dailyForced = [];
    if (focusWord) {
      dailyForced.push({
        id: `focus-word:${normalizeSimple(focusWord.es)}`,
        es: `Hoy practicamos la palabra ${focusWord.es}.`,
        en: `Today we practice the word ${focusWord.en}.`,
        cefr: band,
      });
    }
    if (focusVerbObj) {
      const yoForm = (focusVerbObj?.conjugations || []).find((c) => normalizeSimple(c?.pronoun || "") === "yo")?.form || focusVerbObj?.infinitive;
      dailyForced.push({
        id: `focus-verb:${normalizeSimple(focusVerbObj.infinitive)}`,
        es: `Hoy yo ${yoForm} para practicar español.`,
        en: `Today I ${focusVerbObj.meaning || focusVerbObj.infinitive} to practice Spanish.`,
        cefr: band,
      });
    }

    const all = [...dailyForced, ...generated, ...basePool];
    const byEs = {};
    for (const s of all) {
      if (!s?.es) continue;
      byEs[s.es] = s;
    }
    return Object.values(byEs);
  }, [listenSentences, user, verbs, wordsForLesson, dailyFocusWord, dailyFocusVerb]);

  const transcriptionForLesson = useMemo(() => {
    const selected = selectAdaptiveListenSentences(transcriptionSourcePool, {
      difficulty,
      target: Math.max(7, 4 + difficulty),
      userKey,
      category: "Transcription",
    });
    const mustInclude = transcriptionSourcePool.filter((s) => String(s?.id || "").startsWith("focus-"));
    const merged = [...mustInclude, ...selected];
    const byEs = {};
    for (const s of merged) {
      if (!s?.es) continue;
      byEs[s.es] = s;
    }
    return shuffle(Object.values(byEs)).slice(0, Math.max(7, 4 + difficulty));
  }, [transcriptionSourcePool, difficulty, userKey]);
  const selectedScenarioPool = type === "Scenario Builder" && category
    ? scenariosData.filter((s) => s.setting === category)
    : scenariosData;
  const scenariosForLesson = shuffle(selectedScenarioPool.length ? selectedScenarioPool : scenariosData).slice(0, Math.max(1, Math.min(6, 2 + difficulty)));

  const selectedScenePool = type === "Image Labeling" && category
    ? scenes.filter((s) => s.name === category)
    : scenes;
  const scenesForLesson = shuffle(selectedScenePool.length ? selectedScenePool : scenes).slice(0, Math.max(1, Math.min(2, Math.ceil(difficulty / 3))));

  const selectedPicturePool = type === "Picture Description" && category
    ? pictureScenes.filter((s, i) => `${s.emoji} Scene ${i + 1}` === category)
    : pictureScenes;
  const pictureForLesson = shuffle(selectedPicturePool.length ? selectedPicturePool : pictureScenes).slice(0, 4);
  const scrambleForLesson = useMemo(() => (
    selectAdaptiveScrambles(scrambleSentences, {
      difficulty,
      target: Math.max(4, Math.min(8, 3 + difficulty)),
      userKey,
      category: "Sentence Scramble",
    })
  ), [scrambleSentences, difficulty, userKey]);
  function pickCategory(cat) {
    if (cat === "General") {
      setCategory("General");
      setWords([]);
      return;
    }
    if (type === "Scenario Builder" || type === "Image Labeling" || type === "Picture Description") {
      setCategory(cat);
      return;
    }
    setCategory(cat);
    setWords(vocabMap[cat] || []);
  }
  function buildFallbackWordResults(correct, total) {
    const cap = Math.max(1, Math.min(12, Number(total || 0) || 1));
    const hitCount = Math.max(0, Math.min(cap, Number(correct || 0)));

    const toWordResults = (items = []) => {
      const pool = (items || []).slice(0, cap);
      if (!pool.length) return [];
      return pool.map((item, idx) => ({
        id: item?.id || item?.wordId || item?.es || item?.answer || item?.template || `${type}:${category || 'General'}:${idx}`,
        cefr: item?.cefr || user?.profile?.cefrBand || 'A1',
        bucket: item?.bucket || item?._bucket || 'current',
        seen: 1,
        correct: idx < hitCount ? 1 : 0,
      }));
    };

    if (type === 'Flashcards') return toWordResults(flashcardsForLesson);
    if (type === 'Word Match') return toWordResults(wordsForMatch);
    if (type === 'Fill in the Blank') return toWordResults(fillForLesson);
    if (type === 'Learn Verbs' || type === 'Speed Round') return toWordResults(verbsForLesson.map((v) => ({ id: v?.infinitive, cefr: v?.cefr || user?.profile?.cefrBand || 'A1' })));
    if (type === 'Sentence Scramble') return toWordResults(scrambleForLesson);
    if (type === 'Transcription' || type === 'Audio Shadowing' || type === 'Pronunciation Coach') return toWordResults((transcriptionForLesson?.length ? transcriptionForLesson : listenForLesson).map((s, i) => ({ id: s?.id || s?.es || `listen:${i}`, cefr: s?.cefr || user?.profile?.cefrBand || 'A1' })));
    if (type === 'Scenario Builder') return toWordResults(scenariosForLesson.map((s, i) => ({ id: s?.id || s?.setting || `scenario:${i}`, cefr: s?.cefr || user?.profile?.cefrBand || 'A1' })));
    if (type === 'Image Labeling') return toWordResults(scenesForLesson.flatMap((scene, i) => (scene?.items || []).map((it, j) => ({ id: it?.id || it?.es || it?.word || `${scene?.name || 'scene'}:${i}:${j}`, cefr: it?.cefr || user?.profile?.cefrBand || 'A1' }))));
    if (type === 'Picture Description') return toWordResults(pictureForLesson.map((p, i) => ({ id: p?.id || p?.prompt || `${p?.emoji || 'scene'}:${i}`, cefr: p?.cefr || user?.profile?.cefrBand || 'A1' })));
    return [];
  }

  function done(pts,correct,total,meta) {
    const pathMeta = launchOptions?.path ? { pathStep: true, pathStepId: launchOptions?.pathStepId || null } : {};
    const existingWordResults = Array.isArray(meta?.wordResults) ? meta.wordResults : [];
    const fallbackWordResults = existingWordResults.length ? [] : buildFallbackWordResults(correct, total);
    onComplete(pts,correct,total,category||type,{ ...(meta || {}), wordResults: existingWordResults.length ? existingWordResults : fallbackWordResults, ...pathMeta });
  }

  useEffect(() => {
    if (!needsCategory || category || !categoryOptions.length) return;
    const random = categoryOptions[Math.floor(Math.random() * categoryOptions.length)];
    pickCategory(random);
  }, [needsCategory, category, categoryOptions.length]);

  if (AI_REQUIRED_LESSONS.has(type) && !aiStatus?.anyAvailable) {
    return (
      <div style={{ maxWidth:600, margin:"0 auto", padding:"20px" }}>
        <button onClick={onBack} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", fontFamily:"'Outfit', sans-serif", marginBottom:24, display:"flex", alignItems:"center", gap:6 }}>← Back</button>
        <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.35)", borderRadius:14, padding:"16px" }}>
          <div style={{ color:"#fca5a5", fontWeight:700, marginBottom:8 }}>AI lesson currently unavailable</div>
          <div style={{ color:"#d1d5db", fontSize:13 }}>No AI provider is currently available. Please check provider availability, then retry.</div>
        </div>
      </div>
    );
  }

  if (needsCategory && !category) {
    return (
      <div style={{ maxWidth:600, margin:"0 auto", padding:"20px" }}>
        <button onClick={onBack} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", fontFamily:"'Outfit', sans-serif", marginBottom:24, display:"flex", alignItems:"center", gap:6 }}>← Back</button>
        <h2 style={{ color:"#fff", fontFamily:"'Playfair Display', serif", marginBottom:8 }}>{type}</h2>
        <p style={{ color:"#9ca3af", fontSize:14 }}>Preparing your random category…</p>
      </div>
    );
  }

  if (type === "Flashcards" && !flashcardsForLesson.length) {
    return (
      <div style={{ maxWidth:600, margin:"0 auto", padding:"20px" }}>
        <button onClick={onBack} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", fontFamily:"'Outfit', sans-serif", marginBottom:24, display:"flex", alignItems:"center", gap:6 }}>← Back</button>
        <h2 style={{ color:"#fff", fontFamily:"'Playfair Display', serif", marginBottom:8 }}>Flashcards</h2>
        <p style={{ color:"#9ca3af", fontSize:14 }}>Preparing your random category…</p>
      </div>
    );
  }
  const lessonRegistry = {
    "Flashcards": () => <FlashcardLesson words={flashcardsForLesson} onComplete={(pts,correct,total,meta) => { writeRecentFlashcards(userKey, category || type, flashcardsForLesson); done(pts,correct,total,meta); }} />,
    "Word Match": () => <WordMatchLesson words={wordsForMatch} difficulty={difficulty} onComplete={done} />,
    "Fill in the Blank": () => <FillBlankLesson difficulty={difficulty} onComplete={(pts,correct,total,meta) => { writeRecentFillBlanks(userKey, category || "General", fillForLesson); done(pts,correct,total,meta); }} sentences={fillForLesson} />,
    "Learn Verbs": () => <VerbLesson onComplete={done} verbs={verbsForLesson} />,
    "Speed Round": () => <SpeedRoundLesson onComplete={done} verbs={verbsForLesson} />,
    "Sentence Scramble": () => <SentenceScrambleLesson onComplete={(pts,correct,total) => { writeRecentScrambles(userKey, "Sentence Scramble", scrambleForLesson); done(pts,correct,total); }} scrambleSentences={scrambleForLesson} />,
    "Transcription": () => <TranscriptionLesson onComplete={(pts,correct,total) => { writeRecentListen(userKey, "Transcription", transcriptionForLesson); done(pts,correct,total); }} listenSentences={transcriptionForLesson} />,
    "Audio Shadowing": () => <AudioShadowingLesson onComplete={done} listenSentences={listenForLesson} />,
    "Pronunciation Coach": () => <PronunciationCoachLesson onComplete={done} listenSentences={listenForLesson} />,
    "Scenario Builder": () => <ScenarioBuilderLesson onComplete={done} scenariosData={scenariosForLesson} />,
    "Chat Partner": () => <ChatPartnerLesson onBack={onBack} onComplete={done} chatTopics={chatTopics} />,
    "Image Labeling": () => <ImageLabelingLesson onComplete={done} scenes={scenesForLesson} />,
    "Picture Description": () => <PictureDescriptionLesson onComplete={done} pictureScenes={pictureForLesson} />,
    "Placement Test": () => <PlacementTestLesson onComplete={(pts,correct,total,meta)=>onComplete(pts,correct,total,"Placement Test",meta)} vocab={vocabMap} sentences={fillForLesson} verbs={verbsForLesson} />,
    "Dictionary Book": () => <DictionaryBookLesson
      user={user}
      contentPack={contentPack}
      onComplete={done}
      onPractice={(challengeWords) => onStartLesson?.('Flashcards', { challengeWords })}
      onPracticeWord={(word) => {
        const drillWords = Array.from({ length: 8 }, () => ({ ...word }));
        onStartLesson?.('Flashcards', { challengeWords: drillWords });
      }}
    />,
  };
  const lessonNode = lessonRegistry[type] ? lessonRegistry[type]() : null;

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <button onClick={onBack} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", fontFamily:"'Outfit', sans-serif", display:"flex", alignItems:"center", gap:6 }}>← Back</button>
        <div style={{ textAlign:"right", display:"grid", gap:6 }}>
          <div style={{ color:"#e5e7eb", fontWeight:600, fontSize:15 }}>{type}</div>
          {dailyFocusWord?.es && dailyFocusWord?.en && (
            <div style={{ color:'#67e8f9', fontSize:11, background:'rgba(6,182,212,0.12)', border:'1px solid rgba(34,211,238,0.35)', borderRadius:999, padding:'4px 10px', justifySelf:'end' }}>
              🌟 Word of the day: <strong>{dailyFocusWord.es}</strong> — {dailyFocusWord.en}
            </div>
          )}
          {needsCategory ? (
            <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
              <span style={{ color:"#9ca3af", fontSize:11 }}>Category</span>
              <select value={category || ""} onChange={(e) => pickCategory(e.target.value)} style={{ padding:"6px 8px", borderRadius:8, background:"#1f1638", border:"1px solid rgba(255,255,255,0.14)", color:"#fff", fontSize:12, appearance:"none" }}>
                {categoryOptions.map((cat) => <option key={cat} value={cat} style={{ backgroundColor:"#1f1638", color:"#f3f4f6" }}>{cat}</option>)}
              </select>
            </div>
          ) : (
            category!==type&&<div style={{ color:"#a78bfa", fontSize:12 }}>{category}</div>
          )}
        </div>
      </div>
      <div key={`${type}:${category || "default"}`}>
        {lessonNode}
      </div>
    </div>
  );
}

function AdminScreen({ onBack }) {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogSource, setBlogSource] = useState("github");
  const [blogWarning, setBlogWarning] = useState("");
  const [approvingSlug, setApprovingSlug] = useState("");

  async function unlock() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setErr(data?.error || "Invalid admin password.");
        setLoading(false);
        return;
      }
      setToken(password);
    } catch {
      setErr("Unable to verify admin login.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!token) return;
    let mounted = true;

    async function loadAdminData() {
      try {
        const headers = { "x-admin-password": token };
        const [statsReq, usersReq, healthReq, blogReq] = await Promise.allSettled([
          fetch("/api/admin/stats", { headers }),
          fetch("/api/admin/users", { headers }),
          fetch("/api/admin/health", { headers }),
          fetch("/api/admin/blog/list", { headers }),
        ]);

        if (!mounted) return;

        if (healthReq.status === "fulfilled") {
          const healthData = await healthReq.value.json().catch(() => ({}));
          setHealth(healthData?.health || null);
        }

        if (statsReq.status === "fulfilled" && statsReq.value.ok) {
          const statsData = await statsReq.value.json();
          setStats(statsData?.stats || null);
        }

        if (usersReq.status === "fulfilled" && usersReq.value.ok) {
          const usersData = await usersReq.value.json();
          setUsers(Array.isArray(usersData?.users) ? usersData.users : []);
        }

        if (blogReq.status === "fulfilled" && blogReq.value.ok) {
          const blogData = await blogReq.value.json();
          setBlogPosts(Array.isArray(blogData?.posts) ? blogData.posts : []);
          setBlogSource(blogData?.source || "github");
          setBlogWarning(blogData?.warning || "");
        } else {
          setBlogPosts([]);
          setBlogSource("github");
          setBlogWarning("Unable to load blog drafts from API.");
        }

        if (!(statsReq.status === "fulfilled" && statsReq.value.ok)) {
          const details = statsReq.status === "fulfilled" ? await statsReq.value.json().catch(() => ({})) : {};
          setErr(details?.error || "Admin stats unavailable.");
        }
      } catch (e) {
        if (mounted) setErr(e?.message || "Failed to load admin stats.");
      }
    }

    loadAdminData();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function approveBlogPost(slug) {
    if (!slug || !token) return;
    setApprovingSlug(slug);
    try {
      const res = await fetch("/api/admin/blog/approve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-password": token },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Approve failed");
      setBlogPosts((prev) => prev.map((p) => (p.slug === slug ? { ...p, approved: true } : p)));
    } catch (e) {
      setErr(e?.message || "Could not approve blog post");
    }
    setApprovingSlug("");
  }

  if (!token) {
    return (
      <div style={{ maxWidth:520, margin:"0 auto", padding:"40px 20px" }}>
        <button onClick={onBack} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", marginBottom:24 }}>← Back</button>
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:"24px" }}>
          <div style={{ color:"#fff", fontSize:24, fontWeight:800, marginBottom:6 }}>Admin Login</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginBottom:16 }}>Enter the admin password to access reports.</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="Admin password" style={{ width:"100%", padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#fff", marginBottom:12 }} />
          <PrimaryBtn onClick={unlock} disabled={loading}>{loading ? "Checking..." : "Unlock Admin"}</PrimaryBtn>
          {err && <div style={{ color:"#fca5a5", fontSize:12, marginTop:10 }}>{err}</div>}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Registered Users", value: stats?.totalUsers ?? "—", icon: "👥" },
    { label: "New This Week", value: stats?.newThisWeek ?? "—", icon: "🆕" },
    { label: "WAU", value: stats?.weeklyActiveUsers ?? "—", icon: "📈" },
    { label: "MAU", value: stats?.monthlyActiveUsers ?? "—", icon: "📊" },
    { label: "Total Lessons", value: stats?.totalLessons ?? "—", icon: "📚" },
    { label: "Total Active Minutes", value: stats?.totalActiveMinutes ?? "—", icon: "⏱️" },
    { label: "Avg Progress / Lesson", value: stats?.avgProgressPerLesson ?? "—", icon: "⚡" },
    { label: "Avg Strength / Lesson", value: stats?.avgStrengthPerLesson ?? "—", icon: "🛡️" },
    { label: "Total Progress Points", value: stats?.totalProgressPoints ?? "—", icon: "🚀" },
  ];

  return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"26px 20px 60px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ color:"#a78bfa", fontSize:12, letterSpacing:2 }}>ADMIN</div>
          <h2 style={{ color:"#fff", margin:"4px 0 0", fontSize:28 }}>Usage Dashboard</h2>
        </div>
        <button onClick={onBack} style={{ padding:"8px 14px", borderRadius:8, background:"rgba(255,255,255,0.06)", color:"#9ca3af" }}>← Back</button>
      </div>

      {err && <div style={{ color:"#fca5a5", fontSize:12, marginBottom:12 }}>{err}</div>}

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
        <div style={{ color:"#e5e7eb", fontSize:14, fontWeight:700, marginBottom:6 }}>Admin Health</div>
        <div style={{ color: health?.configured ? "#86efac" : "#fca5a5", fontSize:12 }}>
          Redis/KV: {health?.configured ? "Connected" : "Not configured"}
        </div>
        <div style={{ color:"#9ca3af", fontSize:12, marginTop:4 }}>
          Last event: {health?.lastEventAt ? new Date(health.lastEventAt).toLocaleString() : "—"}
        </div>
        <div style={{ color:"#9ca3af", fontSize:12 }}>
          Total tracked events: {health?.totalEvents ?? "—"}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"14px" }}>
            <div style={{ fontSize:20 }}>{c.icon}</div>
            <div style={{ color:"#9ca3af", fontSize:11, marginTop:4 }}>{c.label}</div>
            <div style={{ color:"#fff", fontSize:28, fontWeight:800 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px", marginBottom:14 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700, marginBottom:10 }}>Most Played Modules</div>
        {(stats?.topLessons || []).length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13 }}>No lesson history yet.</div>
        ) : (
          <div style={{ display:"grid", gap:8 }}>
            {(stats?.topLessons || []).map(([name, count]) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", color:"#d1d5db", fontSize:13 }}>
                <span>{name}</span>
                <span style={{ color:"#a78bfa" }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px", marginBottom:14 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700, marginBottom:10 }}>Progression Tuning Diagnostics</div>
        {(stats?.moduleProgressDiagnostics || []).length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13 }}>No progression diagnostics yet. Complete a few lessons first.</div>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {(stats?.moduleProgressDiagnostics || []).map((row) => (
              <div key={row.lesson} style={{ display:'grid', gridTemplateColumns:'1.3fr 0.8fr 0.8fr 0.8fr', gap:8, color:'#d1d5db', fontSize:12, alignItems:'center' }}>
                <div>{row.lesson}</div>
                <div style={{ color:'#67e8f9' }}>+{row.avgProgressPerLesson}/lesson</div>
                <div style={{ color:'#86efac' }}>+{row.avgStrengthPerLesson} strength</div>
                <div style={{ color:'#9ca3af' }}>{row.lessons} lessons</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px", marginBottom:14 }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700, marginBottom:10 }}>Learning Blog Draft Approval</div>
        <div style={{ color:"#9ca3af", fontSize:11, marginBottom:8 }}>Source: {blogSource === "local" ? "Local workspace drafts" : "GitHub repository drafts"}</div>
        {blogWarning ? <div style={{ color:"#fbbf24", fontSize:12, marginBottom:8 }}>{blogWarning}</div> : null}
        {blogPosts.length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13 }}>No draft posts found yet. Daily agent posts will appear here.</div>
        ) : (
          <div style={{ display:"grid", gap:10 }}>
            {blogPosts.map((post) => (
              <div key={post.slug} style={{ border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 12px", background:"rgba(255,255,255,0.02)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                  <div>
                    <div style={{ color:"#fff", fontSize:13, fontWeight:700 }}>{post.name}</div>
                    <div style={{ color:"#9ca3af", fontSize:11, whiteSpace:"pre-wrap", marginTop:4 }}>{post.excerpt || "No preview"}</div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <a href={post.htmlUrl} target="_blank" rel="noreferrer" style={{ color:"#93c5fd", fontSize:12 }}>Open</a>
                    <button
                      onClick={() => approveBlogPost(post.slug)}
                      disabled={post.approved || approvingSlug === post.slug}
                      style={{ padding:"8px 10px", borderRadius:8, fontSize:12, fontWeight:700, background:post.approved?"rgba(34,197,94,0.2)":"rgba(124,58,237,0.22)", color:post.approved?"#86efac":"#ddd6fe", border:"1px solid rgba(124,58,237,0.4)" }}
                    >
                      {post.approved ? "Approved" : approvingSlug === post.slug ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px" }}>
        <div style={{ color:"#e5e7eb", fontSize:15, fontWeight:700, marginBottom:10 }}>Registered Users</div>
        {users.length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13 }}>No users tracked yet.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ color:"#9ca3af", textAlign:"left" }}>
                  <th style={{ padding:"8px 6px" }}>Username</th>
                  <th style={{ padding:"8px 6px" }}>Display</th>
                  <th style={{ padding:"8px 6px" }}>Joined</th>
                  <th style={{ padding:"8px 6px" }}>Last Login</th>
                  <th style={{ padding:"8px 6px" }}>Points</th>
                  <th style={{ padding:"8px 6px" }}>Lessons</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username} style={{ borderTop:"1px solid rgba(255,255,255,0.06)", color:"#d1d5db" }}>
                    <td style={{ padding:"8px 6px" }}>{u.username}</td>
                    <td style={{ padding:"8px 6px" }}>{u.displayName || "—"}</td>
                    <td style={{ padding:"8px 6px" }}>{u.joined ? new Date(u.joined).toLocaleDateString() : "—"}</td>
                    <td style={{ padding:"8px 6px" }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "—"}</td>
                    <td style={{ padding:"8px 6px" }}>{u.points || 0}</td>
                    <td style={{ padding:"8px 6px" }}>{u.lessons || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StoryModeSetup({ aiStatus, onBack, onStart }) {
  const [minutes, setMinutes] = useState(10);
  const durations = [5, 10, 15, 20];
  const preview = useMemo(() => buildStoryPlan(minutes, aiStatus), [minutes, aiStatus]);

  return (
    <div style={{ maxWidth:760, margin:"0 auto", padding:"28px 20px 60px" }}>
      <button onClick={onBack} style={{ background:"none", color:"#9ca3af", fontSize:13, padding:"8px 0", marginBottom:20 }}>← Back</button>
      <div style={{ background:"linear-gradient(140deg, rgba(124,58,237,0.23), rgba(6,182,212,0.15))", border:"1px solid rgba(124,58,237,0.38)", borderRadius:22, padding:"22px" }}>
        <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:12 }}>
          <img src={MASCOT_ASSETS.success} alt="Story mode mascot" style={{ width:120, height:120, objectFit:"contain" }} onError={(e)=>{e.currentTarget.style.display="none";}} />
          <div>
            <div style={{ color:"#d8b4fe", fontSize:12, letterSpacing:2 }}>STORY MODE</div>
            <h2 style={{ color:"#fff", margin:"4px 0 6px", fontSize:32, fontFamily:"'Playfair Display', serif" }}>Take on the Challenge</h2>
            <div style={{ color:"#ddd6fe", fontSize:13 }}>Timed adventure run with mixed Spanish challenges and a final mission report.</div>
          </div>
        </div>

        <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"10px 12px", marginBottom:14 }}>
          <div style={{ color:"#fff", fontSize:16, fontWeight:800 }}>{preview.episodeTitle || "Story Run"}</div>
          <div style={{ color:"#c4b5fd", fontSize:12, marginTop:2 }}>{preview.episodeVibe || "A focused mission through core challenges."}</div>
          <div style={{ color:"#9ca3af", fontSize:11, marginTop:6 }}>Planned challenges: {(preview.plan || []).join(" • ")}</div>
        </div>

        <div style={{ color:"#9ca3af", fontSize:12, marginBottom:10 }}>Choose your session length</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
          {durations.map((d) => (
            <button key={d} onClick={() => setMinutes(d)} style={{ padding:"10px 14px", borderRadius:10, border:`1px solid ${minutes===d?"#7c3aed":"rgba(255,255,255,0.12)"}`, background:minutes===d?"rgba(124,58,237,0.24)":"rgba(255,255,255,0.05)", color:minutes===d?"#e9d5ff":"#d1d5db", fontWeight:700 }}>
              {d} min
            </button>
          ))}
        </div>
        {!aiStatus?.anyAvailable && <div style={{ color:"#fca5a5", fontSize:12, marginBottom:12 }}>AI modules are currently unavailable; story run will use non-AI challenges.</div>}
        <PrimaryBtn onClick={() => onStart(minutes, preview)}>🚀 Start Story Mode</PrimaryBtn>
      </div>
    </div>
  );
}

function StorySummaryScreen({ summary, onBack }) {
  if (!summary) return null;
  const accuracy = summary.totalQuestions ? Math.round((summary.totalCorrect / summary.totalQuestions) * 100) : 0;
  return (
    <div style={{ maxWidth:760, margin:"0 auto", padding:"28px 20px 60px" }}>
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:10 }}>
          <img src={MASCOT_ASSETS.success} alt="Story complete mascot" style={{ width:120, height:120, objectFit:"contain" }} onError={(e)=>{e.currentTarget.style.display="none";}} />
          <div>
            <div style={{ color:"#a78bfa", fontSize:12, letterSpacing:2 }}>MISSION COMPLETE</div>
            <h2 style={{ color:"#fff", margin:"6px 0 0", fontSize:30, fontFamily:"'Playfair Display', serif" }}>Story Session Report</h2>
            <div style={{ color:"#c4b5fd", fontSize:13, marginTop:4 }}>{summary.episodeTitle || "Story Run"}</div>
            {summary.episodeVibe && <div style={{ color:"#9ca3af", fontSize:12, marginTop:2 }}>{summary.episodeVibe}</div>}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:12 }}>
          {[{k:"Challenges",v:summary.completed},{k:"Points",v:summary.points},{k:"Accuracy",v:`${accuracy}%`},{k:"Duration",v:`${summary.minutes}m`}].map((s)=><div key={s.k} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"12px" }}><div style={{ color:"#9ca3af", fontSize:11 }}>{s.k}</div><div style={{ color:"#fff", fontWeight:800, fontSize:22 }}>{s.v}</div></div>)}
        </div>
        <MascotSpeechBubble text={accuracy >= 80 ? "Elite run. You dominated Story Mode 🔥" : "Solid progress — jump back in and beat your score."} tone={accuracy >= 80 ? "success" : "default"} style={{ marginTop:14, maxWidth:420 }} />
        <PrimaryBtn onClick={onBack} style={{ marginTop:14 }}>Back to Dashboard</PrimaryBtn>
      </div>
    </div>
  );
}

function LearningBlogPage() {
  const [posts, setPosts] = useState([]);
  const [err, setErr] = useState("");
  const [expandedPosts, setExpandedPosts] = useState({});

  useEffect(() => {
    let mounted = true;
    fetch("/api/blog/approved")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (!data?.ok) throw new Error(data?.error || "Failed to load blog posts");
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      })
      .catch((e) => {
        if (mounted) setErr(e?.message || "Failed to load blog posts");
      });
    return () => {
      mounted = false;
    };
  }, []);

  function cleanMd(line) {
    return String(line || "").replace(/\*\*/g, "").trim();
  }

  function derivePostMeta(post) {
    const content = String(post?.content || "");
    const lines = content.split("\n");
    const findValue = (label) => {
      const row = lines.find((l) => l.toLowerCase().includes(label.toLowerCase()));
      if (!row) return "";
      return cleanMd(row.replace(/^[-*#\s]*/, "")).replace(/^[^:]+:\s*/, "").trim();
    };

    const studentFromBody = findValue("student:");
    const scoreFromBody = Number((findValue("score:") || "").replace(/[^0-9]/g, "")) || 0;
    const dateFromBody = findValue("date & time:") || findValue("session time:");

    return {
      student: post?.meta?.studentName || studentFromBody || "Student",
      score: Number(post?.meta?.score) || scoreFromBody || 0,
      when: post?.meta?.startedAt ? new Date(post.meta.startedAt).toLocaleString() : (dateFromBody || "Unknown time"),
    };
  }

  function avatarStyleFromName(name = "Student") {
    const seed = [...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0);
    const palettes = [
      ['#7c3aed', '#f59e0b'],
      ['#06b6d4', '#22c55e'],
      ['#ec4899', '#8b5cf6'],
      ['#f97316', '#ef4444'],
      ['#14b8a6', '#3b82f6'],
    ];
    const [a, b] = palettes[seed % palettes.length];
    return {
      background: `linear-gradient(135deg, ${a}, ${b})`,
      border: `1px solid ${a}55`,
    };
  }

  function renderPostBody(content) {
    const lines = String(content || "").split("\n");
    const out = [];
    let list = [];

    const flushList = (keySeed) => {
      if (!list.length) return;
      out.push(
        <ul key={`ul-${keySeed}`} style={{ margin:"6px 0 12px 18px", color:"#d1d5db", lineHeight:1.6 }}>
          {list.map((item, i) => (
            <li key={`${keySeed}-${i}`}>{cleanMd(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    };

    lines.forEach((raw, idx) => {
      const line = raw.trim();
      if (!line) {
        flushList(idx);
        return;
      }
      if (line.startsWith("- ")) {
        list.push(line.slice(2));
        return;
      }

      flushList(idx);

      if (line.startsWith("# ")) {
        out.push(<h3 key={`h1-${idx}`} style={{ color:"#fff", margin:"2px 0 10px", fontSize:24, fontFamily:"'Playfair Display', serif" }}>{cleanMd(line.slice(2))}</h3>);
        return;
      }
      if (line.startsWith("## ")) {
        out.push(<h4 key={`h2-${idx}`} style={{ color:"#e5e7eb", margin:"12px 0 8px", fontSize:16, fontWeight:700 }}>{cleanMd(line.slice(3))}</h4>);
        return;
      }
      out.push(<p key={`p-${idx}`} style={{ color:"#d1d5db", margin:"0 0 8px", lineHeight:1.65 }}>{cleanMd(line)}</p>);
    });

    flushList("end");
    return out;
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", backgroundImage:"radial-gradient(ellipse at 20% 50%, #1a0a3e 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0a1a3e 0%, transparent 50%)", color:"#e5e7eb", fontFamily:"'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;900&display=swap'); *{box-sizing:border-box}`}</style>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"30px 20px 70px" }}>
        <div style={{ marginBottom:12 }}>
          <a href="/" style={{ color:"#a78bfa", fontSize:13, fontWeight:600, textDecoration:"none" }}>← Back to Chadlingo</a>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <img src={MASCOT_ASSETS.base} alt="mascot" style={{ width:72, height:72, objectFit:"contain" }} onError={(e)=>{e.currentTarget.style.display="none";}} />
          <div>
            <div style={{ color:"#a78bfa", fontSize:12, letterSpacing:2 }}>CHADLINGO</div>
            <h1 style={{ color:"#fff", margin:"4px 0 0", fontSize:30, fontFamily:"'Playfair Display', serif" }}>Chadlingo Learning Blog</h1>
            <div style={{ color:"#9ca3af", fontSize:13 }}>Learning updates and reflections from the Chadlingo community.</div>
          </div>
        </div>

        {err && <div style={{ color:"#fca5a5", fontSize:13, marginBottom:12 }}>{err}</div>}
        {posts.length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:14 }}>No approved posts yet.</div>
        ) : (
          <div style={{ display:"grid", gap:14 }}>
            {posts.map((p) => {
              const meta = derivePostMeta(p);
              const when = meta.when;
              const student = meta.student;
              const score = meta.score;
              const body = p?.content || p?.excerpt || "";
              const excerpt = (p?.content || p?.excerpt || "")
                .split("\n")
                .filter(l => l.trim() && !l.startsWith("#") && !l.includes("Date & Time:") && !l.includes("Score:") && !l.includes("Lessons Completed:") && !l.includes("Mood:"))
                .join(" ")
                .replace(/\*\*/g, "")
                .slice(0, 200) + "...";

              const avatarStyle = avatarStyleFromName(student);
              const isExpanded = !!expandedPosts[p.slug];
              return (
                <article key={p.slug} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"20px", position:"relative", transition:"transform 0.2s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", ...avatarStyle, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#fff", fontSize:16 }}>
                      {student.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>{student}</div>
                      <div style={{ color:"#9ca3af", fontSize:12 }}>{when}</div>
                    </div>
                    <div style={{ marginLeft:"auto", background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", padding:"4px 10px", borderRadius:10, color:"#f59e0b", fontSize:12, fontWeight:700 }}>
                      {score} pts
                    </div>
                  </div>
                  
                  {isExpanded ? (
                    <div style={{ margin:"0 0 14px" }}>
                      {renderPostBody(body)}
                    </div>
                  ) : (
                    <p style={{ color:"#e5e7eb", fontSize:15, lineHeight:1.6, margin:"0 0 14px", whiteSpace:"pre-wrap" }}>
                      {excerpt}
                    </p>
                  )}

                  <div style={{ display:"flex", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:12 }}>
                    <button
                      onClick={() => setExpandedPosts((prev) => ({ ...prev, [p.slug]: !prev[p.slug] }))}
                      style={{ color:"#a78bfa", fontSize:13, fontWeight:600, background:"transparent", padding:0, border:"none", cursor:"pointer", fontFamily:"'Outfit', sans-serif" }}
                    >
                      {isExpanded ? "Collapse diary entry" : "View full diary entry"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

async function trackAnalyticsEvent(payload) {
  try {
    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
  } catch {}
}

function playCelebrationSound() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.26);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 700);
  } catch {}
}

function CelebrationOverlay({ celebration, onClose }) {
  if (!celebration) return null;
  const confetti = Array.from({ length: 70 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1.7 + Math.random() * 1.8,
    color: ['#7c3aed', '#22d3ee', '#f59e0b', '#4ade80', '#f472b6'][i % 5],
    size: 6 + Math.random() * 8,
  }));
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1400, pointerEvents:'none' }}>
      <style>{`@keyframes confettiFall{0%{transform:translateY(-12vh) rotate(0)}100%{transform:translateY(112vh) rotate(720deg)}}`}</style>
      {confetti.map((c) => (
        <div key={c.id} style={{ position:'absolute', left:`${c.left}%`, top:'-10vh', width:c.size, height:c.size * 0.6, background:c.color, opacity:0.9, borderRadius:2, animation:`confettiFall ${c.dur}s linear ${c.delay}s forwards` }} />
      ))}
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ pointerEvents:'auto', width:'min(520px, 92vw)', background:'rgba(18,10,34,0.95)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:18, padding:18, textAlign:'center' }}>
          <img src={MASCOT_ASSETS.success} alt="Mascot celebration" style={{ width:110, height:110, objectFit:'contain' }} onError={(e)=>{e.currentTarget.style.display='none';}} />
          <div style={{ color:'#fbbf24', letterSpacing:2, fontSize:11, marginTop:4 }}>{celebration?.tag || 'MILESTONE'}</div>
          <h3 style={{ color:'#fff', margin:'6px 0 8px', fontFamily:"'Playfair Display', serif" }}>{celebration?.title || 'Great job!'}</h3>
          <MascotSpeechBubble text={celebration?.message || 'You are on fire! Keep going!'} tone='success' style={{ maxWidth:430, margin:'0 auto' }} />
          <button onClick={onClose} style={{ marginTop:12, padding:'8px 14px', borderRadius:10, background:'rgba(255,255,255,0.10)', color:'#fff', fontWeight:700 }}>Continue</button>
        </div>
      </div>
    </div>
  );
}

function DailyFocusModal({ user, dailyFocus, onClose }) {
  const [flipWord, setFlipWord] = useState(false);
  const [flipVerb, setFlipVerb] = useState(false);
  if (!dailyFocus) return null;
  const verb = dailyFocus?.verb || {};
  const word = dailyFocus?.word || {};
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.74)", zIndex:1200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"min(920px, 96vw)", maxHeight:"88vh", overflowY:"auto", background:"#120a22", border:"1px solid rgba(255,255,255,0.14)", borderRadius:18, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src={MASCOT_ASSETS.success} alt="Chadlingo mascot" style={{ width:68, height:68, objectFit:"contain", borderRadius:12, background:"rgba(124,58,237,0.12)", padding:4 }} onError={(e)=>{e.currentTarget.style.display='none';}} />
            <div>
              <div style={{ color:"#fbbf24", fontSize:11, letterSpacing:2 }}>DAILY LAUNCH</div>
              <h3 style={{ color:"#fff", margin:"4px 0 0", fontFamily:"'Playfair Display', serif" }}>¡Vamos, {user?.displayName || "Amigo"}! Your daily Spanish mission is ready.</h3>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:"8px 12px", borderRadius:10, background:"rgba(255,255,255,0.08)", color:"#e5e7eb", fontWeight:700 }}>Start Learning 🚀</button>
        </div>

        <MascotSpeechBubble text="Use today’s word and verb in every lesson. Stack points, keep streak, and sound natural. 💪" tone="hype" style={{ marginBottom:14 }} />

        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:12, alignItems:'stretch' }}>
          <button onClick={() => setFlipWord((v) => !v)} style={{ textAlign:'left', perspective:1000, borderRadius:14, transition:'transform 0.2s ease, filter 0.2s ease', animation:'tileFloat 2.8s ease-in-out infinite' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-2px) scale(1.01)';e.currentTarget.style.filter='drop-shadow(0 8px 20px rgba(34,211,238,0.22))';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0) scale(1)';e.currentTarget.style.filter='none';}}>
            <div style={{ position:'relative', minHeight:232, transformStyle:'preserve-3d', transition:'transform 0.55s ease', transform: flipWord ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', background:"rgba(6,182,212,0.10)", border:"1px solid rgba(34,211,238,0.35)", borderRadius:14, padding:14 }}>
                <div style={{ color:"#67e8f9", fontSize:11, letterSpacing:2, marginBottom:8 }}>🃏 WORD TILE</div>
                <div style={{ color:'#9ca3af', fontSize:12, marginBottom:6 }}>Word of the day • tap to flip</div>
                <div translate="no" className="notranslate" style={{ color:"#fff", fontSize:30, fontWeight:900, fontFamily:"'Playfair Display', serif" }}>{word?.es || "hola"}</div>
                <div style={{ color:"#bae6fd", fontSize:14, marginTop:4 }}>{word?.en || "hello"}</div>
              </div>
              <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:"rgba(6,182,212,0.16)", border:"1px solid rgba(34,211,238,0.45)", borderRadius:14, padding:14 }}>
                <div style={{ color:'#67e8f9', fontSize:11, letterSpacing:2, marginBottom:8 }}>WORD MISSION</div>
                <div style={{ color:'#ecfeff', fontSize:13 }}>Use <strong>{word?.es || 'hola'}</strong> naturally in every module today for bonus momentum.</div>
                <div style={{ color:'#a5f3fc', fontSize:12, marginTop:10 }}>Try 3 quick examples:
                  <div style={{ marginTop:6 }}>• Yo digo <strong>{word?.es || 'hola'}</strong>.</div>
                  <div>• Practico <strong>{word?.es || 'hola'}</strong> hoy.</div>
                  <div>• Entiendo “{word?.en || 'hello'}”.</div>
                </div>
              </div>
            </div>
          </button>

          <button onClick={() => setFlipVerb((v) => !v)} style={{ textAlign:'left', perspective:1000, borderRadius:14, transition:'transform 0.2s ease, filter 0.2s ease', animation:'tileFloat 3.1s ease-in-out infinite' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-2px) scale(1.01)';e.currentTarget.style.filter='drop-shadow(0 8px 20px rgba(168,85,247,0.26))';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0) scale(1)';e.currentTarget.style.filter='none';}}>
            <div style={{ position:'relative', minHeight:232, transformStyle:'preserve-3d', transition:'transform 0.55s ease', transform: flipVerb ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', background:"rgba(124,58,237,0.14)", border:"1px solid rgba(168,85,247,0.35)", borderRadius:14, padding:14 }}>
                <div style={{ color:"#c4b5fd", fontSize:11, letterSpacing:2, marginBottom:8 }}>🃏 VERB TILE</div>
                <div style={{ color:'#9ca3af', fontSize:12, marginBottom:6 }}>Verb of the day • tap to flip</div>
                <div translate="no" className="notranslate" style={{ color:"#fff", fontSize:28, fontWeight:900, fontFamily:"'Playfair Display', serif" }}>{verb?.infinitive || "hablar"}</div>
                <div style={{ color:"#ddd6fe", fontSize:14, marginTop:4 }}>{verb?.meaning || "to speak"}</div>
                <div style={{ color:"#ddd6fe", fontSize:12, marginTop:8 }}>{verb?.description}</div>
              </div>
              <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:"rgba(124,58,237,0.22)", border:"1px solid rgba(168,85,247,0.5)", borderRadius:14, padding:14 }}>
                <div style={{ color:"#c4b5fd", fontSize:11, letterSpacing:2, marginBottom:8 }}>CONJUGATIONS</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:8 }}>
                  {(verb?.conjugations || []).map((c, i) => (
                    <div key={`${c?.pronoun || 'p'}:${i}`} style={{ padding:"8px 10px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#e5e7eb", fontSize:12 }}>
                      <strong style={{ color:"#a78bfa" }}>{c?.pronoun}</strong> — <span translate="no" className="notranslate">{c?.form}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [user, setUser] = useState(null); const [screen, setScreen] = useState("auth");
  const [lessonType, setLessonType] = useState(null); const [lessonLaunchOptions, setLessonLaunchOptions] = useState(null); const [lastResult, setLastResult] = useState(null); const [toast, setToast] = useState(null);
  const [contentPack, setContentPack] = useState(starterPack);
  const [aiStatus, setAiStatus] = useState({ anyAvailable: true, providers: {}, checkedAt: null });
  const [storyMode, setStoryMode] = useState(null);
  const [storySummary, setStorySummary] = useState(null);
  const [dailyFocus, setDailyFocus] = useState(null);
  const [showDailyFocusModal, setShowDailyFocusModal] = useState(false);
  const [celebration, setCelebration] = useState(null);

  useEffect(() => {
    async function loadPack() {
      const parsed = await loadActiveContentPack();
      if (parsed?.vocab) {
        const { pack: sanitized, issues } = validateAndSanitizeContentPack(parsed);
        setContentPack(sanitized);
        if (issues.length) {
          await saveActiveContentPack(sanitized);
          showToast(`Content pack auto-corrected (${issues.length} translation issue${issues.length > 1 ? "s" : ""})`, "error");
          console.warn("[content-pack] translation issues fixed", issues);
        }
      }
    }
    loadPack();
  }, []);

  async function importContentPack(pack) {
    const { pack: sanitized, issues } = validateAndSanitizeContentPack(pack);
    await saveActiveContentPack(sanitized);
    setContentPack(sanitized);
    if (issues.length) {
      showToast(`Loaded with ${issues.length} auto-fix${issues.length > 1 ? "es" : ""} to translations`, "error");
      console.warn("[content-pack] import translation issues fixed", issues);
    } else {
      showToast(`Loaded content pack: ${sanitized.name || sanitized.id}`);
    }
  }

  async function resetContentPack() {
    await clearActiveContentPack();
    setContentPack(starterPack);
    showToast("Reset to starter content pack");
  }

  useEffect(() => {
    let mounted = true;
    async function loadAiStatus(force = false) {
      try {
        const res = await fetch(`/api/ai/status${force ? "?force=1" : ""}`);
        const data = await res.json();
        if (mounted && data) setAiStatus(data);
      } catch {
        if (mounted) {
          setAiStatus({ anyAvailable: false, providers: {}, checkedAt: new Date().toISOString() });
        }
      }
    }

    loadAiStatus(true);
    const t = setInterval(() => loadAiStatus(false), 120000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);
  function showToast(msg,type="success") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }
  function triggerCelebration(payload) {
    setCelebration(payload || { title: 'Milestone reached!', message: 'Great momentum — keep going!' });
    playCelebrationSound();
    setTimeout(() => setCelebration(null), 5200);
  }

  function startLesson(type, opts = {}) {
    const pathMode = !!opts.path;
    const challengeWords = Array.isArray(opts.challengeWords)
      ? opts.challengeWords
      : pathMode
        ? selectWordsForModule({ profile: user?.profile || {}, moduleType: type, count: 10 })
        : null;
    const challengeFillItems = Array.isArray(opts.challengeFillItems)
      ? opts.challengeFillItems
      : (pathMode && type === "Fill in the Blank")
        ? getFillBlankItemsForModule({ profile: user?.profile || {}, count: 8 })
        : null;

    setLessonLaunchOptions({
      path: pathMode,
      pathStepId: opts.pathStepId || null,
      challengeWords,
      challengeFillItems,
      dailyFocusWord: dailyFocus?.word || null,
      dailyFocusVerb: dailyFocus?.verb || null,
      dailyFocusKey: dailyFocus?.key || null,
    });
    setLessonType(type);
    setScreen("lesson");
  }


  function handleLogin(u) {
    const today=new Date().toDateString(); const last=u.lastLogin?new Date(u.lastLogin).toDateString():null;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    let streak=u.streak;
    if(last===today){}else if(last===yesterday.toDateString()){streak++;}else{streak=1;}

    const recomputedProfile = recomputeProfileFromHistory(u);
    const daily = getDailyFocusBundle(recomputedProfile, u?.username || "guest", new Date());
    const updated={...u,lastLogin:new Date().toISOString(),streak,profile:recomputedProfile};
    const updatedWithPath = {
      ...updated,
      profile: ensurePathState({
        ...(updated.profile || {}),
        dailyFocusWordId: daily?.word?.id || null,
        dailyFocusVerb: daily?.verb?.infinitive || null,
      }),
    };
    const wantsAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";
    const isNewRegistration = !u.lastLogin;
    setDailyFocus(daily);
    setShowDailyFocusModal(!wantsAdmin);
    setUser(updatedWithPath);saveUser(updatedWithPath);setScreen(wantsAdmin ? "admin" : "dashboard");showToast(`¡Bienvenido, ${u.displayName}! 🇪🇸`);
    trackAnalyticsEvent({
      eventType: isNewRegistration ? "register" : "login",
      username: updated.username,
      displayName: updated.displayName,
      joined: updated.joined,
      lastLogin: updated.lastLogin,
      points: updated.points || 0,
      lessons: Array.isArray(updated.history) ? updated.history.length : 0,
    });
  }
  async function dismissDailyFocusModal() {
    setShowDailyFocusModal(false);
    if (!user || !dailyFocus?.key) return;
    const patched = {
      ...user,
      profile: {
        ...(user.profile || {}),
        lastDailyFocusSeen: dailyFocus.key,
        dailyFocusWordId: dailyFocus?.word?.id || user?.profile?.dailyFocusWordId || null,
        dailyFocusVerb: dailyFocus?.verb?.infinitive || user?.profile?.dailyFocusVerb || null,
      },
    };
    setUser(patched);
    await saveUser(patched);
  }

  function startStoryMode(minutes = 10, preview = null) {
    const built = preview || buildStoryPlan(minutes, aiStatus);
    const plan = built?.plan || [];
    const first = plan[0];
    if (!first) {
      showToast("No Story Mode challenges available right now", "error");
      return;
    }
    const now = Date.now();
    setStorySummary(null);
    setStoryMode({
      active: true,
      minutes,
      plan,
      episodeTitle: built?.episodeTitle || "Story Run",
      episodeVibe: built?.episodeVibe || "",
      index: 0,
      startedAt: now,
      endAt: now + minutes * 60 * 1000,
      results: [],
    });
    setLessonLaunchOptions(null);
    setLessonType(first);
    setScreen("lesson");
    showToast(`Story Mode started: ${built?.episodeTitle || "Mission"}`);
  }

  async function handleLessonComplete(pts,correct,total,category,meta) {
    const difficulty = getAdaptiveDifficulty(user?.profile || {}, lessonType);
    const entry={date:new Date().toISOString(),points:pts,correct,total,category,type:lessonType,meta:{...(meta||{}), difficulty}};

    let profileUpdate = updateLearningProfile(user?.profile || {}, {
      lessonType,
      attemptedAt: entry.date,
      points: pts,
      correct,
      total,
      wordResults: meta?.wordResults || [],
    });

    if (meta?.level) {
      profileUpdate = {
        ...profileUpdate,
        level: meta.level,
        recommendedLessons: meta.recommendedLessons?.length ? meta.recommendedLessons : profileUpdate.recommendedLessons,
      };
    }

    // Update guided learning path step completion only for guided launches
    if (meta?.pathStep) {
      profileUpdate = completePathStep(profileUpdate, lessonType);
    }

    const previousOverallLevel = user?.profile?.overallLevel || 1;
    const updated={...user,points:user.points+pts,history:[...user.history,entry],profile:profileUpdate};
    setUser(updated);await saveUser(updated);

    const newOverallLevel = profileUpdate?.overallLevel || 1;
    if (newOverallLevel > previousOverallLevel) {
      showToast(`🎉 Level Up! ${profileUpdate.levelTitle} · Level ${newOverallLevel}`);
      const milestone = newOverallLevel % 5 === 0;
      triggerCelebration({
        tag: milestone ? 'MAJOR MILESTONE' : 'LEVEL UP',
        title: milestone ? `🏆 Level ${newOverallLevel} Unlocked!` : `🎉 Level ${newOverallLevel}!`,
        message: milestone
          ? `Mascot says: Legendary work! You hit a major milestone — ${profileUpdate.levelTitle}!`
          : `Mascot says: Awesome push! You're now ${profileUpdate.levelTitle}. Keep the streak alive!`,
      });
    } else {
      const prevLearn = Math.round(Number(user?.profile?.learningProgress || 0) * 100);
      const nextLearn = Math.round(Number(profileUpdate?.learningProgress || 0) * 100);
      const milestones = [25, 50, 75, 100];
      const hit = milestones.find((m) => prevLearn < m && nextLearn >= m);
      if (hit) {
        triggerCelebration({
          tag: 'PROGRESS MILESTONE',
          title: `✨ ${hit}% Band Progress!`,
          message: `Mascot says: Boom! You reached ${hit}% learning progress in your ${getFriendlyPathName(profileUpdate)}.`,
        });
      }
    }
    const latestProgressionEvent = Array.isArray(profileUpdate?.progressionEvents)
      ? profileUpdate.progressionEvents[profileUpdate.progressionEvents.length - 1]
      : null;

    trackAnalyticsEvent({
      eventType: "lesson_complete",
      username: updated.username,
      displayName: updated.displayName,
      points: updated.points || 0,
      lessons: Array.isArray(updated.history) ? updated.history.length : 0,
      lessonType,
      durationSec: Number(meta?.durationSec) || 0,
      earnedPoints: Number(pts) || 0,
      progressPointsEarned: Number(latestProgressionEvent?.progressPointsEarned || 0),
      strengthPointsEarned: Number(latestProgressionEvent?.strengthPointsEarned || 0),
    });

    if (storyMode?.active) {
      const now = Date.now();
      const nextResults = [...(storyMode.results || []), { type: lessonType, pts, correct, total }];
      const nextIndex = (storyMode.index || 0) + 1;
      const timedOut = now >= storyMode.endAt;
      const finishedPlan = nextIndex >= (storyMode.plan?.length || 0);

      if (timedOut || finishedPlan) {
        const totalPoints = nextResults.reduce((s, r) => s + (Number(r.pts) || 0), 0);
        const totalCorrect = nextResults.reduce((s, r) => s + (Number(r.correct) || 0), 0);
        const totalQuestions = nextResults.reduce((s, r) => s + (Number(r.total) || 0), 0);
        setStorySummary({
          minutes: storyMode.minutes,
          episodeTitle: storyMode.episodeTitle,
          episodeVibe: storyMode.episodeVibe,
          completed: nextResults.length,
          points: totalPoints,
          totalCorrect,
          totalQuestions,
        });
        setStoryMode(null);
        setScreen("story-summary");
        return;
      }

      const nextType = storyMode.plan[nextIndex];
      setStoryMode({ ...storyMode, index: nextIndex, results: nextResults });
      setLessonLaunchOptions(null);
      setLessonType(nextType);
      showToast(`${storyMode.episodeTitle} • Challenge ${nextIndex + 1}/${storyMode.plan.length}: ${nextType}`);
      setScreen("lesson");
      return;
    }

    setLastResult({pts,correct,total,progression:latestProgressionEvent});setScreen("result");
  }
  if (typeof window !== "undefined" && ["/student-blog", "/blog"].includes(window.location.pathname)) {
    return <LearningBlogPage />;
  }
  if(screen==="auth") return <AuthScreen onLogin={handleLogin}/>;
  return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", fontFamily:"'Outfit', sans-serif", backgroundImage:"radial-gradient(ellipse at 20% 50%, #1a0a3e 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0a1a3e 0%, transparent 50%)", color:"#e5e7eb" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;900&display=swap');@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}@keyframes tileFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes bookFlip{0%{transform:perspective(900px) rotateY(-14deg);opacity:0.65}100%{transform:perspective(900px) rotateY(0deg);opacity:1}}*{box-sizing:border-box}input,textarea{outline:none}button{cursor:pointer;border:none;background:none}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#7c3aed55;border-radius:2px}`}</style>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
      {celebration && <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} />}
      {showDailyFocusModal && user && dailyFocus && <DailyFocusModal user={user} dailyFocus={dailyFocus} onClose={dismissDailyFocusModal} />}
      {screen==="dashboard"&&<Dashboard user={user} aiStatus={aiStatus} onStartLesson={startLesson} onOpenStoryMode={()=>setScreen("story-setup")} onLogout={()=>{setShowDailyFocusModal(false);setDailyFocus(null);setUser(null);setScreen("auth");}}/>}
      {screen==="story-setup"&&<StoryModeSetup aiStatus={aiStatus} onBack={()=>setScreen("dashboard")} onStart={startStoryMode} />}
      {screen==="story-summary"&&<StorySummaryScreen summary={storySummary} onBack={()=>setScreen("dashboard")} />}
      {screen==="admin"&&<AdminScreen onBack={()=>{ if (typeof window !== "undefined") window.history.pushState({}, "", "/"); setScreen("dashboard"); }} />}
      {screen==="lesson"&&<LessonScreen type={lessonType} launchOptions={lessonLaunchOptions} difficulty={getAdaptiveDifficulty(user?.profile || {}, lessonType)} aiStatus={aiStatus} onComplete={handleLessonComplete} onBack={()=>{ setStoryMode(null); setScreen("dashboard"); }} contentPack={contentPack} user={user} onStartLesson={startLesson}/>}
      {screen==="result"&&lastResult&&<div style={{maxWidth:500,margin:"0 auto",padding:"60px 20px"}}><ResultScreen points={lastResult.pts} correct={lastResult.correct} total={lastResult.total} progression={lastResult.progression} onBack={()=>setScreen("dashboard")}/></div>}
      {storyMode?.active && <div style={{ position:"fixed", top:10, right:10, background:"rgba(124,58,237,0.22)", border:"1px solid rgba(124,58,237,0.4)", borderRadius:12, padding:"8px 10px", color:"#ddd6fe", fontSize:12, zIndex:20 }}>Story Mode • {Math.max(0, Math.ceil((storyMode.endAt - Date.now())/60000))}m left</div>}
      <div style={{ position:"fixed", right:10, bottom:8, color:"#6b7280", fontSize:10, opacity:0.7, pointerEvents:"none" }}>
        build {APP_COMMIT}
      </div>
    </div>
  );
}
