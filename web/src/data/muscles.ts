// Muscle anatomy mapping and automatic routine text detection

export const MUSCLES = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
] as const;

export type MuscleKey = typeof MUSCLES[number];

export const INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'] as const;

export const MUSCLE_NAME: Record<string, string> = {
  trapezius: 'Traps',
  deltoids: 'Shoulders',
  chest: 'Chest',
  'upper-back': 'Upper Back & Lats',
  serratus: 'Serratus',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearm: 'Forearms',
  abs: 'Abs & Core',
  obliques: 'Obliques',
  'lower-back': 'Lower Back',
  gluteal: 'Glutes',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  adductors: 'Adductors',
  'hip-flexors': 'Hip Flexors',
  calves: 'Calves',
  tibialis: 'Shins',
};

export const ALIAS: Record<string, MuscleKey> = {
  // Primaries
  abs: 'abs',
  abdominals: 'abs',
  core: 'abs',
  pectorals: 'chest',
  chest: 'chest',
  pecs: 'chest',
  biceps: 'biceps',
  glutes: 'gluteal',
  gluteal: 'gluteal',
  butt: 'gluteal',
  delts: 'deltoids',
  deltoids: 'deltoids',
  shoulders: 'deltoids',
  triceps: 'triceps',
  'upper back': 'upper-back',
  'upper-back': 'upper-back',
  back: 'upper-back',
  lats: 'upper-back',
  latissimus: 'upper-back',
  calves: 'calves',
  calf: 'calves',
  quads: 'quadriceps',
  quadriceps: 'quadriceps',
  thighs: 'quadriceps',
  legs: 'quadriceps',
  forearms: 'forearm',
  forearm: 'forearm',
  hamstrings: 'hamstring',
  hamstring: 'hamstring',
  spine: 'lower-back',
  'lower back': 'lower-back',
  'lower-back': 'lower-back',
  traps: 'trapezius',
  trapezius: 'trapezius',
  adductors: 'adductors',
  serratus: 'serratus',
  obliques: 'obliques',
  shins: 'tibialis',
  tibialis: 'tibialis',
  'hip flexors': 'hip-flexors',
  'hip-flexors': 'hip-flexors',
};

// Common exercises mapped directly to muscles
export const EXERCISE_KEYWORD_MAP: Record<string, MuscleKey[]> = {
  bench: ['chest', 'triceps', 'deltoids'],
  'chest press': ['chest', 'triceps'],
  fly: ['chest'],
  flye: ['chest'],
  dip: ['chest', 'triceps'],
  pushup: ['chest', 'triceps', 'abs'],
  'push up': ['chest', 'triceps', 'abs'],
  'pull up': ['upper-back', 'biceps'],
  pullup: ['upper-back', 'biceps'],
  chinup: ['upper-back', 'biceps'],
  'chin up': ['upper-back', 'biceps'],
  row: ['upper-back', 'biceps'],
  pulldown: ['upper-back', 'biceps'],
  lat: ['upper-back'],
  deadlift: ['hamstring', 'gluteal', 'lower-back', 'trapezius'],
  squat: ['quadriceps', 'gluteal'],
  lunge: ['quadriceps', 'gluteal', 'hamstring'],
  'leg press': ['quadriceps', 'gluteal'],
  'leg extension': ['quadriceps'],
  'leg curl': ['hamstring'],
  'hamstring curl': ['hamstring'],
  'calf raise': ['calves'],
  curl: ['biceps', 'forearm'],
  'bicep curl': ['biceps'],
  'tricep extension': ['triceps'],
  'pushdown': ['triceps'],
  'overhead press': ['deltoids', 'triceps'],
  'shoulder press': ['deltoids', 'triceps'],
  'lateral raise': ['deltoids'],
  'front raise': ['deltoids'],
  shrug: ['trapezius'],
  crunch: ['abs'],
  plank: ['abs', 'obliques'],
  situp: ['abs', 'hip-flexors'],
  'sit up': ['abs', 'hip-flexors'],
  'russian twist': ['obliques', 'abs'],
  'leg raise': ['abs', 'hip-flexors'],
};

/**
 * Detects which muscles are activated based on a text string
 * e.g. "Chest & Triceps: Barbell Bench Press 3x10, Tricep Pushdown 3x12"
 */
export function detectMusclesFromText(text: string): MuscleKey[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set<MuscleKey>();

  // Check alias words
  for (const [alias, muscle] of Object.entries(ALIAS)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(lower)) {
      found.add(muscle);
    }
  }

  // Check common exercises
  for (const [kw, muscles] of Object.entries(EXERCISE_KEYWORD_MAP)) {
    if (lower.includes(kw)) {
      muscles.forEach(m => found.add(m));
    }
  }

  return Array.from(found);
}
