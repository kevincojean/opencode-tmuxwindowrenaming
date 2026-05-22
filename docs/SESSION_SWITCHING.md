# OpenCode Tmux Plugin - Session Switching Update

## What Changed

The plugin now supports **session switching**! Previously, it only tracked one main session. Now it:

1. **Tracks all main sessions** (non-subagent) in a Map
2. **Tracks the currently active session**
3. **Detects when you switch between sessions** using the `tui.session.select` event
4. **Updates the tmux window name** whenever you switch to a different session

## How Session Switching Works

When you switch sessions in OpenCode (using `/sessions`, `/resume`, or `Ctrl+X L`), the plugin:

1. Receives a `tui.session.select` event with the new `sessionID`
2. Looks up the session from its internal cache
3. Updates the tmux window name to `oc-<new-session-title>`

## Events the Plugin Handles

- `session.created` - Stores new sessions and sets initial window name
- `session.updated` - Updates window name when session title changes
- `tui.session.select` - Detects session switches and updates window name
- `session.deleted` - Removes deleted sessions from tracking
- `server.instance.disposed` - Cleanup when OpenCode closes

## Expected Behavior

1. **Start OpenCode**: Window name becomes `oc-<session-title>` or `oc-<session-id>`
2. **Create new session**: New session is tracked but window name stays the same
3. **Switch to another session**: Window name updates to `oc-<new-session-title>`
4. **Update session title**: Window name updates to reflect new title
5. **Close OpenCode**: Window name resets to `oc`

## Testing

To test session switching:

1. Start OpenCode in a tmux window
2. Start a conversation (tmux window should be renamed)
3. Create a new session with `/new` or Ctrl+N
4. Switch between sessions with `/sessions` or Ctrl+X L
5. Watch the tmux window name update as you switch!

## Technical Notes

- The `tui.session.select` event exists in the OpenCode API but isn't in the standard Plugin Event type union
- We use type assertion `(event as any).type === "tui.session.select"` to access it
- The plugin maintains a `Map<string, Session>` to cache session information
- Only main sessions (without `parentID`) are tracked; subagent sessions are ignored
