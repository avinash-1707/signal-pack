"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";

import { BriefPack } from "@/components/brief-pack";
import { EvidenceLedger } from "@/components/evidence-ledger";
import { SourceDrawer } from "@/components/source-drawer";
import { createRunRequestSchema } from "@/schemas/api";

import { cartesiaDemoRun, cartesiaInput, cartesiaTrace } from "./cartesia-demo";
import { approveRun, connectRunEvents, createRun, exportRun, getRun, RunApiError, type CreateRunInput, type RunEvidence, type RunReport, unlockExport } from "./run-api-client";

type IntakeDraft = {
  productUrl: string;
  objective: "awareness" | "waitlist_signups" | "demo_requests";
  audience: string;
  launchDate: string;
  constraint: string;
};

type ExportStatus =
  | { kind: "idle" }
  | { kind: "retryable_failure"; message: string }
  | { kind: "failure"; message: string }
  | { kind: "success"; range: string };

const initialDraft: IntakeDraft = {
  ...cartesiaInput,
  launchDate: cartesiaInput.launchDate ?? "",
  constraint: cartesiaInput.constraint ?? "",
};

const statusLabels = {
  queued: "Run queued",
  researching: "Researching public sources",
  validating: "Validating evidence",
  awaiting_approval: "Ready for review",
  incomplete: "Research incomplete",
  complete: "Report complete",
  exported: "Exported",
} as const;

function isActiveStatus(status: RunReport["status"]): boolean {
  return status === "queued" || status === "researching" || status === "validating";
}

function queuedRun(runId: string, input: CreateRunInput): RunReport {
  return {
    id: runId,
    ...input,
    status: "queued",
    createdAt: new Date().toISOString(),
    completedAt: null,
    coverage: null,
    evidence: [],
    briefs: [],
    approval: null,
    export: null,
    limitations: [],
  };
}

function liveTrace(report: RunReport | null) {
  if (!report) {
    return [{ label: "Live run", detail: "Creating a session-owned research run.", state: "current" as const }];
  }
  return [
    { label: "Run queued", detail: report.status === "queued" ? "Waiting for the research harness." : "Public-source scope accepted.", state: report.status === "queued" ? "current" as const : "done" as const },
    { label: "Source discovery", detail: report.status === "researching" ? "Gathering permitted public context." : "No trace event received yet.", state: report.status === "researching" ? "current" as const : report.status === "queued" ? "pending" as const : "done" as const },
    { label: "Evidence validation", detail: report.status === "validating" ? "Checking citations and source roles." : "Waiting for evidence validation.", state: report.status === "validating" ? "current" as const : report.status === "queued" || report.status === "researching" ? "pending" as const : "done" as const },
    { label: "Brief compilation", detail: report.status === "awaiting_approval" ? "Three brief lanes are ready for review." : report.status === "incomplete" ? "Run closed with limitations." : "Waiting for a validated report.", state: report.status === "awaiting_approval" ? "done" as const : report.status === "incomplete" ? "partial" as const : "pending" as const },
  ];
}

export function ResearchDesk() {
  const [draft, setDraft] = useState<IntakeDraft>(initialDraft);
  const [report, setReport] = useState<RunReport>(cartesiaDemoRun);
  const [isDemo, setIsDemo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<RunEvidence | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [presenterCode, setPresenterCode] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [unlockedUntil, setUnlockedUntil] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportIdempotencyKey, setExportIdempotencyKey] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ kind: "idle" });

  function resetApprovalExportState() {
    setIsApproving(false);
    setApprovalError(null);
    setPresenterCode("");
    setIsUnlocking(false);
    setUnlockError(null);
    setOwnerUnlocked(false);
    setUnlockedUntil(null);
    setIsExporting(false);
    setExportIdempotencyKey(null);
    setExportStatus({ kind: "idle" });
  }

  const refreshRun = useCallback(async (runId: string) => {
    const nextReport = await getRun(runId);
    setReport(nextReport);
    setRequestError(null);
  }, []);

  useEffect(() => {
    if (isDemo || !isActiveStatus(report.status)) {
      return;
    }
    return connectRunEvents(report.id, {
      onEvent: () => {
        void refreshRun(report.id).catch(() => {
          setRequestError("We could not refresh this live run. Your session-owned run remains available to retry.");
        });
      },
      onSequenceGap: () => {
        // A snapshot is authoritative if an SSE reconnect missed any event.
        void refreshRun(report.id).catch(() => {
          setRequestError("We could not refresh this live run. Your session-owned run remains available to retry.");
        });
      },
    });
  }, [isDemo, refreshRun, report.id, report.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createRunRequestSchema.safeParse({
      productUrl: draft.productUrl.trim(),
      objective: draft.objective,
      audience: draft.audience.trim(),
      launchDate: draft.launchDate || null,
      constraint: draft.constraint.trim() || null,
    });
    if (!parsed.success) {
      setRequestError("Check the product URL, audience, and optional date before starting research.");
      return;
    }

    setIsSubmitting(true);
    setRequestError(null);
    resetApprovalExportState();
    try {
      const created = await createRun(parsed.data);
      setIsDemo(false);
      setReport(queuedRun(created.runId, parsed.data));
      await refreshRun(created.runId);
    } catch (error: unknown) {
      setRequestError(error instanceof RunApiError ? error.message : "The live run could not be started. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function showDemo() {
    setReport(cartesiaDemoRun);
    setIsDemo(true);
    setRequestError(null);
    resetApprovalExportState();
    setSelectedEvidence(null);
  }

  async function handleApprovalChange(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.checked || isDemo || report.status !== "awaiting_approval" || report.approval) {
      return;
    }

    setIsApproving(true);
    setApprovalError(null);
    try {
      const approval = await approveRun(report.id);
      setReport((current) => current.id === report.id
        ? {
            ...current,
            approval: {
              approvedAt: approval.approvedAt,
              acknowledgmentVersion: "creator-brief-review-v1",
            },
          }
        : current);
      setOwnerUnlocked((current) => current || approval.exportEligible);
    } catch (error: unknown) {
      setApprovalError(error instanceof RunApiError ? error.message : "Approval could not be recorded. Please try again.");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = presenterCode.trim();
    if (!code) {
      setUnlockError("Enter the presenter code to unlock owner export.");
      return;
    }

    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const unlocked = await unlockExport(code);
      setOwnerUnlocked(true);
      setUnlockedUntil(unlocked.unlockedUntil);
      setPresenterCode("");
    } catch (error: unknown) {
      setUnlockError(error instanceof RunApiError ? error.message : "Owner export could not be unlocked. Please try again.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleExport() {
    if (isDemo || !report.approval || !ownerUnlocked || report.export) {
      return;
    }

    const idempotencyKey = exportIdempotencyKey ?? crypto.randomUUID();
    if (!exportIdempotencyKey) {
      setExportIdempotencyKey(idempotencyKey);
    }

    setIsExporting(true);
    setExportStatus({ kind: "idle" });
    try {
      const exported = await exportRun(report.id, idempotencyKey);
      setReport((current) => current.id === report.id
        ? {
            ...current,
            export: {
              provider: "google_sheets",
              exportedAt: exported.exportedAt,
            },
          }
        : current);
      setExportStatus({ kind: "success", range: exported.range });
    } catch (error: unknown) {
      if (error instanceof RunApiError && error.code === "OWNER_EXPORT_REQUIRED") {
        setOwnerUnlocked(false);
        setUnlockError("The owner unlock expired. Enter the presenter code again to export.");
        return;
      }
      if (error instanceof RunApiError && error.code === "EXPORT_RETRYABLE") {
        setExportStatus({ kind: "retryable_failure", message: error.message });
        return;
      }
      setExportStatus({
        kind: "failure",
        message: error instanceof RunApiError ? error.message : "Export could not be completed.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const trace = isDemo ? cartesiaTrace : liveTrace(report);
  const partialMessage = report.limitations.find((limitation) => limitation.includes("One source unavailable")) ?? report.limitations[0];
  const canReview = report.status === "awaiting_approval";
  const isApproved = report.approval !== null;
  const isExported = report.export !== null;
  const canApprove = !isDemo && canReview && !isApproved;
  const canExport = !isDemo && isApproved && ownerUnlocked && !isExported && !isExporting;

  return (
    <main className="research-desk">
      <header className="masthead">
        <Link className="wordmark" href="/" aria-label="Signal Pack home">signal<span>pack</span></Link>
        <p>Evidence-led creator research</p>
        <a className="demo-link" href="?demo=cartesia" onClick={(event) => { event.preventDefault(); showDemo(); }}>View static demo <span aria-hidden="true">↗</span></a>
      </header>

      <section aria-labelledby="intake-title" className="intake-section">
        <div className="intake-intro">
          <p className="eyebrow">PUBLIC-SOURCE LAUNCH RESEARCH</p>
          <h1 id="intake-title">Build a creator brief pack from what can be verified.</h1>
          <p className="method">Evidence <span aria-hidden="true">→</span> validation <span aria-hidden="true">→</span> three distinct briefs <span aria-hidden="true">→</span> human-approved export</p>
        </div>
        <form className="intake-form" onSubmit={handleSubmit} noValidate>
          <label>product URL<input type="url" value={draft.productUrl} onChange={(event) => setDraft({ ...draft, productUrl: event.target.value })} required /></label>
          <label>objective<select value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value as IntakeDraft["objective"] })}><option value="awareness">Awareness</option><option value="waitlist_signups">Waitlist signups</option><option value="demo_requests">Demo requests</option></select></label>
          <label>audience<input value={draft.audience} minLength={3} maxLength={200} onChange={(event) => setDraft({ ...draft, audience: event.target.value })} required /></label>
          <label>launch date<input type="date" value={draft.launchDate} onChange={(event) => setDraft({ ...draft, launchDate: event.target.value })} /></label>
          <label>constraint<textarea value={draft.constraint} maxLength={500} onChange={(event) => setDraft({ ...draft, constraint: event.target.value })} rows={2} /></label>
          <div className="form-footer"><p>First-party sources preferred. No private analytics or scraped creator data.</p><button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? "Starting live run…" : "Start live research"} <span aria-hidden="true">→</span></button></div>
        </form>
        {requestError ? <p className="form-error" role="alert"><span aria-hidden="true">!</span>{requestError}</p> : null}
      </section>

      <section aria-label="Research report" className="report-shell">
        <div className="report-heading">
          <div><p className="eyebrow">{isDemo ? "STATIC CARTESIA FIXTURE · SHAREABLE DEMO" : "SESSION-OWNED LIVE RUN"}</p><h2>{new URL(report.productUrl).hostname.replace("www.", "")} <span>/{statusLabels[report.status]}</span></h2></div>
          <button className="quiet-button" type="button" onClick={showDemo} disabled={isDemo}>Reset to Cartesia demo</button>
        </div>
        <div className="research-grid">
          <aside aria-labelledby="trace-heading" className="trace-rail">
            <div className="trace-heading"><p className="eyebrow">RUN TRACE</p><h2 id="trace-heading">Research, not reasoning</h2></div>
            <ol>
              {trace.map((item) => <li className={`trace-${item.state}`} key={item.label}><span aria-hidden="true">{item.state === "done" ? "✓" : item.state === "partial" ? "!" : "·"}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></li>)}
            </ol>
            <p className="trace-note">Only safe tool milestones and evidence records appear here. Model reasoning is not shown.</p>
          </aside>
          <div className="report-content">
            {partialMessage ? <div className="partial-notice" role="status"><span aria-hidden="true">!</span><p>{partialMessage}</p></div> : null}
            {report.evidence.length > 0 ? <EvidenceLedger evidence={report.evidence} onSelect={setSelectedEvidence} /> : <section className="empty-report"><p className="eyebrow">AWAITING EVIDENCE</p><h2>Evidence will appear here as the run records it.</h2><p>Refresh is automatic while this run is active. No source claim is shown before it is recorded.</p></section>}
          </div>
        </div>
      </section>

      {report.briefs.length === 3 ? <BriefPack briefs={report.briefs} evidence={report.evidence} onSelectEvidence={setSelectedEvidence} /> : null}

      <section aria-labelledby="approval-heading" className="approval-band">
        <div><p className="eyebrow">DOCUMENT SIGN-OFF</p><h2 id="approval-heading">Approval gate</h2></div>
        <ul className="validator-list" aria-label="Pack validators"><li><span aria-hidden="true">✓</span>Citations {canReview ? "checked" : "pending"}</li><li><span aria-hidden="true">✓</span>Unique primary claims {canReview ? "checked" : "pending"}</li><li><span aria-hidden="true">✓</span>Narrative overlap {canReview ? "checked" : "pending"}</li></ul>
        <div className="approval-controls">
          <label className="acknowledgment"><input checked={isApproved} disabled={!canApprove || isApproving} type="checkbox" onChange={handleApprovalChange} /><span>I have reviewed these claims and constraints.</span></label>
          <p className={approvalError ? "approval-status status-error" : isApproved ? "approval-status status-success" : "approval-status"} aria-live="polite" role={approvalError ? "alert" : "status"}>
            <span aria-hidden="true">{approvalError ? "!" : isApproved ? "✓" : "·"}</span>
            {approvalError ?? (isDemo ? "Static fixture: review only." : isApproving ? "Recording approval…" : isApproved ? "Approval recorded." : canReview ? "Acknowledge to submit approval." : "Awaiting a review-ready pack.")}
          </p>
        </div>
        <div className="export-state">
          {!isDemo ? <form className="owner-unlock" onSubmit={handleUnlock}>
            <label htmlFor="presenter-code">Presenter code<input aria-describedby="owner-unlock-help" aria-invalid={unlockError ? true : undefined} disabled={isUnlocking || ownerUnlocked} id="presenter-code" maxLength={128} onChange={(event) => { setPresenterCode(event.target.value); setUnlockError(null); }} type="password" value={presenterCode} /></label>
            <button className="unlock-button" disabled={isUnlocking || ownerUnlocked} type="submit">{ownerUnlocked ? "Unlocked" : isUnlocking ? "Unlocking…" : "Unlock"}</button>
          </form> : null}
          <p className={unlockError ? "owner-note status-error" : ownerUnlocked ? "owner-note status-success" : "owner-note"} id="owner-unlock-help" aria-live="polite" role={unlockError ? "alert" : "status"}>
            <span aria-hidden="true">{unlockError ? "!" : ownerUnlocked ? "✓" : "·"}</span>
            {unlockError ?? (isDemo ? "Static fixture: Sheets export is disabled." : ownerUnlocked ? `Owner export unlocked${unlockedUntil ? ` until ${new Date(unlockedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}.` : "Owner-only Sheets write. Unlock with the presenter code.")}
          </p>
          <button className="export-button" disabled={!canExport} onClick={handleExport} type="button">{isExported ? "Exported to Google Sheets" : isExporting ? "Exporting…" : exportStatus.kind === "retryable_failure" ? "Retry Google Sheets export" : "Export to Google Sheets"}</button>
          <p className={exportStatus.kind === "retryable_failure" || exportStatus.kind === "failure" ? "export-note status-error" : exportStatus.kind === "success" || isExported ? "export-note status-success" : "export-note"} aria-live="polite" role={exportStatus.kind === "retryable_failure" || exportStatus.kind === "failure" ? "alert" : "status"}>
            <span aria-hidden="true">{exportStatus.kind === "retryable_failure" || exportStatus.kind === "failure" ? "!" : exportStatus.kind === "success" || isExported ? "✓" : "·"}</span>
            {exportStatus.kind === "retryable_failure" ? `${exportStatus.message} Retry uses the same export record.` : exportStatus.kind === "failure" ? exportStatus.message : exportStatus.kind === "success" ? `Exported to ${exportStatus.range}.` : isExported ? "This approved pack was already exported." : isDemo ? "The static fixture never writes to Google Sheets." : !isApproved ? "Export unlocks after approval." : !ownerUnlocked ? "Owner unlock required before export." : "Ready to export the approved pack."}
          </p>
        </div>
      </section>
      <SourceDrawer evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
    </main>
  );
}
