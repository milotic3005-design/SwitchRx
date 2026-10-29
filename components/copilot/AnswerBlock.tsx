'use client';

import { createContext, useContext, useMemo, type ComponentProps } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, FlaskConical } from 'lucide-react';
import { parseCiteHref } from '@/lib/copilot/citations';
import { injectDrugLinks, repairBriefMarkdown, type DrugMatcher } from '@/lib/copilot/markdown';
import type { EnrichedSource } from '@/lib/copilot/types';
import { emitOpenDrug } from '@/lib/cross-tab-events';
import { CitationChip } from './CitationChip';

interface CitationContextValue {
  refs: number[];
  sources: EnrichedSource[];
  referencesId: string;
}

// The link renderer reads the citation data from context instead of closing over it, so the `components`
// map below never changes identity. Otherwise a parent that re-renders with a fresh `refs` array would make
// react-markdown remount every link, closing an open citation card.
const CitationContext = createContext<CitationContextValue>({ refs: [], sources: [], referencesId: '' });

function AnswerLink({ href, children }: ComponentProps<'a'>) {
  const { refs, sources, referencesId } = useContext(CitationContext);

  const refNums = href ? parseCiteHref(href) : null;
  if (refNums) {
    return <CitationChip refNums={refNums} refs={refs} sources={sources} referencesId={referencesId} />;
  }

  // Drug Reference cross-link: `#drug:<key>` becomes a chip that opens that drug's monograph.
  if (href?.startsWith('#drug:')) {
    const drugKey = href.slice('#drug:'.length);
    return (
      <button
        type="button"
        onClick={() => emitOpenDrug({ drugKey })}
        title={typeof children === 'string' ? `Open ${children} in Drug Reference` : 'Open in Drug Reference'}
        className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 align-baseline font-body text-[12px] font-medium not-italic leading-none text-emerald-300 no-underline transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/25"
      >
        <FlaskConical size={10} strokeWidth={2} className="shrink-0 opacity-80" aria-hidden="true" />
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 break-words text-blue-400 underline decoration-blue-400/40 hover:text-blue-300 hover:decoration-blue-300"
    >
      {children}
      <ExternalLink size={11} strokeWidth={1.5} className="inline shrink-0 opacity-70" aria-hidden="true" />
    </a>
  );
}

// The Tailwind typography plugin is not enabled in this app, so the prose styling is spelled out per element.
// Colours use the plain theme classes (not `[&_th]:` style variants) so the global dark/light remap applies.
const COMPONENTS: Components = {
  a: AnswerLink,
  p: ({ children }) => <p className="my-4">{children}</p>,
  h1: ({ children }) => <h1 className="mb-3 mt-8 text-[20px] leading-snug">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-8 text-[18px] leading-snug">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-[16px] leading-snug">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-5 text-[14px] uppercase leading-snug">{children}</h4>,
  ul: ({ children }) => <ul className="my-4 list-disc pl-6">{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} className="my-4 list-decimal pl-6">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="my-1.5 pl-0.5 [&>ol]:my-1.5 [&>ul]:my-1.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-blue-500/40 bg-blue-500/10 py-1 pl-4">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
  code: ({ children }) => <code className="rounded bg-white/10 px-1 py-px font-accent text-[13px]">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-black/40 p-3 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>
  ),
  // Wide tables scroll sideways instead of stretching the column.
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto">
      <table className="w-full border-collapse font-body text-[13px] leading-5">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={style} className="border border-white/10 bg-white/5 px-3 py-2 text-left font-semibold text-slate-200">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border border-white/10 px-3 py-2 align-top">
      {children}
    </td>
  ),
};

const PROSE =
  'font-[family-name:var(--font-serif)] text-[16px] leading-[26px] text-slate-300 [&>:first-child]:mt-0 [&>:last-child]:mb-0';

/**
 * One answer: serif prose with an inline citation pill at the end of each supported sentence and a
 * chip on each recognised drug name.
 *
 * `markdown` is the answer with ` [cite](#cite:<refNums>)` markers already placed (see `placeCitations`);
 * `refs[n - 1]` is the index in `sources` of reference `n`; `referencesId` is the `id` of the reference
 * list that each citation card links to.
 */
export function AnswerBlock({
  markdown,
  refs,
  sources,
  drugMatcher,
  referencesId,
}: {
  markdown: string;
  refs: number[];
  sources: EnrichedSource[];
  drugMatcher: DrugMatcher;
  referencesId: string;
}) {
  const content = useMemo(() => injectDrugLinks(repairBriefMarkdown(markdown), drugMatcher), [markdown, drugMatcher]);
  const citations = useMemo(() => ({ refs, sources, referencesId }), [refs, sources, referencesId]);

  return (
    <CitationContext.Provider value={citations}>
      <div className={PROSE}>
        {/* No raw HTML (react-markdown's default) and no images: a remote image URL could carry text out of the page. */}
        <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS} disallowedElements={['img']}>
          {content}
        </Markdown>
      </div>
    </CitationContext.Provider>
  );
}
