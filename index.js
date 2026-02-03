#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const minimist = require('minimist');
const chalk = require('chalk');

const args = minimist(process.argv.slice(2));

if (args.help || args.h) {
  console.log(`
${chalk.bold('claw-standup')} - Generate daily standup reports

${chalk.bold('USAGE')}
  node index.js [options]

${chalk.bold('OPTIONS')}
  --days <n>      Number of days to look back (default: 1)
  --path <dir>    Workspace directory to scan (default: ..)
  --author <name> Git author to filter by (default: git config user.name)
  --ai            Enable AI summarization via 'gemini' CLI (default: false)
  --json          Output JSON instead of Markdown
  --help          Show this help

${chalk.bold('EXAMPLES')}
  node index.js --days 1
  node index.js --ai --days 3
`);
  process.exit(0);
}

const DAYS = parseInt(args.days || 1, 10);
const WORKSPACE = path.resolve(args.path || '.');
const USE_AI = args.ai === true;
const JSON_OUTPUT = args.json === true;

// Get default author
let AUTHOR = args.author;
if (!AUTHOR) {
  try {
    AUTHOR = execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch (e) {
    AUTHOR = ''; // No default author
  }
}

function getRepos(dir) {
  const repos = [];
  
  // Check root dir itself
  if (fs.existsSync(path.join(dir, '.git'))) {
    repos.push(dir);
  }

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return repos;
  }
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
      const fullPath = path.join(dir, entry.name);
      if (fs.existsSync(path.join(fullPath, '.git'))) {
        repos.push(fullPath);
      }
    }
  }
  return repos;
}

function getGitLogs(repoPath, days, author) {
  try {
    // Format: hash|date|msg
    const cmd = `git log --since="${days} days ago" --pretty=format:"%h|%ad|%s" --date=short --no-merges`;
    const authorFilter = author ? ` --author="${author}"` : '';
    const output = execSync(cmd + authorFilter, { cwd: repoPath, encoding: 'utf8' }).trim();
    
    if (!output) return [];

    return output.split('\n').map(line => {
      const [hash, date, msg] = line.split('|');
      return { hash, date, msg, repo: path.basename(repoPath) };
    });
  } catch (e) {
    return [];
  }
}

function getMemoryLogs(days) {
  const memories = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const memPath = path.join(process.cwd(), 'memory', `${dateStr}.md`); // Assume running from workspace root context?
    // Actually, process.cwd() might be claw-standup. 
    // We should look in WORKSPACE/memory if it exists, or process.cwd()/../memory
    
    // Let's try to find memory dir relative to WORKSPACE
    // WORKSPACE is usually .. (workspace root)
    
    let targetMemPath = path.join(WORKSPACE, 'memory', `${dateStr}.md`);
    if (!fs.existsSync(targetMemPath)) {
        // Fallback to process.cwd()/memory (if running from root)
        targetMemPath = path.join(process.cwd(), 'memory', `${dateStr}.md`);
    }

    if (fs.existsSync(targetMemPath)) {
      const content = fs.readFileSync(targetMemPath, 'utf8');
      memories.push({ date: dateStr, content });
    }
  }
  return memories;
}

async function run() {
  if (!JSON_OUTPUT) {
    console.log(chalk.blue(`Scanning ${WORKSPACE} for activity by ${AUTHOR || 'anyone'} over last ${DAYS} days...`));
  }

  const repos = getRepos(WORKSPACE);
  let allCommits = [];

  for (const repo of repos) {
    const commits = getGitLogs(repo, DAYS, AUTHOR);
    if (commits.length > 0) {
      allCommits = allCommits.concat(commits);
    }
  }

  // Sort by date/time (git log is reverse chronological, but we concat multiple repos)
  // We don't have exact time in short date, but okay.
  allCommits.sort((a, b) => b.date.localeCompare(a.date));

  const memories = getMemoryLogs(DAYS);

  const data = {
    range: `${DAYS} days`,
    author: AUTHOR,
    stats: {
      reposTouched: [...new Set(allCommits.map(c => c.repo))].length,
      totalCommits: allCommits.length,
      memoryEntries: memories.length
    },
    commits: allCommits,
    memory: memories
  };

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Markdown Output
  let output = `# Standup Report (${new Date().toISOString().split('T')[0]})\n\n`;
  output += `**Range:** Last ${DAYS} days\n`;
  output += `**Author:** ${AUTHOR}\n`;
  output += `**Activity:** ${data.stats.totalCommits} commits across ${data.stats.reposTouched} repos.\n\n`;

  output += `## 🛠 Code Activity\n`;
  if (allCommits.length === 0) {
    output += `No commits found.\n`;
  } else {
    // Group by Repo
    const byRepo = {};
    allCommits.forEach(c => {
      if (!byRepo[c.repo]) byRepo[c.repo] = [];
      byRepo[c.repo].push(c);
    });

    for (const [repo, commits] of Object.entries(byRepo)) {
      output += `### ${repo}\n`;
      commits.forEach(c => {
        output += `- ${c.date} ${c.msg} \`(${c.hash})\`\n`;
      });
      output += '\n';
    }
  }

  output += `## 🧠 Memory Logs\n`;
  if (memories.length === 0) {
    output += `No memory logs found.\n`;
  } else {
    memories.forEach(m => {
      output += `### ${m.date}\n`;
      // Extract headers or first few lines to avoid dumping whole file
      const summary = m.content.split('\n')
        .filter(l => l.startsWith('#') || l.trim().startsWith('-') || l.trim().length > 0)
        .slice(0, 10) // First 10 interesting lines
        .join('\n');
      output += summary + `\n... (see file for full details)\n\n`;
    });
  }

  // AI Summarization
  if (USE_AI) {
    console.log(chalk.yellow('Generating AI summary with Gemini...'));
    try {
      const prompt = `
You are an AI assistant generating a daily standup report.
Here is the raw activity log for ${AUTHOR} over the last ${DAYS} days.
Summarize this into a concise narrative:
1. What were the main focus areas?
2. What key tools/features were shipped?
3. Any significant blockers or notes from memory?

RAW DATA:
${JSON.stringify(data)}
`;
      // Call gemini CLI
      // Assuming 'gemini' is in path. If not, try absolute path if known, or fail.
      const geminiResult = spawnSync('gemini', [prompt], { encoding: 'utf8' });
      
      if (geminiResult.error) {
         output += `\n## ⚠️ AI Summary Failed\nCould not execute 'gemini' command.\n`;
      } else if (geminiResult.stderr && !geminiResult.stdout) {
         output += `\n## ⚠️ AI Summary Failed\n${geminiResult.stderr}\n`;
      } else {
         output = `# Standup Report (AI Summary)\n\n${geminiResult.stdout}\n\n---\n\n` + output;
      }
    } catch (e) {
      output += `\n## ⚠️ AI Summary Failed\n${e.message}\n`;
    }
  }

  console.log(output);
}

run();
