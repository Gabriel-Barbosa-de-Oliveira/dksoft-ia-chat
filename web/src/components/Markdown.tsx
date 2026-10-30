import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./Markdown.module.css";

const components: Components = {
  a({ node: _node, children, ...props }) {
    return (
      <a {...props} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ node: _node, children, ...props }) {
    return (
      <div className={styles.tableWrap} role="region" aria-label="Tabela da resposta" tabIndex={0}>
        <table className="table" {...props}>
          {children}
        </table>
      </div>
    );
  },
};

const plugins = [remarkGfm];

/** Markdown da resposta. Sem `rehype-raw`: HTML bruto vira texto; URLs inseguras são removidas pelo react-markdown. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.root}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
