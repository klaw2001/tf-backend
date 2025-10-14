# 📧 Offline Chat Notifications - Implementation Summary

## 🎯 What Was Implemented

### 1. **Email Notification System (Brevo/SMTP)**
- ✅ Created email helper with Brevo integration
- ✅ Professional HTML email templates for chat messages
- ✅ Automatic email sending when recipient is offline
- ✅ Email contains message preview and link to conversation

### 2. **Offline Notification Logic**
- ✅ Backend detects if user is online via socket
- ✅ If offline: Creates in-app notification + sends email
- ✅ If online: Only sends real-time socket event
- ✅ Non-blocking: Message send doesn't fail if notification fails

### 3. **Online/Offline Status Events**
- ✅ Auto-broadcast when users connect/disconnect
- ✅ Manual status control (set_online/set_offline)
- ✅ Single user status check
- ✅ Batch status check for multiple users
- ✅ Real-time presence indicators support

### 4. **Push Notification Support (Commented)**
- ✅ Code structure ready for FCM/APNS
- ✅ Commented out for future implementation
- ✅ Easy to enable when needed

---

## 📁 Files Created/Modified

### Created Files:
1. **`src/app/helpers/emailHelper.js`** - Brevo email integration
2. **`SOCKET_ONLINE_OFFLINE_DOCS.md`** - Documentation for frontend
3. **`OFFLINE_NOTIFICATIONS_IMPLEMENTATION.md`** - This file

### Modified Files:
1. **`src/app/modules/chat/chatSocketHandler.js`**
   - Added `isUserOnline()` helper function
   - Updated `send_message` event with offline notification logic
   - Imports for email and notification helpers

2. **`src/socket/socketServer.js`**
   - Added online/offline broadcast events
   - Added status check endpoints
   - Manual status control events

3. **`package.json`**
   - Added `nodemailer` dependency

4. **`src/config/index.js`** (Already had Brevo creds)
   - Using existing `brevoCreds` for email

---

## 🚀 Installation & Setup

### Step 1: Install Dependencies
```bash
npm install
```

This will install the newly added `nodemailer` package.

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# Brevo Email Configuration (Already configured)
BREVO_HOST=smtp-relay.brevo.com
BREVO_MAIL_PORT=587
BREVO_USER=99482b001@smtp-brevo.com
BREVO_PASSWORD=your-brevo-password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:4000
```

### Step 3: Update Prisma Client (If needed)
```bash
npm run db:generate
npm run db:push
```

### Step 4: Restart Server
```bash
npm run dev
```

---

## 🔄 How It Works

### Scenario 1: Both Users Online
```
User A (online) → sends message → User B (online)
├─ ✅ Message saved to DB
├─ ✅ Real-time socket event sent
├─ ✅ Marked as delivered immediately
└─ ❌ No email/notification (user is online)
```

### Scenario 2: Recipient Offline
```
User A (online) → sends message → User B (offline)
├─ ✅ Message saved to DB
├─ ✅ Socket event sent (no one receives)
├─ ✅ Backend detects User B is offline
├─ ✅ In-app notification created
├─ ✅ Email notification sent to User B
└─ 🔔 (Future) Push notification sent
```

### Scenario 3: User Comes Back Online
```
User B (offline) → goes online
├─ ✅ Fetches unread notifications via REST API
├─ ✅ Sees "New message from User A"
├─ ✅ Clicks notification → Opens chat
├─ ✅ Joins conversation socket room
└─ ✅ Messages marked as delivered
```

---

## 📧 Email Notification Details

### Email Template Features:
- **Professional HTML design** with TalentFlip branding
- **Message preview** (first 200 characters)
- **"View Message" button** linking to conversation
- **Plain text fallback** for email clients without HTML support
- **Responsive design** for mobile devices

### Sample Email:
```
Subject: New message from John Doe

Hi Sarah,

You have a new message from John Doe:

"Hey, are you available for a call this afternoon?"

[View Message Button] → links to: http://localhost:4000/chat/123
```

### Email Service:
- **Provider**: Brevo (formerly Sendinblue)
- **Method**: SMTP
- **Port**: 587 (TLS)
- **From**: "TalentFlip Chat" <noreply@talentflip.ai>

---

## 🟢 Online/Offline Events

### Auto Events (No action required):

**When user connects:**
```javascript
// Broadcasted to all other users
{
  event: 'user_online',
  payload: { userId: 123, userName: 'John Doe', timestamp: '2025-10-14T...' }
}
```

**When user disconnects:**
```javascript
// Broadcasted to all other users
{
  event: 'user_offline',
  payload: { userId: 123, userName: 'John Doe', timestamp: '2025-10-14T...' }
}
```

### Manual Events (Frontend can emit):

**Check single user:**
```javascript
socket.emit('check_user_status', { userId: 123 });
// Response: { userId: 123, isOnline: true, timestamp: '...' }
```

**Check multiple users:**
```javascript
socket.emit('check_multiple_users_status', { userIds: [123, 456, 789] });
// Response: { statuses: [{ userId: 123, isOnline: true }, ...], timestamp: '...' }
```

---

## 🎨 Frontend Integration Guide

### 1. Listen for Online/Offline Events
```javascript
socket.on('user_online', ({ userId, userName }) => {
  console.log(`${userName} is now online`);
  updateUserStatus(userId, 'online');
});

socket.on('user_offline', ({ userId, userName }) => {
  console.log(`${userName} went offline`);
  updateUserStatus(userId, 'offline');
});
```

### 2. Check Status on Load
```javascript
// When loading conversation list
const userIds = conversations.map(c => c.otherUserId);
socket.emit('check_multiple_users_status', { userIds });

socket.once('multiple_users_status_response', ({ statuses }) => {
  statuses.forEach(({ userId, isOnline }) => {
    updateUserStatus(userId, isOnline ? 'online' : 'offline');
  });
});
```

### 3. Display Online Indicator
```javascript
// In chat UI
{isOtherUserOnline ? (
  <span className="status online">🟢 Online</span>
) : (
  <span className="status offline">⚫ Offline</span>
)}
```

### 4. Handle Offline Notifications
```javascript
// When user opens app
async function checkOfflineNotifications() {
  const res = await fetch('/api/common/notifications?isRead=false');
  const { notifications } = await res.json();
  
  const chatNotifications = notifications.filter(
    n => n.notification_name === 'new_chat_message'
  );
  
  // Show notification badge
  setBadgeCount(chatNotifications.length);
}
```

---

## 🔔 Push Notifications (Future Implementation)

The code is ready for push notifications. To enable:

### Step 1: Install Firebase/APNS Package
```bash
npm install firebase-admin
# or
npm install apn
```

### Step 2: Create Push Service
```javascript
// src/services/pushNotificationService.js
export async function sendPushNotification(userId, payload) {
  // FCM/APNS implementation
}
```

### Step 3: Uncomment in chatSocketHandler.js
```javascript
// Line ~250 in chatSocketHandler.js
// Uncomment the push notification code:
const pushNotificationService = await import('../../services/pushNotificationService.js');
await pushNotificationService.sendPushNotification(recipientUserId, {
  title: socket.user.user_full_name,
  body: trimmedMessage.substring(0, 100),
  icon: socket.user.profile_image || '/default-avatar.png',
  data: {
    type: 'chat_message',
    conversationId: conversationIdInt,
    senderId: socket.user.user_id
  }
});
```

---

## ✅ Testing Checklist

### Backend Tests:
- [ ] User A sends message to offline User B
- [ ] Verify in-app notification created in database
- [ ] Verify email sent to User B
- [ ] Verify email contains correct message preview
- [ ] Verify email link navigates to correct conversation
- [ ] User A sends message to online User B
- [ ] Verify NO email sent (user is online)
- [ ] Verify real-time socket event received

### Socket Tests:
- [ ] User connects → `user_online` broadcasted
- [ ] User disconnects → `user_offline` broadcasted
- [ ] Check single user status → correct response
- [ ] Check multiple users status → correct batch response
- [ ] Manual set_online → status broadcasted
- [ ] Manual set_offline → status broadcasted

### Email Tests:
- [ ] Check spam folder if email not in inbox
- [ ] Verify HTML rendering in Gmail, Outlook, Apple Mail
- [ ] Click "View Message" button → opens correct chat
- [ ] Plain text version displays correctly

---

## 📊 Database Schema (Already Exists)

### Notification Table
```sql
notification (
  notification_id: INT PRIMARY KEY,
  user_id: INT,
  notification_name: VARCHAR(255),
  notification_heading: VARCHAR(255),
  notification_text: VARCHAR(255),
  notification_image: VARCHAR(255),
  is_read: BOOLEAN,
  status: BOOLEAN,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
)
```

### Chat Message Table (With Delivery Fields)
```sql
chat_message (
  cm_id: INT PRIMARY KEY,
  cc_id: INT,
  sender_user_id: INT,
  cm_message: TEXT,
  cm_message_type: ENUM,
  cm_file_url: VARCHAR(255),
  cm_is_delivered: BOOLEAN,
  cm_delivered_at: TIMESTAMP,
  cm_is_read: BOOLEAN,
  cm_read_at: TIMESTAMP,
  ...
)
```

---

## 🐛 Troubleshooting

### Email Not Sending?
1. Check Brevo credentials in `.env`
2. Verify `BREVO_PASSWORD` is correct
3. Check Brevo dashboard for sending limits
4. Look for errors in console: `Error sending chat message email`

### Notifications Not Working?
1. Ensure user is truly offline (disconnect socket)
2. Check database for created notifications
3. Verify `createNotification` is imported correctly
4. Check console logs for offline detection

### Online Status Not Updating?
1. Verify socket authentication is working
2. Check if user is in their personal room: `user:${userId}`
3. Listen for `user_online`/`user_offline` events
4. Use `check_user_status` to verify

### Email Goes to Spam?
1. Add SPF/DKIM records for your domain
2. Use Brevo's dedicated sending domain
3. Warm up your email sender reputation
4. Avoid spam trigger words in email content

---

## 📈 Performance Considerations

### Email Rate Limiting
Current implementation sends one email per message. Consider:

**Throttling** (Prevent spam):
```javascript
// Only send email if last email was > 5 minutes ago
const recentNotification = await prisma.notification.findFirst({
  where: {
    user_id: recipientUserId,
    notification_name: 'new_chat_message',
    created_at: { gte: new Date(Date.now() - 5 * 60 * 1000) }
  }
});

if (!recipientOnline && !recentNotification) {
  // Send email
}
```

**Batching** (Group multiple messages):
```javascript
// Send one email with "5 new messages" instead of 5 separate emails
```

### Status Check Optimization
- Cache online status locally (frontend)
- Debounce status checks (1 second)
- Use batch checks for lists
- Clear cache on reconnection

---

## 🔗 Related Documentation

1. **`SOCKET_ONLINE_OFFLINE_DOCS.md`** - Complete online/offline API reference
2. **`README.md`** - General setup and API documentation
3. **Brevo Docs**: https://developers.brevo.com/docs/smtp-api
4. **Socket.IO Docs**: https://socket.io/docs/v4/

---

## 📝 Summary of Changes

### What Works Now:
✅ Real-time chat with delivery & read receipts  
✅ Online/offline presence indicators  
✅ Offline users get email notifications  
✅ Offline users get in-app notifications  
✅ Status checks (single & batch)  
✅ Professional email templates  
✅ Push notification infrastructure (ready to enable)  

### What's Next (Optional):
🔜 Enable push notifications (FCM/APNS)  
🔜 Add email throttling/batching  
🔜 Add "Last seen" timestamps  
🔜 Add "Away" status support  
🔜 Email preference settings (allow users to opt-out)  

---

**Implementation Date**: October 2025  
**Backend Version**: 1.0  
**Email Service**: Brevo SMTP  
**Socket Version**: Socket.IO 4.8.1  

---

🎉 **All features are now live and ready for testing!**

For questions or issues, contact the backend team.

