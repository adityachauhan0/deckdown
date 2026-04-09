import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, Decoration, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder, ViewPlugin } from '@codemirror/view';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { forceLinting, lintGutter, linter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    color: 'var(--ink)'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '15px',
    lineHeight: '1.72'
  },
  '.cm-content': {
    padding: '22px 24px 36px',
    caretColor: 'var(--accent)'
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(251, 250, 247, 0.92)',
    borderRight: '1px solid var(--line)',
    color: '#9aa0ab'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(36, 95, 212, 0.05)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(36, 95, 212, 0.08)',
    color: 'var(--accent)'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(36, 95, 212, 0.18) !important'
  },
  '.cm-tooltip-autocomplete': {
    border: '1px solid var(--line)',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  '.cm-deckdown-slide-break': {
    color: 'var(--accent)',
    fontWeight: '700'
  },
  '.cm-deckdown-attribute': {
    color: '#8a4b0f',
    fontWeight: '600'
  },
  '.cm-deckdown-import': {
    color: '#245fd4',
    fontWeight: '600'
  },
  '.cm-deckdown-frontmatter': {
    color: '#0f766e'
  },
  '.cm-deckdown-math': {
    color: '#8b1e54',
    fontWeight: '600'
  },
  '.cm-deckdown-mermaid': {
    color: '#245fd4',
    fontWeight: '600'
  }
});

const editorHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#102a62', fontWeight: '700' },
  { tag: tags.keyword, color: '#8a4b0f' },
  { tag: tags.link, color: '#245fd4', textDecoration: 'underline' },
  { tag: tags.quote, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.list, color: '#8a4b0f' },
  { tag: tags.monospace, color: '#8b1e54' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' }
]);

const deckdownDecorations = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = buildDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildDecorations(update.view);
    }
  }
}, {
  decorations: value => value.decorations
});

const deckdownCompletions = [
  {
    label: '---',
    type: 'keyword',
    detail: 'Slide break',
    apply: '---'
  },
  {
    label: '@import',
    type: 'keyword',
    detail: 'YAML import',
    apply: '@import[./theme.yaml]'
  },
  {
    label: 'title slide',
    type: 'snippet',
    detail: 'Starter title slide',
    apply: '\n---\n# Title Slide\n\n{{ center middle }}\n\nSubtitle\n'
  },
  {
    label: 'two columns',
    type: 'snippet',
    detail: 'Split content into two columns',
    apply: '\n{{ cols: 2 }}\n## Left\n\nContent\n\n{{ col: break }}\n## Right\n\nContent\n'
  },
  {
    label: 'math block',
    type: 'snippet',
    detail: 'Display LaTeX math',
    apply: '\n$$\n\\int_0^1 x^2 \\, dx\n$$\n'
  },
  {
    label: 'mermaid diagram',
    type: 'snippet',
    detail: 'Starter Mermaid flowchart',
    apply: '\n```mermaid\ngraph TD\n  Input --> Review --> Export\n```\n'
  },
  {
    label: 'center middle',
    type: 'property',
    detail: 'Center content',
    apply: 'center middle'
  },
  {
    label: 'cols: 2',
    type: 'property',
    detail: 'Two-column layout',
    apply: 'cols: 2'
  },
  {
    label: 'width: 72%',
    type: 'property',
    detail: 'Set block width',
    apply: 'width: 72%'
  },
  {
    label: 'contain',
    type: 'property',
    detail: 'Contain an image',
    apply: 'contain'
  }
];

const attributeTokens = ['center', 'middle', 'right', 'contain', 'cover', 'cols: 2', 'col: break', 'width: 72%', 'height: 430'];
const frontmatterKeys = ['title:', 'page:', 'width:', 'height:', 'margin:', 'theme:', 'import:'];
const codeFenceStarters = ['```mermaid', '```javascript', '```python', '```text'];

function buildDecorations(view) {
  const builder = new RangeSetBuilder();
  const content = view.state.doc.toString();
  const ranges = [];
  let frontmatterEnd = -1;

  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---(?=\n|$)/);
  if (frontmatterMatch) {
    frontmatterEnd = frontmatterMatch[0].length;
    ranges.push({
      from: 0,
      to: frontmatterEnd,
      decoration: Decoration.mark({ class: 'cm-deckdown-frontmatter' })
    });
  }

  addRegexDecorations(ranges, content, /^---$/gm, 'cm-deckdown-slide-break', frontmatterEnd);
  addRegexDecorations(ranges, content, /\{\{[^}\n]*\}\}/g, 'cm-deckdown-attribute', frontmatterEnd);
  addRegexDecorations(ranges, content, /@import\[[^\]\n]+\]/g, 'cm-deckdown-import', frontmatterEnd);
  addRegexDecorations(ranges, content, /^\$\$[\s\S]*?^\$\$$/gm, 'cm-deckdown-math', frontmatterEnd);
  addRegexDecorations(ranges, content, /^```mermaid[\s\S]*?^```$/gm, 'cm-deckdown-mermaid', frontmatterEnd);

  ranges
    .sort((left, right) => left.from - right.from || left.to - right.to)
    .forEach(range => {
      builder.add(range.from, range.to, range.decoration);
    });

  return builder.finish();
}

function addRegexDecorations(ranges, content, expression, className, excludedUntil = -1) {
  let match;
  while ((match = expression.exec(content)) !== null) {
    if (match.index < excludedUntil) {
      continue;
    }
    ranges.push({
      from: match.index,
      to: match.index + match[0].length,
      decoration: Decoration.mark({ class: className })
    });
  }
}

function offsetToLineAndColumn(content, offset) {
  const prior = content.slice(0, offset);
  const lines = prior.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function createLocalDiagnostics(content) {
  const diagnostics = [];
  const normalized = String(content || '').replace(/\r/g, '');

  if (normalized.startsWith('---\n')) {
    const closingIndex = normalized.indexOf('\n---', 4);
    if (closingIndex === -1) {
      diagnostics.push({
        from: 0,
        to: Math.min(normalized.length, 3),
        severity: 'error',
        source: 'syntax',
        message: 'Frontmatter starts with `---` but never closes with another `---`.'
      });
    }
  }

  const lines = normalized.split('\n');
  let offset = 0;
  let openCodeFence = null;
  let openMathFence = null;
  lines.forEach((lineText, index) => {
    const trimmed = lineText.trim();

    if (lineText.includes('{{') && !lineText.includes('}}')) {
      diagnostics.push({
        from: offset,
        to: offset + lineText.length,
        severity: 'error',
        source: 'syntax',
        message: 'Attribute block is missing a closing `}}`.',
        line: index + 1
      });
    }

    if (lineText.includes('}}') && !lineText.includes('{{')) {
      diagnostics.push({
        from: offset,
        to: offset + lineText.length,
        severity: 'error',
        source: 'syntax',
        message: 'Closing `}}` appears without an opening `{{`.',
        line: index + 1
      });
    }

    if (lineText.trimStart().startsWith('@import[') && !lineText.includes(']')) {
      diagnostics.push({
        from: offset,
        to: offset + lineText.length,
        severity: 'error',
        source: 'syntax',
        message: 'Import directive is missing a closing `]`.',
        line: index + 1
      });
    }

    if (/^```/.test(trimmed)) {
      if (openCodeFence === null) {
        openCodeFence = {
          from: offset,
          line: index + 1,
          label: trimmed.slice(3).trim() || 'code'
        };
      } else {
        openCodeFence = null;
      }
    }

    if (trimmed === '$$') {
      if (openMathFence === null) {
        openMathFence = {
          from: offset,
          line: index + 1
        };
      } else {
        openMathFence = null;
      }
    }

    offset += lineText.length + 1;
  });

  if (openCodeFence) {
    diagnostics.push({
      from: openCodeFence.from,
      to: Math.min(normalized.length, openCodeFence.from + 3),
      severity: 'error',
      source: 'syntax',
      message: `Code fence for \`${openCodeFence.label}\` is missing a closing \`\`\`.`,
      line: openCodeFence.line
    });
  }

  if (openMathFence) {
    diagnostics.push({
      from: openMathFence.from,
      to: Math.min(normalized.length, openMathFence.from + 2),
      severity: 'error',
      source: 'syntax',
      message: 'Math block is missing a closing `$$`.',
      line: openMathFence.line
    });
  }

  return diagnostics.map(diagnostic => {
    const location = diagnostic.line ? { line: diagnostic.line, column: 1 } : offsetToLineAndColumn(normalized, diagnostic.from);
    return {
      ...diagnostic,
      line: diagnostic.line || location.line,
      column: location.column
    };
  });
}

function toCodeMirrorDiagnostic(doc, diagnostic) {
  let from = diagnostic.from;
  let to = diagnostic.to;

  if (!Number.isInteger(from)) {
    const line = doc.line(Math.max(1, diagnostic.line || 1));
    const column = Math.max(1, diagnostic.column || 1);
    from = Math.min(line.to, line.from + column - 1);
    to = Math.max(from + 1, Math.min(line.to, from + 1));
  }

  if (!Number.isInteger(to) || to <= from) {
    to = Math.min(doc.length, from + 1);
  }

  return {
    from,
    to,
    severity: diagnostic.severity === 'error' ? 'error' : 'warning',
    message: diagnostic.message
  };
}

function normalizeDiagnostic(doc, diagnostic) {
  const range = toCodeMirrorDiagnostic(doc, diagnostic);
  const line = doc.lineAt(range.from);
  return {
    ...diagnostic,
    from: range.from,
    to: range.to,
    line: diagnostic.line || line.number,
    column: diagnostic.column || Math.max(1, range.from - line.from + 1)
  };
}

function createCompletionSource() {
  return context => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    const token = context.matchBefore(/[@A-Za-z:./%-]*/);

    if (!context.explicit && (!token || token.from === token.to) && !before.includes('{{')) {
      return null;
    }

    let options = deckdownCompletions;
    if (before.includes('{{')) {
      options = attributeTokens.map(value => ({
        label: value,
        type: 'property',
        apply: value
      }));
    } else if (before.trimStart().startsWith('---') || before.trim() === '') {
      options = deckdownCompletions;
    } else if (before.trimStart().startsWith('@import')) {
      options = [{
        label: '@import[./theme.yaml]',
        type: 'keyword',
        detail: 'YAML import',
        apply: '@import[./theme.yaml]'
      }];
    } else if (before.trimStart().startsWith('```')) {
      options = codeFenceStarters.map(value => ({
        label: value,
        type: 'keyword',
        apply: value
      }));
    } else if (context.pos < 240 && before.includes(':')) {
      options = frontmatterKeys.map(value => ({
        label: value,
        type: 'property',
        apply: value
      }));
    }

    const from = token ? token.from : context.pos;
    return {
      from,
      options,
      validFor: /[@A-Za-z:./% -]*/
    };
  };
}

export function shouldNotifySelectionChange(update) {
  return Boolean(update?.selectionSet) && !Boolean(update?.docChanged);
}

export function createStudioEditor(options) {
  const {
    parent,
    placeholderText,
    onChange,
    onSelectionChange,
    onDiagnosticsChange,
    onSave
  } = options;

  const readOnlyCompartment = new Compartment();
  let serverDiagnostics = [];
  let suppressCallbacks = false;

  const collectDiagnostics = view => {
    const doc = view.state.doc;
    const localDiagnostics = createLocalDiagnostics(doc.toString()).map(diagnostic => normalizeDiagnostic(doc, diagnostic));
    const normalizedServerDiagnostics = serverDiagnostics.map(diagnostic => normalizeDiagnostic(doc, diagnostic));
    return [...localDiagnostics, ...normalizedServerDiagnostics];
  };

  const reportDiagnostics = view => {
    if (onDiagnosticsChange) {
      onDiagnosticsChange(collectDiagnostics(view));
    }
  };

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        readOnlyCompartment.of(EditorView.editable.of(false)),
        markdown(),
        syntaxHighlighting(editorHighlightStyle),
        editorTheme,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        closeBrackets(),
        autocompletion({
          override: [createCompletionSource()]
        }),
        linter(viewInstance => collectDiagnostics(viewInstance).map(diagnostic => toCodeMirrorDiagnostic(viewInstance.state.doc, diagnostic)), {
          delay: 0
        }),
        lintGutter(),
        deckdownDecorations,
        placeholder(placeholderText),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            serverDiagnostics = [];
            reportDiagnostics(update.view);
            if (!suppressCallbacks && onChange) {
              onChange(update.state.doc.toString());
            }
          }

          if (shouldNotifySelectionChange(update) && !suppressCallbacks && onSelectionChange) {
            onSelectionChange(update.state.selection.main.head);
          }
        }),
        EditorView.domEventHandlers({
          keydown(event, viewInstance) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
              event.preventDefault();
              if (onSave) {
                onSave(viewInstance.state.doc.toString());
              }
              return true;
            }
            return false;
          }
        })
      ]
    })
  });

  reportDiagnostics(view);

  return {
    focus() {
      view.focus();
    },
    getValue() {
      return view.state.doc.toString();
    },
    setValue(content) {
      suppressCallbacks = true;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content
        },
        selection: { anchor: 0 }
      });
      suppressCallbacks = false;
      serverDiagnostics = [];
      reportDiagnostics(view);
    },
    setReadOnly(readOnly) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorView.editable.of(!readOnly))
      });
    },
    getCursorOffset() {
      return view.state.selection.main.head;
    },
    getSelection() {
      return {
        from: view.state.selection.main.from,
        to: view.state.selection.main.to
      };
    },
    setSelection(anchor, head = anchor) {
      view.dispatch({
        selection: { anchor, head },
        effects: EditorView.scrollIntoView(anchor, { y: 'center' })
      });
    },
    replaceSelection(text, selection) {
      const currentSelection = view.state.selection.main;
      const nextSelection = selection || {
        anchor: currentSelection.from + text.length
      };
      view.dispatch({
        changes: {
          from: currentSelection.from,
          to: currentSelection.to,
          insert: text
        },
        selection: nextSelection
      });
      view.focus();
    },
    scrollToOffset(offset) {
      view.dispatch({
        effects: EditorView.scrollIntoView(offset, { y: 'center' })
      });
    },
    setServerDiagnostics(diagnostics) {
      serverDiagnostics = diagnostics || [];
      forceLinting(view);
      reportDiagnostics(view);
    },
    destroy() {
      view.destroy();
    }
  };
}
