import React from "react";
import { Composition } from "remotion";
import { Starter } from "./Starter/Starter";

// Every reel: 1080x1920, 30 fps. Add one <Composition> per reel (src/<ReelName>/).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Starter"
      component={Starter}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={150}
    />
  </>
);
