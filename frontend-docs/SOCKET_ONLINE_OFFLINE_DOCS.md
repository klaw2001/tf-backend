# 🟢 Online/Offline Status - Socket.IO Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Automatic Events](#automatic-events)
3. [Manual Status Events](#manual-status-events)
4. [Status Check Events](#status-check-events)
5. [Implementation Examples](#implementation-examples)
6. [Offline Chat Notifications](#offline-chat-notifications)
7. [Best Practices](#best-practices)

---

## 🎯 Overview

The online/offline status system allows you to:
- **Track user presence** in real-time
- **Display online indicators** (green dot) next to usernames
- **Check if users are available** before initiating actions
- **Receive notifications** when users go online/offline
- **Send offline notifications** (email + in-app) when users are unavailable

---

## 🔄 Automatic Events

These events are automatically emitted by the server when users connect/disconnect.

### 1. User Online (Auto-emitted on connection)

**Event Name**: `user_online`

**When emitted**: Automatically when a user connects to the socket server

**Broadcast**: Sent to all OTHER connected users (not to the user who just connected)

**Payload**:
```javascript
{
  userId: number,
  userName: string,
  timestamp: string  // ISO 8601 format
}
```

**Frontend - Listen for this event**:
```javascript
socket.on('user_online', (data) => {
  console.log(`${data.userName} is now online`);
  // Update UI: Show green dot next to user
  updateUserStatus(data.userId, 'online');
});
```

---

### 2. User Offline (Auto-emitted on disconnect)

**Event Name**: `user_offline`

**When emitted**: Automatically when a user disconnects from the socket server

**Broadcast**: Sent to all OTHER connected users

**Payload**:
```javascript
{
  userId: number,
  userName: string,
  timestamp: string  // ISO 8601 format
}
```

**Frontend - Listen for this event**:
```javascript
socket.on('user_offline', (data) => {
  console.log(`${data.userName} went offline`);
  // Update UI: Show gray/offline indicator
  updateUserStatus(data.userId, 'offline');
});
```

---

## 🎮 Manual Status Events

These are optional events for explicit status control (e.g., "Away", "Do Not Disturb").

### 3. Set Online (Manual)

**Event Name**: `set_online`

**When to emit**: When user explicitly sets their status to "online" (e.g., from "Away")

**Payload**: None required

**Example**:
```javascript
socket.emit('set_online');
```

**What happens**:
- Broadcasts `user_online` event to all other users
- You receive `online_status_set` confirmation

**Confirmation response**:
```javascript
socket.on('online_status_set', (data) => {
  console.log('Status set to:', data.status); // "online"
});
```

---

### 4. Set Offline (Manual)

**Event Name**: `set_offline`

**When to emit**: When user explicitly sets status to "offline" or "away"

**Payload**: None required

**Example**:
```javascript
socket.emit('set_offline');
```

**What happens**:
- Broadcasts `user_offline` event to all other users
- You receive `online_status_set` confirmation

**Confirmation response**:
```javascript
socket.on('online_status_set', (data) => {
  console.log('Status set to:', data.status); // "offline"
});
```

---

## 🔍 Status Check Events

Query the online status of users without waiting for broadcast events.

### 5. Check Single User Status

**Event Name**: `check_user_status`

**When to emit**: When you need to know if a specific user is online

**Payload**:
```javascript
{
  userId: number
}
```

**Example**:
```javascript
socket.emit('check_user_status', { userId: 123 });
```

**Response event**: `user_status_response`

**Response payload**:
```javascript
{
  userId: number,
  isOnline: boolean,
  timestamp: string
}
```

**Listen for response**:
```javascript
socket.on('user_status_response', (data) => {
  if (data.isOnline) {
    console.log(`User ${data.userId} is online`);
    showOnlineIndicator(data.userId);
  } else {
    console.log(`User ${data.userId} is offline`);
    showOfflineIndicator(data.userId);
  }
});
```

---

### 6. Check Multiple Users Status

**Event Name**: `check_multiple_users_status`

**When to emit**: When you need to check status of multiple users at once (e.g., conversation list)

**Payload**:
```javascript
{
  userIds: number[]  // Array of user IDs
}
```

**Example**:
```javascript
socket.emit('check_multiple_users_status', { 
  userIds: [123, 456, 789] 
});
```

**Response event**: `multiple_users_status_response`

**Response payload**:
```javascript
{
  statuses: [
    { userId: 123, isOnline: true },
    { userId: 456, isOnline: false },
    { userId: 789, isOnline: true }
  ],
  timestamp: string
}
```

**Listen for response**:
```javascript
socket.on('multiple_users_status_response', (data) => {
  data.statuses.forEach(({ userId, isOnline }) => {
    updateUserStatus(userId, isOnline ? 'online' : 'offline');
  });
});
```

---

## 💻 Implementation Examples

### Example 1: Basic Online Indicator

```javascript
import { io } from 'socket.io-client';

class UserPresenceService {
  constructor(token) {
    this.socket = io('http://localhost:5000', {
      auth: { token }
    });
    
    this.onlineUsers = new Set();
    this.setupListeners();
  }
  
  setupListeners() {
    // Track online users
    this.socket.on('user_online', ({ userId }) => {
      this.onlineUsers.add(userId);
      this.updateUI(userId, 'online');
    });
    
    // Track offline users
    this.socket.on('user_offline', ({ userId }) => {
      this.onlineUsers.delete(userId);
      this.updateUI(userId, 'offline');
    });
  }
  
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }
  
  updateUI(userId, status) {
    const indicator = document.querySelector(`[data-user-id="${userId}"] .status-dot`);
    if (indicator) {
      indicator.className = `status-dot ${status}`;
    }
  }
  
  // Check specific user status
  async checkUserStatus(userId) {
    return new Promise((resolve) => {
      this.socket.emit('check_user_status', { userId });
      
      this.socket.once('user_status_response', (data) => {
        resolve(data.isOnline);
      });
    });
  }
}

// Usage
const presence = new UserPresenceService(userToken);
const isOnline = await presence.checkUserStatus(123);
console.log('User is online:', isOnline);
```

---

### Example 2: Conversation List with Online Status

```javascript
// When loading conversation list
async function loadConversationsWithStatus() {
  // 1. Fetch conversations from REST API
  const conversations = await fetch('/api/chat/conversations').then(r => r.json());
  
  // 2. Extract all user IDs to check
  const userIds = conversations.map(conv => 
    conv.recruiter_user_id === currentUserId 
      ? conv.talent_user_id 
      : conv.recruiter_user_id
  );
  
  // 3. Check online status for all users
  socket.emit('check_multiple_users_status', { userIds });
  
  socket.once('multiple_users_status_response', ({ statuses }) => {
    // 4. Update UI with online status
    conversations.forEach(conv => {
      const otherUserId = conv.recruiter_user_id === currentUserId 
        ? conv.talent_user_id 
        : conv.recruiter_user_id;
        
      const status = statuses.find(s => s.userId === otherUserId);
      conv.isOnline = status?.isOnline || false;
    });
    
    // 5. Render conversations with online indicators
    renderConversations(conversations);
  });
}
```

---

### Example 3: Real-time Status Updates in Chat

```javascript
// In chat component
function ChatComponent({ conversationId, otherUserId }) {
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  
  useEffect(() => {
    // Check initial status
    socket.emit('check_user_status', { userId: otherUserId });
    
    socket.on('user_status_response', (data) => {
      if (data.userId === otherUserId) {
        setIsOtherUserOnline(data.isOnline);
      }
    });
    
    // Listen for real-time updates
    socket.on('user_online', ({ userId }) => {
      if (userId === otherUserId) {
        setIsOtherUserOnline(true);
      }
    });
    
    socket.on('user_offline', ({ userId }) => {
      if (userId === otherUserId) {
        setIsOtherUserOnline(false);
      }
    });
    
    return () => {
      socket.off('user_status_response');
      socket.off('user_online');
      socket.off('user_offline');
    };
  }, [otherUserId]);
  
  return (
    <div className="chat-header">
      <Avatar userId={otherUserId} />
      <div>
        <h3>{otherUserName}</h3>
        <span className={`status ${isOtherUserOnline ? 'online' : 'offline'}`}>
          {isOtherUserOnline ? '🟢 Online' : '⚫ Offline'}
        </span>
      </div>
    </div>
  );
}
```

---

### Example 4: "User is typing..." with Online Check

```javascript
function sendTypingIndicator(conversationId, otherUserId) {
  // Only send typing indicator if the other user is online
  socket.emit('check_user_status', { userId: otherUserId });
  
  socket.once('user_status_response', ({ isOnline }) => {
    if (isOnline) {
      socket.emit('typing', { conversationId });
    }
  });
}
```

---

## 📧 Offline Chat Notifications

### How It Works

When **User A is offline** and **User B sends a message**:

1. ✅ Message is saved to database
2. ✅ Backend checks: Is User A online?
3. ❌ User A is offline, so backend:
   - Creates **in-app notification** (database)
   - Sends **email notification** via Brevo
   - (Future) Sends **push notification** to device

### Notification Types

#### 1. In-App Notification
```javascript
// User A comes back online and fetches notifications
fetch('/api/common/notifications?isRead=false')
  .then(r => r.json())
  .then(({ notifications }) => {
    // Shows: "New message from John Doe"
    displayNotifications(notifications);
  });
```

#### 2. Email Notification
User receives an email with:
- Subject: "New message from [Sender Name]"
- Preview of the message
- Link to open the conversation

#### 3. Push Notification (Future)
```javascript
// When implemented, user will receive device notification even when app is closed
{
  title: "John Doe",
  body: "Hey, are you available for a call?",
  data: {
    type: 'chat_message',
    conversationId: 123
  }
}
```

### Email Notification Details

**Sent via**: Brevo (SMTP)

**Trigger**: When message is sent to offline user

**Email contains**:
- Sender's name
- Message preview (first 200 characters)
- "View Message" button linking to chat
- Professional HTML template

**Configuration** (in `.env`):
```env
BREVO_HOST=smtp-relay.brevo.com
BREVO_MAIL_PORT=587
BREVO_USER=your-brevo-email@smtp-brevo.com
BREVO_PASSWORD=your-brevo-password
FRONTEND_URL=http://localhost:4000
```

---

## ✅ Best Practices

### 1. **Debounce Status Checks**
Don't check user status too frequently:

```javascript
import { debounce } from 'lodash';

const checkStatusDebounced = debounce((userId) => {
  socket.emit('check_user_status', { userId });
}, 1000);
```

### 2. **Cache Online Status Locally**
```javascript
const onlineStatusCache = new Map();

socket.on('user_online', ({ userId }) => {
  onlineStatusCache.set(userId, true);
});

socket.on('user_offline', ({ userId }) => {
  onlineStatusCache.set(userId, false);
});

// Use cache first, then query if not found
function isUserOnline(userId) {
  if (onlineStatusCache.has(userId)) {
    return onlineStatusCache.get(userId);
  }
  // Query server
  socket.emit('check_user_status', { userId });
}
```

### 3. **Batch Status Checks**
Instead of checking one by one:

```javascript
// ❌ Bad - Multiple requests
userIds.forEach(userId => {
  socket.emit('check_user_status', { userId });
});

// ✅ Good - Single request
socket.emit('check_multiple_users_status', { userIds });
```

### 4. **Handle Reconnection**
```javascript
socket.on('connect', () => {
  // Re-check status of important users after reconnection
  const importantUserIds = getCurrentConversationUserIds();
  if (importantUserIds.length > 0) {
    socket.emit('check_multiple_users_status', { userIds: importantUserIds });
  }
});
```

### 5. **Show Last Seen (Optional)**
Track when users go offline:

```javascript
const lastSeenMap = new Map();

socket.on('user_offline', ({ userId, timestamp }) => {
  lastSeenMap.set(userId, timestamp);
  // Display: "Last seen 5 minutes ago"
  updateLastSeen(userId, timestamp);
});
```

---

## 🎨 UI/UX Recommendations

### Status Indicators

```css
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 5px;
}

.status-dot.online {
  background-color: #10b981; /* Green */
  box-shadow: 0 0 8px #10b981;
}

.status-dot.offline {
  background-color: #6b7280; /* Gray */
}

.status-dot.away {
  background-color: #f59e0b; /* Amber */
}
```

### Status Text
- **Online**: "🟢 Online" or "Active now"
- **Offline**: "⚫ Offline" or "Last seen [time]"
- **Away**: "🟡 Away" or "Inactive"

### Animation
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-dot.online {
  animation: pulse 2s infinite;
}
```

---

## 🔗 Related Events

This online/offline system works seamlessly with:

- **Chat Events**: Know if recipient will receive message in real-time
- **Typing Indicators**: Only show typing when user is online
- **Delivery Status**: Single tick if offline, double tick if online
- **Notifications**: Email sent only if user is offline

---

## 📊 Event Summary

### Events to Emit (Frontend → Backend)

| Event | Payload | Purpose |
|-------|---------|---------|
| `set_online` | None | Manually set status to online |
| `set_offline` | None | Manually set status to offline |
| `check_user_status` | `{ userId }` | Check if specific user is online |
| `check_multiple_users_status` | `{ userIds: [] }` | Check multiple users at once |

### Events to Listen (Backend → Frontend)

| Event | Payload | When Received |
|-------|---------|---------------|
| `user_online` | `{ userId, userName, timestamp }` | When any user connects |
| `user_offline` | `{ userId, userName, timestamp }` | When any user disconnects |
| `online_status_set` | `{ status }` | Confirmation of manual status change |
| `user_status_response` | `{ userId, isOnline, timestamp }` | Response to single user check |
| `multiple_users_status_response` | `{ statuses: [], timestamp }` | Response to multiple users check |

---

## 🚀 Quick Start Checklist

- [ ] Connect to socket with authentication token
- [ ] Listen for `user_online` and `user_offline` events
- [ ] Implement UI status indicators (green dot for online)
- [ ] Use `check_multiple_users_status` for conversation lists
- [ ] Handle reconnection by re-checking important user statuses
- [ ] Cache online status locally for better performance
- [ ] Test offline notifications (email + in-app)

---

**Version**: 1.0  
**Last Updated**: October 2025  
**Backend**: Socket.IO 4.8.1 + Brevo Email

---

Need help? Contact the backend team or refer to the main Socket.IO documentation.

