import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { Button } from "@/app/components/ui/button";
import { CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import {
  SecurityGatewayError,
  verifyClaimWithSecurityBackend,
} from "@/app/utils/securityBackendService";
import { offlineStorage } from "@/app/utils/offlineStorage";

type InferenceState =
  | "health_check"
  | "metadata_check"
  | "phash_check"
  | "ela_check"
  | "inference_ledger"
  | "done"
  | "error";

export default function ProcessingScreen() {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<InferenceState>("health_check");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isEvidenceRejected, setIsEvidenceRejected] = useState(false);
  const hasStarted = useRef(false);

  const steps = [
    { key: "health_check", name: "Layer 1: Video Metadata (EXIF)" },
    { key: "metadata_check", name: "Layer 2: Evidence Hashing (pHash)" },
    { key: "phash_check", name: "Layer 3: Visual Tampering (ELA)" },
    { key: "ela_check", name: "Layer 4: Deepfake & Face Liveness" },
    { key: "inference_ledger", name: "Layer 5: Web Reverse Search (Namesake)" },
    { key: "done", name: "Verification Complete" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === state);
  const progress =
    state === "done"
      ? 100
      : state === "error"
        ? Math.max(10, (stepIndex / steps.length) * 100)
        : Math.min(95, ((stepIndex + 0.5) / steps.length) * 100);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    (window as any).aivalaActiveClaimId = claimId;

    let cancelled = false;

    async function runPipeline() {
      try {
        setState("health_check");
        setStatusMsg("Initializing 5-stage security pipeline...");

        const savedClaim = claimId
          ? await offlineStorage.getClaimAsync(claimId)
          : null;
        const videoFile: Blob | File | null =
          (window as any).currentClaimVideoFile || savedClaim?.videoBlob || null;

        if (!videoFile || videoFile.size < 10) {
          throw new Error(
            "No valid evidence recording found. Please go back and record the evidence again.",
          );
        }

        // The gateway runs every security stage and then proxies to YOLO/Qwen.
        // Do not silently bypass it: on failure, the outer handler retains the
        // evidence for retry instead of presenting unverified stages as passed.
        setState("inference_ledger");
        const result = await verifyClaimWithSecurityBackend(videoFile, claimId!, (msg) => {
          if (cancelled) return;
          setStatusMsg(msg);
        });

        if (cancelled) return;

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
            const localClaims = JSON.parse(localStorage.getItem("claims") || "[]");
            localStorage.setItem(
              "claims",
              JSON.stringify(
                localClaims.map((claim: any) =>
                  claim.id === claimId
                    ? { ...claim, status: "rejected", rejectionReason: err.message }
                    : claim,
                ),
              ),
            );
          }
          setIsEvidenceRejected(true);
          setState("error");
          setErrorMsg(err.message);
          toast.error("Evidence video rejected. Please record it again.");
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
          const localClaims = JSON.parse(localStorage.getItem("claims") || "[]");
          localStorage.setItem(
            "claims",
            JSON.stringify(
              localClaims.map((claim: any) =>
                claim.id === claimId
                  ? { ...claim, status: "pending_upload" }
                  : claim,
              ),
            ),
          );
          toast.info("Server unavailable. Claim saved and queued for automatic submission.");
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
    setState("health_check");
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
                <span className="text-gray-600">Overall Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => {
                const isCurrent = step.key === state;
                const isCompleted =
                  state === "done"
                    ? true
                    : index < stepIndex;

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
                            isCompleted || isCurrent ? "font-semibold text-gray-900" : "text-gray-400"
                          }`}
                        >
                          {step.name}
                        </p>
                        {isCurrent && state !== "error" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full animate-pulse">
                            PROCESSING
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            VERIFIED
                          </span>
                        )}
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
