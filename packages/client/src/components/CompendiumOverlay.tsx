import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import {
  COMPENDIUM_CATEGORIES,
  getArticle,
  getArticlesByCategory,
  searchArticles,
} from '../data/compendium';
import type { CompendiumArticle, CompendiumCategory } from '../data/compendium';

// ---------------------------------------------------------------------------
// Body renderer — converts simple markup to React elements
// ---------------------------------------------------------------------------

function renderBody(body: string, onNavigate: (id: string) => void): ReactNode[] {
  const paragraphs = body.split(/\n\n+/);
  const elements: ReactNode[] = [];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi];
    const lines = paragraph.split('\n');

    // Check if this paragraph is an image block: ![caption](img:path)
    const imgMatch = paragraph.trim().match(/^!\[([^\]]*)\]\(img:([^)]+)\)$/);
    if (imgMatch) {
      const [, caption, path] = imgMatch;
      elements.push(
        <div key={`img-${pi}`} className="compendium-img-block" style={{ margin: '16px 0', textAlign: 'center' }}>
          <img
            src={`/compendium/${path}.png`}
            alt={caption}
            loading="lazy"
            style={{ maxWidth: '100%', imageRendering: 'pixelated', border: '1px solid rgba(255,176,0,0.3)' }}
          />
          <div
            className="compendium-img-caption"
            style={{ fontSize: '0.65rem', color: 'var(--color-dim)', marginTop: '4px', letterSpacing: '0.1em' }}
          >
            [ {caption} ]
          </div>
        </div>,
      );
      continue;
    }

    // Check if this paragraph is a table (all non-empty lines start with |)
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const isTable = nonEmpty.length > 0 && nonEmpty.every((l) => l.trim().startsWith('|'));

    if (isTable) {
      const rows: ReactNode[] = [];
      for (let li = 0; li < nonEmpty.length; li++) {
        const line = nonEmpty[li].trim();
        // Skip separator rows (e.g. |---|---|)
        if (/^\|[-\s|]+\|$/.test(line)) continue;
        const cells = line
          .split('|')
          .filter((_, i, a) => i > 0 && i < a.length - 1)
          .map((c) => c.trim());
        const isHeader = li === 0;
        rows.push(
          <tr key={`${pi}-row-${li}`}>
            {cells.map((cell, ci) =>
              isHeader ? (
                <th
                  key={ci}
                  style={{
                    padding: '4px 12px',
                    borderBottom: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                  }}
                >
                  {cell}
                </th>
              ) : (
                <td
                  key={ci}
                  style={{
                    padding: '4px 12px',
                    borderBottom: '1px solid rgba(255, 176, 0, 0.2)',
                    fontSize: '0.75rem',
                  }}
                >
                  {cell}
                </td>
              ),
            )}
          </tr>,
        );
      }
      elements.push(
        <table
          key={`table-${pi}`}
          style={{
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-mono)',
            margin: '8px 0',
            border: '1px solid rgba(255, 176, 0, 0.3)',
            width: '100%',
          }}
        >
          <tbody>{rows}</tbody>
        </table>,
      );
      continue;
    }

    // Process lines, grouping consecutive list items into <ul> blocks
    const lineElements: ReactNode[] = [];
    let listBuffer: { text: string; idx: number }[] = [];

    const flushList = () => {
      if (listBuffer.length === 0) return;
      lineElements.push(
        <ul
          key={`list-${pi}-${listBuffer[0].idx}`}
          style={{ margin: '4px 0', paddingLeft: '20px', listStyle: 'disc' }}
        >
          {listBuffer.map((item) => (
            <li key={item.idx} style={{ marginBottom: '2px' }}>
              {renderInline(item.text, `${pi}-${item.idx}`, onNavigate)}
            </li>
          ))}
        </ul>,
      );
      listBuffer = [];
    };

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];

      // List item
      if (line.trimStart().startsWith('- ')) {
        listBuffer.push({
          text: line.replace(/^\s*- /, ''),
          idx: li,
        });
        continue;
      }

      // Flush any pending list items before processing non-list line
      flushList();

      // Arrow cross-references
      if (line.trim().startsWith('\u2192')) {
        lineElements.push(
          <span key={`${pi}-${li}`} style={{ color: 'var(--color-primary)', display: 'block' }}>
            {renderInline(line, `${pi}-${li}`, onNavigate)}
          </span>,
        );
        continue;
      }

      if (lineElements.length > 0 && line.trim().length > 0) {
        lineElements.push(<br key={`br-${pi}-${li}`} />);
      }
      if (line.trim().length > 0) {
        lineElements.push(
          <span key={`${pi}-${li}`}>{renderInline(line, `${pi}-${li}`, onNavigate)}</span>,
        );
      }
    }

    // Flush any remaining list items
    flushList();

    // Use <div> instead of <p> when content contains block elements (lists)
    const hasBlockContent = lineElements.some(
      (el) => el !== null && typeof el === 'object' && 'type' in el && el.type === 'ul',
    );
    const Tag = hasBlockContent ? 'div' : 'p';
    elements.push(
      <Tag key={`p-${pi}`} style={{ margin: '6px 0' }}>
        {lineElements}
      </Tag>,
    );
  }

  return elements;
}

/** Render inline markup: **bold** */
function renderInline(
  text: string,
  keyPrefix: string,
  _onNavigate: (id: string) => void,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <strong key={`${keyPrefix}-b${idx++}`} style={{ color: 'var(--color-primary)' }}>
        {match[1]}
      </strong>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-t${idx++}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key={`${keyPrefix}-empty`}>{text}</span>];
}

// ---------------------------------------------------------------------------
// CompendiumOverlay
// ---------------------------------------------------------------------------

export function CompendiumOverlay() {
  const open = useStore((s) => s.compendiumOpen);
  const articleId = useStore((s) => s.compendiumArticleId);
  const search = useStore((s) => s.compendiumSearch);
  const closeCompendium = useStore((s) => s.closeCompendium);
  const setArticle = useStore((s) => s.setCompendiumArticle);
  const setSearch = useStore((s) => s.setCompendiumSearch);

  const searchRef = useRef<HTMLInputElement>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<CompendiumCategory>>(new Set());

  const article = useMemo(() => (articleId ? getArticle(articleId) : undefined), [articleId]);

  const searchResults = useMemo(() => (search.trim() ? searchArticles(search) : []), [search]);

  const toggleCategory = useCallback((cat: CompendiumCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const navigateTo = useCallback(
    (id: string) => {
      setArticle(id);
      setSearch('');
    },
    [setArticle, setSearch],
  );

  // Auto-expand category of active article
  useEffect(() => {
    if (article && !expandedCategories.has(article.category)) {
      setExpandedCategories((prev) => new Set(prev).add(article.category));
    }
  }, [article]); // eslint-disable-line

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCompendium();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeCompendium]);

  if (!open) return null;

  const isSearching = search.trim().length > 0;

  return (
    <div
      data-testid="compendium-overlay"
      onClick={closeCompendium}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        data-testid="compendium-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(5, 5, 5, 0.97)',
          border: '1px solid var(--color-primary)',
          width: '90vw',
          maxWidth: '1100px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-primary)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: 'var(--color-primary)',
              fontSize: '0.85rem',
              letterSpacing: '0.15em',
            }}
          >
            ◈ KOMPENDIUM
          </span>
          <button
            data-testid="compendium-close"
            onClick={closeCompendium}
            style={{
              background: 'none',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              padding: '2px 8px',
              cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            [X] ESC
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            data-testid="compendium-sidebar"
            style={{
              width: '30%',
              minWidth: '180px',
              maxWidth: '280px',
              background: 'rgba(255, 176, 0, 0.03)',
              borderRight: '1px solid rgba(255, 176, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Search */}
            <div style={{ padding: '8px 10px', flexShrink: 0 }}>
              <input
                ref={searchRef}
                data-testid="compendium-search"
                type="text"
                placeholder="SUCHE..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 176, 0, 0.3)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  padding: '4px 6px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category list / search results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
              {isSearching ? (
                // Search results
                <div>
                  <div
                    style={{
                      fontSize: '0.6rem',
                      color: 'var(--color-dim)',
                      padding: '4px 6px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {searchResults.length} TREFFER
                  </div>
                  {searchResults.map((a) => (
                    <SidebarItem
                      key={a.id}
                      article={a}
                      isActive={articleId === a.id}
                      onClick={() => navigateTo(a.id)}
                    />
                  ))}
                </div>
              ) : (
                // Category accordion
                COMPENDIUM_CATEGORIES.map((cat) => {
                  const articles = getArticlesByCategory(cat.id);
                  const isExpanded = expandedCategories.has(cat.id);
                  return (
                    <div key={cat.id} style={{ marginBottom: '2px' }}>
                      <button
                        data-testid={`compendium-cat-${cat.id}`}
                        onClick={() => toggleCategory(cat.id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.15em',
                          padding: '6px 6px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {isExpanded ? '▾' : '▸'} {cat.icon} {cat.label}
                      </button>
                      {isExpanded &&
                        articles.map((a) => (
                          <SidebarItem
                            key={a.id}
                            article={a}
                            isActive={articleId === a.id}
                            onClick={() => navigateTo(a.id)}
                          />
                        ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Content area */}
          <div
            data-testid="compendium-article"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 24px',
              color: '#CCCCCC',
              fontSize: '0.8rem',
              lineHeight: 1.7,
            }}
          >
            {article ? (
              <ArticleView article={article} onNavigate={navigateTo} />
            ) : (
              <WelcomePage onNavigate={navigateTo} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarItem({
  article,
  isActive,
  onClick,
}: {
  article: CompendiumArticle;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`compendium-item-${article.id}`}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        background: isActive ? 'rgba(255, 176, 0, 0.1)' : 'none',
        border: 'none',
        color: isActive ? 'var(--color-primary)' : '#AAAAAA',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        padding: '3px 6px 3px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {isActive ? '▸ ' : '  '}
      {article.title}
    </button>
  );
}

function ArticleView({
  article,
  onNavigate,
}: {
  article: CompendiumArticle;
  onNavigate: (id: string) => void;
}) {
  const seeAlsoArticles = useMemo(() => {
    if (!article.seeAlso) return [];
    return article.seeAlso
      .map((id) => getArticle(id))
      .filter((a): a is CompendiumArticle => a !== undefined);
  }, [article.seeAlso]);

  return (
    <div>
      {/* Title */}
      <h2
        style={{
          color: 'var(--color-primary)',
          fontSize: '0.95rem',
          letterSpacing: '0.15em',
          margin: '0 0 16px',
          borderBottom: '1px solid rgba(255, 176, 0, 0.3)',
          paddingBottom: '8px',
        }}
      >
        {article.icon} {article.title}
      </h2>

      {/* Summary */}
      <p
        style={{
          color: 'var(--color-dim)',
          fontSize: '0.75rem',
          fontStyle: 'italic',
          margin: '0 0 16px',
        }}
      >
        {article.summary}
      </p>

      {/* Body */}
      <div>{renderBody(article.body, onNavigate)}</div>

      {/* See also */}
      {seeAlsoArticles.length > 0 && (
        <div
          data-testid="compendium-see-also"
          style={{
            marginTop: '24px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 176, 0, 0.2)',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--color-primary)',
              letterSpacing: '0.15em',
              marginBottom: '6px',
            }}
          >
            SIEHE AUCH
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {seeAlsoArticles.map((sa) => (
              <button
                key={sa.id}
                data-testid={`compendium-see-also-${sa.id}`}
                onClick={() => onNavigate(sa.id)}
                style={{
                  background: 'rgba(255, 176, 0, 0.05)',
                  border: '1px solid rgba(255, 176, 0, 0.3)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                → {sa.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomePage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div>
      <h2
        style={{
          color: 'var(--color-primary)',
          fontSize: '0.95rem',
          letterSpacing: '0.15em',
          margin: '0 0 16px',
          borderBottom: '1px solid rgba(255, 176, 0, 0.3)',
          paddingBottom: '8px',
        }}
      >
        ◈ KOMPENDIUM
      </h2>
      <p style={{ margin: '0 0 16px' }}>
        Willkommen im Kompendium. Waehle einen Artikel aus der Seitenleiste oder nutze die Suche.
      </p>
      {COMPENDIUM_CATEGORIES.map((cat) => {
        const articles = getArticlesByCategory(cat.id);
        return (
          <div key={cat.id} style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}
            >
              {cat.icon} {cat.label}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                paddingLeft: '8px',
              }}
            >
              {articles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onNavigate(a.id)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255, 176, 0, 0.2)',
                    color: '#AAAAAA',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                >
                  {a.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
