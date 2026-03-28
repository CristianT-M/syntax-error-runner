import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const app = express();
const execAsync = promisify(exec);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;

const LANGUAGE_CONFIG = {
  javascript: {
    filename: 'index.js',
    command: 'node index.js',
  },
  python: {
    filename: 'main.py',
    command: 'python main.py',
  },
  cpp: {
    filename: 'main.cpp',
    command: process.platform === 'win32'
      ? 'g++ main.cpp -o app.exe && app.exe'
      : 'g++ main.cpp -o app && ./app',
  },
};

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'syntax-error-runner' });
});

app.post('/run', async (req, res) => {
  const { language, code, filename } = req.body;

  const config = LANGUAGE_CONFIG[language];

  if (!config) {
    return res.status(400).json({ output: 'Limbaj nesuportat' });
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-'));
  const filePath = path.join(tempDir, filename || config.filename);

  try {
    await fs.writeFile(filePath, code, 'utf8');

    const { stdout, stderr } = await execAsync(config.command, {
      cwd: tempDir,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });

    res.json({ output: `${stdout}${stderr}` || 'Programul a rulat fără output.' });
  } catch (err) {
    res.status(500).json({
      output: err?.stderr || err?.stdout || err?.message || 'Eroare la execuție.',
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

app.listen(PORT, () => {
  console.log(`Runner pornit pe ${PORT}`);
});