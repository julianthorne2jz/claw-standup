# claw-standup

Generate daily standup reports from git logs and memory files.

## Usage

```bash
# Run from your workspace root
claw-standup [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--days <n>` | Number of days to look back | `1` |
| `--path <dir>` | Workspace directory to scan | Current dir (`.`) |
| `--author <name>` | Git author to filter by | `git config user.name` |
| `--ai` | Enable AI summarization via `gemini` CLI | `false` |
| `--json` | Output JSON instead of Markdown | `false` |

## Examples

```bash
# Standard daily standup
claw-standup

# Monday morning check (last 3 days)
claw-standup --days 3

# Generate JSON for another tool
claw-standup --days 1 --json

# AI Summary (requires gemini CLI)
claw-standup --days 1 --ai
```

## How It Works

1.  **Scans Git:** Recursively finds git repositories in the target path and fetches commits by the author.
2.  **Reads Memory:** specific `memory/YYYY-MM-DD.md` files are read for the date range.
3.  **Compiles:** Merges code activity and memory logs into a Markdown report.
