# AIVALA Offline Mode - Quick Guide

## 🌐 Overview

Offline Mode allows users to record insurance claim videos and fill forms without an internet connection. Claims are saved locally and automatically uploaded when connectivity is restored.

---

## 🎯 Key Benefits

### For Users in Areas with Poor Connectivity
- ✅ No interruption in claim process
- ✅ Save data on mobile networks
- ✅ Work from remote locations
- ✅ No need to wait for WiFi

### Technical Advantages
- ✅ Better user retention
- ✅ Reduced abandonment rate
- ✅ Smoother user experience
- ✅ Competitive differentiation

---

## 🔧 How It Works

### User Flow

```
1. Open AIVALA App
   ↓
2. Network Status Detected
   - Online: Green badge "Online"
   - Offline: Gray badge "Offline"
   ↓
3. Start New Claim
   - Select Auto or Property insurance
   - See "Offline Mode Available" message if offline
   ↓
4. Record Video
   - Camera works without internet
   - Video saved locally (encrypted)
   - "Saved for upload" toast message
   ↓
5. Fill Claim Details
   - All forms work offline
   - Auto-save every 30 seconds
   - Data stored in browser localStorage
   ↓
6. Submit Claim
   - Added to upload queue
   - Shows in "Offline Sync" card on Dashboard
   ↓
7. Network Restored
   - Auto-sync starts (checks every 30s)
   - Upload progress shown
   - Notification on completion
   ↓
8. Claim Processed
   - AI verification begins
   - Results available in 5-10 minutes
```

---

## 📱 User Interface Elements

### Network Status Badge
**Location:** Top-right corner on claim screens

**Online:**
- Green badge
- WiFi icon
- Text: "Online"

**Offline:**
- Gray badge
- WiFi-off icon
- Text: "Offline"

### Offline Sync Card
**Location:** Dashboard (appears only when offline claims exist)

**Shows:**
- Total offline claims count
- Pending uploads count
- Failed uploads count
- Storage usage bar
- Manual sync button
- Retry failed button

**Example:**
```
┌─────────────────────────────────┐
│ 🌐 Offline Claims      [Online] │
├─────────────────────────────────┤
│  Total: 3  Pending: 2  Failed: 1│
│                                  │
│  Storage: [████████░░] 45%      │
│  45 MB / 100 MB                 │
│                                  │
│  [Upload 2 Claims]              │
│  [Retry 1 Failed Upload]        │
└─────────────────────────────────┘
```

### Settings Page
**Offline Mode Section:**

```
┌─────────────────────────────────┐
│ Offline Mode                    │
├─────────────────────────────────┤
│ □ Enable Offline Mode           │
│   Record claims without internet│
│                                  │
│ □ Auto-sync when online         │
│   Upload claims automatically   │
│                                  │
│ Offline Claims: 3 / 10          │
│ Storage Used: 45 MB / 100 MB    │
│ Pending Uploads: 2              │
│                                  │
│ [Clear Offline Data]            │
└─────────────────────────────────┘
```

---

## 💾 Storage Details

### Limits

| Item | Limit | Reason |
|------|-------|--------|
| Max Claims | 10 | Prevent storage bloat |
| Max Storage | 100 MB | Browser localStorage limit |
| Video Size | ~5-10 MB each | Compressed format |
| Auto-delete | After upload | Free up space |

### What Gets Stored

**Stored Locally:**
- Video data (Base64 encoded)
- Claim form data
- Location information
- Timestamp metadata
- Claim ID

**NOT Stored:**
- User credentials
- Payment information
- AI processing results
- Historical claims

---

## 🔄 Sync Behavior

### Automatic Sync

**When It Happens:**
- Network connection restored (immediate)
- Every 30 seconds while online
- App reopened while online
- Manual sync button pressed

**Priority Order:**
1. Oldest claims first
2. Smallest file size first
3. Failed uploads retried last

### Manual Sync

**When to Use:**
- Want to upload immediately
- Retry failed uploads
- Check sync status
- Force refresh

**How to Trigger:**
1. Go to Dashboard
2. Find "Offline Sync" card
3. Click "Upload X Claims"
4. Wait for completion

---

## ⚠️ Important Notes

### Storage Warnings

**When storage reaches 80% (80 MB):**
- Orange warning displayed
- Suggest uploading existing claims
- Still allows new claims

**When storage reaches 95% (95 MB):**
- Red warning displayed
- Recommend clearing old claims
- May block new recordings

**When limit reached (100 MB or 10 claims):**
- Error message shown
- Must upload or delete before new claims
- "Clear Offline Data" option available

### Network Recommendations

**Best for Upload:**
- WiFi (preferred)
- 4G connection
- Good signal strength

**Works but Slower:**
- 3G connection
- Weak signal
- May show "Slow connection" warning

**Won't Upload:**
- Offline (obviously)
- Airplane mode
- Very slow connections (may timeout)

---

## 🐛 Troubleshooting

### Problem: Claims not syncing

**Solutions:**
1. Check network status badge (must be "Online")
2. Check Settings → Auto-sync is enabled
3. Try manual sync button
4. Restart app
5. Check storage space on device

### Problem: "Storage limit reached" error

**Solutions:**
1. Wait for pending uploads to complete
2. Use "Upload Now" button to force sync
3. Clear completed claims manually
4. Delete draft claims if needed
5. Use Settings → "Clear Offline Data" (last resort)

### Problem: Upload failed multiple times

**Solutions:**
1. Check internet stability
2. Try on WiFi instead of mobile data
3. Wait for better signal
4. Use "Retry Failed" button
5. Clear and re-record if corrupted

### Problem: Video quality too low after compression

**Solutions:**
1. Ensure good lighting when recording
2. Keep camera steady
3. Check camera settings
4. Update app to latest version

---

## 🔒 Security

### Encryption

**Local Storage:**
- Data encrypted at rest
- AES-256 encryption
- Secure key storage

**During Sync:**
- HTTPS/TLS encryption
- End-to-end security
- No man-in-the-middle attacks

### Privacy

**What Happens to Videos:**
1. Recorded → Encrypted locally
2. Uploaded → Encrypted in transit
3. Processed → AI extracts frames
4. Stored → Only frames kept
5. Deleted → Raw video removed (24h)

**User Control:**
- View all offline data
- Delete anytime
- Clear all data option
- No automatic sharing

---

## 📊 Monitoring & Analytics

### For Users

**Dashboard Shows:**
- Pending uploads count
- Failed uploads count
- Storage usage percentage
- Last sync time

### For Developers

**Logging:**
```javascript
// Storage info
offlineStorage.getStorageInfo()
// Returns:
// {
//   claimCount: 3,
//   maxClaims: 10,
//   totalSize: 47185920, // bytes
//   maxSize: 104857600,
//   usagePercentage: 45,
//   pendingUploads: 2,
//   failedUploads: 1
// }
```

**Network monitoring:**
```javascript
// Use hook
const networkStatus = useNetworkStatus()
// Returns:
// {
//   isOnline: true,
//   effectiveType: '4g',
//   downlink: 10, // Mbps
//   rtt: 50 // ms
// }
```

---

## 💡 Best Practices

### For Users

1. **Enable Auto-sync** - Let app handle uploads automatically
2. **Use WiFi** - Faster and doesn't use mobile data
3. **Clear regularly** - Don't let storage fill up
4. **Good lighting** - Better video quality when recording
5. **Stable connection** - Wait for good signal before manual sync

### For Developers

1. **Check storage** - Before allowing new recordings
2. **Handle errors** - Graceful degradation
3. **User feedback** - Clear messages and progress
4. **Test offline** - Regularly test offline scenarios
5. **Monitor sync** - Track success/failure rates

---

## 🎓 Tutorial

### First-Time User Guide

**Step 1: Enable Offline Mode**
1. Go to Settings
2. Toggle "Enable Offline Mode"
3. Toggle "Auto-sync when online"

**Step 2: Record Offline Claim**
1. Turn on Airplane Mode (for testing)
2. Go to New Claim
3. See "Offline" badge
4. Record video normally
5. Fill claim details
6. Submit (saved locally)

**Step 3: Verify Storage**
1. Go to Dashboard
2. See "Offline Sync" card
3. Check pending uploads: 1

**Step 4: Sync When Online**
1. Turn off Airplane Mode
2. Wait 30 seconds (auto-sync)
3. Or click "Upload Now"
4. Watch progress
5. See success message

**Step 5: Verify Upload**
1. Check Dashboard
2. Offline Sync card disappears
3. Claim appears in history
4. Processing starts

---

## 📞 Support

### Common Questions

**Q: How long can claims stay offline?**
A: No time limit, but max 10 claims or 100MB

**Q: Will video quality suffer?**
A: Minimal compression, quality maintained

**Q: Can I edit offline claims?**
A: No, once submitted locally, can't edit

**Q: What if I clear browser data?**
A: Offline claims will be lost, upload first!

**Q: Does offline mode use more battery?**
A: Minimal impact, mostly during recording

**Q: Can I disable offline mode?**
A: Yes, in Settings → Offline Mode toggle

---

## 🚀 Advanced Features (Future)

### Planned Enhancements

1. **Selective Sync**
   - Choose which claims to upload first
   - Priority settings

2. **Compression Options**
   - User-selectable video quality
   - Trade quality for storage

3. **Background Sync**
   - Upload while app is closed
   - Service Worker integration

4. **Partial Uploads**
   - Resume interrupted uploads
   - Chunked upload support

5. **Offline AI**
   - Basic quality checks offline
   - Pre-processing for faster upload

---

**Version:** 2.0.0  
**Last Updated:** January 24, 2026  
**Status:** Implemented ✅
