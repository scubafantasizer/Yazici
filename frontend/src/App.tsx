import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FileEntry { name: string; path: string; isDir: boolean; size: number; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ─── API helpers ─────────────────────────────────────────────────────────────
const api = {
  getFiles: (dir = '') => fetch(`/api/files?path=${encodeURIComponent(dir)}`).then(r => r.json()),
  getFile:  (p: string) => fetch(`/api/file?path=${encodeURIComponent(p)}`).then(r => r.json()),
  saveFile: (p: string, content: string) =>
    fetch('/api/file', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p, content }) }).then(r => r.json()),
  getKeys: () => fetch('/api/keys').then(r => r.json()),
  addKey: (provider: string, key: string) =>
    fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }) }).then(r => r.json()),
  setSudo: (password: string) =>
    fetch('/api/keys/sudo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }) }).then(r => r.json()),
  hasSudo: () => fetch('/api/keys/sudo/status').then(r => r.json()),
};

// ─── FileTree ────────────────────────────────────────────────────────────────
function FileTree({ onSelect }: { onSelect: (path: string) => void }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async (dir = '') => {
    const data = await api.getFiles(dir);
    setFiles(prev => {
      const filtered = prev.filter(f => !f.path.startsWith(dir) || f.path === dir);
      return [...filtered, ...(data.files || [])];
    });
  }, []);

  useEffect(() => { load(''); }, [load]);

  const toggle = async (f: FileEntry) => {
    if (!f.isDir) { onSelect(f.path); return; }
    const next = new Set(expanded);
    if (next.has(f.path)) { next.delete(f.path); } else { next.add(f.path); await load(f.path); }
    setExpanded(next);
  };

  const rootFiles = files.filter(f => !f.path.includes('/') || f.path.split('/').length === (f.path.startsWith('/') ? 2 : 1));

  return (
    <div className="file-tree">
      <div className="panel-header">
        <span>📁 Files</span>
        <button className="icon-btn" onClick={() => load('')} title="Refresh">↺</button>
      </div>
      <div className="file-list">
        {files.filter(f => f.path.split('/').length === 1).map(f => (
          <FileNode key={f.path} file={f} expanded={expanded} allFiles={files} onToggle={toggle} />
        ))}
        {files.length === 0 && <div className="empty-note">Workspace boş</div>}
      </div>
    </div>
  );
}

function FileNode({ file, expanded, allFiles, onToggle }: {
  file: FileEntry; expanded: Set<string>; allFiles: FileEntry[];
  onToggle: (f: FileEntry) => void;
}) {
  const isExpanded = expanded.has(file.path);
  const children = allFiles.filter(f => {
    const parts = f.path.split('/');
    const parentParts = file.path.split('/');
    return parts.length === parentParts.length + 1 && f.path.startsWith(file.path + '/');
  });

  return (
    <div className="file-node">
      <div className="file-item" onClick={() => onToggle(file)}>
        <span className="file-icon">{file.isDir ? (isExpanded ? '▾ 📂' : '▸ 📁') : '📄'}</span>
        <span className="file-name">{file.name}</span>
      </div>
      {file.isDir && isExpanded && (
        <div className="file-children">
          {children.map(c => (
            <FileNode key={c.path} file={c} expanded={expanded} allFiles={allFiles} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────
function Editor({ filePath, content, onChange, onSave }: {
  filePath: string | null; content: string;
  onChange: (v: string) => void; onSave: () => void;
}) {
  return (
    <div className="editor-area">
      <div className="editor-header">
        <span className="editor-tab">{filePath || 'No file open'}</span>
        <button className="btn btn-primary" onClick={onSave} disabled={!filePath} id="save-btn">
          💾 Save
        </button>
      </div>
      <textarea
        className="code-editor"
        value={content}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Select a file to edit..."
      />
    </div>
  );
}

// ─── Terminal ────────────────────────────────────────────────────────────────
function Terminal() {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef   = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [output, setOutput] = useState<string[]>(['Connected to Yazıcı terminal. Type to begin.\n']);
  const [cmd, setCmd] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/pty`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = e => setOutput(prev => [...prev, e.data]);
    ws.onclose = () => { setConnected(false); setOutput(prev => [...prev, '\n[Disconnected]']); };
    ws.onerror = () => setOutput(prev => [...prev, '\n[Connection Error]']);
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  const sendCmd = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(cmd + '\n');
    setCmd('');
  };

  return (
    <div className="terminal-area">
      <div className="panel-header">
        <span>⚡ Terminal</span>
        <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
      <div className="terminal-output" ref={termRef}>
        {output.map((line, i) => <span key={i}>{line}</span>)}
      </div>
      <div className="terminal-input-row">
        <span className="prompt">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendCmd()}
          placeholder="Enter command..."
          id="terminal-input"
        />
        <button className="btn btn-send" onClick={sendCmd} id="terminal-run-btn">Run</button>
      </div>
    </div>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState('gemini');
  const [key, setKey]           = useState('');
  const [sudoPass, setSudoPass] = useState('');
  const [keys, setKeys]         = useState<any>({});
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    api.getKeys().then(setKeys);
  }, []);

  const saveKey = async () => {
    if (!provider || !key) return;
    await api.addKey(provider, key);
    setKey('');
    setMsg('✓ API Key saved!');
    const updated = await api.getKeys();
    setKeys(updated);
    setTimeout(() => setMsg(''), 2000);
  };

  const saveSudo = async () => {
    if (!sudoPass) return;
    await api.setSudo(sudoPass);
    setSudoPass('');
    setMsg('✓ Sudo password saved!');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙ Settings</h2>
          <button className="icon-btn" onClick={onClose} id="close-settings-btn">✕</button>
        </div>

        <section className="settings-section">
          <h3>API Keys</h3>
          <div className="input-row">
            <select value={provider} onChange={e => setProvider(e.target.value)} className="select">
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="groq">Groq</option>
            </select>
            <input className="input" type="password" value={key} placeholder="API Key"
              onChange={e => setKey(e.target.value)} />
            <button className="btn btn-primary" onClick={saveKey} id="save-api-key-btn">Save</button>
          </div>
          <div className="keys-list">
            {Object.entries(keys).map(([prov, keyArr]: any) => (
              <div key={prov} className="key-entry">
                <span className="badge">{prov}</span>
                {keyArr.map((k: any) => <span key={k.index} className="key-preview">{k.preview}</span>)}
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>Sudo Password</h3>
          <div className="input-row">
            <input className="input" type="password" value={sudoPass} placeholder="sudo password"
              onChange={e => setSudoPass(e.target.value)} />
            <button className="btn btn-primary" onClick={saveSudo} id="save-sudo-btn">Save</button>
          </div>
          <p className="hint">Stored encrypted. AI never sees this.</p>
        </section>

        {msg && <div className="success-msg">{msg}</div>}
      </div>
    </div>
  );
}

// ─── Chat ────────────────────────────────────────────────────────────────────
function Chat({ provider, agentMode }: { provider: string; agentMode: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '👋 Merhaba! Ben Yazıcı v4. Sana nasıl yardımcı olabilirim?' }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          provider,
          agentMode,
          strict: false,
        }),
      });

      if (!res.ok) {
        let errStr = `HTTP ${res.status}`;
        try { const d = await res.json(); errStr = d.error || errStr; } catch {}
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Hata: ${errStr}` }]);
        return;
      }

      if (!res.body) { setLoading(false); return; }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiText = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              aiText += data.text;
              setMessages(prev => {
                const arr = [...prev];
                arr[arr.length - 1] = { role: 'assistant', content: aiText };
                return arr;
              });
            } else if (data.type === 'error') {
              aiText += `\n❌ ${data.message}`;
            } else if (data.type === 'action_step') {
              setMessages(prev => {
                const arr = [...prev];
                arr[arr.length - 1] = { role: 'assistant', content: aiText + `\n\`${data.text}\`` };
                return arr;
              });
            }
          } catch { /* partial chunk */ }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-area">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <span className="msg-avatar">{m.role === 'user' ? '🧑' : '🤖'}</span>
            <div className="msg-content">{m.content || (loading && i === messages.length - 1 ? '…' : '')}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Yaz ve Enter'a bas..."
          rows={2}
          id="chat-input"
          disabled={loading}
        />
        <button
          className={`btn btn-send ${loading ? 'loading' : ''}`}
          onClick={sendMessage}
          disabled={loading}
          id="send-btn"
        >
          {loading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal'>('editor');
  const [filePath, setFilePath]   = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider]   = useState('gemini');
  const [agentMode, setAgentMode] = useState<'mono' | 'multi'>('mono');

  const openFile = async (p: string) => {
    try {
      const data = await api.getFile(p);
      setFilePath(p);
      setFileContent(data.content || '');
      setActiveTab('editor');
    } catch { /* ignore */ }
  };

  const saveFile = async () => {
    if (!filePath) return;
    await api.saveFile(filePath, fileContent);
  };

  return (
    <div className="ide-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">✦ Yazıcı</div>
        <FileTree onSelect={openFile} />
      </aside>

      {/* Main */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="tab-group">
            <button className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')} id="tab-editor">Editor</button>
            <button className={`tab ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')} id="tab-terminal">Terminal</button>
          </div>
          <div className="topbar-controls">
            <select className="select-sm" value={provider} onChange={e => setProvider(e.target.value)} id="provider-select">
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="groq">Groq</option>
            </select>
            <button
              className={`btn-tiny ${agentMode === 'multi' ? 'active' : ''}`}
              onClick={() => setAgentMode(m => m === 'mono' ? 'multi' : 'mono')}
              id="agent-mode-btn"
              title="Toggle Mono/Multi agent"
            >
              {agentMode === 'mono' ? '◉ Mono' : '⬡ Multi'}
            </button>
            <button className="btn-tiny" onClick={() => setShowSettings(true)} id="settings-btn">⚙</button>
          </div>
        </header>

        {/* Content */}
        <div className="content-area">
          <div className="left-content">
            {activeTab === 'editor'
              ? <Editor filePath={filePath} content={fileContent} onChange={setFileContent} onSave={saveFile} />
              : <Terminal />}
          </div>
          <div className="chat-panel">
            <div className="panel-header">🤖 AI Assistant <span className="badge">{agentMode}</span></div>
            <Chat provider={provider} agentMode={agentMode} />
          </div>
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
