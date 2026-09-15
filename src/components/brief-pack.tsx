"use client";

import type { RunBrief, RunEvidence } from "@/features/runs/run-api-client";

type BriefPackProps = {
  briefs: readonly RunBrief[];
  evidence: readonly RunEvidence[];
  onSelectEvidence: (evidence: RunEvidence) => void;
};

const laneTitles = {
  engineer_proof: "Engineer proof",
  founder_consequence: "Founder consequence",
  practitioner_reaction: "Practitioner reaction",
} as const;

export function BriefPack({ briefs, evidence, onSelectEvidence }: BriefPackProps) {
  return (
    <section aria-labelledby="brief-pack-heading" className="brief-pack">
      <div className="section-heading">
        <div><p className="eyebrow">CREATOR BRIEF PACK</p><h2 id="brief-pack-heading">Three ways into the same verified story</h2></div>
        <p className="record-count">3 differentiated lanes</p>
      </div>
      <div className="brief-grid">
        {briefs.map((brief, index) => {
          const primaryEvidence = evidence.find((item) => item.id === brief.primaryEvidenceId);
          return (
            <article className="brief-lane" key={brief.id}>
              <header><span className="lane-number">0{index + 1}</span><div><p className="eyebrow">{laneTitles[brief.lane]}</p><p className="audience-lens">For {brief.audienceLens}</p></div></header>
              <div className="brief-block"><span className="brief-label">Hook</span><p>{brief.hook}</p></div>
              <div className="brief-block cited-claim"><span className="brief-label">Cited core claim</span>{primaryEvidence ? <button type="button" onClick={() => onSelectEvidence(primaryEvidence)}><span className="citation-mark">E{String(evidence.indexOf(primaryEvidence) + 1).padStart(2, "0")}</span>{primaryEvidence.excerpt}</button> : <p>Primary source is unavailable in this view.</p>}</div>
              <dl className="brief-details"><div><dt>Asset requirement</dt><dd>{brief.requiredAsset}</dd></div><div><dt>Creator prompt</dt><dd>{brief.creatorPrompt}</dd></div><div><dt>CTA</dt><dd>{brief.cta}</dd></div></dl>
              <div className="do-not-claim"><span className="brief-label">Do not claim</span>{brief.prohibitedClaims.map((claim) => <p key={claim}>✕ {claim}</p>)}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
