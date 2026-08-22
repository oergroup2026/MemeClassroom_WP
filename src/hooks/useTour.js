import { useState, useEffect, useCallback } from "react";
import { TOUR_SCRIPTS } from "../constants/tourScripts";

/**
 * Custom hook to manage tour state per page.
 * Tracks completion and skip states in localStorage.
 * 
 * @param {string} pageKey - Key corresponding to TOUR_SCRIPTS (e.g., 'lab', 'library')
 * @param {boolean} autoStart - Whether to automatically start on first visit
 */
export const useTour = (pageKey, autoStart = true) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSkippedTour, setHasSkippedTour] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);

  const storageKey = `memeclassroom_tour_${pageKey}`;
  const script = TOUR_SCRIPTS[pageKey] || null;
  const totalSteps = script?.steps?.length || 0;

  // Initialize status from localStorage
  useEffect(() => {
    try {
      const status = localStorage.getItem(storageKey);
      if (status === "completed") {
        setHasCompletedTour(true);
        setHasSkippedTour(false);
      } else if (status === "skipped") {
        setHasSkippedTour(true);
        setHasCompletedTour(false);
      } else if (!status && autoStart && totalSteps > 0) {
        // First visit: wait briefly for DOM elements to mount, then open tour
        const timer = setTimeout(() => {
          setIsTourOpen(true);
          setCurrentStep(0);
        }, 700);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn("Tour localStorage error", e);
    }
  }, [storageKey, autoStart, totalSteps]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourOpen(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Completed all steps
      try {
        localStorage.setItem(storageKey, "completed");
      } catch (e) {}
      setHasCompletedTour(true);
      setHasSkippedTour(false);
      setIsTourOpen(false);
    }
  }, [currentStep, totalSteps, storageKey]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "skipped");
    } catch (e) {}
    setHasSkippedTour(true);
    setIsTourOpen(false);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
    setHasSkippedTour(false);
    setHasCompletedTour(false);
    startTour();
  }, [storageKey, startTour]);

  return {
    isTourOpen,
    currentStep,
    totalSteps,
    currentStepData: script?.steps?.[currentStep] || null,
    pageTitle: script?.pageTitle || "",
    hasSkippedTour,
    hasCompletedTour,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    resetTour,
  };
};
