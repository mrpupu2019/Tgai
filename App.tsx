import React, { useState, useEffect, useCallback, useRef } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import ChatInterface from './components/ChatInterface';
import SettingsPanel from './components/SettingsPanel';
import Login from './components/Login';
import { ViewMode, Message, Sender, ScheduleConfig, AppSettings } from './types';
import { DEFAULT_PROMPT, DAILY_TRAINING_PROMPT, TRADINGVIEW_EMBED_URL, SHEETS_SCRIPT_BASE, SHEETS_DEFAULT_PATH } from './constants';
import { analyzeChart, analyzeChartMulti, sendChatMessage, generateDailyTraining } from './services/geminiService';
import { analyzeChartOpenAI, analyzeChartMultiOpenAI, sendChatMessageOpenAI } from './services/openaiService';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CHART);
  const [authed, setAuthed] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Capability Check State
  const [isCaptureSupported, setIsCaptureSupported] = useState<boolean>(true);
  
  // Ref to hold the persistent media stream (screen share)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<any>(null);
  const lastLatestRef = useRef<string>('');

  // Settings State
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    enabled: false,
    intervalMinutes: 60,
    nextRun: null,
    dailyTrainingEnabled: true,
    dailyTrainingTime: "08:00",
    dailyTrainingMessage: DAILY_TRAINING_PROMPT,
    quietHoursEnabled: false,
    quietStart: "23:00",
    quietEnd: "05:00",
    quietTimezone: "Asia/Dhaka"
  });

  const [settings, setSettings] = useState<AppSettings>({
    customPrompt: DEFAULT_PROMPT,
    modelName: 'gemini-2.5-flash',
    notificationsEnabled: true,
    autoSheetSyncEnabled: false,
    captureSource: 'external',
    twoImageModeEnabled: false,
    modelProvider: 'gemini'
  });


  // Check device capabilities on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth-status');
        setAuthed(r.ok);
      } catch { setAuthed(false); }
    })();
    const checkSupport = () => {
        // Check for getDisplayMedia support
        // Some mobile browsers have mediaDevices but not getDisplayMedia
        const supported = typeof navigator !== 'undefined' && 
                          !!navigator.mediaDevices && 
                          typeof navigator.mediaDevices.getDisplayMedia === 'function';
        
        setIsCaptureSupported(supported);
    };
    checkSupport();
  }, []);

  const addMessage = (text: string, sender: Sender, imageData?: string, isAnalysis: boolean = false, imageList?: string[]) => {
    const msg = {
      id: Date.now().toString() + Math.random().toString(),
      text,
      sender,
      timestamp: new Date(),
      imageData,
      imageList,
      isAnalysis
    } as Message;
    setMessages((prev) => [...prev, msg]);
    try {
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, text, sender, isAnalysis, image: imageData || null, images: imageList || null, timestamp: msg.timestamp.getTime() })
      });
    } catch {}
  };

  // --- Persistent Screen Capture Logic (Desktop) ---
  const getPersistentStream = async (): Promise<MediaStream> => {
      if (mediaStreamRef.current && mediaStreamRef.current.active) {
          return mediaStreamRef.current;
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        throw new Error("NOT_SUPPORTED");
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: false,
          preferCurrentTab: true, 
          selfBrowserSurface: 'include'
      } as any);

      stream.getVideoTracks()[0].onended = () => {
          mediaStreamRef.current = null;
          if (captureVideoRef.current) {
            captureVideoRef.current.pause();
            captureVideoRef.current.srcObject = null as any;
            captureVideoRef.current.remove();
            captureVideoRef.current = null;
          }
          addMessage("Screen sharing session ended.", Sender.SYSTEM);
      };
      mediaStreamRef.current = stream;

      if (!captureVideoRef.current) {
        const v = document.createElement('video');
        v.id = 'capture-video';
        v.style.position = 'fixed';
        v.style.left = '-9999px';
        v.style.width = '1px';
        v.style.height = '1px';
        v.muted = true;
        v.playsInline = true;
        v.srcObject = stream;
        document.body.appendChild(v);
        await v.play();
        captureVideoRef.current = v;
      }
      return stream;
  };

  const startCaptureSession = async () => {
      await getPersistentStream();
  };

  const stopCaptureSession = () => {
      const s = mediaStreamRef.current;
      if (s) {
        s.getTracks().forEach(t => t.stop());
      }
  };

  const captureChartArea = async (): Promise<string | null> => {
      const stream = mediaStreamRef.current;
      if (!stream || !stream.active) throw Object.assign(new Error("NO_STREAM"), { name: "NO_STREAM" });
      const video = captureVideoRef.current!;
      if (video.paused) {
        await video.play();
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const chartContainer = document.getElementById('tradingview-widget-container');

      if (!ctx) throw new Error("Canvas context unavailable");

      if (chartContainer) {
            const rect = chartContainer.getBoundingClientRect();
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Calculate accurate crop coordinates
            const scaleX = videoWidth / windowWidth;
            const scaleY = videoHeight / windowHeight;
            const cropX = rect.left * scaleX;
            const cropY = rect.top * scaleY;
            const cropWidth = rect.width * scaleX;
            const cropHeight = rect.height * scaleY;

            canvas.width = cropWidth;
            canvas.height = cropHeight;
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
      }
      

      return canvas.toDataURL('image/png');
  };

  // --- Mobile Fallback: External Chart Fetch ---
  const fetchFallbackChart = async (): Promise<string> => {
      try {
        const rLocal = await fetch(`/api/snapshot-local?origin=${encodeURIComponent(window.location.origin)}&t=${Date.now()}`);
        if (rLocal.ok) {
          const d = await rLocal.json();
          if (d?.image) return d.image as string;
        }
      } catch {}
      try {
        const embedUrl = TRADINGVIEW_EMBED_URL;
        const r = await fetch(`/api/snapshot?url=${encodeURIComponent(embedUrl)}&t=${Date.now()}`);
        if (r.ok) {
          const data = await r.json();
          if (data?.image) return data.image as string;
        }
      } catch {}
      const r2 = await fetch(`/api/chart-image?t=${Date.now()}`);
      if (!r2.ok) throw new Error("Unable to retrieve live market data.");
      const data2 = await r2.json();
      if (!data2?.dataUrl) throw new Error("Invalid chart data.");
      return data2.dataUrl as string;
  };

  // --- Main Analysis Logic ---
  const isWithinQuietHours = (): boolean => {
    try {
      if (!schedule.quietHoursEnabled) return false;
      const tz = schedule.quietTimezone || 'Asia/Dhaka';
      const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const parts = formatter.format(new Date()).split(':');
      const nowMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const [sH, sM] = (schedule.quietStart || '23:00').split(':').map(Number);
      const [eH, eM] = (schedule.quietEnd || '05:00').split(':').map(Number);
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      if (startMin <= endMin) {
        return nowMin >= startMin && nowMin < endMin;
      } else {
        return nowMin >= startMin || nowMin < endMin;
      }
    } catch { return false; }
  };

  const performAnalysis = useCallback(async (isAuto: boolean = false) => {
    if (isTyping) return;
    if (isWithinQuietHours()) {
      addMessage("Quiet hours active. Analysis paused.", Sender.SYSTEM);
      return;
    }

    setIsTyping(true);
    
    const captureFlash = document.getElementById('capture-flash');
    if(captureFlash) {
        captureFlash.style.opacity = '0.3';
        setTimeout(() => captureFlash.style.opacity = '0', 300);
    }

    try {
        if (!isAuto) addMessage(settings.captureSource === 'external' ? "Waiting for external snapshot..." : "Fetching market data...", Sender.SYSTEM);
        
        let imageData: string | null = null;
        let imagesData: string[] | null = null;
        if (settings.captureSource === 'external') {
            try {
                const r = await fetch('/api/snapshot-next');
                if (r.ok) {
                    const d = await r.json();
                    if (Array.isArray(d?.images) && settings.twoImageModeEnabled) {
                      imagesData = d.images as string[];
                    } else if (d?.image) {
                      imageData = d.image as string;
                    }
                }
            } catch {}
            if (!imageData && !imagesData) {
                addMessage("No external snapshot available yet.", Sender.SYSTEM);
                setIsTyping(false);
                return;
            }
        } else {
            try {
                imageData = await fetchFallbackChart();
            } catch (e: any) {
                addMessage("Auto mode failed to fetch market image.", Sender.SYSTEM);
                setIsTyping(false);
                return;
            }
        }
        
        if (imageData === null) {
            addMessage("Capture cancelled.", Sender.SYSTEM);
            setIsTyping(false);
            return;
        }

        const prompt = settings.customPrompt;
        if (imagesData && settings.twoImageModeEnabled) {
          addMessage(`Analysis Request: ${prompt}`, Sender.USER, undefined, false, imagesData);
        } else {
          addMessage(`Analysis Request: ${prompt}`, Sender.USER, imageData as string);
        }
        
        let responseText = "";
        if (imagesData && settings.twoImageModeEnabled) {
          const attemptAnalyzeMulti = async () => {
              const attempts = 3;
              let last = "";
              for (let i = 0; i < attempts; i++) {
                  const res = settings.modelProvider === 'openai'
                    ? await analyzeChartMultiOpenAI(imagesData as string[], prompt, settings.modelName)
                    : await analyzeChartMulti(imagesData as string[], prompt);
                  last = res;
                  if (!res.includes('"code":503') && !res.includes('UNAVAILABLE') && !res.includes('RESOURCE_EXHAUSTED')) {
                      return res;
                  }
                  await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
              }
              return last;
          };
          responseText = await attemptAnalyzeMulti();
        } else {
          const attemptAnalyze = async () => {
              const attempts = 3;
              let last = "";
              for (let i = 0; i < attempts; i++) {
                  const res = settings.modelProvider === 'openai'
                    ? await analyzeChartOpenAI((imageData as string), prompt, settings.modelName)
                    : await analyzeChart((imageData as string), prompt);
                  last = res;
                  if (!res.includes('"code":503') && !res.includes('UNAVAILABLE') && !res.includes('RESOURCE_EXHAUSTED')) {
                      return res;
                  }
                  await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
              }
              return last;
          };
          responseText = await attemptAnalyze();
        }
        addMessage(responseText, Sender.AI, undefined, true);
        if (settings.autoSheetSyncEnabled) {
            const trade = parseTradeFromText(responseText);
            if (trade) {
                try {
                    await sendTradeToSheet(trade);
                    addMessage('Trade synced to Google Sheet.', Sender.SYSTEM);
                } catch (e: any) {
                    addMessage('Sheet sync failed: ' + (e?.message || 'Network error'), Sender.SYSTEM);
                }
            }
        }
        setIsTyping(false);

      } catch (error: any) {
          console.error("Analysis Error:", error);
          let errorMsg = error.message || "Connection error";
          if (errorMsg.includes("NOT_SUPPORTED")) {
            // Fallback if support check failed mid-operation
            errorMsg = "Screen capture not supported. Switching to fallback data...";
            setIsCaptureSupported(false); // Switch mode for next time
            setIsTyping(false); // Reset typing so user can click again immediately
            return; 
        }
        if (errorMsg.includes("NO_STREAM")) {
            addMessage("Screen capture is not active. Use Start Capture to enable.", Sender.SYSTEM);
            setIsTyping(false);
            return;
        }
        addMessage("Analysis Failed: " + errorMsg, Sender.SYSTEM);
        setIsTyping(false);
      }
  }, [settings.customPrompt, settings.captureSource, settings.twoImageModeEnabled, settings.modelProvider, settings.modelName, isTyping, isCaptureSupported, schedule.quietHoursEnabled, schedule.quietStart, schedule.quietEnd, schedule.quietTimezone]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/settings');
        if (r.ok) {
          const d = await r.json();
          if (d?.settings) setSettings((prev) => ({ ...prev, ...d.settings }));
          if (d?.schedule) setSchedule((prev) => ({ ...prev, ...d.schedule }));
        }
      } catch {}
      try {
        const r2 = await fetch('/api/history');
        if (r2.ok) {
          const d2 = await r2.json();
          const items: any[] = d2?.items || [];
          const restored: Message[] = items.map((it) => ({
            id: String(it.id || Date.now() + Math.random()),
            text: String(it.text || ''),
            sender: (it.sender === 'USER' ? Sender.USER : it.sender === 'SYSTEM' ? Sender.SYSTEM : Sender.AI),
            timestamp: new Date(it.timestamp || Date.now()),
            imageData: it.image || undefined,
            imageList: it.images || undefined,
            isAnalysis: !!it.isAnalysis,
          }));
          if (restored.length) setMessages((prev) => [...restored, ...prev]);
        }
      } catch {}
    })();
  }, []);

  const saveSettingsToServer = async (s: AppSettings, sch: ScheduleConfig) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: s, schedule: sch })
      });
    } catch {}
  };

  const clearHistory = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' });
    } catch {}
    setMessages([]);
  };

  const parseTradeFromText = (text: string) => {
    const cleaned = text.replace(/[*_`]/g, '').replace(/\n/g, ' ');
    const sym = cleaned.match(/symbol\s*:\s*([A-Za-z0-9:_/.-]+)/i)?.[1];
    const type = cleaned.match(/type\s*:\s*(buy|sell)/i)?.[1];
    const lotStr = cleaned.match(/lot\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
    const slStr = cleaned.match(/sl\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
    const tpStr = cleaned.match(/tp\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
    if (!sym || !type || !lotStr || !slStr || !tpStr) return null;
    return { symbol: sym, type: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(), lot: lotStr, sl: slStr, tp: tpStr };
  };

  const sendTradeToSheet = async (trade: { symbol: string; type: string; lot: string; sl: string; tp: string }) => {
    const url = `${SHEETS_SCRIPT_BASE}?path=${encodeURIComponent(SHEETS_DEFAULT_PATH)}&action=write&symbol=${encodeURIComponent(trade.symbol)}&type=${encodeURIComponent(trade.type)}&lot=${encodeURIComponent(trade.lot)}&sl=${encodeURIComponent(trade.sl)}&tp=${encodeURIComponent(trade.tp)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const txt = await res.text();
    if (!/Row added successfully/i.test(txt)) throw new Error(txt);
  };

  // Manual Chat Handler
  const handleSendMessage = async (text: string) => {
    addMessage(text, Sender.USER);
    setIsTyping(true);

    try {
        if (settings.modelProvider === 'openai') {
          const history = messages.map(m => ({
            role: m.sender === Sender.USER ? 'user' : 'assistant' as 'user' | 'assistant',
            content: [{ type: 'text', text: m.text }]
          })).slice(-10);
          const response = await sendChatMessageOpenAI(history, text, settings.modelName);
          addMessage(response, Sender.AI);
        } else {
          const history = messages.map(m => ({
            role: m.sender === Sender.USER ? "user" : "model" as "user" | "model",
            parts: [{ text: m.text }]
          })).slice(-10);
          const response = await sendChatMessage(history, text);
          addMessage(response, Sender.AI);
        }
        if (settings.autoSheetSyncEnabled) {
            const trade = parseTradeFromText(response);
            if (trade) {
                try {
                    await sendTradeToSheet(trade);
                    addMessage('Trade synced to Google Sheet.', Sender.SYSTEM);
                } catch (e: any) {
                    addMessage('Sheet sync failed: ' + (e?.message || 'Network error'), Sender.SYSTEM);
                }
            }
        }
    } catch (error) {
        addMessage("Error connecting to AI.", Sender.SYSTEM);
    } finally {
        setIsTyping(false);
    }
  };

  useEffect(() => {
    try {
      const externalOnly = settings.captureSource === 'external';
      fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalOnly }),
      });
    } catch {}
  }, [settings.captureSource]);

  useEffect(() => {
    if (settings.captureSource !== 'external') {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    let sseOk = false;
    try {
      if (sseRef.current) sseRef.current.close();
      const es = new EventSource('/api/snapshot-stream');
      sseRef.current = es;
      es.onopen = () => { sseOk = true; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
      es.onmessage = async (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          const images: string[] | null = data?.images || null;
          const one: string | null = data?.image || null;
          if ((!images && !one) || isTyping) return;
          setIsTyping(true);
          const prompt = settings.customPrompt;
          if (images && images.length >= 2 && settings.twoImageModeEnabled) {
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, undefined, false, images);
          } else {
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, (one || images?.[0]) as string);
          }
          let resText = "";
          if (images && images.length >= 2 && settings.twoImageModeEnabled) {
            for (let i = 0; i < 3; i++) {
              resText = settings.modelProvider === 'openai'
                ? await analyzeChartMultiOpenAI(images, prompt, settings.modelName)
                : await analyzeChartMulti(images, prompt);
              if (!resText.includes('"code":503') && !resText.includes('UNAVAILABLE') && !resText.includes('RESOURCE_EXHAUSTED')) break;
              await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            }
          } else {
            for (let i = 0; i < 3; i++) {
              resText = settings.modelProvider === 'openai'
                ? await analyzeChartOpenAI((one || images?.[0]) as string, prompt, settings.modelName)
                : await analyzeChart((one || images?.[0]) as string, prompt);
              if (!resText.includes('"code":503') && !resText.includes('UNAVAILABLE') && !resText.includes('RESOURCE_EXHAUSTED')) break;
              await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            }
          }
          addMessage(resText, Sender.AI, undefined, true);
          if (settings.autoSheetSyncEnabled) {
            const trade = parseTradeFromText(resText);
            if (trade) {
              try {
                await sendTradeToSheet(trade);
                addMessage('Trade synced to Google Sheet.', Sender.SYSTEM);
              } catch (e: any) {
                addMessage('Sheet sync failed: ' + (e?.message || 'Network error'), Sender.SYSTEM);
              }
            }
          }
          setIsTyping(false);
        } catch {}
      };
      es.onerror = () => { try { es.close(); } catch {} sseOk = false; };
    } catch { sseOk = false; }
    if (!sseOk) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/snapshot-latest?t=${Date.now()}`);
          if (!r.ok) return;
          const d = await r.json();
          const key = (Array.isArray(d?.images) ? (d.images[0] || '') : (d?.image || '')) as string;
          if (!key || key === lastLatestRef.current || isTyping) return;
          lastLatestRef.current = key;
          setIsTyping(true);
          const prompt = settings.customPrompt;
          if (Array.isArray(d?.imageUrls) && d.imageUrls.length >= 2 && settings.twoImageModeEnabled) {
            const arr = await Promise.all(d.imageUrls.map(async (u: string) => {
              const resp = await fetch(u);
              const b = await resp.blob();
              const buf = await b.arrayBuffer();
              const b64 = b.type.startsWith('image/') ? `data:${b.type};base64,${Buffer.from(buf).toString('base64')}` : '';
              return b64;
            }));
            const imagesB64 = arr.filter(Boolean) as string[];
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, undefined, false, imagesB64);
            const res = await analyzeChartMulti(imagesB64, prompt);
            addMessage(res, Sender.AI, undefined, true);
          } else if (Array.isArray(d?.images) && d.images.length >= 2 && settings.twoImageModeEnabled) {
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, undefined, false, d.images as string[]);
            const res = await analyzeChartMulti(d.images as string[], prompt);
            addMessage(res, Sender.AI, undefined, true);
          } else if (d?.image) {
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, d.image as string);
            const res = await analyzeChart(d.image as string, prompt);
            addMessage(res, Sender.AI, undefined, true);
          } else if (Array.isArray(d?.imageUrls) && d.imageUrls.length > 0) {
            const resp = await fetch(d.imageUrls[0]);
            const b = await resp.blob();
            const buf = await b.arrayBuffer();
            const first = `data:${b.type};base64,${Buffer.from(buf).toString('base64')}`;
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, first);
            const res = await analyzeChart(first, prompt);
            addMessage(res, Sender.AI, undefined, true);
          } else if (Array.isArray(d?.images) && d.images.length > 0) {
            const first = d.images[0] as string;
            addMessage(`Analysis Request: ${prompt}`, Sender.USER, first);
            const res = await analyzeChart(first, prompt);
            addMessage(res, Sender.AI, undefined, true);
          }
          setIsTyping(false);
        } catch {}
      }, 4000);
    }
    return () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [settings.captureSource, settings.customPrompt, settings.autoSheetSyncEnabled, settings.twoImageModeEnabled, settings.modelProvider, settings.modelName, isTyping]);

  // Scheduler Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      // Auto-schedule works on both Desktop and Mobile now (via fallback)
      if (schedule.enabled && ((schedule.nextRun && now >= schedule.nextRun) || (!schedule.nextRun))) {
        performAnalysis(true);
        setSchedule(prev => ({
          ...prev,
          nextRun: now + (prev.intervalMinutes * 60000)
        }));
      }

      if (schedule.dailyTrainingEnabled) {
          const [hours, minutes] = schedule.dailyTrainingTime.split(':').map(Number);
          const nowObj = new Date();
          if (nowObj.getHours() === hours && nowObj.getMinutes() === minutes && nowObj.getSeconds() < 5) {
             const alreadyRanToday = messages.some(m => m.text.includes("Daily Training") && m.timestamp.getDate() === nowObj.getDate());
             if(!alreadyRanToday) {
                 setIsTyping(true);
                 generateDailyTraining(schedule.dailyTrainingMessage || DAILY_TRAINING_PROMPT).then(res => {
                     addMessage(`Daily Training: ${res}`, Sender.AI);
                     setIsTyping(false);
                 });
             }
          }
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [schedule, performAnalysis, messages]);


  return (
    <div className="flex h-screen bg-gray-950 font-sans relative">
        <div id="capture-flash" className="fixed inset-0 bg-blue-500 pointer-events-none opacity-0 transition-opacity duration-200 z-50 mix-blend-overlay"></div>

      <aside className="w-16 md:w-20 flex flex-col items-center py-6 bg-gray-900 border-r border-gray-800 z-20">
        <div className="mb-8 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
        </div>

        <nav className="flex-1 flex flex-col gap-6 w-full">
          <button
            onClick={() => setViewMode(ViewMode.CHART)}
            className={`p-3 rounded-xl mx-auto transition-all ${
              viewMode === ViewMode.CHART ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800'
            }`}
            title="Live Chart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
            </svg>
          </button>

          <button
            onClick={() => setViewMode(ViewMode.CHAT)}
            className={`p-3 rounded-xl mx-auto transition-all relative ${
              viewMode === ViewMode.CHAT ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-gray-400 hover:bg-gray-800'
            }`}
            title="AI Analyst"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            {messages.length > 0 && viewMode !== ViewMode.CHAT && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900"></span>
            )}
          </button>

          <button
            onClick={() => setViewMode(ViewMode.SETTINGS)}
            className={`p-3 rounded-xl mx-auto transition-all ${
              viewMode === ViewMode.SETTINGS ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:bg-gray-800'
            }`}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex p-2 md:p-4 gap-4 overflow-hidden relative">
            
            <div className={`flex-1 transition-all duration-500 ${viewMode === ViewMode.CHART ? 'opacity-100 translate-x-0' : 'hidden md:flex md:w-1/2 lg:w-2/3'}`}>
                <div className="w-full h-full relative group">
                    <TradingViewWidget />
                    
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                    <button
                        onClick={() => performAnalysis(false)}
                        disabled={isTyping}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Analyze Chart"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                        </svg>
                        Analyze Now
                    </button>
                    <button
                      onClick={() => (mediaStreamRef.current && mediaStreamRef.current.active ? stopCaptureSession() : startCaptureSession())}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-lg border border-gray-700 transition-all opacity-0 group-hover:opacity-100"
                      title={mediaStreamRef.current && mediaStreamRef.current.active ? "Stop Capture" : "Start Capture"}
                    >
                      {mediaStreamRef.current && mediaStreamRef.current.active ? 'Stop Capture' : 'Start Capture'}
                    </button>
                    </div>
                </div>
            </div>

             <div className={`${viewMode === ViewMode.CHART ? 'hidden md:flex md:w-1/2 lg:w-1/3' : 'flex-1'} flex flex-col h-full transition-all duration-300`}>
                {viewMode === ViewMode.SETTINGS ? (
                    <SettingsPanel 
                        settings={settings} 
                        schedule={schedule} 
                        onSettingsChange={setSettings}
                        onScheduleChange={setSchedule}
                        onSave={(s, sch) => { setSettings(s); setSchedule(sch); saveSettingsToServer(s, sch); addMessage('Settings saved.', Sender.SYSTEM); }}
                    />
                ) : (
                    <ChatInterface 
                        messages={messages} 
                        onSendMessage={handleSendMessage}
                        onClearHistory={clearHistory}
                        isTyping={isTyping}
                    />
                )}
            </div>

        </div>
      </main>
      {!authed && <Login onSuccess={() => setAuthed(true)} />}
    </div>
  );
};

export default App;
