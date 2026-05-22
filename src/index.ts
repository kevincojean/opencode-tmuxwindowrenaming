import type { Plugin, PluginOptions } from "@opencode-ai/plugin";
import type { Session } from "@opencode-ai/sdk";
import { exec } from "child_process";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const DEFAULTS = {
  maxLength: 60,
  waitingIndicator: "● ",
  namePrefix: "[OC] ",
} as const;

type TmuxPluginOptions = PluginOptions & {
  /** Max length for session name */
  maxLength?: number;
  /** Prefix when waiting for input, set to "" to disable */
  waitingIndicator?: string;
  /** Window name prefix */
  namePrefix?: string;
  /** Path to log file. If omitted, logging is disabled. */
  logFile?: string;
};

const createLogger = (logFile?: string) => {
  if (!logFile) return () => {};

  try {
    mkdirSync(dirname(logFile), { recursive: true });
  } catch {}

  return (message: string) => {
    const timestamp = new Date().toISOString();
    try {
      appendFileSync(logFile, `[${timestamp}] ${message}\n`);
    } catch {}
  };
};

const TmuxPlugin: Plugin = async (ctx, options?: TmuxPluginOptions) => {
  const isInTmux = (): boolean => !!process.env.TMUX;

  if (!isInTmux()) {
    return {};
  }

  const maxLength = options?.maxLength ?? DEFAULTS.maxLength;
  const waitingIndicator = options?.waitingIndicator ?? DEFAULTS.waitingIndicator;
  const namePrefix = options?.namePrefix ?? DEFAULTS.namePrefix;

  const sessions = new Map<string, Session>();
  let activeSessionId: string | null = null;
  let currentWindowName: string | null = null;
  let originalWindowName: string | null = null;
  let isWaitingForInput = false;

  const log = createLogger(options?.logFile);
  log("Plugin initialized");
  log(`TMUX env: ${process.env.TMUX || "(not set)"}`);
  log(`Directory: ${ctx.directory}`);

  // Capture our window ID at init — stable across user window switches
  let windowId: string | null = null;
  try {
    const { stdout } = await execAsync("tmux display-message -p '#{window_id}'");
    windowId = stdout.trim();
    log(`Window ID: ${windowId}`);
  } catch (error) {
    log(`Failed to get window ID: ${error}`);
  }

  // Capture original window name before we rename it
  if (windowId) {
    try {
      const { stdout } = await execAsync(`tmux display-message -t ${windowId} -p '#{window_name}'`);
      originalWindowName = stdout.trim();
      log(`Original window name captured: ${originalWindowName}`);
    } catch (error) {
      log(`Failed to capture original window name: ${error}`);
    }
  }

  const targetFlag = (): string => windowId ? ` -t ${windowId}` : "";

  const updateTmuxWindowName = async (sessionName: string): Promise<void> => {
    try {
      const prefix = isWaitingForInput ? waitingIndicator : "";
      const sanitizedName = sessionName.replace(/[^a-zA-Z0-9-_]/g, "-");
      const truncatedName = sanitizedName.slice(0, maxLength);
      const windowName = `${prefix}${namePrefix}${truncatedName}`;

      if (currentWindowName === windowName) return;

      await execAsync(`tmux rename-window${targetFlag()} "${windowName}"`);
      currentWindowName = windowName;
      log(`Window renamed to: ${windowName}`);
    } catch (error) {
      log(`Failed to rename window: ${error}`);
    }
  };

  const resetTmuxWindowName = async (): Promise<void> => {
    try {
      const nameToRestore = originalWindowName ?? namePrefix;
      await execAsync(`tmux rename-window${targetFlag()} "${nameToRestore}"`);
      currentWindowName = nameToRestore;
      log(`Window restored to: ${nameToRestore}`);
    } catch (error) {
      log(`Failed to reset window: ${error}`);
    }
  };

  try {
    await execAsync(`tmux rename-window${targetFlag()} "${namePrefix}"`);
    currentWindowName = namePrefix;
    log(`Initial window name set: ${namePrefix}`);
  } catch (error) {
    log(`Failed to set initial window name: ${error}`);
  }
  return {
    "chat.message": async (input, output) => {
      log(`chat.message: sessionID=${input.sessionID}, active=${activeSessionId}`);
      if (input.sessionID && input.sessionID !== activeSessionId) {
        activeSessionId = input.sessionID;
        
        const sessionInfo = sessions.get(input.sessionID);
        if (sessionInfo) {
          const sessionName = sessionInfo.title || sessionInfo.id.slice(0, 8);
          log(`Switching to cached session: ${sessionName}`);
          await updateTmuxWindowName(sessionName);
        } else {
          try {
            const response = await ctx.client.session.get({ path: { id: input.sessionID } });
            if (response.data) {
              sessions.set(input.sessionID, response.data);
              const sessionName = response.data.title || response.data.id.slice(0, 8);
              log(`Switching to fetched session: ${sessionName}`);
              await updateTmuxWindowName(sessionName);
            } else {
              log(`Session not found, using ID prefix`);
              await updateTmuxWindowName(input.sessionID.slice(0, 8));
            }
          } catch (error) {
            log(`Failed to fetch session: ${error}`);
            await updateTmuxWindowName(input.sessionID.slice(0, 8));
          }
        }
      }
    },
    
    event: async (input) => {
      const { event } = input;
      const props = event.properties as Record<string, unknown> | undefined;
      log(`event hook: ${event.type}`);

      if (event.type === "session.created") {
        const sessionInfo = props?.info as Session | undefined;
        if (!sessionInfo) return;

        if (!sessionInfo.parentID) {
          sessions.set(sessionInfo.id, sessionInfo);
          log(`session.created: ${sessionInfo.id}, title: ${sessionInfo.title || "(none)"}`);
          if (!activeSessionId) {
            activeSessionId = sessionInfo.id;
            const sessionName = sessionInfo.title || sessionInfo.id.slice(0, 8);
            await updateTmuxWindowName(sessionName);
          }
        }
      }

      if (event.type === "session.updated") {
        const sessionInfo = props?.info as Session | undefined;
        if (sessionInfo && !sessionInfo.parentID) {
          sessions.set(sessionInfo.id, sessionInfo);
          log(`session.updated: ${sessionInfo.id}, title: ${sessionInfo.title || "(none)"}`);
          if (sessionInfo.id === activeSessionId) {
            const sessionName = sessionInfo.title || sessionInfo.id.slice(0, 8);
            await updateTmuxWindowName(sessionName);
          }
        }
      }

      if (event.type === "session.deleted") {
        const sessionInfo = props?.info as Session | undefined;
        if (sessionInfo) {
          log(`session.deleted: ${sessionInfo.id}`);
          sessions.delete(sessionInfo.id);
          if (sessionInfo.id === activeSessionId) {
            activeSessionId = null;
            isWaitingForInput = false;
            await resetTmuxWindowName();
          }
        }
      }

      if (event.type === "session.idle") {
        const sessionID = props?.sessionID as string | undefined;
        if (sessionID === activeSessionId) {
          isWaitingForInput = true;
          const sessionInfo = sessions.get(sessionID);
          const sessionName = sessionInfo?.title || sessionID.slice(0, 8);
          log(`session.idle: ${sessionName}`);
          await updateTmuxWindowName(sessionName);
        }
      }

      if (event.type === "session.status") {
        const sessionID = props?.sessionID as string | undefined;
        const status = props?.status as { type: string } | undefined;
        if (sessionID === activeSessionId && status?.type === "busy") {
          isWaitingForInput = false;
          const sessionInfo = sessions.get(sessionID);
          const sessionName = sessionInfo?.title || sessionID.slice(0, 8);
          log(`session.status busy: ${sessionName}`);
          await updateTmuxWindowName(sessionName);
        }
      }

      if ((event as any).type === "permission.asked") {
        const sessionID = props?.sessionID as string | undefined;
        if (sessionID === activeSessionId) {
          isWaitingForInput = true;
          const sessionInfo = sessions.get(sessionID);
          const sessionName = sessionInfo?.title || sessionID.slice(0, 8);
          log(`permission.asked: ${sessionName}`);
          await updateTmuxWindowName(sessionName);
        }
      }

      if ((event as any).type === "question.asked") {
        const sessionID = props?.sessionID as string | undefined;
        if (sessionID === activeSessionId) {
          isWaitingForInput = true;
          const sessionInfo = sessions.get(sessionID);
          const sessionName = sessionInfo?.title || sessionID.slice(0, 8);
          log(`question.asked: ${sessionName}`);
          await updateTmuxWindowName(sessionName);
        }
      }

      if ((event as any).type === "tui.session.select") {
        const sessionID = props?.sessionID as string | undefined;
        if (sessionID && sessionID !== activeSessionId) {
          activeSessionId = sessionID;
          isWaitingForInput = true;
          const sessionInfo = sessions.get(sessionID);
          if (sessionInfo) {
            const sessionName = sessionInfo.title || sessionInfo.id.slice(0, 8);
            log(`tui.session.select: ${sessionName}`);
            await updateTmuxWindowName(sessionName);
          } else {
            log(`tui.session.select: (unknown session)`);
            await updateTmuxWindowName(sessionID.slice(0, 8));
          }
        }
      }

      if (event.type === "server.instance.disposed") {
        log("server.instance.disposed");
        activeSessionId = null;
        isWaitingForInput = false;
        sessions.clear();
        await resetTmuxWindowName();
      }
    },
  };
};

export default TmuxPlugin;
