# Gallery preview assets

Files in this directory back the pi package gallery preview at
<https://pi.dev/packages>.

## screenshot.png

Static preview shown on the gallery card. Referenced from `package.json`:

```json
"pi": {
  "image": "https://raw.githubusercontent.com/tkoyama010/pi-webcam/main/docs/screenshot.png"
}
```

Recommended: 1280×720 or 1600×900 PNG/GIF, ≤ 500 KB.

Capture it by running the extension in the pi TUI:

```
pi -e ./src/index.ts
> /camera take
```

Then screenshot the TUI showing the capture notification and the agent
describing the frame.

## demo.mp4 (optional)

If a short screencast better shows the flow, add `docs/demo.mp4` and switch
`package.json` to:

```json
"pi": {
  "extensions": ["./src/index.ts"],
  "video": "https://raw.githubusercontent.com/tkoyama010/pi-webcam/main/docs/demo.mp4"
}
```

MP4 only, ≤ 10 MB. On the gallery, video autoplays on hover (desktop) and
takes precedence over `image` when both are set.
