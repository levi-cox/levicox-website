# Reels (Remotion)

Video-editing project for vertical Instagram Reels (1080×1920, 30 fps), used with the
`reels-editor` skill in `../.agents/skills/reels-editor`. Kept in its own folder so it
doesn't mix with the website files.

```bash
cd reels
bun install
bun run dev                              # Remotion Studio (live preview)
bun run preview Starter out/preview.mp4  # 540p preview render
bun run render  Starter out/final.mp4    # full-res render
bun run reel:encode -- ...               # final Instagram export (see skill docs)
```

- One folder per reel in `src/<ReelName>/`, registered in `src/Root.tsx`.
- Shared pieces live in `src/shared/` (safe area, font, palette, captions).
- Footage, renders, `work/`, `out/` and `public/` media are git-ignored.
