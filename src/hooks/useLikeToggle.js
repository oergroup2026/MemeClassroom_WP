import { useState } from "react";
import { doc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Toggle-like for memes: creates/deletes a /likes doc, with per-meme
 * pending/animation state for the heart icon. /memes/{memeId}.likes_count and
 * /user_stats/{creatorId}.total_likes_received are updated by Cloud Functions
 * (functions/derivedData.js) when the like doc is created/deleted — clients
 * are not allowed to write those numbers.
 *
 * `userLikesMap` (memeId -> that like doc's id, for the current user) is
 * owned by the caller — populated by a live subscription elsewhere on the
 * page, same as before this was extracted.
 */
export function useLikeToggle({ user, userLikesMap, onSignedOut }) {
  const [likePendingMap, setLikePendingMap] = useState({});
  const [animatingHeartMemeId, setAnimatingHeartMemeId] = useState(null);

  const toggleLike = async (memeId) => {
    if (!user) { onSignedOut?.(); return; }
    if (likePendingMap[memeId]) return;

    setLikePendingMap((prev) => ({ ...prev, [memeId]: true }));
    setAnimatingHeartMemeId(memeId);
    setTimeout(() => setAnimatingHeartMemeId(null), 300);

    const existingLikeId = userLikesMap[memeId];
    try {
      if (existingLikeId) {
        await deleteDoc(doc(db, "likes", existingLikeId));
      } else {
        const likeDocId = `${user.uid}_${memeId}`;
        await setDoc(doc(db, "likes", likeDocId), {
          user_id: user.uid,
          meme_id: memeId,
          created_at: serverTimestamp(),
        }, { merge: true });
      }
    } catch (e) {
      console.error("Like toggle failed", e);
    } finally {
      setLikePendingMap((prev) => ({ ...prev, [memeId]: false }));
    }
  };

  return { likePendingMap, animatingHeartMemeId, toggleLike };
}
