"use client";

import type { RunEvidence } from "@/features/runs/run-api-client";

type EvidenceLedgerProps = {
  evidence: readonly RunEvidence[];
  onSelect: (evidence: RunEvidence) => void;
};

const sourceKindLabels = {
  first_party: "First party",
  search_index: "Search index",
  third_party: "Third party",
  user_provided: "User provided",
} as const;

export function EvidenceLedger({ evidence, onSelect }: EvidenceLedgerProps) {
  return (
    <section aria-labelledby="evidence-heading" className="evidence-ledger">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EVIDENCE LEDGER</p>
          <h2 id="evidence-heading">What this pack can stand on</h2>
        </div>
        <p className="record-count">{evidence.length} recorded sources</p>
      </div>
      <div className="ledger-table-wrap">
        <table>
          <thead>
            <tr><th scope="col">ID</th><th scope="col">Source</th><th scope="col">Excerpt</th><th scope="col">Confidence</th><th scope="col">Roles</th><th scope="col"><span className="sr-only">Open source</span></th></tr>
          </thead>
          <tbody>
            {evidence.map((item, index) => (
              <tr className="evidence-row" key={item.id} style={{ "--entry-delay": `${Math.min(index, 5) * 30}ms` } as React.CSSProperties}>
                <td className="evidence-id">E{String(index + 1).padStart(2, "0")}</td>
                <td><button className="source-title-button" type="button" onClick={() => onSelect(item)}>{item.title}<span>{sourceKindLabels[item.sourceKind]}</span></button></td>
                <td className="excerpt">{item.excerpt}</td>
                <td><span className={`confidence confidence-${item.confidence}`}>{item.confidence}</span></td>
                <td><span className="roles">{item.roles.join(" · ")}</span></td>
                <td><button aria-label={`Open ${item.title} source record`} className="open-source" type="button" onClick={() => onSelect(item)}>View <span aria-hidden="true">→</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
