/* Exercise library. Built-ins here; custom ones live in S.exercises (kind 'exercises').
   type: 'weight' (lb × reps), 'bodyweight' (added lb × reps), 'time' (seconds), 'cardio' (minutes, miles). */
import { S } from './state.js';

export const EX_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'];

const L = [
  ['bench', 'Bench Press', 'Chest', 'weight'], ['incline-bench', 'Incline Bench Press', 'Chest', 'weight'], ['db-bench', 'Dumbbell Bench Press', 'Chest', 'weight'],
  ['incline-db', 'Incline Dumbbell Press', 'Chest', 'weight'], ['chest-fly', 'Chest Fly', 'Chest', 'weight'], ['cable-fly', 'Cable Fly', 'Chest', 'weight'],
  ['pushup', 'Push-up', 'Chest', 'bodyweight'], ['dip', 'Dip', 'Chest', 'bodyweight'],
  ['deadlift', 'Deadlift', 'Back', 'weight'], ['bb-row', 'Barbell Row', 'Back', 'weight'], ['db-row', 'Dumbbell Row', 'Back', 'weight'],
  ['pullup', 'Pull-up', 'Back', 'bodyweight'], ['chinup', 'Chin-up', 'Back', 'bodyweight'], ['lat-pulldown', 'Lat Pulldown', 'Back', 'weight'],
  ['cable-row', 'Seated Cable Row', 'Back', 'weight'], ['tbar-row', 'T-Bar Row', 'Back', 'weight'], ['face-pull', 'Face Pull', 'Back', 'weight'],
  ['ohp', 'Overhead Press', 'Shoulders', 'weight'], ['db-shoulder', 'Dumbbell Shoulder Press', 'Shoulders', 'weight'], ['lateral-raise', 'Lateral Raise', 'Shoulders', 'weight'],
  ['rear-delt', 'Rear Delt Fly', 'Shoulders', 'weight'], ['upright-row', 'Upright Row', 'Shoulders', 'weight'], ['shrug', 'Shrug', 'Shoulders', 'weight'],
  ['bb-curl', 'Barbell Curl', 'Arms', 'weight'], ['db-curl', 'Dumbbell Curl', 'Arms', 'weight'], ['hammer-curl', 'Hammer Curl', 'Arms', 'weight'],
  ['preacher-curl', 'Preacher Curl', 'Arms', 'weight'], ['tri-pushdown', 'Tricep Pushdown', 'Arms', 'weight'], ['skull-crusher', 'Skull Crusher', 'Arms', 'weight'],
  ['oh-tri', 'Overhead Tricep Extension', 'Arms', 'weight'], ['cg-bench', 'Close-Grip Bench Press', 'Arms', 'weight'],
  ['squat', 'Squat', 'Legs', 'weight'], ['front-squat', 'Front Squat', 'Legs', 'weight'], ['leg-press', 'Leg Press', 'Legs', 'weight'],
  ['rdl', 'Romanian Deadlift', 'Legs', 'weight'], ['leg-curl', 'Leg Curl', 'Legs', 'weight'], ['leg-ext', 'Leg Extension', 'Legs', 'weight'],
  ['lunge', 'Walking Lunge', 'Legs', 'weight'], ['bss', 'Bulgarian Split Squat', 'Legs', 'weight'], ['hip-thrust', 'Hip Thrust', 'Legs', 'weight'],
  ['calf-raise', 'Calf Raise', 'Legs', 'weight'], ['hack-squat', 'Hack Squat', 'Legs', 'weight'],
  ['plank', 'Plank', 'Core', 'time'], ['hanging-leg-raise', 'Hanging Leg Raise', 'Core', 'bodyweight'], ['cable-crunch', 'Cable Crunch', 'Core', 'weight'],
  ['ab-wheel', 'Ab Wheel', 'Core', 'bodyweight'], ['russian-twist', 'Russian Twist', 'Core', 'weight'],
  ['treadmill', 'Treadmill', 'Cardio', 'cardio'], ['run', 'Run (outside)', 'Cardio', 'cardio'], ['bike', 'Bike', 'Cardio', 'cardio'],
  ['rower', 'Rowing Machine', 'Cardio', 'cardio'], ['stairs', 'Stair Climber', 'Cardio', 'cardio'], ['walk', 'Walk', 'Cardio', 'cardio'], ['swim', 'Swim', 'Cardio', 'cardio'],
];
export const EXERCISES = L.map(([id, name, group, type]) => ({ id, name, group, type, builtin: true }));

export function allExercises() { return EXERCISES.concat(Object.values(S.exercises || {})); }
export function findExercise(id) { return allExercises().find(e => e.id === id) || null; }
export function searchExercises(q, group) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  return allExercises().filter(e => (!group || group === 'All' || e.group === group) && words.every(w => e.name.toLowerCase().includes(w)));
}
/* What a set row records for each exercise type. */
export const SET_FIELDS = {
  weight: [{ k: 'w', label: 'lb', step: 5 }, { k: 'r', label: 'reps', step: 1 }],
  bodyweight: [{ k: 'w', label: '+lb', step: 5 }, { k: 'r', label: 'reps', step: 1 }],
  time: [{ k: 's', label: 'sec', step: 5 }],
  cardio: [{ k: 'm', label: 'min', step: 1 }, { k: 'd', label: 'mi', step: 0.1 }],
};
