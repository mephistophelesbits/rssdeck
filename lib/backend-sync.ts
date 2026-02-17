import { useSettingsStore } from './settings-store';

export interface BackendSyncOptions {
  skipLocalStorage?: boolean;
  skipBackend?: boolean;
}

// Check if backend is enabled and available
export async function checkBackendAvailable(): Promise<boolean> {
  const { backendSettings } = useSettingsStore.getState();

  if (!backendSettings.enabled) {
    return false;
  }

  try {
    const response = await fetch(`${backendSettings.apiUrl}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Generic backend sync wrapper
export async function syncToBackend<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  data?: T
): Promise<Response | null> {
  const { backendSettings } = useSettingsStore.getState();

  if (!backendSettings.enabled || !backendSettings.autoSync) {
    return null;
  }

  try {
    const response = await fetch(`${backendSettings.apiUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      // Update last synced time
      useSettingsStore.setState({
        backendSettings: {
          ...backendSettings,
          lastSyncedAt: new Date().toISOString(),
        },
      });
    }

    return response;
  } catch (error) {
    console.error('Backend sync error:', error);
    return null;
  }
}

// Fetch from backend
export async function fetchFromBackend<T>(endpoint: string): Promise<T | null> {
  const { backendSettings } = useSettingsStore.getState();

  if (!backendSettings.enabled) {
    return null;
  }

  try {
    const response = await fetch(`${backendSettings.apiUrl}${endpoint}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return await response.json();
    }

    return null;
  } catch (error) {
    console.error('Backend fetch error:', error);
    return null;
  }
}

// Sync columns to backend
export async function syncColumnsToBackend(columns: any[]) {
  for (const column of columns) {
    await syncToBackend('/api/columns', 'POST', column);
  }
}

// Sync bookmarks to backend
export async function syncBookmarksToBackend(bookmarks: any[]) {
  for (const bookmark of bookmarks) {
    await syncToBackend('/api/bookmarks', 'POST', {
      articleId: bookmark.article?.id || bookmark.articleId,
      notes: bookmark.notes,
    });
  }
}

// Migrate all data to backend
export async function migrateToBackend(data: {
  columns: any[];
  feeds: any[];
  bookmarks: any[];
  settings: any;
}): Promise<{ success: boolean; stats?: any; error?: string }> {
  const { backendSettings } = useSettingsStore.getState();

  if (!backendSettings.enabled) {
    return { success: false, error: 'Backend not enabled' };
  }

  try {
    const response = await fetch(`${backendSettings.apiUrl}/api/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(60000), // 60 second timeout for migration
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, stats: result.stats };
    }

    const error = await response.json();
    return { success: false, error: error.error || 'Migration failed' };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
