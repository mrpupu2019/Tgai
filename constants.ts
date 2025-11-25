
export const DEFAULT_PROMPT = `symbol: XAUUSD, type: Buy, lot: 0.01, sl: 4005, tp: 4100)
Remember: In every message, always reply in the same format I provided.
remember you have to write full format on top of your massage same like me
Only change these three fields based on the analysis:

type: Buy or Sell

sl: (stop-loss price)

tp: (take-profit price)

I sended a current market screenshot. Analyze it and give me a signal in the same format.
Below the signal, you may write 1–2 short lines of market info or your opinion (maximum 2 lines)`;

export const DAILY_TRAINING_PROMPT = `Good morning. Provide a daily trading mindset tip and a brief overview of key market sessions to watch today.`;

// Switched to OANDA:XAUUSD (Gold) as requested.
export const TRADINGVIEW_EMBED_URL = "https://www.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=60&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=1&saveimage=1&toolbarbg=F1F3F6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=website&utm_medium=widget&utm_campaign=chart&utm_term=OANDA%3AXAUUSD";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

// Google Apps Script Sheet API
export const SHEETS_SCRIPT_BASE = "https://script.google.com/macros/s/AKfycbylx5tZGaOPQBjyue3l2tsZhaH9yftI6jALs9sLmxc8tUWjjeFfGUUThvyUOf4YbNQSrw/exec";
export const SHEETS_DEFAULT_PATH = "Sheet1";
