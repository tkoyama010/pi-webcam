# ⭐⭐⭐ pi-webcam ⭐⭐⭐

**pi extension that lets your coding agent see through your webcam.**

`pi-package` — capture webcam snapshots from the terminal agent — no browser, no MCP server, no UI. Just `/camera take` and the image is in context.

---

## What it does

- `/camera take` — captures a snapshot from your default webcam **and delivers the image into the conversation** (starts a turn), so the agent sees the frame immediately — no `read` round-trip
- `/camera list` — lists available camera devices
- `webcam_snapshot` tool — lets the **agent** capture on its own when you ask "what does the camera see?"; the frame comes back inline as image content
- Snapshot also renders inline in the TUI (kitty/iterm2 graphics) via a custom entry renderer
- Works with **text-only models** when paired with [`pi-vision-handoff`](https://github.com/tkoyama010/pi-vision-handoff) (or any vision model natively)
- Cross-platform: macOS (AVFoundation), Linux (v4l2), Windows (DirectShow)

## Installation

### Via pi (recommended)

```bash
pi install git:github.com/tkoyama010/pi-webcam
```

To pin a specific version:
```bash
pi install git:github.com/tkoyama010/pi-webcam@v0.1.0
```

### Manual

```bash
git clone https://github.com/tkoyama010/pi-webcam.git ~/.pi/agent/extensions/pi-webcam
```

Or symlink:
```bash
git clone https://github.com/tkoyama010/pi-webcam.git ~/src/pi-webcam
ln -s ~/src/pi-webcam/src/index.ts ~/.pi/agent/extensions/pi-webcam.ts
```

## Usage

```
> /camera take
# Captures from default camera, saves to /tmp/pi-webcam-*.jpg, shows the frame and sends it to the agent

> /camera take /dev/video0
# Captures from a specific camera device (path or device identifier)

> /camera list
# Lists all detected camera devices
```

After capture, the agent reads the image automatically and can describe it, answer questions, or take action.

## Requirements

- **ffmpeg** — must be installed and in PATH
  - macOS: `brew install ffmpeg`
  - Linux: `apt install ffmpeg`
  - Windows: download from [ffmpeg.org](https://ffmpeg.org)

## How it works

This extension shells out to `ffmpeg` to capture a single frame from the system webcam. `/camera take` sends the image into the conversation via `sendUserMessage` (text path + inline jpeg) and renders it in the TUI through a custom entry. The `webcam_snapshot` tool returns the same frame as tool result content, so a multimodal model sees it directly; on text-only models, `pi-vision-handoff` (or a similar vision proxy) describes the image so the model can reason about it.

No web server. No UI. No extra ports.

## Compared to mcp-webcam

| | pi-webcam | mcp-webcam |
|---|---|---|
| Type | Native pi extension | MCP server |
| UI | None | Browser (React) |
| Setup | Install extension | Run server + configure MCP client |
| Transport | Direct ffmpeg call | MCP protocol over HTTP/stdio |
| Vision | Any model (handoff if needed) | Requires multimodal client |
| Footprint | ~50 lines | ~30+ dependencies |

If you already have `pi` and `ffmpeg`, this is a 10-second install.

## License

MIT
