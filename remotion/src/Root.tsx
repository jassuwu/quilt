import "./index.css";
import { Composition } from "remotion";
import { HERO_DURATION, SOCIAL_DURATION } from "./choreography";
import { QuiltShow } from "./QuiltShow";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="hero"
        component={QuiltShow}
        durationInFrames={HERO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ sound: false, showCta: false, lockCamera: true }}
      />
      <Composition
        id="social"
        component={QuiltShow}
        durationInFrames={SOCIAL_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ sound: true, showCta: true }}
      />
    </>
  );
};
