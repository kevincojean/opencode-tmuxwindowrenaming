# How Session Switching Works

## The Solution

Session switching in OpenCode doesn't fire `tui.session.select` events to plugins. Instead, we detect session switches by:

**Using the `chat.message` hook** - Any message (user or assistant) indicates which session is currently active.

## How It Works

1. **When you send a message** to a session:
   - The `chat.message` hook fires with the `sessionID`
   - Plugin checks if this is a different session than the current active one
   - If yes, it switches the tracked active session
   - Updates the tmux window name accordingly

2. **Getting the session title**:
   - First checks the local cache (from `session.created` events)
   - If not cached, fetches the session from the server using `ctx.client.session.get()`
   - Falls back to shortened session ID if fetch fails

3. **Updating the window name**:
   - Uses the session title if available
   - Otherwise uses first 8 characters of session ID

## Why This Works

When you switch sessions using `/sessions` or Ctrl+X L:
- You **don't** get any immediate events
- But when you **send the first message** in that session, the plugin detects the switch
- The window name updates to reflect the new session

## Behavior

- **Switch sessions silently**: Window name doesn't change until you interact
- **Send a message**: Window name immediately updates to the new session
- **View old session**: Window name stays as-is (read-only doesn't trigger updates)
- **Send message in old session**: Window name switches back to that session

This is actually desirable behavior - the window name reflects the **active/interactive** session, not just which one you're viewing.

## Example Flow

```
1. You're in "Session A" (oc-Session-A)
2. Switch to "Session B" with /sessions
   → Window name still shows: oc-Session-A
3. Type a message in Session B
   → chat.message hook fires
   → Plugin detects: active session changed to B
   → Window name updates to: oc-Session-B
4. Switch back to Session A with Ctrl+X L
   → Window name still shows: oc-Session-B
5. Type a message in Session A
   → Window name updates to: oc-Session-A
```

## Alternative Considered

We tried listening for `tui.session.select` events, but those aren't available in the plugin event stream. The `chat.message` approach is simpler and more reliable.
