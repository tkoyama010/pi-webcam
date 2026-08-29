# ⭐⭐⭐ pi-webcam ⭐⭐⭐

**pi extension that lets your coding agent see through your webcam.**

`pi-package` — capture webcam snapshots from the terminal agent — no browser, no MCP server, no UI. Just `/camera take` and the image is in context.

---

## What it does

- `/camera take` — captures a snapshot from your default webcam
- `/camera list` — lists available camera devices
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
# Captures from default camera, saves to /tmp/pi-webcam-*.jpg

> /camera take --device 1
# Uses a specific camera device

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

This extension shells out to `ffmpeg` to capture a single frame from the system webcam. The image file path is returned in the tool result, and the agent's `read` tool picks it up. On text-only models, `pi-vision-handoff` (or a similar vision proxy) describes the image so the model can reason about it.

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
