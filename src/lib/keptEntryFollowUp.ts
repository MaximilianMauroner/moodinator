import { shouldOfferCrisisSupport } from "./crisisSupport";

export type KeptEntryFollowUp = {
  /** Severe ratings show support before anything else. */
  supportFirst: boolean;
  /** Shown right away, or after "Not now" when support comes first. */
  then: "detail" | "toast";
};

/**
 * What happens after one tap keeps an entry. The detail sheet opens when any
 * quick-entry field is on; otherwise a toast with Undo confirms the entry.
 */
export function getKeptEntryFollowUp(mood: number, offersDetail: boolean): KeptEntryFollowUp {
  return {
    supportFirst: shouldOfferCrisisSupport(mood),
    then: offersDetail ? "detail" : "toast",
  };
}
