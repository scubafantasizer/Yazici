import { Router } from 'express';
import { db, touchProject, contentSize } from '../db/index.js';

// ─── Templates ────────────────────────────────────────────────────────────────

const router = Router();

type TemplateFile = { path: string; content: string };

type Template = {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  tags: string[];
  files: TemplateFile[];
};

const TEMPLATES: Template[] = [
  {
    id: 'node-express',
    name: 'Node.js + Express',
    description: 'REST API server with Express and TypeScript',
    language: 'javascript',
    category: 'web',
    tags: ['node', 'express', 'typescript', 'api'],
    files: [
      { path: 'src/index.ts', content: `import express from 'express';\n\nconst app = express();\nconst PORT = process.env.PORT ?? 3000;\n\napp.use(express.json());\n\napp.get('/', (_req, res) => {\n  res.json({ message: 'Hello from GateAI' });\n});\n\napp.listen(PORT, () => console.log(\`Server on port \${PORT}\`));\n` },
      { path: 'package.json', content: `{\n  "name": "my-api",\n  "version": "1.0.0",\n  "scripts": { "dev": "tsx src/index.ts", "build": "tsc" },\n  "dependencies": { "express": "^5.0.0" },\n  "devDependencies": { "typescript": "^5.0.0", "@types/express": "^5.0.0", "tsx": "^4.0.0" }\n}\n` },
      { path: 'tsconfig.json', content: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "commonjs",\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "strict": true\n  }\n}\n` },
    ],
  },
  {
    id: 'python-fastapi',
    name: 'Python + FastAPI',
    description: 'Async REST API with FastAPI and automatic OpenAPI docs',
    language: 'python',
    category: 'web',
    tags: ['python', 'fastapi', 'async', 'api'],
    files: [
      { path: 'main.py', content: `from fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI(title='My API')\n\nclass Item(BaseModel):\n    name: str\n    value: int\n\n@app.get('/')\ndef root():\n    return {'message': 'Hello from GateAI'}\n\n@app.post('/items')\ndef create_item(item: Item):\n    return item\n` },
      { path: 'requirements.txt', content: `fastapi>=0.100.0\nuvicorn[standard]>=0.23.0\npydantic>=2.0.0\n` },
      { path: 'README.md', content: `# FastAPI App\n\nRun with:\n\`\`\`bash\nuvicorn main:app --reload\n\`\`\`\n` },
    ],
  },
  {
    id: 'go-web',
    name: 'Go HTTP Server',
    description: 'Minimal Go web server with standard library — no dependencies',
    language: 'go',
    category: 'web',
    tags: ['go', 'http', 'minimal'],
    files: [
      { path: 'main.go', content: `package main\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set("Content-Type", "application/json")\n\t\tjson.NewEncoder(w).Encode(map[string]string{"message": "Hello from GateAI"})\n\t})\n\tfmt.Println("Server on :8080")\n\thttp.ListenAndServe(":8080", nil)\n}\n` },
      { path: 'go.mod', content: `module myapp\n\ngo 1.21\n` },
    ],
  },
  {
    id: 'rust-cli',
    name: 'Rust CLI',
    description: 'Minimal Rust binary — start of a CLI tool or systems program',
    language: 'rust',
    category: 'systems',
    tags: ['rust', 'cli', 'systems'],
    files: [
      { path: 'src/main.rs', content: `fn main() {\n    println!("Hello from GateAI!");\n\n    let args: Vec<String> = std::env::args().collect();\n    if args.len() > 1 {\n        println!("Got args: {:?}", &args[1..]);\n    }\n}\n` },
      { path: 'Cargo.toml', content: `[package]\nname = "my-cli"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n` },
    ],
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Fast React SPA with Vite, TypeScript, and Tailwind',
    language: 'javascript',
    category: 'frontend',
    tags: ['react', 'vite', 'typescript', 'tailwind'],
    files: [
      { path: 'src/App.tsx', content: `export default function App() {\n  return (\n    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">\n      <h1 className="text-4xl font-bold">Hello from GateAI</h1>\n    </div>\n  );\n}\n` },
      { path: 'src/main.tsx', content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode><App /></React.StrictMode>\n);\n` },
      { path: 'src/index.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n` },
      { path: 'package.json', content: `{\n  "name": "my-app",\n  "scripts": { "dev": "vite", "build": "vite build" },\n  "dependencies": { "react": "^18.0.0", "react-dom": "^18.0.0" },\n  "devDependencies": { "vite": "^5.0.0", "@vitejs/plugin-react": "^4.0.0", "typescript": "^5.0.0", "tailwindcss": "^3.0.0", "autoprefixer": "^10.0.0", "postcss": "^8.0.0" }\n}\n` },
      { path: 'vite.config.ts', content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n` },
    ],
  },
  {
    id: 'html-vanilla',
    name: 'HTML + CSS + JS',
    description: 'Classic vanilla web page — no build tools, no frameworks',
    language: 'html',
    category: 'frontend',
    tags: ['html', 'css', 'javascript', 'vanilla'],
    files: [
      { path: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello from GateAI</h1>\n  <script src="app.js"></script>\n</body>\n</html>\n` },
      { path: 'style.css', content: `* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; background: #0d0e14; color: #cdd6f4; padding: 40px; }\nh1 { color: #7c6af7; }\n` },
      { path: 'app.js', content: `console.log('GateAI ready');\n` },
    ],
  },
  {
    id: 'c-kernel-module',
    name: 'Linux Kernel Module',
    description: 'A minimal loadable kernel module with init/exit hooks',
    language: 'c',
    category: 'kernel',
    tags: ['c', 'kernel', 'linux', 'systems'],
    files: [
      { path: 'hello_module.c', content: `#include <linux/init.h>\n#include <linux/module.h>\n#include <linux/kernel.h>\n\nMODULE_LICENSE("GPL");\nMODULE_AUTHOR("GateAI");\nMODULE_DESCRIPTION("A minimal Linux kernel module");\n\nstatic int __init hello_init(void) {\n    printk(KERN_INFO "GateAI module loaded.\\n");\n    return 0;\n}\n\nstatic void __exit hello_exit(void) {\n    printk(KERN_INFO "GateAI module unloaded.\\n");\n}\n\nmodule_init(hello_init);\nmodule_exit(hello_exit);\n` },
      { path: 'Makefile', content: `obj-m += hello_module.o\n\nall:\n\tmake -C /lib/modules/$(shell uname -r)/build M=$(PWD) modules\n\nclean:\n\tmake -C /lib/modules/$(shell uname -r)/build M=$(PWD) clean\n` },
    ],
  },
];

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/api/templates', (req, res) => {
  const { category, language } = req.query as { category?: string; language?: string };
  let list = TEMPLATES;
  if (category) list = list.filter(t => t.category === category);
  if (language) list = list.filter(t => t.language === language);
  res.json(list.map(({ files: _files, ...meta }) => meta));   // don't send files in list
});

router.get('/api/templates/:id', (req, res) => {
  const tpl = TEMPLATES.find(t => t.id === req.params.id);
  if (!tpl) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(tpl);
});

// Apply a template to a project
router.post('/api/projects/:projectId/templates/:templateId', (req, res) => {
  const tpl     = TEMPLATES.find(t => t.id === req.params.templateId);
  if (!tpl) { res.status(404).json({ error: 'Template not found' }); return; }

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const insertFile = db.prepare(
    `INSERT INTO files (project_id, path, content, is_dir, size)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET content = excluded.content, size = excluded.size`,
  );

  const insertAll = db.transaction((files: TemplateFile[]) => {
    for (const f of files) {
      insertFile.run(req.params.projectId, f.path, f.content, contentSize(f.content));
    }
  });

  insertAll(tpl.files);
  touchProject(req.params.projectId!);

  res.json({ ok: true, filesCreated: tpl.files.length, template: tpl.id });
});

export default router;
