import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { fetchWithAuth } from '@/lib/queryClient';
import type { Experiment, ResultsSummary, ExportRequest } from '@/lib/api-types';
import { useToast } from '@/hooks/use-toast';

interface ResultsProps {
  experiment: Experiment;
  onBack: () => void;
}

export function Results({ experiment, onBack }: ResultsProps) {
  const { toast } = useToast();
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const { data: results, isLoading } = useQuery<ResultsSummary>({
    queryKey: ['/api/experiments', experiment.id, 'results'],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/experiments/${experiment.id}/results`);
      if (!res.ok) throw new Error('Failed to fetch results');
      return res.json();
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && results) {
      setSelectedParticipants(new Set(results.sessions.map(s => s.participantId)));
    } else {
      setSelectedParticipants(new Set());
    }
  };

  const handleSelectParticipant = (participantId: string, checked: boolean) => {
    const newSelection = new Set(selectedParticipants);
    if (checked) {
      newSelection.add(participantId);
    } else {
      newSelection.delete(participantId);
    }
    setSelectedParticipants(newSelection);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportRequest: ExportRequest = {
        format: exportFormat,
        participantIds: selectedParticipants.size > 0 ? Array.from(selectedParticipants) : undefined,
        includeInteractions: true,
      };

      const res = await fetchWithAuth(`/api/experiments/${experiment.id}/results/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportRequest),
      });

      if (!res.ok) throw new Error('Export failed');

      // Download the file
      const blob = await res.blob();
      
      // Parse the response to get actual count for better user feedback
      let actualCount = 0;
      if (exportFormat === 'json') {
        try {
          const text = await blob.text();
          const jsonData = JSON.parse(text);
          actualCount = jsonData.sessions?.length || 0;
          // Re-create blob for download since we consumed it
          const newBlob = new Blob([text], { type: blob.type });
          const url = window.URL.createObjectURL(newBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `results-${experiment.id}.${exportFormat}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch {
          // Fallback if parsing fails
          actualCount = selectedParticipants.size > 0 ? selectedParticipants.size : results?.sessions.length || 0;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `results-${experiment.id}.${exportFormat}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        // For CSV, count lines (subtract 1 for header)
        try {
          const text = await blob.text();
          const lines = text.trim().split('\n');
          actualCount = Math.max(0, lines.length - 1);
          // Re-create blob for download
          const newBlob = new Blob([text], { type: blob.type });
          const url = window.URL.createObjectURL(newBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `results-${experiment.id}.${exportFormat}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch {
          // Fallback if parsing fails
          actualCount = selectedParticipants.size > 0 ? selectedParticipants.size : results?.sessions.length || 0;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `results-${experiment.id}.${exportFormat}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }

      toast({
        title: 'Export complete',
        description: `Downloaded ${actualCount} session(s) as ${exportFormat.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export results',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading results...</div>
      </div>
    );
  }

  const sessions = results?.sessions || [];
  const allSelected = sessions.length > 0 && selectedParticipants.size === sessions.length;

  // Calculate metrics
  const totalParticipants = sessions.length;
  const completedSessions = sessions.filter(s => s.endedAt).length;
  const avgDurationMs = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.totalDurationMs || 0), 0) / sessions.length
    : 0;
  const avgDurationSec = Math.round(avgDurationMs / 1000) || 0; // Guard against NaN
  const selectedCount = selectedParticipants.size > 0 ? selectedParticipants.size : '0 (all participants will be exported)';

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-experiment">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">Results: {experiment.name}</h2>
          <p className="text-muted-foreground text-sm">Participant sessions and interactions</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users size={16} className="text-muted-foreground" />
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParticipants}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedSessions} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              Avg. Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgDurationSec}s
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download size={16} className="text-muted-foreground" />
              Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              sessions selected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>Select format and participants to export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Format</Label>
            <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'json')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv" className="font-normal cursor-pointer">
                  CSV (aggregated per participant)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="format-json" />
                <Label htmlFor="format-json" className="font-normal cursor-pointer">
                  JSON (full interaction details)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              disabled={isExporting || sessions.length === 0}
              data-testid="button-export"
            >
              <Download size={16} className="mr-2" />
              {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </Button>
            {selectedParticipants.size > 0 && (
              <Button
                variant="outline"
                onClick={() => setSelectedParticipants(new Set())}
              >
                Clear Selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participant Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Participant Sessions</CardTitle>
              <CardDescription>
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
              </CardDescription>
            </div>
            {sessions.length > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-normal cursor-pointer">
                  Select all
                </Label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No participant sessions yet. Sessions will appear here once participants start interacting with your experiment.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const isSelected = selectedParticipants.has(session.participantId);
                const durationSec = session.totalDurationMs ? Math.round(session.totalDurationMs / 1000) : 0;

                return (
                  <div
                    key={session.participantId}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        id={`participant-${session.participantId}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => 
                          handleSelectParticipant(session.participantId, checked === true)
                        }
                      />
                      <div className="flex-1">
                        <div className="font-medium">{session.participantId}</div>
                        <div className="text-sm text-muted-foreground">
                          Started: {new Date(session.startedAt).toLocaleString()}
                          {session.endedAt && ` • Ended: ${new Date(session.endedAt).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{durationSec}s</div>
                      <div className="text-xs text-muted-foreground">
                        {session.endedAt ? 'Completed' : 'In progress'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
