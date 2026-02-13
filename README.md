# HikerNet 🏔️

A full-stack social networking application for hiking and outdoor enthusiasts, combining real-time GPS tracking, social features, and safety mechanisms.

## 📱 Overview

**HikerNet** is a comprehensive platform for trekkers that enables:
- Real-time GPS trek tracking (solo & group)
- Social networking (posts, stories, followers)
- End-to-end encrypted chat
- Weather integration & safety features
- Trail discovery & leaderboards
- Cross-platform support (iOS, Android, Web)

**Development Duration**: 38 days (Jan 6 - Feb 12, 2026)  
**Team Size**: 3 developers  
**Total PRs**: 29 merged pull requests

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- Expo CLI
- MongoDB instance

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/lezinsaajid/HikerNet_og.git
cd HikerNet_og
```

2. **Backend Setup**
```bash
cd Backend
npm install
```

Create `.env` file in Backend:
```env
PORT=3000
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_secret_key>
CLOUDINARY_CLOUD_NAME=<cloudinary_name>
CLOUDINARY_API_KEY=<cloudinary_key>
CLOUDINARY_API_SECRET=<cloudinary_secret>
GOOGLE_CLIENT_ID=<google_oauth_client_id>
CHAT_ENCRYPTION_KEY=<256_bit_hex_key>
```

Start backend:
```bash
npm run dev
```

3. **Frontend Setup**
```bash
cd Frontend
npm install
```

Create `.env` file in Frontend:
```env
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000/api
```

**Important**: Replace `<YOUR_LOCAL_IP>` with your machine's local IP address (e.g., `192.168.1.100`)

Start frontend:
```bash
npm start
# Then press:
# - 'a' for Android
# - 'i' for iOS
# - 'w' for Web
```

---

## 🏗️ Tech Stack

### Frontend
- **React Native** 0.81.5 with **Expo** ~54.0
- **Expo Router** (file-based routing)
- **MapLibre** (native maps) / **React Leaflet** (web)
- **TweetNaCl** (E2EE encryption)
- **Lottie** (animations)

### Backend
- **Express.js** 5.2.1
- **MongoDB** with **Mongoose** ODM
- **JWT** authentication
- **Cloudinary** (media storage)
- **OpenStreetMap** API (trail discovery)

### Security
- E2EE messaging with **TweetNaCl**
- **PBKDF2** key derivation (100k iterations)
- **bcrypt** password hashing
- **Expo SecureStore** for key storage

---

## 📂 Project Structure

```
HikerNet_og/
├── Backend/
│   ├── src/
│   │   ├── index.js           # Express server
│   │   ├── models/            # MongoDB schemas (User, Trek, Post, etc.)
│   │   ├── routes/            # API endpoints
│   │   ├── middleware/        # Auth, activity tracking
│   │   └── lib/               # Services (DB, encryption, cron, etc.)
│   └── package.json
│
├── Frontend/
│   ├── app/                   # Expo Router screens
│   │   ├── (auth)/           # Login/signup
│   │   ├── (tabs)/           # Main tab navigation
│   │   ├── trek/             # Trek screens
│   │   ├── chat/             # Chat screens
│   │   └── ...
│   ├── components/           # Reusable UI components
│   ├── context/              # Auth context
│   ├── utils/                # Encryption, helpers
│   └── package.json
│
├── TECHNICAL_DOCUMENTATION.md  # Full technical details
└── README.md                   # This file
```

---

## ✨ Core Features

### 🥾 Trek Management
- **Solo & Group Treks**: Start treks alone or with friends
- **Real-time GPS Tracking**: Accurate location tracking with sensors
- **Waypoints**: Add custom markers with photos and descriptions
- **Statistics**: Distance, duration, elevation gain, average speed
- **GeoJSON Paths**: Industry-standard geospatial data format

### 👥 Social Network
- **Posts & Stories**: Share experiences (stories expire in 24h)
- **Followers/Following**: Build your trekker network
- **Likes & Comments**: Engage with the community
- **User Profiles**: Bio, location, profile picture, trek history

### 💬 Encrypted Chat
- **End-to-End Encryption**: TweetNaCl implementation
- **Public-Key Cryptography**: Server can't read messages
- **Key Backup**: PBKDF2-protected recovery system
- **Online Status**: Real-time presence indicators

### 🏔️ Group Treks
- **Room System**: Create trek rooms with unique codes
- **Invitations**: Send trek invites to followers
- **Ready Status**: Coordinate group members before starting
- **Acceptance Workflow**: Leaders approve/reject join requests

### 🏆 Leaderboards & Competition
- **Distance Rankings**: Top trekkers by total distance
- **Trek Counter**: Track completed treks
- **Profile Integration**: Display user rank and stats

### 🌦️ Weather & Safety
- **Weather API**: Location-based weather data
- **Weather Alerts**: Trek safety warnings
- **Emergency Contacts**: Store multiple emergency contacts
- **Location Sharing**: Safety-first design

### 🗺️ Trail Discovery
- **OpenStreetMap Integration**: Automated trail data fetching
- **Points of Interest**: Discover nearby trails
- **Adventure Routes**: Browse and explore new trails
- **Geospatial Queries**: Find trails within radius

---

## 📚 Documentation

- **[Technical Documentation](./TECHNICAL_DOCUMENTATION.md)**: Comprehensive technical overview
  - System architecture diagrams
  - Complete API endpoint documentation
  - Data model relationships
  - Security implementation details
  - Performance optimizations
  - Deployment guide

- **[Development Work Plan](./DEVELOPMENT_WORKPLAN.md)**: Complete development history
  - 8 development phases (Jan 6 - Feb 12, 2026)
  - All 60+ commits with descriptions
  - 29 pull requests breakdown
  - Team contributions & sprint metrics
  - Bug fixes & optimizations
  - Recommended next steps

---

## 👥 Team

| Developer | Role & Contributions |
|-----------|---------------------|
| **lezinsaajid** (28 commits) | Backend architecture, UI/UX, social features, weather integration |
| **jerii-4 / Jerin Thomas** (16 commits) | Trek system, group functionality, **E2EE chat implementation** |
| **ANSHIDA SHIRIN** (16 commits) | Trail tracking, leaderboard, map visualization, profile UI |

---

## 🎯 Key Achievements

- ✅ **Full-stack app in 38 days** with production-ready features
- ✅ **End-to-end encryption** from scratch using TweetNaCl
- ✅ **Real-time GPS tracking** with MongoDB geospatial queries
- ✅ **Cross-platform** support (iOS, Android, Web)
- ✅ **29 successful PRs** with code review process
- ✅ **50+ features** including authentication, social network, chat, trek tracking

---

## 🔐 Security Features

1. **JWT Authentication**: Stateless token-based auth
2. **Password Hashing**: bcrypt with 10 salt rounds
3. **E2EE Messaging**: 
   - TweetNaCl (X25519-XSalsa20-Poly1305)
   - Client-side key generation
   - PBKDF2 key backup (100k iterations)
4. **Secure Storage**: Expo SecureStore (iOS Keychain / Android Keystore)
5. **Privacy Controls**: User blocking, trek privacy settings

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| Development Days | 38 days |
| Total Commits | 60+ |
| Pull Requests | 29 merged |
| Backend Routes | 12 modules |
| Frontend Screens | 20+ screens |
| Database Models | 9 models |
| API Endpoints | 50+ endpoints |
| Team Members | 3 developers |

---

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth

### Treks
- `POST /api/treks/start` - Start new trek
- `PATCH /api/treks/:id/end` - Complete trek
- `POST /api/treks/:id/waypoint` - Add waypoint
- `GET /api/treks/feed` - Get trek feed

### Social
- `POST /api/posts/create` - Create post
- `POST /api/stories/create` - Create story
- `POST /api/posts/like/:id` - Like post
- `POST /api/users/:id/follow` - Follow user

### Chat
- `POST /api/chat/send` - Send encrypted message
- `GET /api/chat/conversations` - Get conversations
- `POST /api/chat/keys/exchange` - Exchange encryption keys

### Group Treks
- `POST /api/rooms/create` - Create trek room
- `POST /api/rooms/join` - Join with code
- `POST /api/rooms/:id/accept/:userId` - Accept member

*See [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) for full API reference*

---

## 🔮 Future Roadmap

### Short-term
- [ ] Offline mode with map caching
- [ ] Push notifications (Expo Push)
- [ ] Group E2EE chat
- [ ] GPX/KML export
- [ ] Enhanced photo gallery

### Medium-term
- [ ] AI trail recommendations
- [ ] Achievement badges
- [ ] Trek challenges
- [ ] Social sharing (external platforms)
- [ ] Advanced analytics dashboard

### Long-term
- [ ] WebSocket real-time location
- [ ] Premium features / payment system
- [ ] Multi-language support
- [ ] Wearable integration (smartwatches)
- [ ] Trek marketplace

---

## 🐛 Known Issues

- Sender cannot decrypt own sent messages (E2EE design limitation)
- No forward secrecy (static key pairs)
- Metadata not protected (who talks to whom is visible to server)

*See [E2EE documentation](./docs/e2ee_nacl_explanation.md) for detailed security analysis*

---

## 📄 License

This project is part of an academic/portfolio demonstration.

---

## 🙏 Acknowledgments

- **MongoDB** for excellent geospatial support
- **Expo** for simplifying React Native development
- **TweetNaCl** for auditable cryptography
- **OpenStreetMap** for trail data

---

## 📞 Contact

For questions or collaboration:
- Repository: [github.com/lezinsaajid/HikerNet_og](https://github.com/lezinsaajid/HikerNet_og)

---

**Built with ❤️ by the HikerNet team** | Jan-Feb 2026