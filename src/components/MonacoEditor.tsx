import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { TextMateGrammar, SyntaxHighlightingData } from '@/lib/wasmInterface';
import { wasmInference } from '@/lib/wasmInterface';
import * as monaco from 'monaco-editor';
import { Registry } from 'monaco-textmate';
import { loadWASM } from 'onigasm';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string | number;
  enableSyntaxHighlighting?: boolean;
  onSyntaxHighlightingChange?: (data: SyntaxHighlightingData | null) => void;
}

export interface MonacoEditorRef {
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getModel: () => monaco.editor.ITextModel | null;
}

export const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>(({
  value,
  onChange,
  placeholder,
  className = '',
  height = '200px',
  enableSyntaxHighlighting = true,
  onSyntaxHighlightingChange
}, ref) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [grammarLoaded, setGrammarLoaded] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('text');
  const { theme, resolvedTheme } = useTheme();
  const registryRef = useRef<Registry | null>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    blur: () => {
      // Monaco Editor doesn't have a blur method, so we focus on the document body
      document.body.focus();
    },
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (newValue: string) => editorRef.current?.setValue(newValue),
    getModel: () => editorRef.current?.getModel() || null
  }));

  // Load TextMate grammar from WASM
  const loadTextMateGrammar = async () => {
    if (!enableSyntaxHighlighting) {
      onSyntaxHighlightingChange?.(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await wasmInference.requestTextMateGrammar({
        command: 'grammar',
        options: {
          includeComments: true,
          includeWhitespace: false
        }
      });
      
      // Register the grammar with Monaco using monaco-textmate
      await registerTextMateGrammar(result.grammar, result.language);
      setCurrentLanguage(result.language);
      setGrammarLoaded(true);
      onSyntaxHighlightingChange?.(result);
    } catch (error) {
      console.warn('Failed to load TextMate grammar, using fallback:', error);
      onSyntaxHighlightingChange?.(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Register TextMate grammar with Monaco Editor using monaco-textmate
  const registerTextMateGrammar = async (grammar: TextMateGrammar, languageId: string) => {
    try {
      // Initialize registry if not already done
      if (!registryRef.current) {
        // Load WASM for onigasm (required by monaco-textmate)
        await loadWASM(undefined);
        registryRef.current = new Registry({
          getGrammarDefinition: async (scopeName: string) => {
            return {
              format: 'json',
              content: JSON.stringify(grammar)
            };
          }
        });
      }

      // Register the language with Monaco
      monaco.languages.register({ id: languageId });
      
      // Set the tokens provider using monaco-textmate
      const grammarDefinition = await registryRef.current.loadGrammar(grammar.scopeName || languageId);
      if (grammarDefinition) {
        monaco.languages.setTokensProvider(languageId, {
          getInitialState: () => null,
          tokenize: (line: string, state: any) => {
            const result = grammarDefinition.tokenizeLine(line, state);
            return {
              tokens: result.tokens.map(token => ({
                startIndex: token.startIndex,
                scopes: token.scopes.join(' ')
              })),
              endState: result.ruleStack
            };
          }
        });
      }
      
      console.log(`TextMate grammar registered for language: ${languageId}`);
    } catch (error) {
      console.error('Failed to register TextMate grammar:', error);
      throw error;
    }
  };

  // Load grammar on mount
  useEffect(() => {
    loadTextMateGrammar();
  }, [enableSyntaxHighlighting]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      onChange(newValue);
    }
  };

  return (
    <div className={`monaco-editor-container ${className}`} style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-sm text-muted-foreground">Loading syntax highlighting...</div>
        </div>
      )}
      <Editor
        height="100%"
        language={currentLanguage}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'off',
          glyphMargin: true,
          folding: false,
          lineDecorationsWidth: 8,
          lineNumbersMinChars: 2,
          renderLineHighlight: 'none',
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
          },
          wordWrap: 'bounded',
          wordWrapColumn: 80,
          automaticLayout: true,
          padding: { top: 8, bottom: 8 },
          placeholder: placeholder
        }}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
      />
    </div>
  );
});

MonacoEditor.displayName = 'MonacoEditor';
