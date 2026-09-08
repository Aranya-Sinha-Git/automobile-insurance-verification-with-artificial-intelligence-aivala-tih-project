import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";

import {
  ArrowLeft,
  Camera,
  Check,
  Wifi,
  WifiOff,
  AlertCircle,
  Video,
  Square,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { Progress } from "@/app/components/ui/progress";
import { useNetworkStatus } from "@/app/utils/networkStatus";
import { toast } from "sonner";
import { offlineStorage } from "@/app/utils/offlineStorage";
import { accountStorageKey } from "@/app/utils/accountStorage";

const MIN_RECORDING_SECONDS = 2;

export default function VideoRecording() {
  const navigate = useNavigate();
  const networkStatus = useNetworkStatus();

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const continueInFlightRef = useRef(false);

  // Initialize stream on camera activation
  const startCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      return stream;
    } catch (err) {
      console.warn("Could not access environment camera, trying default video source", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = stream;
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
        }
        setCameraActive(true);
        return stream;
      } catch (e) {
        console.error("Camera access failed completely", e);
        const code = (e as DOMException)?.name;
        toast.error(
          code === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your device settings and try again."
            : code === "NotFoundError"
              ? "No camera is available on this device."
              : "Camera is unavailable. Close other camera apps and try again.",
        );
        return null;
      }
    }
  };

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCameraStream();
    return () => {
      stopCameraStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const protectUnsavedRecording = (event: BeforeUnloadEvent) => {
      if (recorded || recording) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protectUnsavedRecording);
    return () => {
      window.removeEventListener("beforeunload", protectUnsavedRecording);
    };
  }, [recorded, recording]);

  // 🚀 START LIVE VIDEO RECORDING
  const startRecording = async () => {
    try {
      let stream = mediaStreamRef.current;
      if (!stream || !stream.active) {
        stream = await startCameraStream();
      }

      if (!stream) {
        toast.error("Unable to start live camera stream");
        return;
      }

      recordedChunksRef.current = [];
      
      // Determine supported mime type
      const mimeTypes = [
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blobType = selectedMime.includes("mp4") ? "video/mp4" : "video/webm";
        const videoBlob = new Blob(recordedChunksRef.current, { type: blobType });
        if (videoBlob.size < 1024) {
          setRecorded(false);
          setRecording(false);
          stopCameraStream();
          toast.error("The recording was empty. Please record the evidence again.");
          return;
        }
        const videoFile = new File([videoBlob], `claim_video_${Date.now()}.${blobType.includes("mp4") ? "mp4" : "webm"}`, {
          type: blobType,
        });

        setSelectedVideoFile(videoFile);
        (window as any).currentClaimVideoFile = videoFile;

        const previewUrl = URL.createObjectURL(videoBlob);
        setVideoPreviewUrl(previewUrl);

        // Generate thumbnail frame
        extractThumbnail(previewUrl);

        setRecorded(true);
        setRecording(false);
        stopCameraStream();
        toast.success("Video evidence recorded successfully!");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200); // collect chunks every 200ms
      setRecording(true);
      setRecordingTime(0);

      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingTime(seconds);

        // Auto-stop at 10 seconds for standard claim video length
        if (seconds >= 10) {
          stopRecording(true);
        }
      }, 1000);

      toast.success("Recording started... Move camera across damaged vehicle areas");
    } catch (error) {
      console.error("Error starting video recording:", error);
      toast.error("Failed to start video recording");
    }
  };

  // ⏹️ STOP RECORDING
  const stopRecording = (force = false) => {
    if (!force && recordingTime < MIN_RECORDING_SECONDS) {
      toast.info(`Record for at least ${MIN_RECORDING_SECONDS} seconds.`);
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = async () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(null);
    setSelectedVideoFile(null);
    setCapturedImage(null);
    setRecorded(false);
    setRecordingTime(0);
    delete (window as any).currentClaimVideoFile;
    delete (window as any).currentClaimThumbnail;
    await startCameraStream();
  };

  // Extract thumbnail image from recorded video URL
  const extractThumbnail = (videoUrl: string) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.currentTime = 1;
    video.muted = true;
    video.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setCapturedImage(dataUrl);
        localStorage.setItem(accountStorageKey("claimCapture"), dataUrl);
      }
    };
  };

  // 🚀 CONTINUE → PROMPT USER FOR INCIDENT DETAILS BEFORE ANALYSIS
  const handleContinue = async () => {
    if (continueInFlightRef.current) return;

    if (!selectedVideoFile) {
      toast.error("Please record a video first");
      return;
    }

    continueInFlightRef.current = true;
    setIsSavingEvidence(true);
    try {
      const draftKey = accountStorageKey("current_claim_draft_id");
      const draftId =
        localStorage.getItem(draftKey) || `CLM-${Date.now()}`;
      const saved = await offlineStorage.saveClaim(
        {
          id: draftId,
          type: "auto",
          status: "draft",
          videoBlob: selectedVideoFile,
          videoFileName: selectedVideoFile.name,
          videoMimeType: selectedVideoFile.type,
          claimData: {},
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          size: selectedVideoFile.size,
        },
        false,
      );
      if (!saved) {
        toast.error("Unable to save evidence on this device. Check available storage.");
        return;
      }

      localStorage.setItem(draftKey, draftId);
      localStorage.setItem(
        accountStorageKey("pending_claim_draft"),
        JSON.stringify({
          id: draftId,
          image: capturedImage,
          createdAt: new Date().toISOString(),
        }),
      );

      // Keep the in-memory reference for the immediate flow; IndexedDB survives restarts.
      (window as any).currentClaimVideoFile = selectedVideoFile;
      if (capturedImage) {
        (window as any).currentClaimThumbnail = capturedImage;
      }

      toast.success("Evidence recorded! Please confirm incident details.");
      navigate("/app/claim-details");
    } catch (error) {
      console.error("Unable to continue to incident details:", error);
      toast.error("Unable to save the recording. Please try again.");
    } finally {
      continueInFlightRef.current = false;
      setIsSavingEvidence(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-black flex flex-col">
      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex justify-between items-center text-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (recorded && !window.confirm("Your unsaved recording will be discarded. Leave this screen?")) return;
              stopCameraStream();
              navigate("/app/new-claim");
            }}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>

          <span className="text-sm font-medium">Auto Insurance Claim Video</span>

          <Badge variant={networkStatus.isServerReachable ? "default" : "destructive"} className="gap-1">
            {networkStatus.isServerReachable ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                AI Server Online
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                AI Server Offline
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* CAMERA / VIDEO DISPLAY AREA */}
      <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
        {/* Live camera stream */}
        {!videoPreviewUrl && (
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
          />
        )}

        {/* Initial instructions before camera starts */}
        {!cameraActive && !videoPreviewUrl && (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
            <Video className="h-20 w-20 mb-4 text-blue-500 animate-pulse" />
            <h2 className="text-xl text-white font-semibold mb-2">Record Vehicle Damage Video</h2>
            <p className="text-sm text-gray-400 max-w-xs">
              Press the red button below to record your damaged vehicle.
            </p>
          </div>
        )}

        {/* Recorded video preview */}
        {videoPreviewUrl && (
          <video src={videoPreviewUrl} controls autoPlay className="w-full h-full object-contain" />
        )}

        {/* RECORDING TIMER OVERLAY */}
        {recording && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-5 py-2 rounded-full flex items-center gap-3 z-50 border border-white/30 shadow-lg">
            <div className="w-3.5 h-3.5 bg-white rounded-full animate-ping" />
            <span className="font-bold text-sm tracking-wide">REC {recordingTime}s / 10s</span>
          </div>
        )}
        {/* INSTRUCTIONS OVERLAY */}
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
          <Card className="bg-black/60 backdrop-blur-sm text-white border-white/10 pointer-events-auto shadow-xl">
            <div className="p-3 space-y-1.5">
              <p className="text-xs font-medium">
                • Pan camera slowly across all exterior damage
              </p>
              <p className="text-xs text-gray-300">
                • Video will be analyzed by AI Vision Server
              </p>
              {!networkStatus.isOnline && (
                <div className="flex items-center gap-2 pt-1.5 border-t border-white/10 mt-1">
                  <AlertCircle className="h-3 w-3 text-orange-400" />
                  <p className="text-[10px] text-orange-300 leading-tight">
                    Offline mode active (Local backup enabled)
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="p-4 pb-6 bg-black border-t border-white/10">
        {recording && (
          <div className="mb-4">
            <Progress value={(recordingTime / 10) * 100} className="h-2 bg-gray-800" />
          </div>
        )}

        <div className="flex gap-4 justify-center items-center">
          {/* NOT RECORDING & NOT RECORDED YET */}
          {!recording && !recorded && (
            <div className="flex items-center gap-4 w-full justify-center">
              <Button
                size="icon"
                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 shadow-xl border-4 border-white/20"
                onClick={startRecording}
                title="Start Recording Video"
              >
                <Video className="h-7 w-7 text-white" />
              </Button>

            </div>
          )}

          {/* IS CURRENTLY RECORDING */}
          {recording && (
            <Button
              className="h-16 px-8 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-3 text-lg"
              onClick={() => stopRecording()}
              disabled={recordingTime < MIN_RECORDING_SECONDS}
            >
              <Square className="h-6 w-6 fill-white" />
              {recordingTime < MIN_RECORDING_SECONDS
                ? `Keep Recording (${recordingTime}s)`
                : `Stop Recording (${recordingTime}s)`}
            </Button>
          )}

          {/* AFTER RECORDING COMPLETE */}
          {!recording && recorded && (
            <div className="flex gap-3 justify-center w-full">
              <Button
                variant="outline"
                className="flex-1 max-w-[10rem] border-white/30 bg-transparent text-white hover:bg-white/10"
                onClick={handleRetake}
                disabled={isSavingEvidence}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button
                className="flex-1 max-w-sm bg-green-600 hover:bg-green-700 text-white font-semibold h-14"
                onClick={handleContinue}
                disabled={isSavingEvidence}
              >
                {isSavingEvidence ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving evidence...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Next: Incident Details →
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
