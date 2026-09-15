"use client";

import { useEffect, useRef } from "react";

import type { RunEvidence } from "@/features/runs/run-api-client";

type SourceDrawerProps = {
  evidence: RunEvidence | null;
  onClose: () => void;
};

const sourceKindLabels = {
  first_party: "First-party source",
  search_index: "Search index",
  third_party: "Third-party source",
  user_provided: "User-provided source",
} as const;

export function SourceDrawer({ evidence, onClose }: SourceDrawerProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!evidence) {
      return;
    }
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = drawer.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!focusable || focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) {
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [evidence, onClose]);

  if (!evidence) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        aria-describedby="source-excerpt"
        aria-labelledby="source-title"
        aria-modal="true"
        className="source-drawer"
        ref={drawer}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="drawer-header">
          <p className="eyebrow">SOURCE RECORD</p>
          <button ref={closeButton} className="icon-button" type="button" onClick={onClose}>
            <span aria-hidden="true">×</span><span className="sr-only">Close source drawer</span>
          </button>
        </div>
        <h2 id="source-title">{evidence.title}</h2>
        <dl className="source-meta">
          <div><dt>Source type</dt><dd>{sourceKindLabels[evidence.sourceKind]}</dd></div>
          <div><dt>Retrieved</dt><dd>{new Date(evidence.retrievedAt).toLocaleString()}</dd></div>
          <div><dt>Confidence</dt><dd className={`confidence confidence-${evidence.confidence}`}>{evidence.confidence}</dd></div>
          <div><dt>Rationale</dt><dd>Confidence reflects the bounded, recorded source context available in this run.</dd></div>
        </dl>
        <section className="bounded-excerpt">
          <p className="eyebrow">BOUNDED EXCERPT</p>
          <p id="source-excerpt">{evidence.excerpt}</p>
        </section>
        <p className="source-url">{evidence.url}</p>
        <a className="source-link" href={evidence.url} rel="noreferrer" target="_blank">Open original source <span aria-hidden="true">↗</span></a>
      </aside>
    </div>
  );
}
