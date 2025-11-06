# SpeedoPage v2.0 - User Guide

## Welcome to SpeedoPage

SpeedoPage is a GPS-based speedometer and vehicle performance tracker that turns your smartphone or tablet into a powerful tool for measuring acceleration, tracking sessions, and analyzing your vehicle's performance.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Guest Mode vs User Accounts](#guest-mode-vs-user-accounts)
3. [Using the Speedometer](#using-the-speedometer)
4. [Performance Timers](#performance-timers)
5. [Managing Your Garage](#managing-your-garage)
6. [Viewing Session History](#viewing-session-history)
7. [Understanding Your Data](#understanding-your-data)
8. [Settings and Preferences](#settings-and-preferences)
9. [Troubleshooting](#troubleshooting)
10. [Frequently Asked Questions](#frequently-asked-questions)

---

## Getting Started

### System Requirements

- A device with GPS capability (smartphone, tablet, or GPS-enabled laptop)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- HTTPS connection (GPS requires secure connection)
- JavaScript enabled
- Location services enabled

### First Launch

1. **Open SpeedoPage** in your web browser
2. **Grant location permissions** when prompted by your browser
3. **Choose your mode**:
   - Click "Continue as Guest" for immediate access
   - Click "Sign Up" to create an account for multi-car tracking and cross-device sync

### GPS Lock Indicators

SpeedoPage displays GPS status at the top of the screen:

- **Red "GPS Acquiring..."** - Searching for GPS signal
- **Yellow "GPS Low Accuracy"** - GPS found but accuracy insufficient (typically when indoors)
- **Green "GPS Locked"** - Good GPS signal, ready to track

**Pro Tip**: For best results, wait for a green GPS lock before starting your run. This typically takes 10-30 seconds outdoors with a clear view of the sky.

---

## Guest Mode vs User Accounts

### Guest Mode (No Account Required)

**Advantages:**
- Instant access, no registration needed
- Full speedometer and timer functionality
- Session tracking on your current device
- All data stored locally on your device

**Limitations:**
- Data only available on current device
- Cannot track multiple vehicles separately
- No cross-device synchronization
- Data lost if you clear browser storage

### User Accounts (Recommended)

**Advantages:**
- Multi-car garage with unlimited vehicles
- Per-car performance statistics
- Cross-device synchronization
- Access your data from any device
- Persistent data storage
- Customizable display name
- Future features (leaderboards, achievements)

**How to Create an Account:**

1. Click "Sign Up" on the main screen
2. Enter your email address
3. Create a password (minimum 8 characters, must include letters and numbers)
4. Optional: Add a display name
5. Click "Create Account"
6. You'll be automatically logged in

**Account Security:**
- Passwords are encrypted using bcrypt hashing
- JWT tokens secure your sessions
- Rate limiting prevents brute force attacks

---

## Using the Speedometer

### Main Speedometer View

The speedometer view shows:

- **Current Speed** (large center display)
- **vMax** - Maximum speed reached in current session
- **Distance** - Total distance traveled in current session
- **Duration** - Session elapsed time
- **Units Toggle** - Switch between mph and km/h
- **GPS Status** - Signal strength and accuracy

### Starting a Session

Sessions start automatically when:
- GPS acquires a lock
- Your vehicle begins moving (speed > 1 km/h / 0.6 mph)

### Ending a Session

Sessions end automatically when:
- You stop moving for several seconds
- Your speed drops below 1 km/h / 0.6 mph

The session is then automatically saved to your history.

### Unit Conversion

SpeedoPage automatically detects your country and displays appropriate units:

- **mph**: United States, United Kingdom, Myanmar
- **km/h**: Rest of world

**Manual Override:**
Click the units badge (e.g., "mph" or "km/h") to toggle between units. Manual selection disables automatic country detection.

### Incline Detection

SpeedoPage monitors road incline using GPS altitude data:

- **Downhill Warning**: When descending more than 2 degrees, a warning badge appears
- **Data Integrity**: Sessions performed on significant downhill slopes are flagged
- **Why it matters**: Gravity-assisted runs don't represent true vehicle performance

---

## Performance Timers

### Acceleration Timers

SpeedoPage tracks multiple acceleration benchmarks simultaneously:

**mph-based timers:**
- 0-60 mph
- 0-100 mph
- 0-150 mph
- 0-200 mph
- 30-60 mph (passing acceleration)
- 60-120 mph
- 60-130 mph
- 100-150 mph

**km/h-based timers:**
- 0-100 km/h
- 0-160 km/h
- 0-250 km/h
- 0-320 km/h
- 100-200 km/h
- 160-240 km/h

### Drag Racing Timers

Measures time to cover specific distances:

- **1/8 mile** (201 meters)
- **1/4 mile** (402 meters)
- **1/2 mile** (805 meters)
- **Standing mile** (1.6 km)

### How Timers Work

1. **Timer Activation**: Timers start automatically when you begin moving
2. **Real-Time Tracking**: All timers run simultaneously
3. **Completion**: When you reach a target speed or distance, that timer stops
4. **Session Display**: Completed timers appear in the session summary
5. **Best Times**: Your fastest times are highlighted in your vehicle's statistics

### Timer Reset

Timers reset automatically when:
- Your speed drops below 1 km/h (stopped)
- You begin a new run
- You manually click "Reset Timers"

**Important**: vMax (maximum speed) persists across timer resets within the same session. This allows multiple runs without ending your session.

---

## Managing Your Garage

*Note: Garage features require a user account. Sign up or log in to access.*

### Adding Your First Car

1. Click "My Garage" in navigation
2. Click "Add New Car" button
3. Fill in vehicle details:
   - **Name** (required): e.g., "My Mustang GT", "Daily Driver"
   - **Make**: Brand (e.g., Ford, Toyota, BMW)
   - **Model**: Model name (e.g., Mustang, Camry, M3)
   - **Year**: Model year
   - **Trim**: Trim level or package (e.g., GT, Premium, Competition)
   - **Color**: Vehicle color
   - **Horsepower**: Engine power rating
   - **Weight**: Vehicle weight (with units)
   - **Drivetrain**: FWD, RWD, AWD, 4WD
   - **Transmission**: Manual, Automatic, DCT, CVT
   - **Notes**: Any additional information
4. Click "Save Car"

### Selecting Active Car

Before each driving session, select which car you're driving:

1. Open "My Garage"
2. Find your vehicle card
3. Click "Set Active" button
4. A green "ACTIVE" badge appears on the selected car

**Important**: Sessions are only saved with car data when you have an active car selected. Always set your active car before starting a run.

### Editing Car Information

1. Navigate to "My Garage"
2. Click "Edit" on the car you want to modify
3. Update any fields
4. Click "Save Changes"

### Viewing Car Statistics

Each car card displays:
- **Best Times**: Top 3 acceleration records
- **Best Distances**: Top 3 drag racing times
- **Total Sessions**: Number of recorded runs

For detailed statistics:
1. Click on a car card
2. View complete performance history
3. Compare times across multiple sessions

### Deleting a Car

1. Go to "My Garage"
2. Click "Edit" on the car
3. Scroll down and click "Delete Car"
4. Confirm deletion

**Warning**: Deleting a car does NOT delete the session data associated with it. Sessions remain in your history but will show the car name as stored at the time of the session.

---

## Viewing Session History

### Summary View

The Summary view displays all your saved sessions:

1. Click "Summary" in the navigation
2. Sessions appear in reverse chronological order (newest first)
3. Each session card shows:
   - Date and time
   - Vehicle name (if logged in with active car)
   - Maximum speed (vMax)
   - Total distance
   - Duration
   - Completed performance timers
   - Incline warning (if applicable)

### Session Details

Click on any session card to expand details:

- All completed acceleration timers
- All completed distance timers
- Session start and end times
- GPS accuracy information

### Filtering and Sorting

**Filter by Vehicle** (account users only):
- Click vehicle name filter at top of Summary
- Select specific car to view only that car's sessions

**Unit Preferences**:
- Click gear icon in Summary view
- Toggle between mph/km/h for speeds
- Toggle between mi/km for distances
- Preferences saved per-device

### Data Management

**Delete Sample Data**:
- When first using SpeedoPage, sample sessions demonstrate features
- Click "Delete Sample Data" to remove example sessions
- Your real sessions remain untouched

**Delete Your Data**:
- Click "Delete My Data" to remove all YOUR sessions
- Sample data remains (if not deleted separately)
- Confirmation required before deletion

**Delete All Data**:
- Requires typing "CONFIRM-DELETE-ALL"
- Removes ALL session data from database
- Use with extreme caution
- No undo available

---

## Understanding Your Data

### Speed Measurements

SpeedoPage calculates speed using:
1. **GPS Position Updates**: Latitude/longitude from device GPS
2. **Haversine Formula**: Calculates distance between consecutive positions
3. **Time Delta**: Measures time between position updates
4. **Speed Calculation**: Distance ÷ Time = Speed

**Accuracy Factors**:
- GPS update rate (typically 1-10 Hz)
- Satellite visibility (4+ satellites recommended)
- Atmospheric conditions
- Device GPS quality
- Urban canyons / signal interference

### Distance Tracking

Distance is calculated by:
- Summing GPS position changes over time
- Using the Haversine formula for great-circle distance
- Accounting for Earth's curvature

**Note**: Distance accuracy depends on GPS update frequency. Faster updates = more accurate distance tracking.

### Altitude and Incline

**Altitude Tracking**:
- GPS provides altitude data (less accurate than position)
- 10-point rolling average smooths altitude fluctuations
- Incline calculated from altitude change over distance

**Incline Thresholds**:
- **Warning at 2° downhill**: Sessions flagged as potentially gravity-assisted
- **Why it matters**: Ensures performance comparisons are fair

### Internal Storage Format

- **All speeds stored in km/h** internally
- **Converted to mph** only for display
- **Ensures data consistency** across unit switches
- **Distance stored in kilometers** internally

---

## Settings and Preferences

### Unit Preferences

**Speedometer View**:
- Click the unit badge (mph or km/h) to toggle
- Manual selection disables auto-detection
- Preference remembered until you toggle again or reload

**Summary View**:
- Click gear icon for unit preferences
- Separate controls for speed and distance
- Settings saved per-device in localStorage

### Display Name

*Account users only*

1. Log in to your account
2. Click your email/name at top right
3. Click "Profile Settings"
4. Update display name
5. Click "Save Changes"

### Password Change

1. Log in to your account
2. Click your email/name at top right
3. Click "Change Password"
4. Enter current password
5. Enter new password (minimum 8 characters)
6. Confirm new password
7. Click "Update Password"

### Account Deletion

**Warning**: This is permanent and cannot be undone.

1. Log in to your account
2. Click your email/name at top right
3. Click "Delete Account"
4. Confirm deletion
5. All your cars and sessions will be permanently deleted

---

## Troubleshooting

### GPS Not Working

**Symptoms**: "GPS Acquiring..." never goes away

**Solutions**:
1. **Check location permissions**: Browser must have permission to access GPS
   - Chrome: Click padlock icon → Site Settings → Location → Allow
   - Firefox: Click shield/lock icon → Permissions → Location → Allow
   - Safari: Settings → Privacy → Location Services → On
2. **Ensure HTTPS**: GPS API requires secure connection (https:// or localhost)
3. **Go outside**: GPS rarely works indoors
4. **Wait longer**: Initial GPS lock can take 30-60 seconds
5. **Check device GPS**: Open maps app to verify GPS works
6. **Restart browser**: Close all tabs and reopen

### Speed Shows Zero or Inaccurate

**Symptoms**: Moving but speed shows 0, or wildly incorrect speeds

**Solutions**:
1. **Wait for GPS lock**: Green "GPS Locked" indicator
2. **Improve satellite visibility**: Avoid tunnels, parking garages, dense urban areas
3. **Check GPS accuracy**: SpeedoPage requires accuracy better than 50 meters
4. **Verify motion**: GPS speed requires actual movement (not stationary)
5. **Device quality**: Older devices may have lower-quality GPS receivers

### Timers Not Recording

**Symptoms**: Reach target speed/distance but timer doesn't record

**Solutions**:
1. **Check GPS lock**: Timers only work with valid GPS
2. **Ensure movement**: Speed must exceed 1 km/h to start timers
3. **Check session status**: Session must be active (distance > 0)
4. **Verify target reached**: Ensure you actually reached the target speed/distance
5. **Look at session history**: Timer may have recorded in previous session

### Sessions Not Saving

**Symptoms**: Run completed but doesn't appear in Summary

**Solutions**:
1. **Check session duration**: Very short sessions (< 10 seconds) may not save
2. **Verify GPS lock**: Sessions without valid GPS data don't save
3. **For logged-in users**: Ensure you selected an active car
4. **Check browser storage**: localStorage must be enabled
5. **Database connection**: Verify server connection (check browser console)

### Login Issues

**Symptoms**: Cannot log in, "Invalid credentials" error

**Solutions**:
1. **Verify email**: Ensure email is typed correctly
2. **Check password**: Passwords are case-sensitive
3. **Account exists**: If you haven't registered, sign up first
4. **Token expiration**: Logout completely and log back in
5. **Clear cache**: Try clearing browser cache and cookies

### Can't Add Car to Garage

**Symptoms**: "Add Car" button not working or error saving car

**Solutions**:
1. **Must be logged in**: Garage requires user account
2. **Fill required fields**: Car name is mandatory
3. **Check field limits**: Names limited to 100 characters
4. **Check connection**: Verify internet connection active
5. **Check browser console**: Look for error messages

---

## Frequently Asked Questions

### General Questions

**Q: Is SpeedoPage free?**
A: Yes, SpeedoPage is completely free to use with all features available.

**Q: Do I need an account?**
A: No, you can use SpeedoPage as a guest. However, creating an account enables multi-car tracking and cross-device sync.

**Q: Does SpeedoPage work offline?**
A: The GPS works offline, but you need internet connectivity to save sessions to the server and sync across devices.

**Q: What data does SpeedoPage collect?**
A: SpeedoPage collects GPS speed data, session information, and account details (if registered). No personal data is sold or shared with third parties.

**Q: How accurate is SpeedoPage?**
A: GPS speed is generally accurate to within 0.5-2 mph (1-3 km/h) under good conditions. Accuracy depends on GPS quality, satellite visibility, and environmental factors.

### Technical Questions

**Q: Why does SpeedoPage require HTTPS?**
A: Web browsers require secure connections (HTTPS) to access location services for privacy and security reasons.

**Q: How often does GPS update?**
A: GPS update rates vary by device, typically 1-10 times per second. SpeedoPage uses "high accuracy" mode for best results.

**Q: Can I export my data?**
A: Data export functionality is planned for a future release. Currently, data is stored in the database and viewable in the Summary view.

**Q: Does SpeedoPage drain my battery?**
A: GPS usage does consume battery. For extended sessions, use a power source or car charger.

**Q: Can I use SpeedoPage in landscape mode?**
A: Yes, SpeedoPage's responsive design works in both portrait and landscape orientations.

### Performance Tracking Questions

**Q: Why did my timer not record?**
A: Timers only record when GPS has a good lock and you actually reach the target speed or distance. Incline warnings may also invalidate some runs.

**Q: What's the difference between mph and km/h timers?**
A: They're different benchmarks. 0-60 mph ≈ 0-97 km/h, while 0-100 km/h ≈ 0-62 mph. Both are tracked separately.

**Q: Why does SpeedoPage flag downhill runs?**
A: Gravity assistance makes downhill performance times unrealistic. The flag ensures fair comparisons.

**Q: Can I compare times with my friends?**
A: Not yet, but social features and leaderboards are planned for future releases.

**Q: How is vMax different from current speed?**
A: vMax is the maximum speed reached during the current session. It persists even when you slow down or stop.

### Account Questions

**Q: Can I change my email address?**
A: Email change functionality is not currently available. Contact support if you need to change your email.

**Q: I forgot my password. How do I reset it?**
A: Password reset functionality is coming in a future update. Currently, you'll need to create a new account.

**Q: Can I have multiple accounts?**
A: While technically possible, we recommend using one account and adding all your vehicles to your garage.

**Q: What happens to my data if I delete my account?**
A: All data (cars and sessions) is permanently deleted and cannot be recovered.

**Q: How long do sessions stay in my history?**
A: Sessions are stored indefinitely unless you manually delete them.

---

## Safety Notice

**IMPORTANT**: SpeedoPage is designed for entertainment and informational purposes on closed courses and private property.

**Safety Guidelines**:
- Never use SpeedoPage while driving in traffic
- Performance testing should only be done on closed courses or racetracks
- Always obey local traffic laws and speed limits
- Use a mount or holder for your device - never hold it while driving
- Have a passenger operate SpeedoPage during runs
- Ensure GPS device is securely mounted to prevent distraction

**Legal Disclaimer**: The developers of SpeedoPage are not responsible for any traffic violations, accidents, or injuries resulting from the use of this application. Always prioritize safety over performance numbers.

---

## Getting Help

### Support Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Complete API and developer guides available
- **Community Forums**: Connect with other SpeedoPage users

### Reporting Bugs

If you encounter a problem:

1. Check this troubleshooting guide first
2. Check browser console for error messages (F12 → Console)
3. Note exact steps to reproduce the issue
4. Include device type, browser version, and GPS conditions
5. Report on GitHub issues page with details

### Feature Requests

Have an idea to improve SpeedoPage? We'd love to hear it!

- Submit feature requests on GitHub
- Describe the feature and why it would be useful
- Vote on existing feature requests

---

## What's Next?

### Coming Soon

- Password reset functionality
- Email verification
- Session export (CSV, JSON)
- Advanced analytics and charts
- Leaderboards and competitions
- Achievement system
- Social features (follow friends, share sessions)
- Push notifications for new PRs

### Stay Updated

Follow the project on GitHub for release announcements and updates.

---

## Conclusion

Thank you for using SpeedoPage! We hope this guide helps you get the most out of the application. Whether you're tracking your daily commute or setting personal records on track day, SpeedoPage provides accurate, reliable performance data.

Drive safe, have fun, and enjoy tracking your performance!

---

**SpeedoPage v2.0.0**
*Last Updated: November 5, 2025*
