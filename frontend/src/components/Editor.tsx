import MonacoEditor, { useMonaco } from '@monaco-editor/react';

interface EditorProps {
  filePath?: string;
  code: string;
  onChange: (value: string | undefined) => void;
}

export const Editor = ({ filePath, code, onChange }: EditorProps) => {
  const monaco = useMonaco();
  
  // Basic theme definition like before
  if (monaco) {
    monaco.editor.defineTheme('yazici-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0d0e14',
        'editor.lineHighlightBackground': '#1a1b27',
        'editorCursor.foreground': '#7c6af7',
      }
    });
  }

  const extension = filePath?.split('.').pop();
  let language = 'plaintext';
  if (extension) {
    if (['ts', 'tsx'].includes(extension)) language = 'typescript';
    if (['js', 'jsx'].includes(extension)) language = 'javascript';
    if (['json'].includes(extension)) language = 'json';
    if (['html'].includes(extension)) language = 'html';
    if (['css'].includes(extension)) language = 'css';
    if (['md'].includes(extension)) language = 'markdown';
  }

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg0 text-text3 flex-col select-none">
        <div className="text-6xl mb-4 font-black opacity-30 text-accent">Y</div>
        <p>Select a file to edit or open AI Chat to begin.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full">
      <MonacoEditor
        height="100%"
        language={language}
        theme="yazici-dark"
        value={code}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
          roundedSelection: true,
          padding: { top: 16 }
        }}
      />
    </div>
  );
};
