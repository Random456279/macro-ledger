/* Built-in generic foods (USDA-style values per serving) so day one isn't an empty list.
   They are read-only templates: logging or favoriting one copies it into My Foods
   (foods.js materialize). Raw and cooked versions are separate on purpose. */
import { fullN } from './nutrients.js';

const ROWS = [
  ['egg', 'Egg, large', '1 egg (50 g)', 50, { kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, satFat: 1.6, cholesterol: 186, sodium: 71, potassium: 69, calcium: 28, iron: 0.9, vitD: 1, vitA: 80, vitB12: 0.5, zinc: 0.6 }],
  ['chickenraw', 'Chicken breast, raw (boneless, skinless)', '4 oz (113 g)', 113, { kcal: 136, protein: 25.4, carbs: 0, fat: 3, satFat: 0.7, cholesterol: 83, sodium: 51, potassium: 370, calcium: 6, iron: 0.4, magnesium: 31, zinc: 0.8, vitB12: 0.2 }],
  ['chicken', 'Chicken breast, cooked', '4 oz (113 g)', 113, { kcal: 187, protein: 35, carbs: 0, fat: 4, satFat: 1.1, cholesterol: 97, sodium: 84, potassium: 288, calcium: 7, iron: 0.5, magnesium: 33, zinc: 1.1, vitB12: 0.2 }],
  ['turkeyraw', 'Ground turkey 93/7, raw', '4 oz (113 g)', 113, { kcal: 170, protein: 21, carbs: 0, fat: 9, satFat: 2.5, cholesterol: 80, sodium: 75, potassium: 260, iron: 1.1, zinc: 2.8, vitB12: 1.1 }],
  ['beef', 'Ground beef 85/15, cooked', '4 oz (113 g)', 113, { kcal: 280, protein: 29, carbs: 0, fat: 17, satFat: 7, cholesterol: 100, sodium: 85, potassium: 350, iron: 2.7, zinc: 6.2, vitB12: 2.5 }],
  ['steak', 'Sirloin steak, cooked', '4 oz (113 g)', 113, { kcal: 207, protein: 33, carbs: 0, fat: 7.6, satFat: 2.9, cholesterol: 101, sodium: 66, potassium: 400, iron: 2.2, zinc: 6, vitB12: 1.6, magnesium: 27 }],
  ['salmon', 'Salmon, cooked', '4 oz (113 g)', 113, { kcal: 233, protein: 25, carbs: 0, fat: 14, satFat: 3, cholesterol: 71, sodium: 69, potassium: 420, vitD: 11, vitB12: 3.8, magnesium: 34 }],
  ['rice', 'White rice, cooked', '1 cup (158 g)', 158, { kcal: 205, protein: 4.3, carbs: 44.5, fat: 0.4, fiber: 0.6, sodium: 2, potassium: 55, calcium: 16, iron: 1.9, magnesium: 19 }],
  ['ricedry', 'White rice, dry', '1/4 cup (45 g)', 45, { kcal: 160, protein: 3, carbs: 36, fat: 0.3, fiber: 0.5, sodium: 0, potassium: 35, iron: 1.8, magnesium: 11 }],
  ['potato', 'Russet potato, baked', '1 medium (173 g)', 173, { kcal: 168, protein: 4.5, carbs: 37, fat: 0.2, fiber: 4, sugar: 2, sodium: 24, potassium: 952, calcium: 31, iron: 1.9, magnesium: 52, vitC: 17 }],
  ['pasta', 'Pasta, cooked', '1 cup (140 g)', 140, { kcal: 220, protein: 8, carbs: 43, fat: 1.3, fiber: 2.5, sugar: 0.8, sodium: 1, potassium: 62, iron: 1.8 }],
  ['oats', 'Oats, dry', '1/2 cup (40 g)', 40, { kcal: 150, protein: 5, carbs: 27, fat: 2.5, fiber: 4, sugar: 1, sodium: 0, potassium: 150, calcium: 20, iron: 1.5 }],
  ['bread', 'Bread, whole wheat', '1 slice (32 g)', 32, { kcal: 80, protein: 4, carbs: 14, fat: 1, fiber: 2, sugar: 2, sodium: 140 }],
  ['sweetpotato', 'Sweet potato, baked', '1 medium (114 g)', 114, { kcal: 103, protein: 2.3, carbs: 24, fat: 0.2, fiber: 3.8, sugar: 7.4, sodium: 41, potassium: 542, calcium: 43, iron: 0.8, vitA: 1096, vitC: 22, magnesium: 31 }],
  ['whey', 'Whey protein, generic', '1 scoop (31 g)', 31, { kcal: 120, protein: 24, carbs: 3, fat: 1.5, satFat: 1, cholesterol: 55, sodium: 130, calcium: 120 }],
  ['greekyogurt', 'Greek yogurt, plain nonfat', '1 cup (227 g)', 227, { kcal: 130, protein: 23, carbs: 8, fat: 0.9, sugar: 7, sodium: 82, potassium: 320, calcium: 250, vitB12: 1.3, zinc: 1.2 }],
  ['milk', 'Milk, whole', '1 cup (244 g)', 244, { kcal: 149, protein: 7.7, carbs: 11.7, fat: 7.9, satFat: 4.6, cholesterol: 24, sugar: 12.3, sodium: 105, potassium: 322, calcium: 276, vitD: 2.7, vitA: 112, vitB12: 1.3, magnesium: 24, zinc: 0.9 }],
  ['banana', 'Banana', '1 medium (118 g)', 118, { kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4, potassium: 422, calcium: 6, iron: 0.3, vitC: 10, magnesium: 32 }],
  ['apple', 'Apple', '1 medium (182 g)', 182, { kcal: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, sugar: 19, potassium: 195, vitC: 8 }],
  ['avocado', 'Avocado', '1/2 avocado (100 g)', 100, { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, satFat: 2.1, fiber: 6.7, sugar: 0.7, sodium: 7, potassium: 485, vitC: 10, magnesium: 29 }],
  ['broccoli', 'Broccoli, cooked', '1 cup (156 g)', 156, { kcal: 55, protein: 3.7, carbs: 11, fat: 0.6, fiber: 5, sugar: 2, sodium: 64, potassium: 457, calcium: 62, iron: 1, vitC: 100, vitA: 120, magnesium: 33 }],
  ['peanutbutter', 'Peanut butter', '2 tbsp (32 g)', 32, { kcal: 190, protein: 7, carbs: 7, fat: 16, satFat: 3, fiber: 2, sugar: 3, sodium: 140, potassium: 200, magnesium: 50, zinc: 0.9 }],
  ['almonds', 'Almonds', '1 oz (28 g)', 28, { kcal: 164, protein: 6, carbs: 6, fat: 14, satFat: 1.1, fiber: 3.5, sugar: 1.2, calcium: 76, iron: 1, potassium: 208, magnesium: 76, zinc: 0.9 }],
  ['oliveoil', 'Olive oil', '1 tbsp (14 g)', 14, { kcal: 119, protein: 0, carbs: 0, fat: 13.5, satFat: 1.9 }],
];

export const BASICS = ROWS.map(([key, name, servingLabel, g, n]) => ({ id: 'basic:' + key, basicKey: key, name, brand: 'Basics', servingLabel, servingGrams: g, n: fullN(n), source: 'basic' }));
