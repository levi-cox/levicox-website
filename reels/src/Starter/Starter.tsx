import React from "react";
import { AbsoluteFill } from "remotion";
import { Captions, type CaptionPage } from "../shared/Captions";
import { UI_FONT } from "../shared/font";
import { BRAND } from "../shared/palette";
import { SAFE } from "../shared/safe";

// Placeholder reel to check the setup. Real reels replace the background with
// <OffthreadVideo src={staticFile("master.mp4")} /> built by the reels-editor pipeline.
const pages: CaptionPage[] = [
  { text: "Remotion is set up", startMs: 300, endMs: 2200 },
  { text: "Ready to edit reels", startMs: 2300, endMs: 4800 },
];

export const Starter: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BRAND.navy }}>
    <AbsoluteFill
      style={{
        paddingTop: SAFE.top,
        paddingLeft: SAFE.side,
        paddingRight: SAFE.side,
        alignItems: "center",
      }}
    >
      <div style={{ fontFamily: UI_FONT, fontWeight: 800, fontSize: 64, color: BRAND.cream, textAlign: "center" }}>
        LEVI COX <span style={{ color: BRAND.red }}>FITNESS</span>
      </div>
    </AbsoluteFill>
    <Captions pages={pages} />
  </AbsoluteFill>
);
