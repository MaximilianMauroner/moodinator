import { shouldOfferCrisisSupport } from "./crisisSupport";

export type KeptEntryFollowUp = "support" | "detail" | "toast";

/**
 * What happens after one tap keeps an entry. Severe ratings always go to
 * support first; otherwise the detail sheet opens when any quick-entry field is
 * on, and a toast with Undo confirms the entry when none is.
 */
export function getKeptEntryFollowUp(mood: number, offersDetail: boolean): KeptEntryFollowUp {
  if (shouldOfferCrisisSupport(mood)) return "support";
  return offersDetail ? "detail" : "toast";
}
