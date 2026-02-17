'use client';

import { useState, useEffect } from 'react';
import { Server, Database, Zap, RefreshCw, Tag, TrendingUp, ArrowLeft, CheckCircle, XCircle, Loader2, Play } from 'lucide-react';
import { useSettingsStore } from '@/lib/settings-store';
import Link from 'next/link';

export default function AdminPage() {
  const { backendSettings } = useSettingsStore();
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (backendSettings.enabled && backendSettings.apiUrl) {
      fetchBackendData();
    }
  }, [backendSettings.enabled, backendSettings.apiUrl]);

  const fetchBackendData = async () => {
    setLoading(true);
    try {
      // Fetch job queue status
      const jobsRes = await fetch(`${backendSettings.apiUrl}/api/jobs`);
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
      }

      // Fetch backend stats
      const statsRes = await fetch(`${backendSettings.apiUrl}/api/analytics/overview`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch backend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerJob = async (jobType: string) => {
    try {
      await fetch(`${backendSettings.apiUrl}/api/jobs/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType }),
      });
      fetchBackendData();
    } catch (error) {
      console.error('Failed to trigger job:', error);
    }
  };

  if (!backendSettings.enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Server className="w-16 h-16 text-foreground-secondary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Backend Not Enabled</h1>
          <p className="text-foreground-secondary">
            Enable backend storage in Settings to access admin features.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-background-secondary">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-500" />
                Backend Administration
              </h1>
              <p className="text-sm text-foreground-secondary">
                {backendSettings.apiUrl}
              </p>
            </div>
          </div>
          <button
            onClick={fetchBackendData}
            className="px-3 py-2 bg-background-tertiary hover:bg-background rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Database className="w-5 h-5 text-blue-500" />}
                title="Total Articles"
                value={stats?.totalArticlesRead || 0}
              />
              <StatCard
                icon={<Tag className="w-5 h-5 text-green-500" />}
                title="Tagged Articles"
                value={stats?.taggedArticles || 0}
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                title="Articles This Week"
                value={stats?.articlesThisWeek || 0}
              />
              <StatCard
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                title="Active Jobs"
                value={jobs.filter((j: any) => j.status === 'processing').length}
              />
            </div>

            {/* Background Jobs */}
            <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Background Jobs
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <JobTrigger
                  title="Fetch RSS Feeds"
                  description="Manually trigger RSS feed refresh"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onTrigger={() => triggerJob('fetch_feed')}
                />
                <JobTrigger
                  title="AI Processing"
                  description="Process articles with AI tagging"
                  icon={<Tag className="w-4 h-4" />}
                  onTrigger={() => triggerJob('ai_tag')}
                />
                <JobTrigger
                  title="Send Briefing"
                  description="Send Telegram briefing now"
                  icon={<Server className="w-4 h-4" />}
                  onTrigger={() => triggerJob('send_briefing')}
                />
                <JobTrigger
                  title="Cleanup"
                  description="Clean old articles and cache"
                  icon={<Database className="w-4 h-4" />}
                  onTrigger={() => triggerJob('cleanup')}
                />
              </div>
            </div>

            {/* Job Queue */}
            <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-500" />
                Job Queue ({jobs.length})
              </h2>

              {jobs.length === 0 ? (
                <p className="text-sm text-foreground-secondary text-center py-8">
                  No jobs in queue
                </p>
              ) : (
                <div className="space-y-2">
                  {jobs.slice(0, 10).map((job: any) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <JobStatusIcon status={job.status} />
                        <div>
                          <p className="text-sm font-medium">{job.jobType}</p>
                          <p className="text-xs text-foreground-secondary">
                            Priority: {job.priority}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-foreground-secondary">
                        {new Date(job.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Topics */}
            {stats?.topTopics && stats.topTopics.length > 0 && (
              <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Tag className="w-5 h-5 text-green-500" />
                  Top Topics
                </h2>
                <div className="flex flex-wrap gap-2">
                  {stats.topTopics.map((topic: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-background rounded-full text-sm border border-border"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: number }) {
  return (
    <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground-secondary">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function JobTrigger({
  title,
  description,
  icon,
  onTrigger,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onTrigger: () => void;
}) {
  return (
    <button
      onClick={onTrigger}
      className="flex items-start gap-3 p-3 bg-background hover:bg-background-tertiary rounded-lg border border-border transition-colors text-left"
    >
      <div className="p-2 bg-background-tertiary rounded-lg">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-foreground-secondary">{description}</p>
      </div>
      <Play className="w-4 h-4 text-accent mt-2" />
    </button>
  );
}

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'processing':
      return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
    default:
      return <div className="w-5 h-5 rounded-full bg-border" />;
  }
}
