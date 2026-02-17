'use client';

import { useState, useEffect } from 'react';
import { X, Palette, Clock, Layout, Eye, Sparkles, Loader2, CheckCircle, XCircle, Coffee, Send, Plus, Trash2, Server, Database, Zap } from 'lucide-react';
import { useSettingsStore, themes, getThemeById } from '@/lib/settings-store';
import { useDeckStore } from '@/lib/store';
import { useArticlesStore } from '@/lib/articles-store';
import { useBookmarksStore } from '@/lib/bookmarks-store';
import { migrateToBackend } from '@/lib/backend-sync';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    themeId,
    defaultRefreshInterval,
    defaultViewMode,

    setTheme,
    setDefaultRefreshInterval,
    setDefaultViewMode,

    aiSettings,
    setAiSettings,

    briefingSettings,
    setBriefingSettings,

    backendSettings,
    setBackendSettings,
  } = useSettingsStore();

  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTestingBriefing, setIsTestingBriefing] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isMigrating, setIsMigrating] = useState(false);

  const columns = useDeckStore((state) => state.columns);
  const savedFeeds = useDeckStore((state) => state.savedFeeds);
  const articlesByColumn = useArticlesStore((state) => state.articlesByColumn);
  const bookmarks = useBookmarksStore((state) => state.bookmarks);

  // Check backend connection
  useEffect(() => {
    if (!isOpen || !backendSettings.enabled) return;

    const checkBackend = async () => {
      setBackendStatus('checking');
      try {
        const response = await fetch(`${backendSettings.apiUrl}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          setBackendStatus('connected');
          setBackendSettings({ lastSyncedAt: new Date().toISOString() });
        } else {
          setBackendStatus('disconnected');
        }
      } catch {
        setBackendStatus('disconnected');
      }
    };

    checkBackend();
  }, [isOpen, backendSettings.enabled, backendSettings.apiUrl]);

  // Check Ollama connection when modal opens or URL changes
  useEffect(() => {
    if (!isOpen || aiSettings.provider !== 'ollama') return;

    const checkOllama = async () => {
      setOllamaStatus('checking');
      try {
        const response = await fetch(`/api/ai/summarize?ollamaUrl=${encodeURIComponent(aiSettings.ollamaUrl)}`);
        const data = await response.json();

        if (data.connected) {
          setOllamaStatus('connected');
          setAvailableModels(data.models?.map((m: any) => m.name) || []);
        } else {
          setOllamaStatus('disconnected');
          setAvailableModels([]);
        }
      } catch {
        setOllamaStatus('disconnected');
        setAvailableModels([]);
      }
    };

    checkOllama();
  }, [isOpen, aiSettings.ollamaUrl, aiSettings.provider]);

  const handleSendTestBriefing = async () => {
    setIsTestingBriefing(true);
    setTestStatus('idle');
    setErrorMessage(null);
    try {
      // Collect some sampling articles
      const sampleArticles: any[] = [];
      columns.slice(0, 3).forEach(col => {
        const colArticles = articlesByColumn.get(col.id) || [];
        sampleArticles.push(...colArticles.slice(0, 2));
      });

      // Fallback if no real articles
      if (sampleArticles.length === 0) {
        sampleArticles.push(
          { title: "Example Global Tech Update", sourceTitle: "Tech Daily" },
          { title: "Market Trends Analysis", sourceTitle: "Finance Hub" }
        );
      }

      const response = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: sampleArticles,
          aiSettings,
          telegramSettings: {
            enabled: true,
            token: briefingSettings.telegramToken,
            chatId: briefingSettings.telegramChatId
          }
        }),
      });

      const data = await response.json();

      if (response.ok && !data.telegramError) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setErrorMessage(data.telegramError || data.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Test briefing failed:', error);
      setTestStatus('error');
      setErrorMessage(error.message);
    } finally {
      setIsTestingBriefing(false);
      // Only auto-reset success status
      if (testStatus === 'success') {
        setTimeout(() => setTestStatus('idle'), 3000);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background-secondary border border-border rounded-xl w-full max-w-lg max-h-[85vh] mx-4 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background-tertiary rounded transition-colors text-foreground-secondary hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Palette className="w-4 h-4" />
              <span>Color Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                    themeId === theme.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-foreground-secondary'
                  )}
                >
                  <div className="flex gap-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: theme.background }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: theme.accent }}
                    />
                  </div>
                  <span className="text-sm">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Auto Refresh Interval */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4" />
              <span>Auto Refresh Interval</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setDefaultRefreshInterval(mins)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-sm transition-all',
                    defaultRefreshInterval === mins
                      ? 'border-accent bg-accent text-white'
                      : 'border-border hover:border-foreground-secondary'
                  )}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Default View Mode */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4" />
              <span>Default View Mode</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDefaultViewMode('comfortable')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg border text-sm transition-all',
                  defaultViewMode === 'comfortable'
                    ? 'border-accent bg-accent text-white'
                    : 'border-border hover:border-foreground-secondary'
                )}
              >
                Comfortable
              </button>
              <button
                onClick={() => setDefaultViewMode('compact')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg border text-sm transition-all',
                  defaultViewMode === 'compact'
                    ? 'border-accent bg-accent text-white'
                    : 'border-border hover:border-foreground-secondary'
                )}
              >
                Compact
              </button>
            </div>
          </div>

          {/* Backend Settings */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-500" />
                Backend Storage
              </h3>
              <button
                onClick={() => setBackendSettings({ enabled: !backendSettings.enabled })}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  backendSettings.enabled ? 'bg-accent' : 'bg-border'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    backendSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {backendSettings.enabled && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                {/* Backend URL */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground-secondary">
                    Backend API URL
                  </label>
                  <input
                    type="text"
                    value={backendSettings.apiUrl}
                    onChange={(e) => setBackendSettings({ apiUrl: e.target.value })}
                    placeholder="http://localhost:3002"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Connection Status */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background-tertiary">
                  <span className="text-xs font-medium">Connection Status</span>
                  <div className="flex items-center gap-2">
                    {backendStatus === 'checking' && (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                        <span className="text-xs text-yellow-500">Checking...</span>
                      </>
                    )}
                    {backendStatus === 'connected' && (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-500">Connected</span>
                      </>
                    )}
                    {backendStatus === 'disconnected' && (
                      <>
                        <XCircle className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-red-500">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Auto Sync Toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background-tertiary">
                  <div>
                    <span className="text-sm font-medium">Auto Sync</span>
                    <p className="text-xs text-foreground-secondary">Automatically sync data to backend</p>
                  </div>
                  <button
                    onClick={() => setBackendSettings({ autoSync: !backendSettings.autoSync })}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      backendSettings.autoSync ? 'bg-accent' : 'bg-border'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        backendSettings.autoSync ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>

                {/* AI Tagging Toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background-tertiary">
                  <div>
                    <span className="text-sm font-medium">AI Auto-Tagging</span>
                    <p className="text-xs text-foreground-secondary">Automatically tag articles with topics & sentiment</p>
                  </div>
                  <button
                    onClick={() => setBackendSettings({ aiTaggingEnabled: !backendSettings.aiTaggingEnabled })}
                    disabled={backendStatus !== 'connected'}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      backendSettings.aiTaggingEnabled ? 'bg-accent' : 'bg-border',
                      backendStatus !== 'connected' && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        backendSettings.aiTaggingEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>

                {/* Migration Section */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground-secondary">Data Migration</span>
                    {backendSettings.migrationStatus === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>

                  {backendSettings.migrationStatus === 'not_started' && (
                    <button
                      onClick={async () => {
                        setIsMigrating(true);
                        setBackendSettings({ migrationStatus: 'in_progress' });
                        setErrorMessage(null);

                        try {
                          // Prepare migration data
                          const migrationData = {
                            columns,
                            feeds: savedFeeds,
                            bookmarks,
                            settings: {
                              theme: themeId,
                              defaultRefreshInterval,
                              defaultViewMode,
                              aiSettings,
                              briefingSettings,
                            },
                          };

                          // Migrate to backend
                          const result = await migrateToBackend(migrationData);

                          if (result.success) {
                            setBackendSettings({ migrationStatus: 'completed' });
                            setTestStatus('success');
                            setTimeout(() => setTestStatus('idle'), 3000);
                          } else {
                            setBackendSettings({ migrationStatus: 'failed' });
                            setErrorMessage(result.error || 'Migration failed');
                            setTestStatus('error');
                          }
                        } catch (error) {
                          console.error('Migration error:', error);
                          setBackendSettings({ migrationStatus: 'failed' });
                          setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
                          setTestStatus('error');
                        } finally {
                          setIsMigrating(false);
                        }
                      }}
                      disabled={backendStatus !== 'connected' || isMigrating}
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                        backendStatus === 'connected'
                          ? 'border-accent bg-accent text-white hover:bg-accent/90'
                          : 'border-border bg-background-secondary text-foreground-secondary cursor-not-allowed'
                      )}
                    >
                      {isMigrating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Migrating...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          Migrate Data to Backend
                        </>
                      )}
                    </button>
                  )}

                  {backendSettings.migrationStatus === 'completed' && (
                    <div className="text-xs text-green-500 flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      Migration completed successfully
                    </div>
                  )}

                  {backendSettings.migrationStatus === 'failed' && errorMessage && (
                    <div className="text-xs text-red-500 space-y-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3" />
                        Migration failed
                      </div>
                      <p className="text-foreground-secondary">{errorMessage}</p>
                      <button
                        onClick={() => setBackendSettings({ migrationStatus: 'not_started' })}
                        className="text-accent hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>

                {/* Advanced Settings Link */}
                <div className="border-t border-border pt-3">
                  <a
                    href="/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    Advanced Backend Settings
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* AI Settings */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                AI Assistant
              </h3>
              <button
                onClick={() => setAiSettings({ enabled: !aiSettings.enabled })}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  aiSettings.enabled ? 'bg-accent' : 'bg-border'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    aiSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {aiSettings.enabled && (
              <div className="space-y-3">
                {/* AI Provider */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground-secondary">
                    AI Provider
                  </label>
                  <select
                    value={aiSettings.provider}
                    onChange={(e) => setAiSettings({
                      provider: e.target.value as any,
                      model: e.target.value === 'ollama' ? 'llama3.2' :
                        e.target.value === 'openai' ? 'gpt-4o-mini' :
                          e.target.value === 'anthropic' ? 'claude-3-5-sonnet-20240620' :
                            'gemini-2.0-flash'
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openai">OpenAI (API)</option>
                    <option value="anthropic">Anthropic (API)</option>
                    <option value="gemini">Google Gemini (API)</option>
                  </select>
                </div>

                {/* API Key for Cloud Providers */}
                {aiSettings.provider !== 'ollama' && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                    <label className="text-xs font-medium text-foreground-secondary">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={aiSettings.apiKey}
                      onChange={(e) => setAiSettings({ apiKey: e.target.value })}
                      placeholder={`Enter ${aiSettings.provider} API key`}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none transition-all"
                    />
                  </div>
                )}

                {/* Ollama URL for Local */}
                {aiSettings.provider === 'ollama' && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                    <label className="text-xs font-medium text-foreground-secondary">
                      Ollama URL
                    </label>
                    <input
                      type="text"
                      value={aiSettings.ollamaUrl}
                      onChange={(e) => setAiSettings({ ollamaUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                    />
                    {/* Connection Status */}
                    <div className="flex items-center gap-2 text-xs mt-1">
                      {ollamaStatus === 'checking' && (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-foreground-secondary" />
                          <span className="text-foreground-secondary">Checking connection...</span>
                        </>
                      )}
                      {ollamaStatus === 'connected' && (
                        <>
                          <CheckCircle className="w-3 h-3 text-success" />
                          <span className="text-success">Ollama connected</span>
                        </>
                      )}
                      {ollamaStatus === 'disconnected' && (
                        <>
                          <XCircle className="w-3 h-3 text-error" />
                          <span className="text-error">Ollama not running</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Model Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground-secondary">
                    Model
                  </label>
                  {aiSettings.provider === 'ollama' && availableModels.length > 0 ? (
                    <select
                      value={aiSettings.model}
                      onChange={(e) => setAiSettings({ model: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={aiSettings.model}
                      onChange={(e) => setAiSettings({ model: e.target.value })}
                      placeholder={aiSettings.provider === 'ollama' ? 'llama3.2' : 'e.g. gpt-4o-mini'}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                    />
                  )}
                  {aiSettings.provider === 'ollama' && (
                    <p className="text-xs text-foreground-secondary">
                      Run <code className="bg-background-tertiary px-1 rounded">ollama pull llama3.2</code> to install.
                    </p>
                  )}
                </div>

                {/* Summary Language */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground-secondary">
                    Summary Language
                  </label>
                  <select
                    value={aiSettings.language}
                    onChange={(e) => setAiSettings({ language: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="Original Language">Original Language (Auto)</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Korean">Korean</option>
                    <option value="Portuguese">Portuguese</option>
                  </select>
                </div>

                {/* Sentiment Analysis Toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background-tertiary mt-2">
                  <div>
                    <span className="text-sm font-medium">Sentiment Analysis</span>
                    <p className="text-xs text-foreground-secondary">Show vibe dots on article headlines</p>
                  </div>
                  <button
                    onClick={() => setAiSettings({ sentimentEnabled: !aiSettings.sentimentEnabled })}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      aiSettings.sentimentEnabled ? 'bg-accent' : 'bg-border'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        aiSettings.sentimentEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Morning Briefing Settings */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Coffee className="w-4 h-4 text-orange-500" />
                Morning Briefing
              </h3>
              <button
                onClick={() => setBriefingSettings({ enabled: !briefingSettings.enabled })}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  briefingSettings.enabled ? 'bg-accent' : 'bg-border'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    briefingSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {briefingSettings.enabled && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground-secondary">
                      Generation Times (Local)
                    </label>
                    <button
                      onClick={() => setBriefingSettings({ times: [...briefingSettings.times, '09:00'] })}
                      className="text-xs text-accent hover:text-accent-hover flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Time
                    </button>
                  </div>
                  <div className="space-y-2">
                    {briefingSettings.times.map((time, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...briefingSettings.times];
                            newTimes[index] = e.target.value;
                            setBriefingSettings({ times: newTimes });
                          }}
                          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                        />
                        {briefingSettings.times.length > 1 && (
                          <button
                            onClick={() => {
                              const newTimes = briefingSettings.times.filter((_, i) => i !== index);
                              setBriefingSettings({ times: newTimes });
                            }}
                            className="px-2 text-foreground-secondary hover:text-error transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-foreground-secondary">
                    Briefings will be generated when you open the app after these times.
                  </p>
                </div>

                <div className="space-y-3 p-3 rounded-lg bg-background-tertiary border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-sky-500" />
                      <span className="text-sm font-medium">Telegram Bot Push</span>
                    </div>
                    <button
                      onClick={() => setBriefingSettings({ telegramEnabled: !briefingSettings.telegramEnabled })}
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-colors',
                        briefingSettings.telegramEnabled ? 'bg-sky-500' : 'bg-border'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          briefingSettings.telegramEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {briefingSettings.telegramEnabled && (
                    <div className="space-y-3 pt-2 animate-in fade-in zoom-in-95">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground-secondary">
                          Bot Token
                        </label>
                        <input
                          type="password"
                          value={briefingSettings.telegramToken}
                          onChange={(e) => setBriefingSettings({ telegramToken: e.target.value })}
                          placeholder="123456:ABC-DEF..."
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground-secondary">
                          Chat ID
                        </label>
                        <input
                          type="text"
                          value={briefingSettings.telegramChatId}
                          onChange={(e) => setBriefingSettings({ telegramChatId: e.target.value })}
                          placeholder="e.g. 123456789"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-accent focus:outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-foreground-secondary leading-tight">
                        Talk to @BotFather to get a token and @userinfobot to get your ID.
                      </p>

                      <button
                        onClick={handleSendTestBriefing}
                        disabled={isTestingBriefing || !briefingSettings.telegramToken || !briefingSettings.telegramChatId}
                        className={cn(
                          "w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md",
                          testStatus === 'success' ? "bg-success text-white" :
                            testStatus === 'error' ? "bg-error text-white" :
                              "bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isTestingBriefing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Sending Test...
                          </>
                        ) : testStatus === 'success' ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Sent Successfully!
                          </>
                        ) : testStatus === 'error' ? (
                          <>
                            <XCircle className="w-3 h-3" />
                            Failed to Send
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            Send Test Briefing
                          </>
                        )}
                      </button>

                      {errorMessage && (
                        <p className="text-[10px] text-error font-medium animate-in fade-in slide-in-from-top-1 px-1">
                          {errorMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-background-tertiary">
          <p className="text-xs text-foreground-secondary text-center">
            Settings are saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
