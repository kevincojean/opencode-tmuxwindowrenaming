# Troubleshooting & Setup Guide

## What We Learned

The plugin now correctly handles these OpenCode events:
- `session.created` - Fires when a new session starts
- `session.updated` - Fires when session metadata (like title) changes  
- `session.deleted` - Fires when a session ends
- `session.idle` - Fires when a session goes idle
- `server.instance.disposed` - Fires when OpenCode shuts down

Each event has a `properties.info` object containing the full `Session` with `id`, `title`, and `parentID`.

## Setup Checklist

1. **Plugin is registered**: ✅ (checked in `~/.config/opencode/opencode.json`)
2. **Plugin is built**: ✅ (dist/index.js exists)
3. **Running in tmux**: ✅ (TMUX env var is set)
4. **OpenCode needs restart**: ⚠️  **IMPORTANT - You must completely exit and restart OpenCode**

## How to Restart OpenCode Properly

OpenCode plugins are loaded at startup. To activate the plugin:

1. **Exit OpenCode completely** (not just end the current session)
2. **Restart OpenCode** from your terminal
3. **Check for plugin logs** - You should see:
   ```
   [tmux-plugin] ========================================
   [tmux-plugin] Plugin initialized!
   [tmux-plugin] Running in tmux: true
   [tmux-plugin] TMUX env var: /private/tmp/tmux-501/default,1455,0
   [tmux-plugin] Working directory: /path/to/your/project
   [tmux-plugin] ========================================
   ```

## Debugging

The plugin now has verbose logging. When it runs, you'll see:

- **On plugin load**: Initialization banner with tmux status
- **On session creation**: Details about the session (ID, name, parent)
- **On session update**: When session metadata changes
- **On session deletion**: When a session ends
- **On window rename**: Success or failure messages

## Expected Behavior

When you start a new OpenCode session:
1. You should see `[tmux-plugin] Event received: session.created`
2. Followed by `[tmux-plugin] This is a MAIN session, tracking it`
3. Then `[tmux-plugin] Updated tmux window name to: oc-<name>`
4. Your tmux window name should change to `oc-<session-name>` or `oc-<8-char-id>`

## Testing Manually

If the plugin still doesn't work after restarting OpenCode, try this manual test:

```bash
# Test if tmux rename works from command line
tmux rename-window "oc-test"

# Check current window name
tmux display-message -p '#W'
```

## Common Issues

1. **Plugin not loading**
   - Make sure you completely exited and restarted OpenCode
   - Check that the path in opencode.json is absolute: `/absolute/path/to/opencode-tmux-plugin`

2. **No logs appearing**
   - Plugin might not be loading at all
   - Verify package.json has correct "main" field pointing to "dist/index.js"
   - Check that dist/index.js exists and is up to date

3. **Tmux window not renaming**
   - Verify you're in tmux: `echo $TMUX` should output something
   - Test manual rename: `tmux rename-window "test"`
   - Check for error messages in the plugin logs

4. **Window status turns white / reverse video (Nord theme)**
   - **Symptom**: Window status bar background flips from blue/dark to white when the plugin renames windows
   - **Cause**: tmux defaults `window-status-activity-style` and `window-status-bell-style` to `reverse`. The `rename-window` command can trigger a bell flag (e.g., from shell/terminal title integration), which applies the `reverse` attribute — swapping fg/bg colors. Themes like Nord that don't override these defaults inherit the inversion.
   - **Fix**: Add these lines to your `tmux.conf` **after** loading the Nord theme:
     ```tmux
     set -g window-status-activity-style none
     set -g window-status-bell-style none
     ```
   - **References**: [nord-tmux#28](https://github.com/nordtheme/tmux/issues/28), [nord-tmux#91](https://github.com/nordtheme/tmux/pull/91)

## Quick Test After Restart

After restarting OpenCode, look for these log messages in your terminal:
1. `[tmux-plugin] Plugin initialized!` - Plugin loaded
2. `[tmux-plugin] Running in tmux: true` - Tmux detected
3. `[tmux-plugin] Event received: session.created` - Session started
4. `[tmux-plugin] Updated tmux window name to: oc-...` - Window renamed

If you don't see these messages, the plugin isn't loading.
