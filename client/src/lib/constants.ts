// Application-wide constants.
// Default symbols and mistakes are built into the client; custom ones come from Settings.

export const DEFAULT_SYMBOLS = [
  // Metals
  'XAUUSD', 'XAGUSD',
  // Major forex
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
  // Minor forex
  'GBPJPY', 'EURJPY', 'EURGBP', 'CADJPY', 'AUDJPY', 'GBPAUD', 'EURCAD',
  // Crypto
  'BTCUSD', 'ETHUSD',
  // Indices
  'US30', 'NAS100', 'US500', 'GER40', 'UK100', 'JPN225',
  // Oil
  'USOIL', 'UKOIL',
] as const;

export const DEFAULT_MISTAKES = [
  'Entered too early',
  'Entered too late',
  'Entered without a setup',
  'FOMO entry',
  'Revenge trading',
  'Overtrading',
  'Ignored stop loss',
  'Moved stop loss unnecessarily',
  'Exited too early',
  'Exited too late',
  'Took profit too quickly',
  'Increased lot size unnecessarily',
  'Traded against the trend',
  "Didn't follow my trading plan",
  'Poor risk management',
] as const;

export const EMOTIONS = [
  'Calm', 'Confident', 'Fearful', 'Greedy',
  'Impatient', 'Frustrated', 'FOMO', 'Revenge', 'Unsure', 'Other',
] as const;

export const PLAN_FOLLOWED_OPTIONS = ['Yes', 'No', 'Partially'] as const;

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD',
  'INR', 'SGD', 'AED', 'ZAR', 'HKD', 'MXN', 'NOK', 'SEK',
];
