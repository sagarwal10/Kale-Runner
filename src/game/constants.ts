/**
 * Core constants for Kale Runner
 */

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 680;
export const HUD_HEIGHT = 64;
export const BOTTOM_BAR_HEIGHT = 28;

// Player speed
export const PLAYER_BASE_SPEED = 4.4; // tiles per second (normal speed enabled from start)

// Scoring
export const SCORE_VEGGIE = 10;
export const SCORE_POWER_VEGGIE = 50;
export const SCORE_EAT_ENEMY = 100;
export const PENALTY_SODA = 20;
export const PENALTY_PIZZA = 20;
export const PENALTY_DONUT = 25;
export const PENALTY_CAKE = 30;

// Game over threshold
export const GAME_OVER_SCORE = -100;

// Enemy IDs
export type EnemyType = 'pizza' | 'soda' | 'donut' | 'cake';

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  emoji: string;
  penalty: number;
  description: string;
  baseSpeed: number; // in tiles per second or normalized speed
  color: string;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  pizza: {
    type: 'pizza',
    name: 'Pizza',
    emoji: '🍕',
    penalty: PENALTY_PIZZA,
    description: 'Pizza: chases you −20',
    baseSpeed: 2.2, // tiles per second (forgiving, escalates in higher levels)
    color: '#f59e0b',
  },
  soda: {
    type: 'soda',
    name: 'Soda',
    emoji: '🥤',
    penalty: PENALTY_SODA,
    description: 'Soda: fast and erratic −20',
    baseSpeed: 3.5, // tiles per second
    color: '#06b6d4',
  },
  donut: {
    type: 'donut',
    name: 'Donut',
    emoji: '🍩',
    penalty: PENALTY_DONUT,
    description: 'Donut: cuts you off −25',
    baseSpeed: 2.8, // tiles per second
    color: '#ec4899',
  },
  cake: {
    type: 'cake',
    name: 'Cake',
    emoji: '🎂',
    penalty: PENALTY_CAKE,
    description: 'Cake: slow, blocks halls −30',
    baseSpeed: 2.1, // tiles per second
    color: '#a855f7',
  },
};

export interface BerryDef {
  id: string;
  name: string;
  emoji: string;
  colorHex: number;
  glowColor: number;
  textColor: string;
  fact: string;
}

export const BERRY_VARIETIES: BerryDef[] = [
  {
    id: 'blueberry',
    name: 'Blueberry',
    emoji: '🫐',
    colorHex: 0x3b82f6,
    glowColor: 0x60a5fa,
    textColor: '#60a5fa',
    fact: 'Blueberries pack anthocyanins that protect against oxidative stress & sharpen focus.',
  },
  {
    id: 'raspberry',
    name: 'Raspberry',
    emoji: '🍒',
    colorHex: 0xf43f5e,
    glowColor: 0xfb7185,
    textColor: '#fb7185',
    fact: 'Raspberries deliver 8g of prebiotic dietary fiber per cup and protective ellagitannins.',
  },
  {
    id: 'blackberry',
    name: 'Blackberry',
    emoji: '🍇',
    colorHex: 0x7e22ce,
    glowColor: 0xa855f7,
    textColor: '#c084fc',
    fact: 'Blackberries are loaded with bioflavonoids and Vitamin K for brain cell agility.',
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    emoji: '🍓',
    colorHex: 0xef4444,
    glowColor: 0xf87171,
    textColor: '#f87171',
    fact: 'Strawberries contain more Vitamin C per serving than oranges, supporting stamina.',
  },
];

export const BERRY_LOOKUP: Record<string, BerryDef> = {
  '🫐': BERRY_VARIETIES[0],
  '🍒': BERRY_VARIETIES[1],
  '🍇': BERRY_VARIETIES[2],
  '🍓': BERRY_VARIETIES[3],
};

// Sprinkles in a colorful balanced mix of fresh veggies and the 4 berry varieties
export const VEGGIE_EMOJIS = ['🥕', '🫐', '🫛', '🍓', '🥕', '🍇', '🫛', '🍒'];
export const POWER_VEGGIE_EMOJIS = ['🥬', '🥦', '🥑'];

export interface SuperfoodDef {
  id: string;
  name: string;
  emoji: string;
  shortLabel: string;
  badge: string;
  colorHex: number;
  glowColor: number;
  textColor: string;
  benefits: string[];
  summary: string;
}

export const SUPERFOOD_VARIETIES: SuperfoodDef[] = [
  {
    id: 'spinach',
    name: 'Spinach',
    emoji: '🍃',
    shortLabel: 'SPINACH',
    badge: 'Cellular Endurance & Nitric Oxide',
    colorHex: 0x10b981,
    glowColor: 0x34d399,
    textColor: '#34d399',
    benefits: [
      '🍃 Dietary Nitrates: Boost nitric oxide for muscle oxygenation & stamina',
      '🍃 Lutein & Zeaxanthin: Shield retinal tissue & sharpen visual reflexes',
      '🍃 Iron & Bioactive Folate: Power ATP cellular energy & combat fatigue',
      '🍃 Plant Thylakoids: Regulate satiety hormones & steady metabolism',
    ],
    summary: 'Spinach: Dietary nitrates surge oxygen delivery and sharpen visual reflexes!',
  },
  {
    id: 'almonds',
    name: 'Almonds',
    emoji: '🌰',
    shortLabel: 'ALMONDS',
    badge: 'Neural Membrane Defense & Stamina',
    colorHex: 0xf59e0b,
    glowColor: 0xfbbf24,
    textColor: '#fbbf24',
    benefits: [
      '🌰 Vitamin E (Alpha-Tocopherol): Shields brain cell membranes from oxidation',
      '🌰 High Magnesium: Calms vascular tone, regulates nerves & halts fatigue',
      '🌰 Clean Plant Protein & Lipids: Deliver hours of steady metabolic stamina',
      '🌰 Prebiotic Skin Fiber: Feeds beneficial gut Bifidobacteria flora',
    ],
    summary: 'Almonds: Vitamin E & magnesium protect brain cell membranes & stop fatigue!',
  },
  {
    id: 'walnuts',
    name: 'Walnuts',
    emoji: '🥜',
    shortLabel: 'WALNUTS',
    badge: 'Brain Neuroplasticity & Omega-3 ALA',
    colorHex: 0xd97706,
    glowColor: 0xfcd34d,
    textColor: '#fcd34d',
    benefits: [
      '🥜 Plant Omega-3 ALA: Essential fatty acid nourishing cerebral gray matter',
      '🥜 Polyphenolic Ellagitannins: Cross blood-brain barrier to halt inflammation',
      '🥜 Melatonin & Copper: Accelerate cellular repair & neurotransmitter synthesis',
      '🥜 Endothelial Tone: Increases arterial nitric oxide flexibility for blood flow',
    ],
    summary: 'Walnuts: Plant Omega-3 ALA & ellagitannins fuel brain plasticity & focus!',
  },
  {
    id: 'broccoli',
    name: 'Broccoli',
    emoji: '🥦',
    shortLabel: 'BROCCOLI',
    badge: 'Sulforaphane Nrf2 & Cellular Defense',
    colorHex: 0x16a34a,
    glowColor: 0x4ade80,
    textColor: '#4ade80',
    benefits: [
      '🥦 Sulforaphane Activation: Potent activator of cellular Nrf2 defense against oxidative stress',
      '🥦 Vitamin C & Carotenoids: Boost collagen structure, eye health & immune vitality',
      '🥦 Indole-3-Carbinol: Promotes cellular DNA repair and healthy hormone balance',
      '🥦 Chromium & Prebiotic Fiber: Regulates blood glucose balance and gut microbiome',
    ],
    summary: 'Broccoli: Sulforaphane sparks Nrf2 cellular defenses & protects DNA integrity!',
  },
  {
    id: 'cauliflower',
    name: 'Cauliflower',
    emoji: '🤍',
    shortLabel: 'CAULIFLOWER',
    badge: 'White Choline Matrix & Cellular Detox',
    colorHex: 0xf8fafc,
    glowColor: 0xffffff,
    textColor: '#ffffff',
    benefits: [
      '🤍 Choline Powerhouse: Vital precursor for memory neurotransmitter acetylcholine',
      '🤍 Anthoxanthin Bioflavonoids: White plant pigments that lower arterial blood pressure',
      '🤍 Phase II Glucosinolates: Activates liver enzyme detoxification & cellular cleansing',
      '🤍 Vitamin C & Dietary Fiber: Strengthens mucosal immunity and optimizes digestion',
    ],
    summary: 'Cauliflower: Choline & white anthoxanthins optimize brain acetylcholine & arterial flow!',
  },
  {
    id: 'kale',
    name: 'Super Kale',
    emoji: '🥬',
    shortLabel: 'KALE',
    badge: 'King of Greens & Bone Density',
    colorHex: 0x22c55e,
    glowColor: 0x4ade80,
    textColor: '#4ade80',
    benefits: [
      '🥬 Vitamin K1 Surge (>100% DV): Directs calcium into bones & away from arteries',
      '🥬 Kaempferol & Quercetin: Potent cardio-protective anti-inflammatory flavones',
      '🥬 Carotenoid Dense: Neutralizes systemic free radicals & metabolic stress',
      '🥬 Sulfo-Glucosinolates: Enhance DNA cellular repair mechanisms',
    ],
    summary: 'Kale: Vitamin K & bioflavonoids supercharge bone density & arterial flow!',
  },
  {
    id: 'avocado',
    name: 'Avocado',
    emoji: '🥑',
    shortLabel: 'AVOCADO',
    badge: 'Neural Lipid Sheaths & Potassium',
    colorHex: 0x84cc16,
    glowColor: 0xa3e635,
    textColor: '#a3e635',
    benefits: [
      '🥑 Oleic Acid (Monounsaturated Fat): Insulates neural axons for rapid transmission',
      '🥑 Potassium Loaded (> Banana): Regulates cellular fluid balance & prevents cramps',
      '🥑 Nutrient Absorption Booster: Magnifies fat-soluble carotenoid uptake up to 15x',
      '🥑 Glutathione Master Antioxidant: Defends mitochondria from metabolic fatigue',
    ],
    summary: 'Avocado: Oleic acid & potassium insulate nerves & eliminate muscle fatigue!',
  },
];

export const SUPERFOOD_LOOKUP: Record<string, SuperfoodDef> = {
  spinach: SUPERFOOD_VARIETIES[0],
  almonds: SUPERFOOD_VARIETIES[1],
  walnuts: SUPERFOOD_VARIETIES[2],
  broccoli: SUPERFOOD_VARIETIES[3],
  cauliflower: SUPERFOOD_VARIETIES[4],
  kale: SUPERFOOD_VARIETIES[5],
  avocado: SUPERFOOD_VARIETIES[6],
  '🍃': SUPERFOOD_VARIETIES[0],
  '🌰': SUPERFOOD_VARIETIES[1],
  '🥜': SUPERFOOD_VARIETIES[2],
  '🧠': SUPERFOOD_VARIETIES[2],
  '🥦': SUPERFOOD_VARIETIES[3],
  '🤍': SUPERFOOD_VARIETIES[4],
  '🥬': SUPERFOOD_VARIETIES[5],
  '🥑': SUPERFOOD_VARIETIES[6],
};

export const STORAGE_KEY_BEST_SCORE = 'kale_runner_best_score';
export const STORAGE_KEY_HIGHEST_LEVEL = 'kale_runner_highest_level';
export const STORAGE_KEY_MUTED = 'kale_runner_muted';
