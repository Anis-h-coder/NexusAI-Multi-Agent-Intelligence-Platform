import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Check,
  Copy,
  ChevronRight,
  Code2,
  Table as TableIcon,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface StepOutputRendererProps {
  content: string;
  theme?: 'light' | 'dark';
}

export const StepOutputRenderer: React.FC<StepOutputRendererProps> = ({
  content,
  theme = 'light',
}) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  if (!content) {
    return (
      <div className="p-4 text-xs text-slate-400 italic">
        No output content recorded for this stage yet.
      </div>
    );
  }

  const isDark = theme === 'dark';

  const handleCopyCode = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  let codeBlockCounter = 0;

  return (
    <div
      className={`step-output-renderer space-y-3.5 text-xs sm:text-sm leading-relaxed ${
        isDark ? 'text-slate-200' : 'text-slate-800'
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings with clear hierarchy and proper margins
          h1: ({ children }) => (
            <h1
              className={`text-base sm:text-lg font-extrabold pb-2 mt-4 mb-3 border-b tracking-tight flex items-center gap-2 ${
                isDark ? 'text-white border-slate-800' : 'text-slate-900 border-slate-200'
              }`}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={`text-sm sm:text-base font-bold mt-4 mb-2 tracking-tight flex items-center gap-1.5 ${
                isDark ? 'text-emerald-400' : 'text-emerald-800'
              }`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={`text-xs sm:text-sm font-bold mt-3.5 mb-1.5 tracking-tight ${
                isDark ? 'text-teal-300' : 'text-slate-900'
              }`}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4
              className={`text-xs sm:text-xs font-bold uppercase tracking-wider mt-3 mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {children}
            </h4>
          ),

          // Paragraphs rendered as divs to prevent invalid nesting with code blocks/tables
          p: ({ children }) => (
            <div
              className={`leading-relaxed mb-3 last:mb-0 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {children}
            </div>
          ),

          // Code blocks container
          pre: ({ children }) => <div className="not-prose my-3.5">{children}</div>,

          // Ordered Lists
          ol: ({ children }) => (
            <ol className="space-y-2 my-3 pl-1 list-none counter-reset-item">{children}</ol>
          ),

          // Unordered Lists
          ul: ({ children }) => (
            <ul className="space-y-2 my-3 pl-1 list-none">{children}</ul>
          ),

          // List Items styled as clean modern cards/bullet points
          li: ({ children }) => {
            return (
              <li
                className={`p-2.5 sm:p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
                    : 'bg-slate-50/90 border-slate-200/90 text-slate-800 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    isDark ? 'bg-emerald-400' : 'bg-emerald-600'
                  }`}
                />
                <div className="flex-1 leading-relaxed text-xs sm:text-sm min-w-0">
                  {children}
                </div>
              </li>
            );
          },

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote
              className={`p-3.5 rounded-xl border-l-4 my-3 text-xs sm:text-sm italic ${
                isDark
                  ? 'bg-slate-900/60 border-emerald-500 text-slate-300'
                  : 'bg-emerald-50/50 border-emerald-600 text-emerald-950 shadow-2xs'
              }`}
            >
              {children}
            </blockquote>
          ),

          // Tables rendered with rich modern styling and horizontal scrolling
          table: ({ children }) => (
            <div className="my-4 overflow-hidden rounded-xl border border-slate-200 shadow-2xs bg-white">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-max text-left text-xs border-collapse whitespace-nowrap">
                  {children}
                </table>
              </div>
            </div>
          ),
          thead: ({ children }) => (
            <thead
              className={`border-b font-bold ${
                isDark
                  ? 'bg-slate-900 text-slate-200 border-slate-800'
                  : 'bg-slate-100/90 text-slate-900 border-slate-200'
              }`}
            >
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody
              className={`divide-y ${
                isDark ? 'divide-slate-800/80 bg-slate-950/40' : 'divide-slate-100 bg-white'
              }`}
            >
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr
              className={`transition-colors ${
                isDark ? 'even:bg-slate-900/40 hover:bg-slate-900/70' : 'even:bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className={`px-4 py-2.5 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap border-r last:border-r-0 ${
              isDark ? 'border-slate-800 text-slate-200' : 'border-slate-200 text-slate-800'
            }`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-4 py-2.5 align-middle leading-relaxed border-r last:border-r-0 ${
              isDark ? 'border-slate-800/60 text-slate-300' : 'border-slate-100 text-slate-700'
            }`}>
              {children}
            </td>
          ),

          // Inline & Block Code with syntax presentation and copy action
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const rawCode = String(children).replace(/\n$/, '');

            const isBlock = !inline && (Boolean(match) || rawCode.includes('\n'));

            if (isBlock) {
              const currentBlockIdx = ++codeBlockCounter;
              const isCopied = copiedCodeIdx === currentBlockIdx;
              const lang = match ? match[1] : 'text';

              return (
                <div className="my-3.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="uppercase text-slate-300 font-bold">{lang}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(rawCode, currentBlockIdx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer text-[10px] font-mono font-medium"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-4 text-xs font-mono leading-relaxed text-emerald-300 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <code>{rawCode}</code>
                  </pre>
                </div>
              );
            }

            return (
              <code
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] sm:text-xs font-medium ${
                  isDark
                    ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                    : 'bg-slate-100 text-emerald-900 border border-slate-200 font-semibold'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Bold & Strong
          strong: ({ children }) => (
            <strong
              className={`font-bold ${
                isDark ? 'text-emerald-300' : 'text-slate-900'
              }`}
            >
              {children}
            </strong>
          ),

          // Horizontal rule
          hr: () => (
            <hr
              className={`my-4 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
