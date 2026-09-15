"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { BriefPack } from "@/components/brief-pack";
import { EvidenceLedger } from "@/components/evidence-ledger";
import { SourceDrawer } from "@/components/source-drawer";
import { createRunRequestSchema } from "@/schemas/api";

import { cartesiaDemoRun, cartesiaInput, cartesiaTrace } from "./cartesia-demo";
import { connectRunEvents, createRun, getRun, RunApiError, type CreateRunInput, type RunEvidence, type RunReport } from "./run-api-client";

type IntakeDraft = {
  productUrl: string;
  objective: "awareness" | "waitlist_signups" | "demo_requests";
  audience: string;
  launchDate: string;
  constraint: string;
};

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
  const [acknowledged, setAcknowledged] = useState(false);

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
    setAcknowledged(false);
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
    setAcknowledged(false);
    setSelectedEvidence(null);
  }

  const trace = isDemo ? cartesiaTrace : liveTrace(report);
  const partialMessage = report.limitations.find((limitation) => limitation.includes("One source unavailable")) ?? report.limitations[0];
  const canReview = report.status === "awaiting_approval";

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
        <label className="acknowledgment"><input checked={acknowledged} disabled={!canReview} type="checkbox" onChange={(event) => setAcknowledged(event.target.checked)} /><span>I have reviewed these claims and constraints.</span></label>
        <div className="export-state"><button className="export-button" disabled type="button">Export to Google Sheets</button><p>{acknowledged ? "Approval API required before export." : "Owner-only export unlocks after approval."}</p></div>
      </section>
      <SourceDrawer evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
    </main>
  );
}
