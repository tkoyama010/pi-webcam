import { execSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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
      // NOTE: `-list_devices` is not a v4l2 option in ffmpeg — it only exists for
      // avfoundation (macOS) and dshow (Windows). Linux listing goes through
      // listLinuxDevices() below.
      listArgs: [],
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

/**
 * Linux: enumerate /dev/video* directly and keep only nodes that carry a video
 * stream (ffprobe probe). UVC cameras expose a metadata node (e.g. /dev/video1)
 * next to the capture node; capturing from the metadata node fails, so it must
 * not be offered as a device.
 *
 * Returns [] only when /dev has no video nodes at all. On probe failure (camera
 * busy, ffprobe missing) returns the raw node list — better to show a device
 * that may fail on `take` than to hide cameras that are merely busy.
 */
function listLinuxDevices(): string[] {
  let nodes: string[] = [];
  try {
    nodes = readdirSync("/dev")
      .filter((f) => /^video\d+$/.test(f))
      .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
      .map((f) => `/dev/${f}`);
  } catch {
    return [];
  }
  if (nodes.length === 0) return [];

  const captureNodes = nodes.filter((node) => {
    try {
      const out = execSync(
        `ffprobe -v error -f v4l2 -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 ${node}`,
        { encoding: "utf8", stdio: "pipe", timeout: 5000 },
      );
      return out.includes("video");
    } catch {
      return false;
    }
  });
  return captureNodes.length > 0 ? captureNodes : nodes;
}

function listDevices(): string[] {
  if (process.platform === "linux") return listLinuxDevices();
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

function capture(device?: string): CaptureResult {
  const cfg = getPlatformConfig();
  const outputPath = join(tmpdir(), `pi-webcam-${Date.now()}.jpg`);

  // clean up previous snapshots so $TMPDIR doesn't accumulate them
  try {
    const existing = execSync(`ls -t ${join(tmpdir(), "pi-webcam-*.jpg")} 2>/dev/null || true`, {
      encoding: "utf8",
      stdio: "pipe",
    });
    for (const file of existing.split("\n")) {
      const trimmed = file.trim();
      if (trimmed && existsSync(trimmed)) unlinkSync(trimmed);
    }
  } catch {
    // cleanup is best-effort
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
        ctx.ui.notify(
          `Camera devices:\n${devices.map((d, i) => `  [${i}] ${d}`).join("\n")}`,
          "info",
        );
        return;
      }

      if (action === "take") {
        const device = parts.slice(1).join(" ") || "";
        const result = capture(device);
        if (result.success) {
          ctx.ui.notify(`Snapshot saved: ${result.path}`, "info");
        } else {
          ctx.ui.notify(`Capture failed: ${result.error}`, "error");
        }
        return;
      }

      ctx.ui.notify(`Unknown action: ${action}. Use 'take' or 'list'.`, "warning");
    },
  });
}
