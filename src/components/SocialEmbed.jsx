import React, { useEffect, useRef } from "react";
import { getSocialPlatform, loadInstagramEmbedScript, loadTwitterEmbedScript } from "../utils/socialEmbed";

/**
 * Renders a live Instagram or X (Twitter) post using their own official,
 * free embed widgets. Falls back to nothing (caller should show their own
 * placeholder) if the URL isn't a recognized post link.
 */
export default function SocialEmbed({ url }) {
  const containerRef = useRef(null);
  const platform = getSocialPlatform(url);

  useEffect(() => {
    if (platform === "instagram") {
      loadInstagramEmbedScript().then(() => {
        window.instgrm?.Embeds?.process();
      }).catch(() => {});
    } else if (platform === "twitter") {
      loadTwitterEmbedScript().then(() => {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          window.twttr?.widgets?.createTweet(
            url.split("/status/")[1]?.split(/[/?]/)[0],
            containerRef.current,
            { theme: "light", dnt: true }
          );
        }
      }).catch(() => {});
    }
  }, [url, platform]);

  if (platform === "instagram") {
    return (
      <div className="w-full flex justify-center overflow-hidden">
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          style={{ margin: 0, maxWidth: "100%", minWidth: "260px" }}
        />
      </div>
    );
  }

  if (platform === "twitter") {
    return <div ref={containerRef} className="w-full flex justify-center overflow-hidden" />;
  }

  return null;
}

export { getSocialPlatform };
