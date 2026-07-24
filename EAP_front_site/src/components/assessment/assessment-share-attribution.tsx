"use client";

import { useEffect } from "react";
import { verifiedIncomingAssessmentShareCode } from "@/lib/assessment/assessment-share-state";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useQuizSession } from "@/lib/stores/quiz-session";

interface AssessmentShareAttributionProps {
  assessmentId: string;
  assessmentVersion: number;
  expectedShareCode?: string | null;
  incomingShareCode?: string | null;
}

/**
 * Keeps QR attribution separate from the sharing UI.
 *
 * This component belongs only on a published assessment entry route. Mounting
 * it on report pages would incorrectly overwrite the source of an in-progress
 * assessment session.
 */
export function AssessmentShareAttribution({
  assessmentId,
  assessmentVersion,
  expectedShareCode = null,
  incomingShareCode = null,
}: AssessmentShareAttributionProps) {
  const accountId = useAuthStore((state) => state.user?.id);
  const ensureAccount = useQuizSession((state) => state.ensureAccount);
  const ensureVersion = useQuizSession((state) => state.ensureVersion);
  const setShareCode = useQuizSession((state) => state.setShareCode);
  const currentAttemptId = useQuizSession((state) =>
    state.assessmentVersions[assessmentId] === assessmentVersion
      ? state.attemptIds[assessmentId]
      : undefined
  );

  useEffect(() => {
    const syncAttribution = () => {
      if (accountId == null) return;

      // Account and version normalization must happen before reading the
      // attempt. Both operations are synchronous Zustand updates.
      ensureAccount(accountId);
      ensureVersion(assessmentId, assessmentVersion);

      const verifiedCode = verifiedIncomingAssessmentShareCode(
        incomingShareCode,
        expectedShareCode
      );
      if (!verifiedCode) {
        // A normal entry without a share parameter may be resuming the same
        // attempt, so it must not erase a previously verified attribution.
        return;
      }
      const attemptId = useQuizSession
        .getState()
        .getAttemptId(assessmentId, assessmentVersion);
      if (!attemptId) return;
      setShareCode(
        assessmentId,
        assessmentVersion,
        attemptId,
        verifiedCode
      );
    };
    if (useQuizSession.persist.hasHydrated()) {
      syncAttribution();
      return;
    }
    return useQuizSession.persist.onFinishHydration(syncAttribution);
  }, [
    accountId,
    assessmentId,
    assessmentVersion,
    currentAttemptId,
    ensureAccount,
    ensureVersion,
    expectedShareCode,
    incomingShareCode,
    setShareCode,
  ]);

  return null;
}
