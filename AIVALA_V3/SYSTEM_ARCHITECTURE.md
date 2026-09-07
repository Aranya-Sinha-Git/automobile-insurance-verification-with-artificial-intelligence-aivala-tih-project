# AIVALA Insurance Claim Platform - System Architecture

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Application Architecture](#application-architecture)
4. [Feature Modules](#feature-modules)
5. [Data Architecture](#data-architecture)
6. [Offline-First Architecture](#offline-first-architecture)
7. [Security & Privacy](#security--privacy)
8. [Component Architecture](#component-architecture)
9. [Routing Architecture](#routing-architecture)
10. [Future Scalability](#future-scalability)

---

## Overview

AIVALA is a comprehensive insurance claim platform that leverages AI-powered video analysis for fraud detection and automated damage assessment. The platform consists of two primary interfaces:

- **Mobile Application**: Customer-facing claim submission and tracking
- **Web Dashboard**: Insurer-facing claim management and fraud analytics

### Core Capabilities
- AI-powered video-based claim validation
- Real-time fraud detection with multi-layer analysis
- Automated damage assessment
- Offline-first architecture with automatic sync
- Comprehensive claim lifecycle management
- Team performance analytics

---

## Technology Stack

### Frontend Framework
- **React 18.3.1**: Component-based UI library
- **TypeScript**: Type-safe development
- **Vite 6.3.5**: Build tool and dev server
- **React Router 7.13.0**: Client-side routing

### UI & Styling
- **Tailwind CSS 4.1.12**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives (40+ components)
- **Material UI 7.3.5**: Comprehensive component library
- **Lucide React**: Icon library
- **Motion 12.23.24**: Animation library (formerly Framer Motion)

### Data Visualization
- **Recharts 2.15.2**: Chart and graph library for analytics dashboards

### Form Management
- **React Hook Form 7.55.0**: Performant form validation and handling

### State Management
- **React Context**: Local state management
- **LocalStorage API**: Offline data persistence
- **Custom Hooks**: Network status, offline storage, sync management

### Development Tools
- **@vitejs/plugin-react**: React plugin for Vite
- **@tailwindcss/vite**: Tailwind integration

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AIVALA Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐      ┌─────────────────────┐     │
│  │   Mobile App        │      │   Web Dashboard     │     │
│  │   (Claimants)       │      │   (Insurers)        │     │
│  │                     │      │                     │     │
│  │ • Claim Submission  │      │ • Claims Review     │     │
│  │ • Video Recording   │      │ • Fraud Analytics   │     │
│  │ • Status Tracking   │      │ • Team Management   │     │
│  │ • Offline Mode      │      │ • Settlement Mgmt   │     │
│  └─────────────────────┘      └─────────────────────┘     │
│           │                            │                    │
│           └────────────┬───────────────┘                    │
│                        │                                    │
│              ┌─────────▼──────────┐                        │
│              │   Shared Services   │                        │
│              ├─────────────────────┤                        │
│              │ • Routing Engine    │                        │
│              │ • UI Components     │                        │
│              │ • Utilities         │                        │
│              │ • Data Models       │                        │
│              └─────────────────────┘                        │
│                        │                                    │
│              ┌─────────▼──────────┐                        │
│              │  Offline Layer      │                        │
│              ├─────────────────────┤                        │
│              │ • LocalStorage      │                        │
│              │ • Sync Manager      │                        │
│              │ • Network Monitor   │                        │
│              └─────────────────────┘                        │
│                        │                                    │
│              ┌─────────▼──────────┐                        │
│              │   Backend API       │                        │
│              │  (Future/Mock)      │                        │
│              ├─────────────────────┤                        │
│              │ • Claim Processing  │                        │
│              │ • AI Analysis       │                        │
│              │ • Video Storage     │                        │
│              │ • User Auth         │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Patterns

1. **Component-Based Architecture**: Modular, reusable React components
2. **Route-Based Code Splitting**: Separate mobile and web routes
3. **Offline-First Design**: Local storage with background sync
4. **Responsive Design**: Mobile-first with adaptive layouts
5. **Design System**: Consistent color palette, typography, and components

---

## Feature Modules

### Mobile Application (15+ Screens)

#### 1. Authentication Module
- **Welcome Screen**: Landing page with branding
- **Login Screen**: Email/phone authentication with biometric option
- **Register Screen**: New user onboarding with KYC

#### 2. Claim Submission Module
- **Dashboard**: Overview of active claims and quick actions
- **New Claim Type**: Selection between Auto and Property insurance
- **Video Recording**: 
  - Live camera feed with recording controls
  - Real-time guidance overlay
  - Face visibility verification (no blur)
  - Damage area highlighting
  - 60-second maximum duration
- **Claim Details**: Additional information entry
- **Claim Submission**: Final review and submit

#### 3. Processing & Results Module
- **Processing Screen**: 
  - Real-time AI analysis progress
  - Multi-stage processing indicators
  - Estimated completion time
- **Results Screen**: 
  - Fraud score display
  - Approval/rejection status
  - AI confidence metrics
- **Damage Details**: 
  - Detected damage areas
  - Cost estimation breakdown
  - Before/after imagery

#### 4. Settlement Module
- **Settlement Screen**: 
  - Payment details
  - Settlement timeline
  - Document uploads
  - Bank account verification

#### 5. History & Profile Module
- **Claims History**: Chronological claim listing with filters
- **Profile**: User information and documents
- **Settings**: 
  - Notification preferences
  - Privacy controls
  - Offline mode settings
  - Storage management

### Web Dashboard (6+ Screens)

#### 1. Claims Management
- **Main Dashboard**: 
  - Real-time metrics (total claims, approval rate, fraud detection)
  - Trending analytics charts
  - Quick action widgets
- **Claims Management**: 
  - Searchable/filterable claim table
  - Bulk actions
  - Status management
  - Claim detail modal with video playback

#### 2. Fraud Analytics
- **Fraud Analytics Dashboard**:
  - Multi-layer fraud detection visualization
  - Pattern recognition charts
  - Geographic fraud heatmaps
  - Temporal fraud trends
  - Individual fraud factor breakdown

#### 3. Settlement Operations
- **Settlement Management**:
  - Payment processing queue
  - Settlement approval workflow
  - Payment tracking
  - Dispute management

#### 4. Team Operations
- **Team Management**:
  - Adjuster performance metrics
  - Workload distribution
  - Team member roles and permissions
  - Activity logs

#### 5. System Configuration
- **System Settings**:
  - AI model configuration
  - Fraud threshold tuning
  - Integration settings
  - Notification templates
  - Audit logs

---

## Data Architecture

### Data Models

#### Claim Data Structure
```typescript
interface Claim {
  id: string;                    // Unique claim identifier
  customerId: string;            // Customer reference
  customerName: string;          // Display name
  type: 'auto' | 'property';    // Claim category
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  fraudScore: number;            // 0-100 fraud probability
  damageAssessment: string;      // AI-generated summary
  estimatedCost: number;         // Repair cost estimate
  submittedAt: string;           // ISO timestamp
  processedAt?: string;          // Processing completion time
  vehicleInfo?: string;          // Auto-specific data
  propertyInfo?: string;         // Property-specific data
  location?: string;             // Incident location
  description?: string;          // User description
}
```

#### Offline Claim Structure
```typescript
interface OfflineClaim {
  id: string;
  type: 'auto' | 'property';
  status: 'draft' | 'pending_upload';
  videoBlob?: string;            // Base64 encoded video
  claimData: {
    description?: string;
    location?: string;
    vehicleInfo?: string;
    propertyInfo?: string;
  };
  createdAt: string;
  lastModified: string;
  size: number;                  // Storage size in bytes
}
```

#### Sync Queue Structure
```typescript
interface SyncQueue {
  pendingUploads: string[];      // Claim IDs awaiting upload
  failedUploads: string[];       // Failed upload claim IDs
  lastSyncAttempt?: string;      // Last sync timestamp
}
```

#### Fraud Analysis Layers
```typescript
interface FraudLayer {
  name: string;                  // Layer identifier
  score: number;                 // 0-100 fraud score
  confidence: 'high' | 'medium' | 'low';
  details: string;               // Analysis explanation
}
```

### Data Flow

```
┌──────────────┐
│   User Input │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Form Validation  │ (React Hook Form)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Network Check    │ (useNetworkStatus)
└──────┬───────────┘
       │
       ├─── Online ───► API Upload ───► Backend Processing
       │
       └─── Offline ──► LocalStorage ──► Sync Queue
                              │
                              ▼
                      ┌───────────────┐
                      │  Auto-Sync    │ (Every 30s when online)
                      └───────┬───────┘
                              │
                              └───► Retry Upload ───► Backend
```

---

## Offline-First Architecture

### Key Components

#### 1. Offline Storage Manager (`offlineStorage.ts`)
**Responsibilities:**
- Save claims to LocalStorage
- Manage storage quotas (100MB max, 10 claims max)
- CRUD operations for offline claims
- Storage usage analytics

**Storage Keys:**
- `aivala_offline_claims`: Array of offline claims
- `aivala_sync_queue`: Upload queue metadata

**Features:**
- Automatic size validation
- Storage limit enforcement
- Human-readable size formatting
- Claim versioning with timestamps

#### 2. Sync Manager (`syncManager.ts`)
**Responsibilities:**
- Background synchronization (30-second intervals)
- Upload retry logic with exponential backoff
- Failed upload tracking
- Network-aware sync triggering

**Sync Strategies:**
- Auto-sync on network restoration
- Manual sync trigger
- Failed upload retry queue
- Batch upload processing

**Error Handling:**
- 90% simulated success rate (for demo)
- Failed uploads moved to retry queue
- User notifications via toast messages
- Sync status persistence

#### 3. Network Status Monitor (`networkStatus.ts`)
**Responsibilities:**
- Real-time connectivity detection
- Connection quality assessment
- Upload time estimation
- User-friendly status messages

**Monitored Metrics:**
- Online/offline state
- Effective connection type (2G, 3G, 4G, WiFi)
- Network downlink speed
- Round-trip time (RTT)

**Connection Quality Logic:**
```typescript
Good Connection: 4G, WiFi
Moderate: 3G
Slow: 2G, slow-2G
Offline: No connection
```

### Offline Mode Features

1. **Claim Creation Offline**
   - Full claim form accessible offline
   - Video recording and local storage
   - Draft saving with auto-save
   - Queue for upload when online

2. **Storage Management**
   - Visual storage usage indicator
   - Automatic cleanup of uploaded claims
   - Manual deletion of drafts
   - Storage quota warnings

3. **Sync Indicators**
   - Network status badge
   - Pending upload count
   - Sync progress notifications
   - Failed upload alerts

4. **User Experience**
   - Connection quality messages
   - Estimated upload time display
   - Offline capability badges
   - Seamless online/offline transitions

---

## Security & Privacy

### Privacy Features

1. **Face Visibility Controls**
   - **No automatic face blurring**: Faces remain visible for fraud prevention
   - **Privacy notices**: Clear user communication about video usage
   - **Consent management**: Explicit consent before recording
   - **Data retention policies**: Configurable retention periods

2. **Video Recording Privacy**
   - Recording indicators (red dot, timer)
   - Guidance overlays for optimal recording
   - Review before submission
   - Delete and re-record option

3. **Data Protection**
   - Local encryption of stored videos (future enhancement)
   - Secure video transmission (HTTPS)
   - Access control on web dashboard
   - Audit logging for all claim access

### Security Measures

1. **Authentication**
   - Email/phone-based login
   - Biometric authentication support (future)
   - Session management
   - Role-based access control (web dashboard)

2. **Data Security**
   - Input validation on all forms
   - XSS prevention through React
   - CSRF protection (backend integration)
   - Secure file upload handling

3. **API Security** (Future Backend Integration)
   - JWT-based authentication
   - Rate limiting
   - Request signing
   - Encrypted data transmission

---

## Component Architecture

### Component Organization

```
src/
├── app/
│   ├── components/
│   │   ├── ui/              # 40+ Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ... (Radix UI wrappers)
│   │   ├── web/             # Web-specific components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── NetworkStatusBadge.tsx
│   │   │   └── ...
│   │   └── figma/           # Figma import components
│   │       └── ImageWithFallback.tsx
│   ├── pages/
│   │   ├── mobile/          # 15 mobile screens
│   │   │   ├── Welcome.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── VideoRecording.tsx
│   │   │   └── ...
│   │   └── web/             # 6 web dashboard screens
│   │       ├── WebMainDashboard.tsx
│   │       ├── ClaimsManagement.tsx
│   │       ├── FraudAnalytics.tsx
│   │       └── ...
│   ├── utils/               # Utility modules
│   │   ├── offlineStorage.ts
│   │   ├── syncManager.ts
│   │   └── networkStatus.ts
│   ├── data/                # Mock data and types
│   │   └── mockData.ts
│   ├── routes.ts            # Route configuration
│   └── App.tsx              # Root component
└── styles/
    ├── theme.css            # Design tokens
    └── fonts.css            # Font imports
```

### Component Patterns

1. **Compound Components**: Complex UI with multiple sub-components
2. **Controlled Components**: Form inputs managed by React Hook Form
3. **Higher-Order Components**: Shared logic extraction
4. **Custom Hooks**: Reusable stateful logic (network status, offline storage)
5. **Render Props**: Flexible component composition

### Design System

**Color Palette:**
- Primary: `#2563EB` (Blue) - CTAs, links, primary actions
- Success: `#10B981` (Green) - Approvals, success states
- Warning: `#F59E0B` (Orange) - Pending, warnings
- Danger: `#EF4444` (Red) - Rejections, errors
- Neutral: Gray scale for backgrounds and text

**Typography:**
- Font Family: Inter (via Google Fonts)
- Responsive font sizing via Tailwind utilities
- Semantic heading hierarchy (h1-h6)

**Spacing System:**
- Tailwind's 4px base spacing scale
- Consistent padding/margin patterns
- Responsive spacing modifiers

**Component Library:**
- 40+ UI components from Radix UI
- Material UI for complex data displays
- Custom-styled components using Tailwind

---

## Routing Architecture

### Route Structure

```typescript
Route Hierarchy:
/
├── /                          # Welcome screen
├── /app/*                     # Mobile application
│   ├── /login
│   ├── /register
│   ├── /dashboard
│   ├── /new-claim
│   ├── /video-recording
│   ├── /claim-details
│   ├── /claim-submission
│   ├── /processing/:claimId
│   ├── /results/:claimId
│   ├── /damage/:claimId
│   ├── /settlement/:claimId
│   ├── /history
│   ├── /profile
│   └── /settings
└── /web/*                     # Web dashboard
    ├── /login
    ├── /dashboard
    ├── /claims
    ├── /fraud-analytics
    ├── /settlements
    ├── /team
    └── /settings
```

### Navigation Features

1. **Mobile Navigation**
   - Bottom navigation bar on main screens
   - Back button navigation
   - Swipe gestures (settings sidebar)
   - Deep linking to specific claims

2. **Web Navigation**
   - Persistent sidebar navigation
   - Breadcrumb trails
   - Mobile-responsive hamburger menu
   - Swipe-to-toggle sidebar (mobile web)

3. **Route Guards** (Future Enhancement)
   - Authentication checks
   - Role-based access
   - Redirect logic for unauthorized access

---

## Future Scalability

### Backend Integration Readiness

Current architecture supports seamless backend integration:

1. **API Layer**: Replace mock data with API calls
2. **Authentication**: JWT token management
3. **Real-time Updates**: WebSocket for live claim status
4. **Video Processing**: Stream upload to cloud storage (AWS S3, Cloudflare R2)
5. **AI Processing**: Integration with ML models for fraud detection

### Recommended Backend Stack

```
Technology Recommendations:
- Backend: Node.js (Express/Fastify) or Python (FastAPI)
- Database: PostgreSQL (relational) + Redis (caching)
- Object Storage: AWS S3 / Cloudflare R2
- ML Platform: TensorFlow Serving / AWS SageMaker
- Real-time: WebSocket (Socket.io) or Server-Sent Events
- Queue: Redis Queue / AWS SQS for async processing
- CDN: Cloudflare for video delivery
```

### Scalability Considerations

1. **Horizontal Scaling**: Stateless frontend, API gateway pattern
2. **Database Optimization**: Indexing on claim IDs, status fields
3. **Caching Strategy**: Redis for frequently accessed claims
4. **CDN Integration**: Offload video delivery to CDN
5. **Microservices**: Separate services for claim processing, fraud detection, payments

### Performance Optimizations

1. **Code Splitting**: Route-based lazy loading
2. **Image Optimization**: Responsive images, lazy loading
3. **Bundle Size**: Tree shaking, dependency optimization
4. **Caching**: Service worker for offline assets
5. **Video Compression**: Client-side video optimization before upload

### Mobile App Considerations

Current web app can be packaged as:
- **PWA (Progressive Web App)**: Install on mobile devices
- **React Native**: Reuse components with React Native Web
- **Capacitor/Ionic**: Wrap as native app with device API access

---

## Monitoring & Analytics (Future)

### Recommended Monitoring

1. **Error Tracking**: Sentry for frontend error monitoring
2. **Analytics**: Google Analytics / Mixpanel for user behavior
3. **Performance**: Lighthouse CI, Web Vitals monitoring
4. **Uptime**: Pingdom / UptimeRobot for availability
5. **Logs**: Centralized logging (ELK stack, Datadog)

### Key Metrics to Track

- Claim submission success rate
- Average fraud detection time
- Offline claim sync success rate
- User engagement (claims per user, session duration)
- System uptime and API latency
- Storage usage patterns

---

## Conclusion

The AIVALA Insurance Claim Platform is built with a modern, scalable, and user-centric architecture. Key strengths include:

✅ **Offline-First**: Handles intermittent connectivity gracefully  
✅ **Modular Design**: Easy to extend and maintain  
✅ **Comprehensive UI**: 51 reusable components  
✅ **Type Safety**: TypeScript for robust development  
✅ **Responsive**: Works across mobile and web  
✅ **Performance**: Optimized with Vite and code splitting  
✅ **Security**: Privacy-aware with clear user controls  

The platform is ready for backend integration and can scale to handle production workloads with appropriate infrastructure.

---

**Document Version**: 1.0  
**Last Updated**: April 27, 2026  
**Platform**: AIVALA Insurance Claim Platform
