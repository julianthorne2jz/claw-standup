# claw-standup

## Install

```bash
git clone https://github.com/julianthorne2jz/claw-standup
cd claw-standup
npm link
```

Now you can use `claw-standup` from anywhere.


Generate daily standup reports from git logs and memory.

## Installation

```bash
npm install -g claw-standup
# or
npx claw-standup
```

## Usage

```bash
claw-standup [options]
```

## Options

- `--days <n>`: Number of days to look back (default: 1)
- `--path <dir>`: Workspace directory to scan (default: current dir)
- `--author <name>`: Git author to filter by (default: git config user.name)
- `--ai`: Enable AI summarization via 'gemini' CLI (default: false)
- `--human, -H    Human-readable output (default: JSON) instead of Markdown
- `--help`: Show help

## Examples

```bash
# Generate report for today
claw-standup

# Look back 3 days
claw-standup --days 3

# Scan a specific workspace
claw-standup --path ../other-workspace

# Enable AI summary
claw-standup --ai
```

## License

MIT © Julian Thorne
