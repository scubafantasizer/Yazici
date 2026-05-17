"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const child_process_1 = require("child_process");
// ─── Git ──────────────────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
function runGit(cmd, cwd) {
    try {
        const output = (0, child_process_1.execSync)(cmd, {
            encoding: 'utf-8',
            cwd: cwd ?? process.cwd(),
            timeout: 10_000,
            shell: process.platform === 'win32' ? 'cmd' : '/bin/sh',
        });
        return { output: output.trim(), success: true };
    }
    catch (err) {
        const e = err;
        return { output: (e.stderr ?? e.stdout ?? 'git error').trim(), success: false };
    }
}
function isGitRepo(cwd) {
    return runGit('git rev-parse --git-dir', cwd).success;
}
// STATUS
router.get('/api/projects/:projectId/git/status', (req, res) => {
    const cwd = process.cwd();
    if (!isGitRepo(cwd)) {
        res.json({ branch: '', ahead: 0, behind: 0, modified: [], staged: [], untracked: [], deleted: [], isRepo: false });
        return;
    }
    const branch = runGit('git branch --show-current', cwd).output || 'HEAD';
    const statusOut = runGit('git status --porcelain', cwd).output;
    const modified = [], staged = [], untracked = [], deleted = [];
    for (const line of statusOut.split('\n').filter(Boolean)) {
        const x = line[0] ?? ' ', y = line[1] ?? ' ', file = line.slice(3);
        if (x !== ' ' && x !== '?')
            staged.push(file);
        if (y === 'M')
            modified.push(file);
        if (y === 'D' || x === 'D')
            deleted.push(file);
        if (x === '?' && y === '?')
            untracked.push(file);
    }
    let ahead = 0, behind = 0;
    try {
        const ab = runGit('git rev-list --left-right --count @{upstream}...HEAD', cwd).output;
        const parts = ab.split(/\s+/);
        behind = parseInt(parts[0] ?? '0', 10) || 0;
        ahead = parseInt(parts[1] ?? '0', 10) || 0;
    }
    catch { /* no upstream */ }
    res.json({ branch, ahead, behind, modified, staged, untracked, deleted, isRepo: true });
});
// INIT
router.post('/api/projects/:projectId/git/init', (_req, res) => {
    const r = runGit('git init');
    res.json({ success: r.success, output: r.output, hash: null });
});
// COMMIT
router.post('/api/projects/:projectId/git/commit', (req, res) => {
    const { message, stageAll = true } = req.body;
    if (!message) {
        res.status(400).json({ error: 'message required' });
        return;
    }
    if (stageAll)
        runGit('git add -A');
    const safe = message.replace(/"/g, '\\"');
    const r = runGit(`git commit -m "${safe}"`);
    const hash = r.success ? (runGit('git rev-parse --short HEAD').output || null) : null;
    res.json({ success: r.success, output: r.output, hash });
});
// LOG
router.get('/api/projects/:projectId/git/log', (req, res) => {
    const limit = parseInt(req.query.limit ?? '20', 10);
    const r = runGit(`git log --pretty=format:"%H|%s|%an|%aI" -${limit}`);
    if (!r.success) {
        res.json([]);
        return;
    }
    const commits = r.output.split('\n').filter(Boolean).map(line => {
        const [hash, message, author, date] = line.split('|');
        return { hash: hash ?? '', message: message ?? '', author: author ?? '', date: date ?? new Date().toISOString() };
    });
    res.json(commits);
});
// BRANCHES
router.get('/api/projects/:projectId/git/branches', (_req, res) => {
    const r = runGit('git branch -v');
    if (!r.success) {
        res.json([]);
        return;
    }
    const branches = r.output.split('\n').filter(Boolean).map(line => {
        const isCurrent = line.startsWith('*');
        const parts = line.replace(/^\*?\s+/, '').split(/\s+/);
        return { name: parts[0] ?? '', isCurrent, lastCommit: parts[1] ?? null };
    });
    res.json(branches);
});
router.post('/api/projects/:projectId/git/branches', (req, res) => {
    const { name, checkout = true } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Branch name required' });
        return;
    }
    const cmd = checkout ? `git checkout -b ${name}` : `git branch ${name}`;
    const r = runGit(cmd);
    res.status(201).json({ success: r.success, output: r.output });
});
// DIFF
router.get('/api/projects/:projectId/git/diff', (req, res) => {
    const staged = req.query.staged === 'true';
    const file = req.query.file;
    const cmd = staged
        ? `git diff --cached ${file ? `-- "${file}"` : ''}`
        : `git diff ${file ? `-- "${file}"` : ''}`;
    const r = runGit(cmd);
    const filesChanged = r.output.split('\n').filter(l => l.startsWith('diff --git')).length;
    res.json({ unified: r.output || 'No changes', filesChanged });
});
exports.default = router;
