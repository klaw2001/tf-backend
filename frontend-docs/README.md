# 📚 TalentFlip Frontend Documentation

Welcome to the TalentFlip frontend integration documentation! This folder contains all the guides you need to integrate with the TalentFlip backend APIs and real-time features.

---

## 📋 Documentation Index

### 1. **[Jitsi Meet Integration](./JITSI_MEET_INTEGRATION.md)** 🎥
Complete guide for implementing video meetings using Jitsi Meet.

**Topics Covered**:
- Creating and joining meetings
- JWT authentication flow
- REST API endpoints
- Socket.IO real-time events
- React component examples
- Recording management
- Best practices

**Use Cases**:
- Interview calls
- Team meetings
- 1-on-1 consultations
- Recorded sessions

---

### 2. **[Online/Offline Status](./SOCKET_ONLINE_OFFLINE_DOCS.md)** 🟢
Real-time user presence tracking with Socket.IO.

**Topics Covered**:
- Online/offline detection
- Automatic and manual status events
- Single and batch status checks
- UI implementation examples
- Presence indicators

**Use Cases**:
- Show user availability
- Display "User is typing..."
- Green dot indicators
- Last seen timestamps

---

### 3. **[Chat & Notifications](./CHAT_SOCKET_INTEGRATION.md)** 💬
Complete chat implementation with offline notifications.

**Topics Covered**:
- Real-time messaging
- Message delivery & read receipts
- Offline notifications (email + in-app)
- Typing indicators
- Online/offline user handling

**Use Cases**:
- Direct messaging
- Conversation threads
- Email notifications when offline
- Read receipts (WhatsApp-style)

---

## 🚀 Quick Start Guide

### Prerequisites

```bash
# Install required packages
npm install socket.io-client @jitsi/react-sdk
```

### Basic Socket Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.talentflip.ai', {
  auth: {
    token: yourJwtToken  // From login API
  }
});

// Connection successful
socket.on('connect', () => {
  console.log('Connected to TalentFlip backend');
});

// Handle errors
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

---

## 🔐 Authentication

All socket connections and API requests require JWT authentication.

### Getting JWT Token

```javascript
// Login API
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token } = await response.json();
```

### Using JWT Token

**REST API**:
```javascript
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Socket.IO**:
```javascript
const socket = io(SOCKET_URL, {
  auth: { token }
});
```

---

## 📡 Core Features

### 1. Real-time Chat
- Instant messaging
- Delivery & read receipts
- Offline notifications
- Typing indicators

### 2. Video Meetings
- Jitsi-powered video calls
- JWT-based secure rooms
- Recording support
- Screen sharing

### 3. User Presence
- Online/offline status
- Last seen tracking
- Batch status queries
- Real-time updates

---

## 🛣️ API Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.talentflip.ai` |
| Staging | `https://stg-api.talentflip.ai` |
| Development | `http://localhost:5000` |

---

## 📦 Common Socket Events

### Events You Emit

```javascript
// Chat
socket.emit('join_conversation', { conversationId });
socket.emit('send_message', { conversationId, message });
socket.emit('mark_as_read', { conversationId });

// Meetings
socket.emit('join_meeting_room', { meetingId });
socket.emit('meeting_audio_status', { meetingId, isMuted });

// Presence
socket.emit('check_user_status', { userId });
```

### Events You Listen

```javascript
// Chat
socket.on('new_message', (data) => { /* handle message */ });
socket.on('messages_delivered', (data) => { /* update UI */ });
socket.on('messages_read', (data) => { /* blue tick */ });

// Meetings
socket.on('user_joined_meeting', (data) => { /* participant joined */ });
socket.on('recording_started', (data) => { /* show indicator */ });

// Presence
socket.on('user_online', (data) => { /* green dot */ });
socket.on('user_offline', (data) => { /* gray dot */ });
```

---

## 🎨 UI Component Examples

### Online Status Indicator

```jsx
function UserStatus({ userId }) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    socket.emit('check_user_status', { userId });
    
    socket.on('user_status_response', (data) => {
      if (data.userId === userId) {
        setIsOnline(data.isOnline);
      }
    });

    socket.on('user_online', (data) => {
      if (data.userId === userId) setIsOnline(true);
    });

    socket.on('user_offline', (data) => {
      if (data.userId === userId) setIsOnline(false);
    });

    return () => {
      socket.off('user_status_response');
      socket.off('user_online');
      socket.off('user_offline');
    };
  }, [userId]);

  return (
    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
  );
}
```

### Chat Message with Status

```jsx
function ChatMessage({ message, isSentByMe }) {
  const getMessageStatus = () => {
    if (!isSentByMe) return null;
    
    if (message.cm_is_read) {
      return <span className="status blue">✓✓</span>; // Blue double tick
    }
    if (message.cm_is_delivered) {
      return <span className="status gray">✓✓</span>; // Gray double tick
    }
    return <span className="status gray">✓</span>; // Single tick
  };

  return (
    <div className={`message ${isSentByMe ? 'sent' : 'received'}`}>
      <p>{message.cm_message}</p>
      {getMessageStatus()}
      <span className="time">{formatTime(message.created_at)}</span>
    </div>
  );
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Socket Connection Fails
```javascript
// Solution: Check token and handle connection errors
socket.on('connect_error', (error) => {
  if (error.message.includes('Authentication')) {
    // Token expired or invalid - re-login
    redirectToLogin();
  }
});
```

### Issue 2: Messages Not Delivered
```javascript
// Solution: Ensure you've joined the conversation room
socket.emit('join_conversation', { conversationId });

socket.on('joined_conversation', (data) => {
  // Now you can send messages
  socket.emit('send_message', { conversationId, message });
});
```

### Issue 3: Jitsi Not Loading
```javascript
// Solution: Ensure domain is correct (no https:// prefix)
<JitsiMeeting
  domain="meet.talentflip.ai"  // ✅ Correct
  // domain="https://meet.talentflip.ai"  // ❌ Wrong
  roomName={roomName}
  jwt={jitsiToken}
/>
```

---

## 🔧 Environment Variables

Create a `.env.local` file in your frontend project:

```env
# API Base URL
NEXT_PUBLIC_API_URL=https://api.talentflip.ai
NEXT_PUBLIC_SOCKET_URL=https://api.talentflip.ai

# Jitsi
NEXT_PUBLIC_JITSI_DOMAIN=meet.talentflip.ai
```

---

## 📊 Data Models

### User Object
```typescript
interface User {
  user_id: number;
  user_full_name: string;
  user_email: string;
  role_id: number;
  status: boolean;
  is_active: boolean;
}
```

### Message Object
```typescript
interface Message {
  cm_id: number;
  cm_message: string;
  sender_user_id: number;
  cm_is_delivered: boolean;
  cm_delivered_at: string | null;
  cm_is_read: boolean;
  cm_read_at: string | null;
  created_at: string;
}
```

### Meeting Object
```typescript
interface Meeting {
  meeting_id: number;
  meeting_title: string;
  meeting_room_name: string;
  meeting_status: 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
  host_user_id: number;
  meeting_started_at: string | null;
  meeting_ended_at: string | null;
}
```

---

## ✅ Implementation Checklist

### Chat Implementation
- [ ] Install socket.io-client
- [ ] Initialize socket connection with JWT
- [ ] Implement join conversation
- [ ] Implement send message
- [ ] Handle new message events
- [ ] Show delivery & read status
- [ ] Add typing indicators
- [ ] Handle offline notifications

### Meeting Implementation
- [ ] Install @jitsi/react-sdk
- [ ] Implement create meeting API
- [ ] Implement join meeting flow
- [ ] Integrate Jitsi component
- [ ] Connect socket events
- [ ] Handle participant events
- [ ] Add recording support (optional)
- [ ] Implement cleanup on unmount

### Presence Implementation
- [ ] Listen for online/offline events
- [ ] Implement status check
- [ ] Add UI indicators (green dot)
- [ ] Cache status locally
- [ ] Handle reconnection

---

## 📞 Support

For questions or issues:
1. Check the relevant documentation above
2. Review the code examples
3. Contact the backend team
4. Check console for error messages

---

## 🔄 Updates

| Date | Version | Changes |
|------|---------|---------|
| Oct 2025 | 1.0 | Initial documentation |
| Oct 2025 | 1.1 | Added Jitsi Meet integration |
| Oct 2025 | 1.2 | Added offline notifications |

---

**Happy Coding! 🚀**

