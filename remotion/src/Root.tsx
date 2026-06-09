import "./index.css";
import { Composition } from "remotion";
import { HERO_DURATION, SOCIAL_DURATION } from "./choreography";
import { QuiltMerge } from "./QuiltMerge";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="hero"
        component={QuiltMerge}
        durationInFrames={HERO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showCta: false }}
      />
      <Composition
        id="social"
        component={QuiltMerge}
        durationInFrames={SOCIAL_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showCta: true }}
      />
    </>
  );
};
