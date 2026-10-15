import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Count one view of a meme / resource / newspaper item by the signed-in user.
 *
 * Writes a receipt /views/{uid}_{kind}_{itemId}; a Cloud Function
 * (functions/derivedData.js viewCreated) adds 1 to the item's view_count.
 * The receipt id makes each person count once per item, ever: a repeat write
 * is an update, which firestore.rules denies, and is silently ignored here.
 * Guests are not counted.
 *
 * @param {"memes"|"resources"|"newspaper_items"} kind
 */
export function recordView(user, kind, itemId) {
  if (!user?.uid || !itemId) return Promise.resolve();
  return setDoc(doc(db, "views", `${user.uid}_${kind}_${itemId}`), {
    user_id: user.uid,
    kind,
    item_id: itemId,
    created_at: serverTimestamp(),
  }).catch(() => {});
}
