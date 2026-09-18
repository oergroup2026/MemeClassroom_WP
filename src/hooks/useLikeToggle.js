import { useState } from "react";
import { doc, deleteDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Toggle-like for memes: creates/deletes a /likes doc and keeps
 * /memes/{memeId}.likes_count and /user_stats/{creatorId}.total_likes_received
 * in sync, with per-meme pending/animation state for the heart icon.
 *
 * `userLikesMap` (memeId -> that like doc's id, for the current user) is
 * owned by the caller — populated by a live subscription elsewhere on the
 * page, same as before this was extracted.
 */
export function useLikeToggle({ user, userLikesMap, onSignedOut }) {
  const [likePendingMap, setLikePendingMap] = useState({});
  const [animatingHeartMemeId, setAnimatingHeartMemeId] = useState(null);

  const toggleLike = async (memeId, creatorId) => {
    if (!user) { onSignedOut?.(); return; }
    if (likePendingMap[memeId]) return;

    setLikePendingMap((prev) => ({ ...prev, [memeId]: true }));
    setAnimatingHeartMemeId(memeId);
    setTimeout(() => setAnimatingHeartMemeId(null), 300);

    const existingLikeId = userLikesMap[memeId];
    const statsRef = doc(db, "user_stats", creatorId);
    const memeRef = doc(db, "memes", memeId);

    try {
      if (existingLikeId) {
        await deleteDoc(doc(db, "likes", existingLikeId)).catch(() => {});
        await setDoc(statsRef, { total_likes_received: increment(-1) }, { merge: true }).catch(() => {});
        await setDoc(memeRef, { likes_count: increment(-1) }, { merge: true });
      } else {
        const likeDocId = `${user.uid}_${memeId}`;
        await setDoc(doc(db, "likes", likeDocId), {
          user_id: user.uid,
          meme_id: memeId,
          created_at: serverTimestamp(),
        }, { merge: true });
        await setDoc(statsRef, { total_likes_received: increment(1) }, { merge: true }).catch(() => {});
        await setDoc(memeRef, { likes_count: increment(1) }, { merge: true });
      }
    } catch (e) {
      console.error("Like toggle failed", e);
    } finally {
      setLikePendingMap((prev) => ({ ...prev, [memeId]: false }));
    }
  };

  return { likePendingMap, animatingHeartMemeId, toggleLike };
}
