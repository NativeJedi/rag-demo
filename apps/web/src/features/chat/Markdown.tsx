import { memo, useState, type ComponentProps, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function CodeBlock({ children, ...props }: ComponentProps<'pre'>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(children));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="group relative my-4">
      <pre {...props}>{children}</pre>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy code"
        className="absolute right-2 top-2 rounded-md border border-line bg-surface p-1.5 text-muted opacity-0 transition hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  a: (props: ComponentProps<'a'>) => <a {...props} target="_blank" rel="noreferrer noopener" />,
  table: (props: ComponentProps<'table'>) => (
    <div className="my-4 overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown prose prose-sm max-w-none break-words sm:prose-base prose-p:leading-relaxed prose-headings:font-semibold">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
