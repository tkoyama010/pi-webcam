import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Cross-platform camera capture for pi.
// Requires ffmpeg in PATH.
//
// Commands:
//   /camera take [device]  — capture a snapshot
//   /camera list            — list available camera devices

interface CaptureResult {
  success: boolean;
  path: string;
  error?: string;
}

interface PlatformConfig {
  videoInput: string;
  listArgs: string[];
  listParse: (output: string) => string[];
  format: string;
}

function getPlatformConfig(): PlatformConfig {
  const platform = process.platform;

  if (platform === "darwin") {
    return {
      videoInput: "avfoundation",
      listArgs: ["-f", "avfoundation", "-list_devices", "true", "-i", ""],
      listParse: (output: string) =>
        output
          .split("\n")
          .filter((line) => /^\s*\[AVFoundation/.test(line))
          .map((line) => {
            const match = line.match(/\[(AVFoundation|AVF)\]\s*\[.+\]\s*(.+)/);
            return match ? match[2].trim() : "";
          })
          .filter(Boolean),
      format: "default",
    };
  }

  if (platform === "linux") {
    return {
      videoInput: "v4l2",
      listArgs: ["-f", "v4l2", "-list_devices", "true", "-i", ""],
      listParse: (output: string) =>
        output
          .split("\n")
          .filter((line) => /\/dev\/video/.test(line))
          .map((line) => {
            const match = line.match(/\[.+\]\s*\[.+\]\s*(.+)/);
            return match ? match[1].trim() : "";
          })
          .filter(Boolean),
      format: "/dev/video0",
    };
  }

  // Windows
  return {
    videoInput: "dshow",
    listArgs: ["-f", "dshow", "-list_devices", "true", "-i", ""],
    listParse: (output: string) =>
      output
        .split("\n")
        .filter((line) => /\[dshow/.test(line) && /video/.test(line))
        .map((line) => {
          const match = line.match(/"([^"]+)"\s*\(video\)/);
          return match ? match[1] : "";
        })
        .filter(Boolean),
    format: "video=Integrated Camera",
  };
}

function capture(device: string): CaptureResult {
  const cfg = getPlatformConfig();
  const timestamp = Date.now();
  const outputPath = join(tmpdir(), `pi-webcam-${timestamp}.jpg`);

  // Clean up old captures (keep last 5)
  try {
    const existing = execSync(`ls -t ${join(tmpdir(), "pi-webcam-*.jpg")} 2>/dev/null || true`, {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const old of existing.slice(5)) {
      if (existsSync(old)) unlinkSync(old);
    }
  } catch {
    // ignore
  }

  const args = [
    "-f",
    cfg.videoInput,
    "-video_size",
    "1280x720",
    "-i",
    device || cfg.format,
    "-update",
    "1",
    "-frames:v",
    "1",
    "-y",
    outputPath,
  ];

  try {
    execSync(`ffmpeg ${args.join(" ")}`, { encoding: "utf8", stdio: "pipe" });
    if (existsSync(outputPath)) {
      return { success: true, path: outputPath };
    }
    return { success: false, path: "", error: "Capture succeeded but no file was created" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // ffmpeg exits non-zero on list_devices, but capture should succeed
    if (existsSync(outputPath)) {
      return { success: true, path: outputPath };
    }
    return { success: false, path: "", error: message };
  }
}

function listDevices(): string[] {
  const cfg = getPlatformConfig();
  try {
    const output = execSync(`ffmpeg ${cfg.listArgs.join(" ")} 2>&1`, {
      encoding: "utf8",
    });
    return cfg.listParse(output);
  } catch {
    return [];
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("camera", {
    description: "Capture webcam snapshots — /camera take [device] | /camera list",
    getArgumentCompletions(prefix: string) {
      const subs = ["take", "list"];
      const matches = subs.filter((s) => s.startsWith(prefix));
      return matches.length > 0 ? matches.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const action = parts[0]?.toLowerCase();

      if (!action || action === "help") {
        ctx.ui.notify("Usage: /camera take [device] | /camera list", "info");
        return;
      }

      if (action === "list") {
        const devices = listDevices();
        if (devices.length === 0) {
          ctx.ui.notify("No camera devices found. Is ffmpeg installed?", "warning");
          return;
        }
        ctx.ui.notify(`Camera devices:\n${devices.map((d, i) => `  [${i}] ${d}`).join("\n")}`, "info");
        return;
      }

      if (action === "take") {
        const device = parts.slice(1).join(" ") || "";
        const result = capture(device);

        if (result.success) {
          ctx.ui.notify(`Snapshot saved: ${result.path}`, "success");
        } else {
          ctx.ui.notify(`Capture failed: ${result.error}`, "error");
        }
        return;
      }

      ctx.ui.notify(`Unknown action: ${action}. Use 'take' or 'list'.`, "warning");
    },
  });
}
