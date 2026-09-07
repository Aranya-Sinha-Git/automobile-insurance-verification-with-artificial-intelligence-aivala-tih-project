# AIVALA v2.0 - Quick Start Guide

## 🚀 For Developers

### What's New in v2.0

Three major updates:
1. ✅ **Health Insurance Removed** - Only Auto & Property now
2. ✅ **Face Visibility Required** - No more face blurring
3. ✅ **Offline Mode Added** - Record claims without internet

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- Modern browser

### Getting Started

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 🗺️ Project Structure

```
/src/app
├── components/
│   ├── ui/                    # Shadcn UI components
│   ├── OfflineSync.tsx        # NEW: Offline status component
│   └── Root.tsx               # Updated: Added Toaster
│
├── pages/
│   ├── mobile/                # 15 mobile screens
│   │   ├── Dashboard.tsx      # Updated: Offline sync card
│   │   ├── NewClaimType.tsx   # Updated: Only Auto/Property
│   │   ├── VideoRecording.tsx # Updated: Offline support
│   │   ├── Settings.tsx       # Updated: Offline controls
│   │   ├── Register.tsx       # Updated: Privacy consent
│   │   └── ...
│   └── web/                   # 6 web dashboard screens
│       ├── ClaimsManagement.tsx # Updated: Filters
│       └── ...
│
├── utils/                     # NEW: Offline utilities
│   ├── offlineStorage.ts      # Storage manager
│   ├── networkStatus.ts       # Network monitoring
│   └── syncManager.ts         # Sync orchestration
│
├── data/
│   └── mockData.ts            # Updated: Removed health type
│
├── App.tsx
└── routes.ts
```

---

## 🎯 Key Features to Test

### 1. Claim Types (Updated)

**Mobile App:**
```
Navigate to: /app/new-claim
Expected: Only see "Auto" and "Property" options
```

**Web Dashboard:**
```
Navigate to: /web/claims
Filter dropdown: Only "Auto" and "Property"
```

### 2. Face Visibility (New)

**Registration:**
```
Navigate to: /app/register
Expected: See two consent checkboxes:
- Face visibility requirement
- Privacy policy agreement
```

**Settings:**
```
Navigate to: /app/settings
Expected: 
- No "Auto-blur face" toggle
- Privacy notice about face visibility
```

### 3. Offline Mode (New)

**Test Offline Recording:**
```bash
# In browser DevTools:
# 1. Open DevTools (F12)
# 2. Go to Network tab
# 3. Select "Offline" throttling
# 4. Navigate to /app/new-claim
# 5. Record a claim
# 6. Check localStorage for saved claim
# 7. Set throttling back to "Online"
# 8. Watch auto-sync happen
```

**Check Storage:**
```
Navigate to: /app/settings
Expected: See storage usage display
```

**Manual Sync:**
```
Navigate to: /app/dashboard
Expected: See "Offline Sync" card if claims pending
```

---

## 💻 Code Examples

### Using Network Status

```typescript
import { useNetworkStatus } from '@/app/utils/networkStatus';

function MyComponent() {
  const networkStatus = useNetworkStatus();
  
  return (
    <div>
      {networkStatus.isOnline ? (
        <span>You're online!</span>
      ) : (
        <span>You're offline. Claims will sync when online.</span>
      )}
    </div>
  );
}
```

### Saving Offline Claim

```typescript
import { offlineStorage } from '@/app/utils/offlineStorage';

// Save claim
const claim = {
  id: `OFFLINE-${Date.now()}`,
  type: 'auto' as const,
  status: 'draft' as const,
  videoBlob: 'base64_video_data',
  claimData: {
    description: 'Front bumper damage',
    location: 'Mumbai',
  },
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  size: 5 * 1024 * 1024, // 5MB
};

const saved = offlineStorage.saveClaim(claim);
if (saved) {
  toast.success('Saved offline!');
}
```

### Checking Storage Info

```typescript
import { offlineStorage } from '@/app/utils/offlineStorage';

const info = offlineStorage.getStorageInfo();
console.log({
  claimCount: info.claimCount,        // e.g., 3
  maxClaims: info.maxClaims,          // 10
  totalSize: info.totalSize,          // bytes
  usagePercentage: info.usagePercentage, // e.g., 45%
  pendingUploads: info.pendingUploads,  // e.g., 2
});
```

### Manual Sync

```typescript
import { syncManager } from '@/app/utils/syncManager';

// Sync now
const result = await syncManager.syncNow();
console.log(`Success: ${result.success}, Failed: ${result.failed}`);

// Retry failed
const retryResult = await syncManager.retryFailed();
```

---

## 🧪 Testing Scenarios

### Scenario 1: Normal Online Flow
```
1. Open app (online)
2. Login
3. New Claim → Auto Insurance
4. Record video
5. Fill details
6. Submit
7. Check processing screen
✓ Should work as before
```

### Scenario 2: Offline Recording
```
1. Open app (online)
2. Login
3. Go offline (airplane mode)
4. New Claim → Auto Insurance
5. See "Offline" badge
6. Record video
7. Fill details
8. Submit
9. Check Dashboard - see "Offline Sync" card
10. Go online
11. Wait 30 seconds or click "Upload Now"
12. Verify claim uploaded
✓ Should save locally and sync when online
```

### Scenario 3: Multiple Offline Claims
```
1. Go offline
2. Create 3 claims
3. Check Settings → Storage usage
4. Check Dashboard → Offline Sync card shows "3 claims"
5. Go online
6. Watch auto-sync
7. All 3 should upload successfully
✓ Should handle multiple claims
```

### Scenario 4: Storage Limit
```
1. Go offline
2. Try to create 11th claim (limit is 10)
3. Should see error
4. Go online and sync
5. Now can create new claims
✓ Should enforce 10-claim limit
```

---

## 🐛 Common Issues & Fixes

### Issue 1: "Cannot read property of undefined"
**Cause:** Network status not initialized
**Fix:** Ensure useNetworkStatus hook is called in component

### Issue 2: Claims not syncing
**Cause:** Auto-sync disabled or no network
**Fix:** 
- Check Settings → Enable auto-sync
- Verify online status
- Try manual sync

### Issue 3: Storage full error
**Cause:** 100MB or 10 claims limit reached
**Fix:**
- Click "Upload Now" to sync pending
- Or "Clear Offline Data" in Settings

### Issue 4: TypeScript errors
**Cause:** Type definitions not matching
**Fix:**
```typescript
// Use 'auto' | 'property' only
type: 'auto' as const  // ✓ Correct
type: 'health' as const // ✗ Wrong - removed
```

---

## 📝 Best Practices

### For Components

1. **Always check network status for claim flows:**
```typescript
const networkStatus = useNetworkStatus();
if (!networkStatus.isOnline) {
  // Show offline message
  // Save to localStorage
}
```

2. **Use toast notifications:**
```typescript
import { toast } from 'sonner';
toast.success('Claim saved offline!');
toast.error('Upload failed');
toast.info('Syncing...');
```

3. **Handle loading states:**
```typescript
const [isSyncing, setIsSyncing] = useState(false);
// Show loading indicator while syncing
```

### For Data Handling

1. **Only use valid claim types:**
```typescript
type ClaimType = 'auto' | 'property'; // No 'health'
```

2. **Encrypt sensitive data:**
```typescript
// Use offlineStorage methods (already encrypted)
offlineStorage.saveClaim(claim);
```

3. **Clean up after sync:**
```typescript
// Automatically done by syncManager
// But can manually delete if needed
offlineStorage.deleteClaim(claimId);
```

---

## 🎨 UI/UX Guidelines

### Network Status Badge

**Always show on claim-related screens:**
- New Claim Type
- Video Recording
- Claim Details

**Colors:**
- Online: Blue (#2563EB)
- Offline: Gray (secondary)

### Offline Sync Card

**Show on Dashboard only when:**
- Claims exist in offline storage
- Hide when all synced

**Update frequency:**
- Every 5 seconds
- Or on user action

### Toast Notifications

**Use for:**
- Claim saved offline
- Sync started
- Sync completed
- Sync failed
- Storage warnings

**Duration:**
- Success: 3 seconds
- Error: 5 seconds
- Info: 3 seconds

---

## 🔍 Debugging Tips

### Check LocalStorage

```javascript
// In browser console:
// View offline claims
JSON.parse(localStorage.getItem('aivala_offline_claims'))

// View sync queue
JSON.parse(localStorage.getItem('aivala_sync_queue'))

// Clear all (for testing)
localStorage.clear()
```

### Network Simulation

```javascript
// Force offline in console
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false
});

// Force online
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});
```

### Monitor Sync Events

```javascript
// Add logging in syncManager.ts
console.log('Sync started');
console.log('Uploading claim:', claimId);
console.log('Sync result:', result);
```

---

## 📚 Resources

### Documentation
- `CHANGELOG.md` - What changed
- `FEATURES.md` - All features
- `OFFLINE_MODE_GUIDE.md` - User guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details

### Code References
- `/src/app/utils/` - Offline utilities
- `/src/app/components/OfflineSync.tsx` - Sync UI
- `/src/app/data/mockData.ts` - Data models

### External Links
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [React Router](https://reactrouter.com/)

---

## ✅ Pre-deployment Checklist

Before deploying to production:

- [ ] Test all claim types (Auto, Property)
- [ ] Test offline recording
- [ ] Test auto-sync
- [ ] Test manual sync
- [ ] Test storage limits
- [ ] Test privacy consent flow
- [ ] Test across browsers
- [ ] Test on mobile devices
- [ ] Check TypeScript compilation
- [ ] Check console for errors
- [ ] Review network requests
- [ ] Test with slow connection
- [ ] Verify localStorage usage
- [ ] Test edge cases

---

## 🚦 Quick Commands

```bash
# Development
npm run dev              # Start dev server

# Build
npm run build           # Production build

# Testing (manual)
# 1. Open browser DevTools
# 2. Go to Network tab
# 3. Toggle offline/online
# 4. Check Application → Local Storage

# Inspect bundle
npm run build           # Then check dist/ folder
```

---

## 💡 Tips

1. **Use React DevTools** to inspect component state
2. **Use Network tab** to simulate offline
3. **Clear localStorage** between tests
4. **Check console** for errors/warnings
5. **Test on multiple browsers** (Chrome, Firefox, Safari)
6. **Use mobile view** in DevTools for mobile testing

---

## 🎓 Learning Resources

### For Offline Mode
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync/)

### For TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### For React
- [React Hooks](https://react.dev/reference/react)
- [Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

---

## 🆘 Need Help?

1. Check documentation files first
2. Review code comments in utility files
3. Check browser console for errors
4. Verify network status
5. Test in incognito mode (clean state)

---

**Version:** 2.0.0  
**Last Updated:** January 24, 2026  
**Status:** Ready for Development ✅

Happy coding! 🚀
