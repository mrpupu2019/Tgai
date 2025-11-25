import React, { useEffect, useState } from 'react';
import { AppSettings, ScheduleConfig } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  schedule: ScheduleConfig;
  onSettingsChange: (newSettings: AppSettings) => void;
  onScheduleChange: (newSchedule: ScheduleConfig) => void;
  onSave?: (newSettings: AppSettings, newSchedule: ScheduleConfig) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  schedule,
  onSettingsChange,
  onScheduleChange,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [localSchedule, setLocalSchedule] = useState<ScheduleConfig>(schedule);

  useEffect(() => { setLocalSettings(settings); }, [settings]);
  useEffect(() => { setLocalSchedule(schedule); }, [schedule]);

  const saveAll = () => {
    const s = { ...localSettings };
    const sch = { ...localSchedule };
    onSettingsChange(s);
    onScheduleChange(sch);
    if (typeof onSave === 'function') onSave(s, sch);
  };
  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-900 rounded-lg border border-gray-800 shadow-xl text-gray-200">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        System Configuration
      </h2>

      <div className="space-y-8">
        {/* Scheduling Section */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Automation Schedule</h3>
          <div className="bg-gray-800 p-4 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Auto-Capture & Analyze</label>
              <div 
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${localSchedule.enabled ? 'bg-emerald-600' : 'bg-gray-600'}`}
                onClick={() => setLocalSchedule({ ...localSchedule, enabled: !localSchedule.enabled })}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${localSchedule.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </div>

            {localSchedule.enabled && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs text-gray-400">Frequency (minutes)</label>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={localSchedule.intervalMinutes}
                  onChange={(e) => setLocalSchedule({ ...localSchedule, intervalMinutes: parseInt(e.target.value) || 60, nextRun: Date.now() + ((parseInt(e.target.value) || 60) * 60000) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none text-white"
                />
                <p className="text-[10px] text-gray-500">Minimum 15 minutes to avoid rate limits.</p>

                <div className="flex items-center gap-2 mt-2">
                  {[
                    { label: '15m', val: 15 },
                    { label: '30m', val: 30 },
                    { label: '1h', val: 60 },
                    { label: '2h', val: 120 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      className={`px-2 py-1 rounded border text-xs ${localSchedule.intervalMinutes === opt.val ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
                      onClick={() => setLocalSchedule({ ...localSchedule, intervalMinutes: opt.val, nextRun: Date.now() + (opt.val * 60000) })}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    className="ml-auto px-2 py-1 rounded border text-xs bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-600"
                    onClick={() => setLocalSchedule({ ...localSchedule, nextRun: Date.now() })}
                    title="Start Now"
                  >
                    Start Now
                  </button>
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Daily Morning Training</label>
                    <div 
                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${localSchedule.dailyTrainingEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                        onClick={() => setLocalSchedule({ ...localSchedule, dailyTrainingEnabled: !localSchedule.dailyTrainingEnabled })}
                    >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${localSchedule.dailyTrainingEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                </div>
                {localSchedule.dailyTrainingEnabled && (
                     <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Time:</label>
                        <input 
                            type="time" 
                            value={localSchedule.dailyTrainingTime}
                            onChange={(e) => setLocalSchedule({...localSchedule, dailyTrainingTime: e.target.value})}
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                     </div>
                )}
            </div>
          </div>
        </section>

        {/* Prompt Configuration */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">AI Personality</h3>
          <div className="bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Default Analysis Prompt</label>
                <span className="text-xs text-gray-500">This prompt is sent to Gemini along with the chart screenshot.</span>
            </div>
            <textarea
              rows={4}
              value={localSettings.customPrompt}
              onChange={(e) => setLocalSettings({ ...localSettings, customPrompt: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </section>

        {/* AI Model */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">AI Model</h3>
          <div className="bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <button
                className={`px-3 py-1.5 rounded border text-sm ${settings.modelProvider === 'gemini' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
                onClick={() => onSettingsChange({ ...settings, modelProvider: 'gemini' })}
              >
                Gemini
              </button>
              <button
                className={`px-3 py-1.5 rounded border text-sm ${settings.modelProvider === 'openai' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
                onClick={() => onSettingsChange({ ...settings, modelProvider: 'openai' })}
              >
                OpenAI
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Model name or fine-tune ID</label>
              <input
                type="text"
                value={settings.modelName}
                onChange={(e) => onSettingsChange({ ...settings, modelName: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">Examples: gemini-2.5-flash, gpt-4o-mini, ft:gpt-4o-mini:&lt;id&gt;</span>
            </div>
          </div>
        </section>

        {/* Daily Training Message */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Daily Morning Training Message</h3>
          <div className="bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Custom message</label>
              <span className="text-xs text-gray-500">This text is sent to AI at the scheduled time.</span>
            </div>
            <textarea
              rows={3}
              value={localSchedule.dailyTrainingMessage ?? ''}
              onChange={(e) => setLocalSchedule({ ...localSchedule, dailyTrainingMessage: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </section>

        {/* Quiet Hours */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Quiet Hours</h3>
          <div className="bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Pause analysis during the time range</label>
              <div 
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${localSchedule.quietHoursEnabled ? 'bg-red-600' : 'bg-gray-600'}`}
                onClick={() => setLocalSchedule({ ...localSchedule, quietHoursEnabled: !localSchedule.quietHoursEnabled })}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${localSchedule.quietHoursEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </div>
            {localSchedule.quietHoursEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Start</label>
                  <input type="time" value={localSchedule.quietStart || '23:00'} onChange={(e) => setLocalSchedule({ ...localSchedule, quietStart: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">End</label>
                  <input type="time" value={localSchedule.quietEnd || '05:00'} onChange={(e) => setLocalSchedule({ ...localSchedule, quietEnd: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Timezone</label>
                  <input type="text" value={localSchedule.quietTimezone || 'Asia/Dhaka'} onChange={(e) => setLocalSchedule({ ...localSchedule, quietTimezone: e.target.value })} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Notifications</h3>
          <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
             <label className="text-sm font-medium text-gray-300">In-App Notifications</label>
              <div 
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${localSettings.notificationsEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                onClick={() => setLocalSettings({ ...localSettings, notificationsEnabled: !localSettings.notificationsEnabled })}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${localSettings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
          </div>
        </section>

        {/* Capture Source */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Capture Source</h3>
          <div className="bg-gray-800 p-4 rounded-lg flex items-center gap-3">
            <button
              className={`px-3 py-1.5 rounded border text-sm ${localSettings.captureSource === 'external' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
              onClick={() => setLocalSettings({ ...localSettings, captureSource: 'external' })}
            >
              External Agent (VPS)
            </button>
            <button
              className={`px-3 py-1.5 rounded border text-sm ${localSettings.captureSource === 'web' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
              onClick={() => setLocalSettings({ ...localSettings, captureSource: 'web' })}
            >
              Web Embed (auto)
            </button>
          </div>
          {localSettings.captureSource === 'external' && (
            <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Enable 2‑image mode (15m + 1h)</label>
              <div
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${localSettings.twoImageModeEnabled ? 'bg-emerald-600' : 'bg-gray-600'}`}
                onClick={() => setLocalSettings({ ...localSettings, twoImageModeEnabled: !localSettings.twoImageModeEnabled })}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${localSettings.twoImageModeEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </div>
          )}
        </section>

        {/* Google Sheet Sync */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Google Sheet Sync</h3>
          <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
             <label className="text-sm font-medium text-gray-300">Auto fill trade via API link</label>
             <div 
               className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${localSettings.autoSheetSyncEnabled ? 'bg-emerald-600' : 'bg-gray-600'}`}
               onClick={() => setLocalSettings({ ...localSettings, autoSheetSyncEnabled: !localSettings.autoSheetSyncEnabled })}
             >
               <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${localSettings.autoSheetSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
             </div>
          </div>
        </section>

        {/* External Agent Intake Info */}
        {settings.captureSource === 'external' && (
          <section className="space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">External Agent Intake</h3>
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="text-xs text-gray-400">The VPS agent uploads to <code className="text-gray-300">/api/snapshot-upload</code>. The app analyzes each upload immediately.</p>
            </div>
          </section>
        )}

        {/* Save Bar */}
        <section className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-end gap-2">
            <button
              className="px-3 py-1.5 rounded border text-sm bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
              onClick={() => { setLocalSettings(settings); setLocalSchedule(schedule); }}
            >
              Reset
            </button>
            <button
              className="px-3 py-1.5 rounded border text-sm bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500"
              onClick={() => {
                const s = { ...localSettings };
                const sch = { ...localSchedule };
                onSettingsChange(s);
                onScheduleChange(sch);
                if (typeof onSave === 'function') onSave(s, sch);
              }}
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPanel;
