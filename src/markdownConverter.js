/**
 * Harmony2FreeboxRCMapper - Markdown Converter
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fs = require('fs');

function markdownToHtml(markdown) {
  let html = markdown;

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code>${escapedCode}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.replace(/^> \*\*(.+?)\*\* (.+)$/gm, '<div class="note"><strong>$1</strong> $2</div>');
  html = html.replace(/^> (.+)$/gm, '<div class="note">$1</div>');

  html = html.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
    const headers = header
      .split('|')
      .filter((h) => h.trim())
      .map((h) => `<th>${h.trim()}</th>`)
      .join('');
    const rowsHtml = rows
      .trim()
      .split('\n')
      .map((row) => {
        const cells = row
          .split('|')
          .filter((c) => c.trim())
          .map((c) => `<td>${c.trim()}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
  });

  html = html
    .split('\n\n')
    .map((para) => {
      para = para.trim();
      if (!para) return '';
      if (
        para.startsWith('<h') ||
        para.startsWith('<ul') ||
        para.startsWith('<ol') ||
        para.startsWith('<pre') ||
        para.startsWith('<div') ||
        para.startsWith('<table')
      ) {
        return para;
      }
      return `<p>${para}</p>`;
    })
    .join('\n');

  return html;
}

function generateHelpPage(readmePath) {
  const markdown = fs.readFileSync(readmePath, 'utf8');
  const content = markdownToHtml(markdown);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harmony2FreeboxRCMapper - Documentation</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap" />
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            line-height: 1.6;
        }

        .common-header {
            background: white;
            padding: 15px 30px;
            border-bottom: 2px solid #6200ea;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .common-header h1 {
            margin: 0;
            color: #6200ea;
            font-size: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .common-header-nav {
            display: flex;
            gap: 15px;
            align-items: center;
        }

        .common-header-nav a {
            color: #6200ea;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 4px;
            transition: background 0.3s;
            font-size: 14px;
        }

        .common-header-nav a:hover {
            background: #f0f0f0;
        }

        .common-header-nav a.active {
            background: #e8eaf6;
            font-weight: 500;
        }

        .common-header-nav button {
            background: #6200ea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }

        .common-header-nav button:hover {
            background: #4a00b0;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .content {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        h1 {
            color: #1976d2;
            margin-bottom: 20px;
            font-size: 32px;
        }

        h2 {
            color: #333;
            margin-top: 40px;
            margin-bottom: 20px;
            font-size: 24px;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
        }

        h3 {
            color: #555;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 20px;
        }

        h4 {
            color: #666;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 16px;
        }

        p {
            margin-bottom: 15px;
            color: #555;
        }

        ul, ol {
            margin-bottom: 20px;
            margin-left: 30px;
        }

        li {
            margin-bottom: 8px;
            color: #555;
        }

        code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #d32f2f;
        }

        pre {
            background: #263238;
            color: #aed581;
            padding: 20px;
            border-radius: 5px;
            overflow-x: auto;
            margin-bottom: 20px;
        }

        pre code {
            background: none;
            color: #aed581;
            padding: 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }

        th {
            background: #1976d2;
            color: white;
            font-weight: 500;
        }

        tr:hover {
            background: #f5f5f5;
        }

        .note {
            background: #e3f2fd;
            border-left: 4px solid #1976d2;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }

        strong {
            color: #333;
        }

        a {
            color: #1976d2;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            .content {
                padding: 20px;
            }

            .container {
                padding: 20px 10px;
            }

            h1 {
                font-size: 24px;
            }

            h2 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="common-header">
        <h1>
            <span style="font-size: 24px;">📚</span>
            Harmony2FreeboxRCMapper - Documentation
        </h1>
        <div class="common-header-nav">
            <button id="toggleBtn" onclick="toggleExecution()">⏸️ Disable</button>
            <a href="/">🏠 Main</a>
            <a href="/edit">✏️ Edit</a>
            <a href="/help" class="active">📚 Help</a>
        </div>
    </div>

    <div class="container">
        <div class="content">
            ${content}
        </div>
    </div>

    <script>
        async function toggleExecution() {
            const btn = document.getElementById('toggleBtn');
            try {
                const response = await fetch('/api/toggle-execution', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    btn.textContent = data.enabled ? '⏸️ Disable' : '▶️ Enable';
                }
            } catch (err) {
                console.error('Error toggling execution:', err);
            }
        }

        async function loadStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                const btn = document.getElementById('toggleBtn');
                btn.textContent = data.enabled ? '⏸️ Disable' : '▶️ Enable';
            } catch (err) {
                console.error('Error loading status:', err);
            }
        }

        loadStatus();
    </script>
</body>
</html>`;
}

module.exports = { generateHelpPage, markdownToHtml };
