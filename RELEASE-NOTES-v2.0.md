# SpeedoPage v2.0.0 - Major Release

## Release Date
November 5, 2025

## Overview
Version 2.0.0 is a major release that introduces user accounts, authentication, and multi-car garage functionality. This release transforms SpeedoPage from a single-device speedometer into a comprehensive vehicle performance tracking platform with persistent user data across devices.

---

## 🎉 Major New Features

### User Accounts & Authentication
- **User Registration & Login** - Create accounts with email and password
- **JWT Authentication** - Secure token-based authentication system
- **Password Security** - bcrypt password hashing with salt rounds
- **User Profiles** - Customizable display names and profile settings
- **Guest Mode** - Continue using the app without an account
- **Persistent Sessions** - Stay logged in across browser sessions

### Multi-Car Garage
- **Add Multiple Cars** - Track performance for all your vehicles
- **Car Profiles** - Store make, model, year, horsepower, and photos
- **Active Car Selection** - Easily switch between vehicles
- **Per-Car Statistics** - View best times and performance stats for each car
- **Car Management** - Full CRUD operations (Create, Read, Update, Delete)
- **Beautiful Garage UI** - Card-based grid layout with active car indicators

### Enhanced Session Tracking
- **User-Linked Sessions** - Sessions now tied to user accounts
- **Car-Specific Data** - Performance runs linked to specific vehicles
- **Cross-Device Sync** - Access your data from any device when logged in
- **Backward Compatibility** - Anonymous device-based tracking still works

---

## 🔧 Technical Changes

### Database Schema
New tables added to `speeds.db`:
- `users` - User accounts with authentication
- `cars` - Vehicle profiles and specifications
- `sessions` - Enhanced with userId and carId fields
- `achievements` - Foundation for future gamification
- `follows` - Foundation for future social features
- `password_resets` - Support for password recovery (future)

### API Endpoints

#### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and receive JWT token
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/logout` - Logout (client-side)
- `POST /api/auth/refresh` - Refresh JWT token

#### Cars (`/api/cars`)
- `GET /api/cars` - List all user's cars
- `POST /api/cars` - Add new car to garage
- `GET /api/cars/:carId` - Get specific car details
- `PUT /api/cars/:carId` - Update car information
- `DELETE /api/cars/:carId` - Remove car from garage
- `PUT /api/cars/:carId/set-active` - Set car as active
- `GET /api/cars/:carId/stats` - Get car performance statistics

#### User Profile (`/api/users`)
- `GET /api/users/:userId/profile` - Get user profile
- `PUT /api/users/:userId/profile` - Update profile settings
- `PUT /api/users/:userId/password` - Change password
- `DELETE /api/users/:userId/account` - Delete account
- `GET /api/users/:userId/stats` - Get user statistics

### Dependencies Added
- `bcrypt` (v6.0.0) - Password hashing
- `jsonwebtoken` (v9.0.2) - JWT token generation/validation
- `express-validator` (v7.3.0) - Request validation
- `express-rate-limit` (v8.2.1) - API rate limiting
- `uuid` (v13.0.0) - UUID generation

### Frontend Changes
- **AuthService Module** (`public/auth-service.js`) - Client-side authentication handling
- **Modal UI System** - Login/register modals with smooth animations
- **Garage View** - Complete garage management interface
- **View Switching** - Enhanced navigation between speedometer, summary, and garage
- **Auth State Management** - Real-time UI updates based on authentication status

---

## 📊 Database Migration

A migration script (`migrate-v2-user-accounts.js`) is included to upgrade existing v1.x databases to v2.0 schema. The migration:
- Creates all new tables
- Preserves existing speed logs and sessions
- Adds userId and carId columns to sessions table
- Maintains backward compatibility with anonymous sessions

**To migrate**: Run `node migrate-v2-user-accounts.js`

---

## 🔒 Security Features

- **Password Hashing** - Bcrypt with 10 salt rounds
- **Password Validation** - Minimum 8 characters, must include letters and numbers
- **JWT Tokens** - Secure, expiring tokens (24-hour lifetime)
- **Rate Limiting** - Protection against brute force attacks
- **SQL Injection Protection** - Parameterized queries throughout
- **Input Validation** - Express-validator on all endpoints
- **Ownership Verification** - Middleware ensures users can only access their own data

---

## 🎨 UI/UX Improvements

- **Gradient Backgrounds** - Modern, eye-catching design
- **Card-Based Layout** - Clean garage view with hover effects
- **Active Car Badge** - Visual indicator for currently selected vehicle
- **Modal Animations** - Smooth fade-in/out effects
- **Responsive Design** - Mobile-friendly garage and auth UI
- **Loading States** - Button states during async operations
- **Error Handling** - Clear error messages for failed operations

---

## 🔄 Backward Compatibility

Version 2.0 maintains full backward compatibility:
- **Anonymous Mode** - Can still use app without account
- **Device IDs** - Legacy deviceId-based tracking still works
- **Existing Data** - All v1.x speed logs preserved
- **Guest Sessions** - "Continue as Guest" option available

---

## 📝 Known Limitations

- Password reset functionality not yet implemented (table created for future use)
- Social features (achievements, follows) are database-ready but UI pending
- Car statistics only show top 3 best times in garage view
- No bulk session management yet

---

## 🚀 Upgrade Instructions

1. **Pull latest code** from repository
2. **Run migration**: `node migrate-v2-user-accounts.js`
3. **Install dependencies**: `npm install`
4. **Start server**: `npm start`
5. **Register account** or continue as guest

---

## 🐛 Bug Fixes

- Fixed view switching logic (added proper toggleView function)
- Improved GPS accuracy handling
- Enhanced session persistence across page reloads

---

## 📚 Documentation

- `CLAUDE.md` - Updated project overview
- `AWS-COMPLETE-SETUP.md` - AWS deployment guide
- `AWS-502-TROUBLESHOOTING.md` - Common AWS issues
- `AWS-MIGRATION-INSTRUCTIONS.md` - Migration guide
- `FIX-DATABASE-PERMISSIONS.md` - Database permission fixes

---

## 👥 Contributors

Generated with Claude Code (Anthropic)

---

## 🔮 Coming in Future Releases

- Password reset functionality
- Email verification
- Social features (leaderboards, friend following)
- Achievement system
- Session sharing and comparison
- Export sessions to CSV/JSON
- Advanced analytics and charts
- Push notifications for performance milestones

---

## ⚙️ System Requirements

- Node.js 14+ (tested on 18+)
- SQLite3
- Modern web browser with JavaScript enabled
- HTTPS for GPS functionality (or localhost)
- Geolocation API support

---

## 📄 License

ISC

---

## 🙏 Acknowledgments

Built on the solid foundation of SpeedoPage v1.x, enhanced with modern authentication and data management capabilities.

---

**For issues or feature requests**, please visit: https://github.com/yourusername/speedopage/issues
