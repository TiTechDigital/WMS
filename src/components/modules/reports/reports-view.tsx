"use client";

import * as React from "react";
import { CalendarClock, Clock, Download, FileSpreadsheet, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWms, nowIso, CURRENT_USER } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { REPORTS, type ReportDef, type ReportRow } from "./report-catalog";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatRelative } from "@/lib/format";
import { REFERENCE_NOW } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Run = { id: string; reportId: string; at: string; rows: number; by: string; site: string; data: ReportRow[] };
type Schedule = { id: string; reportId: string; frequency: string; time: string; recipients: string; enabled: boolean };

const CATS = ["All", "Inventory", "Operations", "Financial", "Workforce"] as const;

export function ReportsView() {
  const store = useWms();
  const { warehouse, actions } = store;
  const [cat, setCat] = React.useState<(typeof CATS)[number]>("All");
  const [runs, setRuns] = React.useState<Run[]>([]);
  const [schedules, setSchedules] = React.useState<Schedule[]>([
    { id: "sch_1", reportId: "reorder", frequency: "Daily", time: "06:00", recipients: "purchasing@northstar-logistics.com", enabled: true },
    { id: "sch_2", reportId: "kpi", frequency: "Weekly · Mon", time: "07:30", recipients: "ops-leadership@northstar-logistics.com", enabled: true },
    { id: "sch_3", reportId: "adjustments", frequency: "Monthly · 1st", time: "08:00", recipients: "finance@northstar-logistics.com", enabled: false },
  ]);
  const [scheduling, setScheduling] = React.useState<ReportDef | null>(null);
  const [preview, setPreview] = React.useState<Run | null>(null);

  const list = REPORTS.filter((r) => cat === "All" || r.category === cat);
  const name = (id: string) => REPORTS.find((r) => r.id === id)?.name ?? id;

  const run = (r: ReportDef) => {
    const data = r.build(store);
    const entry: Run = { id: `run_${Date.now()}`, reportId: r.id, at: nowIso(), rows: data.length, by: CURRENT_USER.name, site: warehouse.id, data };
    setRuns((prev) => [entry, ...prev].slice(0, 20));
    actions.log({ module: "System", action: "Report generated", entity: r.name, details: `${data.length} rows · ${warehouse.id}`, severity: "info" });
    setPreview(entry);
  };
  const download = (r: Run) => {
    downloadCsv(`${r.reportId}-${r.site}-${r.at.slice(0, 10)}.csv`, r.data);
    toast.success("Report downloaded", { description: `${name(r.reportId)} · ${r.rows} rows` });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description={`Generate, download and schedule operational reports · ${warehouse.name}`} />

      <Tabs value={cat} onValueChange={(v) => setCat(v as typeof cat)}>
        <TabsList>
          {CATS.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((r) => {
          const last = runs.find((x) => x.reportId === r.id);
          const sched = schedules.find((s) => s.reportId === r.id && s.enabled);
          return (
            <div key={r.id} className="flex flex-col rounded-lg border bg-surface p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-subtle text-muted-foreground">
                  <FileSpreadsheet className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{r.name}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge>{r.category}</Badge>
                <Badge>CSV</Badge>
                {sched && (
                  <Badge tone="primary">
                    <CalendarClock className="size-3" /> {sched.frequency}
                  </Badge>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-2xs text-muted-foreground">{last ? `Last run ${formatRelative(last.at)}` : "Not run this session"}</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setScheduling(r)}>
                    <Clock /> Schedule
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => run(r)}>
                    <Play /> Run
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Scheduled reports" description="Delivered by email as CSV attachments" />
          <div className="divide-y">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) => {
                    setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)));
                    toast.success(v ? "Schedule enabled" : "Schedule paused", { description: name(s.reportId) });
                  }}
                  aria-label="Enabled"
                />
                <div className={cn("min-w-0 flex-1", !s.enabled && "opacity-60")}>
                  <div className="truncate text-[13px] font-medium">{name(s.reportId)}</div>
                  <div className="truncate text-2xs text-muted-foreground">
                    {s.frequency} at {s.time} · {s.recipients}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete schedule"
                  onClick={() => {
                    setSchedules((prev) => prev.filter((x) => x.id !== s.id));
                    toast.success("Schedule removed");
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {schedules.length === 0 && <EmptyState icon={CalendarClock} title="No scheduled reports" description="Use “Schedule” on any report to deliver it automatically." />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent runs" description="Generated in this session" />
          <div className="divide-y">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{name(r.reportId)}</div>
                  <div className="text-2xs text-muted-foreground">
                    {formatDateTime(r.at)} · {r.rows} rows · {r.site} · {r.by}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPreview(r)}>
                  Preview
                </Button>
                <Button size="sm" variant="secondary" onClick={() => download(r)}>
                  <Download /> CSV
                </Button>
              </div>
            ))}
            {runs.length === 0 && <EmptyState icon={Play} title="No reports run yet" description="Run any report above to preview and download it." />}
          </div>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent size="xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{name(preview.reportId)}</DialogTitle>
                <DialogDescription>
                  {preview.rows} rows · {preview.site} · generated {formatDateTime(preview.at)}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="p-0">
                <div className="scrollbar-thin max-h-[55vh] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-subtle">
                      <tr>
                        {Object.keys(preview.data[0] ?? {}).map((h) => (
                          <th key={h} scope="col" className="whitespace-nowrap border-b px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {h.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.data.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="whitespace-nowrap px-3 py-1.5 tabular">
                              {String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows === 0 && <EmptyState title="No rows" description="Nothing matches this report at the current site." />}
                </div>
              </DialogBody>
              <DialogFooter className="justify-between">
                <span className="text-2xs text-muted-foreground">{preview.rows > 100 ? `Showing first 100 of ${preview.rows} rows` : `${preview.rows} rows`}</span>
                <Button onClick={() => download(preview)} disabled={!preview.rows}>
                  <Download /> Download CSV
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ScheduleDialog
        report={scheduling}
        onOpenChange={(o) => !o && setScheduling(null)}
        onSave={(s) => {
          setSchedules((prev) => [s, ...prev]);
          toast.success("Report scheduled", { description: `${name(s.reportId)} · ${s.frequency} at ${s.time}` });
          setScheduling(null);
        }}
      />
    </div>
  );
}

function ScheduleDialog({ report, onOpenChange, onSave }: { report: ReportDef | null; onOpenChange: (v: boolean) => void; onSave: (s: Schedule) => void }) {
  const [frequency, setFrequency] = React.useState("Daily");
  const [time, setTime] = React.useState("06:00");
  const [recipients, setRecipients] = React.useState(CURRENT_USER.email);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (report) {
      setFrequency("Daily");
      setTime("06:00");
      setRecipients(CURRENT_USER.email);
      setError(null);
    }
  }, [report]);
  const firstRun = new Date(REFERENCE_NOW.getTime() + 86400000).toISOString().slice(0, 10);
  return (
    <Dialog open={!!report} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const emails = recipients.split(/[,;\s]+/).filter(Boolean);
            if (!emails.length || emails.some((m) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m))) return setError("Enter one or more valid email addresses.");
            onSave({ id: `sch_${Date.now()}`, reportId: report!.id, frequency, time, recipients: emails.join(", "), enabled: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>Schedule report</DialogTitle>
            <DialogDescription>{report?.name}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequency">
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Daily", "Weekdays", "Weekly · Mon", "Monthly · 1st"].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Time (site local)">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <Field label="Recipients" hint="Separate multiple addresses with commas">
              <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} />
            </Field>
            <p className="rounded-md bg-subtle px-3 py-2 text-2xs text-muted-foreground">First delivery: {firstRun} at {time}</p>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save schedule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
