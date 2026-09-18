import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Award a badge to a user if they don't already have one matching `badgeName`
 * (or any name in `matchNames`, for badges that were renamed at some point —
 * e.g. "Authorized" used to be written as "Authorised User"). Idempotent:
 * safe to call on every render/login without creating duplicates.
 *
 * Pass `existingBadges` (an array of already-loaded badge docs, e.g. from a
 * live onSnapshot subscription the caller already has) to skip the Firestore
 * existence query entirely.
 *
 * Returns true if a badge was newly awarded, false otherwise.
 */
export async function awardBadgeIfMissing({
  uid,
  badgeName,
  matchNames,
  category,
  level = 1,
  badgeIcon = "award",
  description = "",
  existingBadges = null,
  announce = true,
}) {
  if (!uid || uid === "guest_dev") return false;
  const names = matchNames || [badgeName];

  let alreadyHas;
  if (existingBadges) {
    alreadyHas = existingBadges.some((b) => names.includes(b.badge_name));
  } else {
    try {
      const snap = await getDocs(
        query(
          collection(db, "badges"),
          where("user_id", "==", uid),
          where("badge_name", "in", names)
        )
      );
      alreadyHas = !snap.empty;
    } catch (err) {
      console.error(`Could not verify existing badge "${badgeName}"`, err);
      alreadyHas = false;
    }
  }
  if (alreadyHas) return false;

  try {
    await addDoc(collection(db, "badges"), {
      user_id: uid,
      category,
      level,
      badge_name: badgeName,
      badge_icon: badgeIcon,
      description,
      awarded_at: serverTimestamp(),
    });
    if (announce) {
      const badgeDetails = { title: "you earned a badge", badgeName, description };
      sessionStorage.setItem("mc_pending_badge_popup", JSON.stringify(badgeDetails));
      window.dispatchEvent(new CustomEvent("mc_badge_earned", { detail: badgeDetails }));
    }
    return true;
  } catch (err) {
    console.error(`Failed to award badge "${badgeName}"`, err);
    return false;
  }
}
