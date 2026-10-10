"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SearchItem } from "@/content/search";
import styles from "./CommandPalette.module.css";

const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** Higher is better; -1 when some word of the query is missing. Title hits outrank hint and keyword hits. */
function score(item: SearchItem, terms: string[]) {
  const title = item.title.toLowerCase();
  const rest = `${item.hint} ${item.keywords ?? ""} ${item.group}`.toLowerCase();
  let total = 0;
  for (const t of terms) {
    if (title.startsWith(t)) total += 8;
    else if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title)) total += 5;
    else if (title.includes(t)) total += 3;
    else if (rest.includes(t)) total += 1;
    else return -1;
  }
  return total;
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {}
}

/** Ctrl/⌘ K or "/" opens a search over every page, model, project, paper and pull request. */
export function CommandPalette({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const mac = useSyncExternalStore(noop, isMac, () => false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return items;
    return items
      .map((item, i) => ({ item, i, s: score(item, terms) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((r) => r.item);
  }, [items, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true]");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function run(item: SearchItem) {
    close();
    if (item.action === "theme") toggleTheme();
    else if (item.action === "copy-email") {
      const email = item.hint;
      navigator.clipboard?.writeText(email).then(
        () => setStatus(`Copied ${email}`),
        () => setStatus(`Email: ${email}`),
      );
      setTimeout(() => setStatus(""), 2500);
    } else if (item.href?.startsWith("/") && !item.href.endsWith(".pdf")) router.push(item.href);
    else if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = results.length;
      if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      run(results[active]);
    }
  }

  const optionId = (i: number) => `palette-option-${i}`;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-label="Search the site" data-testid="palette-open">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3.5 3.5" />
        </svg>
        <span className={styles.label}>Search</span>
        <kbd className={styles.kbd}>{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label="Search the site"
        onClose={close}
        onClick={(e) => e.target === dialog.current && close()}
        data-testid="palette"
      >
        {open ? (
          <div className={styles.panel}>
            <input
              className={styles.input}
              autoFocus
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={results[active] ? optionId(active) : undefined}
              aria-autocomplete="list"
              placeholder="Search models, projects, papers, pull requests…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              data-testid="palette-input"
            />
            <ul id="palette-list" role="listbox" ref={list} className={styles.list} aria-label="Results">
              {results.map((item, i) => (
                <li
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className={styles.option}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => run(item)}
                  data-testid="palette-option"
                >
                  <span className={styles.title}>{item.title}</span>
                  <span className={styles.hint}>{item.hint}</span>
                  <span className={styles.group}>{item.group}</span>
                </li>
              ))}
              {results.length === 0 ? <li className={styles.empty}>Nothing matches “{query}”.</li> : null}
            </ul>
            <p className={styles.footer}>
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> to move
              </span>
              <span>
                <kbd>Enter</kbd> to open
              </span>
              <span>
                <kbd>Esc</kbd> to close
              </span>
            </p>
          </div>
        ) : null}
      </dialog>
      <p className={styles.status} role="status" aria-live="polite" data-testid="palette-status">
        {status}
      </p>
    </>
  );
}
