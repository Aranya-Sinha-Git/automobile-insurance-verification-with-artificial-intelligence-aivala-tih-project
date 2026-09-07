import { useState, useEffect } from 'react';
import { getHFSpaceURL } from './huggingFaceService';

export interface NetworkStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

// Hook to monitor network status & active AI server health
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isServerReachable: false,
  });

  useEffect(() => {
    let intervalId: any = null;

    const checkServerHealth = async (): Promise<boolean> => {
      if (!navigator.onLine) return false;
      try {
        const baseUrl = getHFSpaceURL();
        const res = await fetch(`${baseUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const updateStatus = async () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const reachable = await checkServerHealth();

      setStatus({
        isOnline: navigator.onLine,
        isServerReachable: reachable,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt
      });
    };

    // Initial update
    updateStatus();

    // Periodic ping every 8 seconds
    intervalId = setInterval(updateStatus, 8000);

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  return status;
}

// Check if network is suitable for uploading
export function isGoodConnection(status: NetworkStatus): boolean {
  if (!status.isOnline) return false;
  
  // If we have connection info, check quality
  if (status.effectiveType) {
    return ['4g', 'wifi'].includes(status.effectiveType);
  }
  
  // Default to true if online but no detailed info
  return true;
}

// Estimate upload time based on file size and connection
export function estimateUploadTime(fileSizeBytes: number, status: NetworkStatus): string {
  if (!status.isOnline) return 'Offline';
  
  // Default speeds in Mbps
  const speedMap: Record<string, number> = {
    'slow-2g': 0.05,
    '2g': 0.25,
    '3g': 0.75,
    '4g': 5,
    'wifi': 10
  };
  
  const speedMbps = status.downlink || speedMap[status.effectiveType || '4g'] || 5;
  const speedBps = speedMbps * 1024 * 1024 / 8; // Convert to bytes per second
  const timeSeconds = fileSizeBytes / speedBps;
  
  if (timeSeconds < 60) return `${Math.ceil(timeSeconds)}s`;
  if (timeSeconds < 3600) return `${Math.ceil(timeSeconds / 60)}m`;
  return `${Math.ceil(timeSeconds / 3600)}h`;
}

// Get connection quality message
export function getConnectionMessage(status: NetworkStatus): string {
  if (!status.isOnline) {
    return 'You are offline. Claims will be saved and uploaded when connection is restored.';
  }
  
  if (status.effectiveType === 'slow-2g' || status.effectiveType === '2g') {
    return 'Slow connection detected. Upload may take longer.';
  }
  
  if (status.effectiveType === '3g') {
    return 'Moderate connection. Ready to upload.';
  }
  
  return 'Good connection. Ready to upload.';
}
