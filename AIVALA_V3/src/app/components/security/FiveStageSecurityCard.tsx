import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSearch,
  Fingerprint,
  Database,
  Scan,
  Cpu,
  Copy,
  Check,
} from "lucide-react";
import type { FiveStageSecurityDetails, FiveStageSecurityItem } from "@/app/utils/huggingFaceService";
import { toast } from "sonner";

interface FiveStageSecurityCardProps {
  securityDetails?: FiveStageSecurityDetails;
  compact?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export default function FiveStageSecurityCard({
  securityDetails,
  compact = false,
  defaultExpanded = false,
  className = "",
}: FiveStageSecurityCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Older claims may not contain a server-issued audit. Never invent passes.
  const defaultStages: FiveStageSecurityItem[] = [
    {
      stage: 1,
      name: "Stage 1: Video Metadata & Decodability",
      shortName: "Video Metadata",
      status: "SKIPPED",
      details: "No server-issued metadata result is stored for this older claim.",
    },
    {
      stage: 2,
      name: "Stage 2: Perceptual Hash (pHash) Fingerprinting",
      shortName: "pHash Structural",
      status: "SKIPPED",
      details: "No server-issued frame fingerprint is stored for this older claim.",
    },
    {
      stage: 3,
      name: "Stage 3: Persistent Duplicate Evidence Check",
      shortName: "Duplicate Check",
      status: "SKIPPED",
      details: "No persistent duplicate-check result is stored for this older claim.",
    },
    {
      stage: 4,
      name: "Stage 4: ELA & Display Re-recording Screen",
      shortName: "Authenticity Screen",
      status: "SKIPPED",
      details: "No ELA or display re-recording result is stored for this older claim.",
    },
    {
      stage: 5,
      name: "Stage 5: YOLO/Qwen Analysis & Local Audit Receipt",
      shortName: "Vision & Receipt",
      status: "SKIPPED",
      details: "No server-issued local audit receipt is stored for this older claim.",
    },
  ];

  const stagesList: FiveStageSecurityItem[] = securityDetails
    ? [
        securityDetails.stage1_exif,
        securityDetails.stage2_phash,
        securityDetails.stage3_duplicate,
        securityDetails.stage4_ela,
        securityDetails.stage5_vision_ledger,
      ]
    : defaultStages;

  const isAllPassed = stagesList.every((s) => s.status === "PASSED");
  const failedStage = stagesList.find((s) => s.status === "FAILED");
  const warningStage = stagesList.find((s) => s.status === "WARNING");
  const issueStage = failedStage || warningStage;
  const auditUnavailable = stagesList.every((s) => s.status === "SKIPPED");

  const getStageIcon = (stageNum: number) => {
    switch (stageNum) {
      case 1:
        return <FileSearch className="h-4 w-4" />;
      case 2:
        return <Fingerprint className="h-4 w-4" />;
      case 3:
        return <Database className="h-4 w-4" />;
      case 4:
        return <Scan className="h-4 w-4" />;
      case 5:
        return <Cpu className="h-4 w-4" />;
      default:
        return <ShieldCheck className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PASSED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 font-medium dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> PASSED
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive" className="bg-red-500/15 text-red-700 border-red-300 font-medium">
            <XCircle className="mr-1 h-3 w-3 text-red-600" /> FAILED
          </Badge>
        );
      case "WARNING":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 font-medium">
            <AlertTriangle className="mr-1 h-3 w-3 text-amber-600" /> WARNING
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-400">
            SKIPPED
          </Badge>
        );
    }
  };

  const handleCopyReceipt = (val?: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedReceipt(true);
    toast.success("Local audit receipt copied to clipboard");
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  return (
    <Card
      className={`border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-purple-50/50 shadow-sm rounded-2xl overflow-hidden ${className}`}
    >
      <CardContent className="p-5">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isAllPassed
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200 dark:shadow-none"
                  : failedStage
                  ? "bg-gradient-to-tr from-red-500 to-rose-600 text-white shadow-md shadow-red-200"
                  : "bg-gradient-to-tr from-orange-500 to-amber-600 text-white shadow-md shadow-orange-200"
              }`}
            >
              {isAllPassed ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                  5-Stage Security Pipeline
                </h3>
                <Badge
                  className={
                    isAllPassed
                      ? "bg-emerald-100 text-emerald-800 font-semibold"
                      : failedStage
                      ? "bg-red-100 text-red-800 font-semibold"
                      : "bg-orange-100 text-orange-800 font-semibold"
                  }
                >
                  {isAllPassed
                    ? "5/5 Verified"
                    : failedStage
                    ? "Security Failure"
                    : auditUnavailable
                    ? "Not Available"
                    : "Manual Review"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isAllPassed
                  ? "Evidence checks and computer vision analysis completed"
                  : failedStage
                  ? `Halted at Stage ${issueStage?.stage}: ${issueStage?.shortName}`
                  : auditUnavailable
                  ? "No server-issued audit is stored for this claim"
                  : `Review Stage ${issueStage?.stage}: ${issueStage?.shortName}`}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 hover:text-blue-700 hover:bg-blue-100/50 rounded-xl transition-all"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 5-Step Pipeline Graphical Timeline */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 my-3">
          {stagesList.map((stg) => {
            const passed = stg.status === "PASSED";
            const failed = stg.status === "FAILED";
            const warning = stg.status === "WARNING";
            return (
              <div
                key={stg.stage}
                className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                  passed
                    ? "bg-white/80 border-emerald-200/80 shadow-xs"
                    : failed
                    ? "bg-red-50/80 border-red-200 shadow-xs"
                    : warning
                    ? "bg-orange-50/80 border-orange-200 shadow-xs"
                    : "bg-gray-50/60 border-gray-200"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                    passed
                      ? "bg-emerald-500 text-white"
                      : failed
                      ? "bg-red-500 text-white"
                      : warning
                      ? "bg-orange-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {stg.stage}
                </div>
                <span className="text-[11px] font-medium text-gray-700 line-clamp-1">
                  {stg.shortName}
                </span>
                <span
                  className={`text-[9px] font-bold mt-1 px-1 rounded ${
                    passed
                      ? "text-emerald-700 bg-emerald-50"
                      : failed
                      ? "text-red-700 bg-red-50"
                      : warning
                      ? "text-orange-700 bg-orange-50"
                      : "text-gray-500"
                  }`}
                >
                  {stg.status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Detailed Breakdown List */}
        <AnimatePresence>
          {(isExpanded || !compact) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-3 pt-3 border-t border-blue-100/80 dark:border-blue-900/40"
            >
              {stagesList.map((stg) => (
                <div
                  key={stg.stage}
                  className="p-3 bg-white/90 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs hover:border-blue-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg">
                        {getStageIcon(stg.stage)}
                      </div>
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {stg.name}
                      </span>
                    </div>
                    {getStatusBadge(stg.status)}
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 ml-8 leading-relaxed">
                    {stg.details}
                  </p>

                  {stg.metricLabel && stg.metricValue && (
                    <div className="ml-8 mt-2 inline-flex items-center gap-2 px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700 rounded-lg text-xs">
                      <span className="text-gray-500">{stg.metricLabel}:</span>
                      <span className="font-mono font-medium text-blue-700 dark:text-blue-300">
                        {stg.metricValue}
                      </span>
                      {stg.stage === 5 && stg.metricValue && (
                        <button
                          onClick={() => handleCopyReceipt(stg.metricValue)}
                          className="ml-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Copy local audit receipt"
                        >
                          {copiedReceipt ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Toggle text */}
        {compact && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium mt-3 pt-2 border-t border-blue-100/50 flex items-center justify-center gap-1"
          >
            {isExpanded ? "Hide 5-Stage Details" : "View Technical 5-Stage Audit Details"}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
