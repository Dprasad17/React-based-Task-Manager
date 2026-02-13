# 📋 React-based Task Manager

A feature-rich, security-first **React Native** task management application built with TypeScript, Redux Toolkit, and React Navigation. Manage your tasks on the go with offline support, biometric authentication, dark mode, and smooth Lottie animations.

---

## ✨ Features

### 🔐 Security & Authentication
- **PIN & Biometric Login** — Set up a PIN code and optionally use fingerprint/face unlock
- **Session Timeout** — Automatic logout after inactivity to protect your data
- **Rooted/Jailbroken Device Detection** — Blocks usage on compromised devices
- **Secure Storage** — Credentials stored with `react-native-keychain`

### 📝 Task Management
- **Create, View, Edit & Delete Tasks** — Full CRUD with priority levels (High / Medium / Low)
- **Task Details Screen** — Expanded view with descriptions, images, and metadata
- **Image Attachments** — Attach photos to tasks using the device camera or gallery
- **Priority Color Coding** — Visual indicators for task urgency
- **Pull-to-Refresh** — Instantly refresh your task list

### 🌐 Offline-First Architecture
- **Local Storage with AsyncStorage** — Tasks persist even without internet
- **API Sync** — Fetch and merge tasks from a remote API when online
- **Network Awareness** — Automatic detection of connectivity via `@react-native-community/netinfo`
- **Data Caching** — Smart caching layer with configurable expiration

### 🎨 UI & Experience
- **Dark / Light Mode** — Toggle theme with persistent preference
- **Lottie Animations** — Polished loading, success, error, and empty-state animations
- **Gesture Handling** — Swipe and gesture interactions via `react-native-gesture-handler`
- **Smooth Transitions** — Animated list items and screen transitions

### ⚙️ Developer Experience
- **TypeScript** — Type-safe codebase
- **Redux Toolkit** — Centralized state management
- **Performance Monitoring** — Built-in performance tracking service
- **Error Boundary** — Graceful error handling with recovery UI
- **ESLint & Prettier** — Consistent code style

---

## 🏗️ Project Structure

```
app/
├── App.tsx                  # Root component & navigation setup
├── components/
│   ├── ErrorBoundary.jsx    # App-wide error catching
│   ├── GestureHandler.jsx   # Swipe & gesture utilities
│   ├── LottieAnimation.jsx  # Reusable animation wrapper
│   ├── PinInput.jsx         # PIN entry keypad
│   ├── SecureScreen.tsx     # Screen-level security wrapper
│   └── SessionTimeout.jsx   # Inactivity auto-logout
├── context/
│   ├── AuthContext.tsx       # Authentication state & flow
│   └── ProfileContext.jsx    # User profile state
├── screens/
│   ├── LoginScreen.tsx       # Email/password login
│   ├── PinSetupScreen.jsx    # First-time PIN creation
│   ├── PinLoginScreen.jsx    # PIN/biometric unlock
│   ├── HomeScreen.jsx        # Task list dashboard
│   ├── AddTaskScreen.jsx     # Create new task
│   ├── TaskDetailsScreen.jsx # View/edit task details
│   ├── ProfileScreen.jsx     # User profile & avatar
│   ├── SettingsScreen.jsx    # App settings & logout
│   ├── RootedDeviceScreen.jsx# Security block screen
│   └── SplashScreen.jsx      # Loading splash
├── services/
│   ├── ApiService.js         # REST API client (Axios)
│   ├── AuthService.js        # Token & credential management
│   ├── NotificationService.js# Push notification handling
│   ├── PerformanceMonitor.js # Performance tracking
│   ├── PermissionService.js  # Runtime permission requests
│   └── StorageService.js     # AsyncStorage + caching layer
├── store/
│   └── store.js              # Redux store configuration
├── assets/                   # Lottie JSON files & images
└── mock-api/                 # Mock API for development
```

---

## 🚀 Getting Started

### Prerequisites

| Tool        | Version  |
|-------------|----------|
| **Node.js** | ≥ 20     |
| **npm**     | ≥ 9      |
| **React Native CLI** | Latest |
| **Android Studio** | Latest (for Android) |
| **Xcode**   | Latest (for iOS, macOS only) |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Dprasad17/React-based-Task-Manager.git
cd React-based-Task-Manager/app

# 2. Install dependencies
npm install

# 3. Install iOS pods (macOS only)
cd ios && pod install && cd ..
```

### Running the App

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

---

## 🔄 Authentication Flow

```
App Launch
    │
    ▼
Device Integrity Check ──▶ Blocked (if rooted/jailbroken)
    │
    ▼
Login Screen (email/password)
    │
    ▼
PIN Setup (first-time only)
    │
    ▼
PIN / Biometric Unlock
    │
    ▼
Home Screen ◀──▶ Session Timeout → Auto Logout
```

---

## 🛠️ Tech Stack

| Category           | Technology                              |
|--------------------|-----------------------------------------|
| **Framework**      | React Native 0.82                       |
| **Language**       | TypeScript / JavaScript                 |
| **Navigation**     | React Navigation 7 (Native Stack + Tabs)|
| **State**          | Redux Toolkit + React Context           |
| **Storage**        | AsyncStorage + Keychain                 |
| **Networking**     | Axios + NetInfo                         |
| **Animations**     | Lottie + React Native Animated API      |
| **Notifications**  | Notifee                                 |
| **Auth**           | react-native-biometrics + PIN           |
| **Testing**        | Jest + React Test Renderer              |

---

## 🧪 Testing

```bash
# Run unit tests
npm test
```

---

## 📄 License

This project is open-source and available for personal and educational use.

---

## 👤 Author

**Dprasad17** — [GitHub Profile](https://github.com/Dprasad17)
