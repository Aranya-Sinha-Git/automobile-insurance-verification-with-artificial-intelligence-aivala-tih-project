import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import {
  SecurityGatewayError,
  verifyClaimWithSecurityBackend,
} from "@/app/utils/securityBackendService";
import { offlineStorage } from "@/app/utils/offlineStorage";
import { analysisStorageKey } from "@/app/utils/securityBackendService";
import { accountStorageKey, readAccountJson, writeAccountJson } from "@/app/utils/accountStorage";

type InferenceState =
  | "preparing"
  | "uploading"
  | "verifying"
  | "detecting"
  | "severity"
  | "saving"
  | "done"
  | "error";

export default function ProcessingScreen() {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<InferenceState>("preparing");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isEvidenceRejected, setIsEvidenceRejected] = useState(false);
  const hasStarted = useRef(false);

  const steps = [
    { key: "preparing", name: "Preparing recording" },
    { key: "uploading", name: "Sending claim" },
    { key: "verifying", name: "Verifying recording" },
    { key: "detecting", name: "Detecting damage" },
    { key: "severity", name: "Assessing severity" },
    { key: "saving", name: "Saving result" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === state);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    (window as any).aivalaActiveClaimId = claimId;

    let cancelled = false;

    async function runPipeline() {
      try {
        setState("preparing");
        setStatusMsg("Preparing your saved recording…");

        const savedClaim = claimId
          ? await offlineStorage.getClaimAsync(claimId)
          : null;
        // A reopened claim must always use its own persisted evidence. The
        // transient global is only relevant before a draft has been persisted.
        const videoFile: Blob | File | null =
          savedClaim
            ? savedClaim.videoBlob instanceof Blob
              ? savedClaim.videoBlob
              : null
            : (window as any).currentClaimVideoFile || null;
        if (savedClaim) {
          delete (window as any).currentClaimVideoFile;
          delete (window as any).currentClaimThumbnail;
        }

        if (!videoFile || videoFile.size < 10) {
          throw new Error(
            "No valid evidence recording found. Please go back and record the evidence again.",
          );
        }

        setState("uploading");
        setStatusMsg("Sending claim to the verification service…");
        const result = await verifyClaimWithSecurityBackend(videoFile, claimId!, (msg) => {
          if (cancelled) return;
          const lower = msg.toLowerCase();
          if (lower.includes("complete")) setState("saving");
          else if (lower.includes("yolo") || lower.includes("analysis")) setState("detecting");
          else if (lower.includes("evidence") || lower.includes("verification")) setState("verifying");
          setStatusMsg(msg);
        }, savedClaim?.videoFileName);

        if (cancelled) return;

        delete (window as any).currentClaimVideoFile;
        delete (window as any).currentClaimThumbnail;
        localStorage.removeItem(accountStorageKey("claimCapture"));
        setState("done");
        setTimeout(() => {
          if (!cancelled) navigate(`/app/results/${claimId}`);
        }, result.isRejected ? 0 : 800);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[ProcessingScreen] Pipeline failed:", err);

        if (
          err instanceof SecurityGatewayError &&
          err.category === "invalid_evidence"
        ) {
          if (claimId) {
            await offlineStorage.updateClaim(
              claimId,
              { status: "rejected", rejectionReason: err.message },
              false,
            );
            const localClaims = readAccountJson<any[]>("claims", []);
            writeAccountJson(
              "claims",
              localClaims.map((claim: any) =>
                claim.id === claimId
                  ? { ...claim, status: "rejected", rejectionReason: err.message }
                  : claim,
              ),
              );
            try {
              const storageKey = analysisStorageKey(claimId);
              const syntheticRejection = {
                annotated_image: "",
                detection_frames: [],
                detections: [],
                summary: err.message,
                costBreakdown: { totalCost: 0, items: [] },
                estimatedCost: 0,
                fraudAnalysis: { totalScore: 100, riskLevel: "high" },
                fraudScore: 100,
                damageAreas: [],
                isAiGenerated: false,
                isRejected: true,
                rejectionReason: err.message,
              };
              localStorage.setItem(storageKey, JSON.stringify(syntheticRejection));
            } catch {
              // Ignore localStorage quota errors; the claim record still has the reason.
            }
          }
          setIsEvidenceRejected(true);
          setState("error");
          setErrorMsg(err.message);
          toast.error("Evidence video rejected. Please record it again.");
          return;
        }

        if (
          err instanceof SecurityGatewayError &&
          err.category === "invalid_media"
        ) {
          setIsEvidenceRejected(true);
          setState("error");
          setErrorMsg(err.message);
          toast.error("Recording could not be read. Please record it again.");
          return;
        }

        if (err instanceof SecurityGatewayError && !err.retryable) {
          setState("error");
          setErrorMsg(err.message);
          toast.error(err.message);
          return;
        }

        const queuedClaim = claimId
          ? await offlineStorage.getClaimAsync(claimId)
          : null;
        if (queuedClaim?.videoBlob instanceof Blob) {
          await offlineStorage.updateClaim(
            claimId!,
            { status: "pending_upload" },
            true,
          );
          const localClaims = readAccountJson<any[]>("claims", []);
          writeAccountJson(
            "claims",
            localClaims.map((claim: any) =>
              claim.id === claimId
                ? { ...claim, status: "pending_upload" }
                : claim,
            ),
          );
          toast.info("Verification service unavailable. Your recording has been saved and can be retried.");
          navigate("/app/dashboard");
          return;
        }
        setState("error");
        setErrorMsg(err.message || "Pipeline execution failed.");
      }
    }

    runPipeline();

    return () => {
      cancelled = true;
      if ((window as any).aivalaActiveClaimId === claimId) {
        delete (window as any).aivalaActiveClaimId;
      }
    };
  }, [claimId, navigate]);

  const handleRetry = () => {
    hasStarted.current = false;
    setState("preparing");
    setErrorMsg("");
    setStatusMsg("");
    // Re-trigger the effect
    hasStarted.current = false;
    window.location.reload();
  };

  const handleGoBack = () => {
    if (isEvidenceRejected) {
      delete (window as any).currentClaimVideoFile;
      delete (window as any).currentClaimThumbnail;
      navigate("/app/video-recording");
      return;
    }
    navigate("/app/new-claim");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-4">
          {state === "error" ? (
            <div className="inline-block mb-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
          ) : state === "done" ? (
            <div className="inline-block mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          ) : (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="inline-block mb-4"
            >
              <Loader2 className="h-12 w-12 text-blue-600" />
            </motion.div>
          )}

          <h1 className="text-xl font-semibold mb-1">
            {state === "error"
              ? isEvidenceRejected
                ? "Evidence Needs Re-recording"
                : "Analysis Failed"
              : state === "done"
                ? "Analysis Complete!"
                : "Processing Your Claim"}
          </h1>
          <p className="text-xs text-gray-500">Claim ID: {claimId}</p>
          {statusMsg && state !== "error" && (
            <p className="text-xs text-blue-600 mt-2 min-h-4 animate-pulse">{statusMsg}</p>
          )}
        </div>

        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Status</span>
                <span className="font-medium">{state === "done" ? "Complete" : state === "error" ? "Needs attention" : "In progress"}</span>
              </div>
              <div className="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full" aria-label="Processing in progress">
                <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => {
                const isCurrent = step.key === state;
                const isCompleted = state === "done";

                return (
                  <motion.div
                    key={step.key}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-all ${
                      isCurrent && state !== "error"
                        ? "bg-blue-50/80 border border-blue-200/80 shadow-xs"
                        : isCompleted
                        ? "bg-gray-50/60"
                        : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 p-1 rounded-full ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-600"
                          : isCurrent && state !== "error"
                            ? "bg-blue-100 text-blue-600"
                            : state === "error" && isCurrent
                              ? "bg-red-100 text-red-600"
                              : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : isCurrent && state !== "error" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      ) : state === "error" && isCurrent ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex items-center justify-center text-[9px] text-gray-400">
                          {index}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-xs ${
                            isCompleted || isCurrent
                                ? "font-semibold text-gray-900"
                                : "text-gray-400"
                          }`}
                        >
                          {step.name}
                        </p>
                        {isCurrent && state !== "error" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full animate-pulse">
                            PROCESSING
                          </span>
                        ) : isCompleted ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            COMPLETE
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Error state with retry */}
        {state === "error" && (
          <Card className="bg-red-50 border-red-200 mb-4">
            <CardContent className="p-4">
              <p className="text-sm text-red-700 mb-3">{errorMsg}</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleGoBack}
                >
                  {isEvidenceRejected ? "Record Again" : "Go Back"}
                </Button>
                {!isEvidenceRejected && (
                  <Button className="flex-1" onClick={handleRetry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
