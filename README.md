# OpenCode Tmux Plugin

An OpenCode plugin that automatically updates your tmux window name based on the current OpenCode session.

## Features

- Automatically renames tmux window when a new OpenCode session starts
- Updates window name when you switch between sessions
- Updates window name when session title changes
- Restores the original window name when OpenCode closes (or falls back to the prefix)
- Tracks all main sessions (ignores subagent sessions)
- Safe: only runs if you're inside a tmux session

## Installation

Add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "@kevincojean/opencode-tmuxwindowrenaming"
  ]
}
```

Restart OpenCode or start a new session to activate the plugin.

## How It Works

The plugin listens to OpenCode session events and chat messages:

- **session.created**: When a main session (non-subagent) is created, it stores the session
- **session.updated**: When the session title changes, it updates the window name
- **chat.message**: When you send a message in a different session, it detects the switch and updates the window name
- **session.deleted**: When a session ends, it removes it from tracking
- **server.instance.disposed**: When OpenCode shuts down, it restores the original window name (captured at startup) or falls back to the prefix (default `[OC] `)

**Note**: The window name updates when you **send a message** in a session, not immediately when you switch using `/sessions`. This means the window reflects the session you're actively working in.

## Development

- **Watch mode**: `npm run watch` - automatically rebuilds on file changes
- **Manual build**: `npm run build`

## Configuration

The plugin accepts the following configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxLength` | number | `60` | Max length for the tmux window name |
| `waitingIndicator` | string | `"● "` | Prefix when waiting for input, set to `""` to disable |
| `namePrefix` | string | `"[OC] "` | Window name prefix |
| `logFile` | string | *(none)* | Path to log file. If omitted, logging is disabled. |

Example configuration in `opencode.json`:

```json
{
  "plugin": [
    [
      "/absolute/path/to/opencode-tmux-plugin",
      {
        "maxLength": 60,
        "waitingIndicator": "⏳ ",
        "namePrefix": "[OC] ",
        "logFile": "/tmp/tmux-plugin.log"
      }
    ]
  ]
}
```

All options are optional. Omitting an option uses its default value.

## Requirements

- tmux must be installed
- OpenCode must be running inside a tmux session
- The `TMUX` environment variable must be set (automatic when inside tmux)

## Troubleshooting

- Check that you're running OpenCode inside a tmux session: `echo $TMUX`
- Look for plugin logs in OpenCode's output (they start with `[tmux-plugin]`)
- Verify the plugin is registered in `~/.config/opencode/opencode.json`
- Make sure the plugin is built: check that `dist/index.js` exists
- If your tmux theme (e.g., Nord) shows a white/reversed window status bar, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#common-issues) for a fix
