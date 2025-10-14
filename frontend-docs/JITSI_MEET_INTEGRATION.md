# 🎥 Jitsi Meet Integration - Frontend Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Installation](#installation)
3. [Authentication Flow](#authentication-flow)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Socket.IO Events](#socketio-events)
6. [React Component Example](#react-component-example)
7. [Meeting Lifecycle](#meeting-lifecycle)
8. [Recording Management](#recording-management)
9. [Best Practices](#best-practices)

---

## 🎯 Overview

TalentFlip uses **Jitsi Meet** for video conferencing with the following features:
- 🔐 JWT-based secure authentication
- 👥 Multi-participant video calls
- 🎙️ Audio/video controls
- 📺 Screen sharing
- 🎬 Recording support
- 💬 Real-time participant notifications
- 📊 Meeting history and analytics

**Jitsi Domain**: `https://meet.talentflip.ai`

---

## 📦 Installation

### Install Jitsi React SDK

```bash
npm install @jitsi/react-sdk
# or
yarn add @jitsi/react-sdk
```

### Install Socket.IO Client (if not already installed)

```bash
npm install socket.io-client
```

---

## 🔐 Authentication Flow

### Step 1: Create Meeting (REST API)

```javascript
// Create a new meeting
const createMeeting = async () => {
  const response = await fetch('/api/meeting/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      title: 'Interview with John Doe',
      description: 'Technical interview for Full Stack position',
      conversationId: 123, // Optional: Link to chat conversation
      scheduledAt: '2025-10-20T14:00:00Z', // Optional: Schedule for later
      participantUserIds: [456, 789], // User IDs to invite
      enableRecording: true,
      password: 'optional-password' // Optional room password
    })
  });

  const data = await response.json();
  return data.meeting;
};
```

### Step 2: Join Meeting (Get JWT Token)

```javascript
// Join an existing meeting
const joinMeeting = async (meetingId) => {
  const response = await fetch(`/api/meeting/${meetingId}/join`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });

  const data = await response.json();
  
  return {
    jitsiToken: data.jitsiToken,
    roomName: data.roomName,
    jitsiDomain: data.jitsiDomain,
    role: data.role, // 'Host', 'Moderator', or 'Participant'
    meeting: data.meeting
  };
};
```

---

## 🛣️ REST API Endpoints

### 1. Create Meeting
**POST** `/api/meeting/create`

**Headers**:
```javascript
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Request Body**:
```javascript
{
  "title": string,              // Required
  "description": string,        // Optional
  "conversationId": number,     // Optional
  "scheduledAt": ISO8601,       // Optional (instant if not provided)
  "participantUserIds": number[], // Optional
  "password": string,           // Optional
  "enableRecording": boolean    // Optional, default: false
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "meeting": {
      "meeting_id": 1,
      "meeting_room_name": "Interview_1729000000_abc123",
      "meeting_title": "Interview with John Doe",
      "meeting_status": "Scheduled", // or "InProgress"
      "jitsiDomain": "https://meet.talentflip.ai",
      // ... other fields
    }
  },
  "message": "Meeting created successfully"
}
```

---

### 2. Join Meeting
**POST** `/api/meeting/:meetingId/join`

**Headers**:
```javascript
{
  "Authorization": "Bearer <token>"
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {
    "jitsiToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "roomName": "Interview_1729000000_abc123",
    "jitsiDomain": "https://meet.talentflip.ai",
    "jitsiAppId": "talentflip-ai",
    "role": "Host", // or "Moderator" or "Participant"
    "meeting": {
      "meeting_id": 1,
      "title": "Interview with John Doe",
      "description": "Technical interview",
      "isRecordingEnabled": true
    }
  },
  "message": "Joined meeting successfully"
}
```

---

### 3. Get User's Meetings
**GET** `/api/meeting/list?status=InProgress&limit=50&offset=0`

**Query Parameters**:
- `status` (optional): `Scheduled`, `InProgress`, `Completed`, `Cancelled`
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response**:
```javascript
{
  "success": true,
  "data": {
    "meetings": [
      {
        "meeting_id": 1,
        "meeting_title": "Interview with John Doe",
        "meeting_status": "InProgress",
        "meeting_scheduled_at": "2025-10-20T14:00:00Z",
        "meeting_started_at": "2025-10-20T14:05:00Z",
        "host_user": {
          "user_id": 123,
          "user_full_name": "Sarah Smith",
          "user_email": "sarah@company.com"
        },
        "meeting_participants": [
          {
            "user": {
              "user_id": 456,
              "user_full_name": "John Doe"
            },
            "mp_role": "Participant",
            "mp_joined_at": "2025-10-20T14:05:30Z"
          }
        ],
        "meeting_recordings": []
      }
    ],
    "total": 1
  }
}
```

---

### 4. Get Meeting Details
**GET** `/api/meeting/:meetingId`

**Response**: Same structure as single meeting in list above

---

### 5. End Meeting
**PUT** `/api/meeting/:meetingId/end`

**Note**: Only the host can end a meeting

**Response**:
```javascript
{
  "success": true,
  "data": {
    "meeting": {
      "meeting_id": 1,
      "meeting_status": "Completed",
      "meeting_ended_at": "2025-10-20T15:00:00Z",
      "meeting_duration": 3300 // in seconds
    }
  },
  "message": "Meeting ended successfully"
}
```

---

### 6. Cancel Meeting
**PUT** `/api/meeting/:meetingId/cancel`

**Note**: Only the host can cancel a meeting

---

### 7. Save Recording
**POST** `/api/meeting/:meetingId/recording`

**Request Body**:
```javascript
{
  "fileName": "recording_1729000000.mp4",
  "fileUrl": "https://storage.example.com/recordings/...",
  "fileSize": 104857600, // bytes
  "duration": 3300, // seconds
  "format": "mp4",
  "startedAt": "2025-10-20T14:05:00Z",
  "endedAt": "2025-10-20T15:00:00Z"
}
```

---

## 🔌 Socket.IO Events

### Events to Emit (Frontend → Backend)

#### 1. Join Meeting Room
```javascript
socket.emit('join_meeting_room', { meetingId: 123 });
```

**Response**:
```javascript
socket.on('joined_meeting_room', (data) => {
  console.log('Joined meeting room:', data.meetingId);
});
```

---

#### 2. Leave Meeting Room
```javascript
socket.emit('leave_meeting_room', { meetingId: 123 });
```

**Response**:
```javascript
socket.on('left_meeting_room', (data) => {
  console.log('Left meeting room:', data.meetingId);
});
```

---

#### 3. Audio Status Changed
```javascript
socket.emit('meeting_audio_status', {
  meetingId: 123,
  isMuted: true
});
```

---

#### 4. Video Status Changed
```javascript
socket.emit('meeting_video_status', {
  meetingId: 123,
  isVideoOn: false
});
```

---

#### 5. Recording Started
```javascript
socket.emit('meeting_recording_started', { meetingId: 123 });
```

---

#### 6. Recording Stopped
```javascript
socket.emit('meeting_recording_stopped', { meetingId: 123 });
```

---

#### 7. Screen Share Started
```javascript
socket.emit('meeting_screen_share_started', { meetingId: 123 });
```

---

#### 8. Screen Share Stopped
```javascript
socket.emit('meeting_screen_share_stopped', { meetingId: 123 });
```

---

#### 9. Hand Raised
```javascript
socket.emit('meeting_hand_raised', { meetingId: 123 });
```

---

#### 10. Hand Lowered
```javascript
socket.emit('meeting_hand_lowered', { meetingId: 123 });
```

---

### Events to Listen (Backend → Frontend)

#### 1. User Joined Meeting
```javascript
socket.on('user_joined_meeting', (data) => {
  console.log(`${data.userName} joined the meeting`);
  // data: { userId, userName, meetingId, timestamp }
});
```

---

#### 2. User Left Meeting
```javascript
socket.on('user_left_meeting', (data) => {
  console.log(`${data.userName} left the meeting`);
  // data: { userId, userName, meetingId, timestamp }
});
```

---

#### 3. User Audio Status
```javascript
socket.on('user_audio_status', (data) => {
  if (data.isMuted) {
    console.log(`${data.userName} muted their mic`);
  } else {
    console.log(`${data.userName} unmuted their mic`);
  }
  // data: { userId, userName, isMuted, timestamp }
});
```

---

#### 4. User Video Status
```javascript
socket.on('user_video_status', (data) => {
  console.log(`${data.userName} turned video ${data.isVideoOn ? 'on' : 'off'}`);
  // data: { userId, userName, isVideoOn, timestamp }
});
```

---

#### 5. Recording Started
```javascript
socket.on('recording_started', (data) => {
  console.log(`Recording started by ${data.startedBy}`);
  showRecordingIndicator();
  // data: { meetingId, startedBy, startedById, timestamp }
});
```

---

#### 6. Recording Stopped
```javascript
socket.on('recording_stopped', (data) => {
  console.log(`Recording stopped by ${data.stoppedBy}`);
  hideRecordingIndicator();
  // data: { meetingId, stoppedBy, stoppedById, timestamp }
});
```

---

#### 7. Meeting Ended
```javascript
socket.on('meeting_ended', (data) => {
  console.log('Meeting has ended');
  // Redirect user or show meeting summary
  // data: { meetingId, endedAt }
});
```

---

#### 8. Meeting Invitation
```javascript
socket.on('meeting_invitation', (data) => {
  console.log(`Meeting invitation from ${data.hostName}`);
  showNotification(`You've been invited to: ${data.title}`);
  // data: { meetingId, hostName, title, scheduledAt }
});
```

---

#### 9. Meeting Cancelled
```javascript
socket.on('meeting_cancelled', (data) => {
  console.log(`Meeting "${data.title}" has been cancelled`);
  // data: { meetingId, title }
});
```

---

## ⚛️ React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { io } from 'socket.io-client';

function MeetingRoom({ meetingId, userToken }) {
  const [meetingData, setMeetingData] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('https://api.talentflip.ai', {
      auth: { token: userToken }
    });

    setSocket(newSocket);

    // Join meeting and get JWT token
    const joinMeeting = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}/join`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        });

        const result = await response.json();
        
        if (result.success) {
          setMeetingData(result.data);
          
          // Join socket room
          newSocket.emit('join_meeting_room', { meetingId });
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Failed to join meeting');
      } finally {
        setLoading(false);
      }
    };

    joinMeeting();

    // Cleanup
    return () => {
      newSocket.emit('leave_meeting_room', { meetingId });
      newSocket.close();
    };
  }, [meetingId, userToken]);

  useEffect(() => {
    if (!socket) return;

    // Listen for other participants joining
    socket.on('user_joined_meeting', (data) => {
      console.log(`${data.userName} joined`);
      // Show notification or update UI
    });

    // Listen for other participants leaving
    socket.on('user_left_meeting', (data) => {
      console.log(`${data.userName} left`);
    });

    // Listen for recording status
    socket.on('recording_started', (data) => {
      console.log('Recording started');
      // Show recording indicator
    });

    socket.on('recording_stopped', (data) => {
      console.log('Recording stopped');
      // Hide recording indicator
    });

    // Listen for meeting ended
    socket.on('meeting_ended', (data) => {
      console.log('Meeting ended');
      // Redirect or show summary
      window.location.href = '/meetings';
    });

    return () => {
      socket.off('user_joined_meeting');
      socket.off('user_left_meeting');
      socket.off('recording_started');
      socket.off('recording_stopped');
      socket.off('meeting_ended');
    };
  }, [socket]);

  if (loading) {
    return <div>Loading meeting...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!meetingData) {
    return null;
  }

  return (
    <div className="meeting-container">
      <JitsiMeeting
        domain={meetingData.jitsiDomain.replace('https://', '')}
        roomName={meetingData.roomName}
        jwt={meetingData.jitsiToken}
        configOverwrite={{
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          disableModeratorIndicator: false,
          startScreenSharing: false,
          enableEmailInStats: false,
          prejoinPageEnabled: true,
          hideConferenceSubject: false,
          subject: meetingData.meeting.title,
          recordingService: {
            enabled: meetingData.meeting.isRecordingEnabled,
            sharingEnabled: true,
          },
        }}
        interfaceConfigOverwrite={{
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'closedcaptions',
            'desktop',
            'fullscreen',
            'fodeviceselection',
            'hangup',
            'profile',
            'recording',
            'livestreaming',
            'etherpad',
            'sharedvideo',
            'settings',
            'raisehand',
            'videoquality',
            'filmstrip',
            'stats',
            'shortcuts',
            'tileview',
            'download',
            'help',
            'mute-everyone',
          ],
        }}
        userInfo={{
          displayName: currentUser.name,
          email: currentUser.email,
        }}
        onApiReady={(externalApi) => {
          console.log('Jitsi API ready');

          // Handle participant joined
          externalApi.on('participantJoined', (participant) => {
            console.log('Participant joined:', participant);
          });

          // Handle participant left
          externalApi.on('participantLeft', (participant) => {
            console.log('Participant left:', participant);
          });

          // Handle audio mute/unmute
          externalApi.on('audioMuteStatusChanged', ({ muted }) => {
            socket.emit('meeting_audio_status', {
              meetingId,
              isMuted: muted
            });
          });

          // Handle video mute/unmute
          externalApi.on('videoMuteStatusChanged', ({ muted }) => {
            socket.emit('meeting_video_status', {
              meetingId,
              isVideoOn: !muted
            });
          });

          // Handle recording started
          externalApi.on('recordingStatusChanged', ({ on }) => {
            if (on) {
              socket.emit('meeting_recording_started', { meetingId });
            } else {
              socket.emit('meeting_recording_stopped', { meetingId });
            }
          });

          // Handle meeting left
          externalApi.on('videoConferenceLeft', () => {
            console.log('Left video conference');
            socket.emit('leave_meeting_room', { meetingId });
            // Redirect to meetings page
            window.location.href = '/meetings';
          });

          // Handle screen share
          externalApi.on('screenSharingStatusChanged', ({ on }) => {
            if (on) {
              socket.emit('meeting_screen_share_started', { meetingId });
            } else {
              socket.emit('meeting_screen_share_stopped', { meetingId });
            }
          });
        }}
        getIFrameRef={(iframeRef) => {
          iframeRef.style.height = '100vh';
          iframeRef.style.width = '100%';
        }}
      />
    </div>
  );
}

export default MeetingRoom;
```

---

## 🔄 Meeting Lifecycle

### 1. Create Meeting
```
Frontend → POST /api/meeting/create → Backend
Backend → Creates meeting record → Returns meeting details
Backend → Sends invitations to participants (socket + notification)
```

### 2. Join Meeting
```
Frontend → POST /api/meeting/:id/join → Backend
Backend → Validates access → Generates JWT token
Frontend → Receives JWT + room name
Frontend → Initializes Jitsi with JWT
Frontend → emit 'join_meeting_room' via socket
```

### 3. During Meeting
```
Participant actions (mute/unmute, video on/off, etc.)
→ Jitsi API events
→ Frontend emits to socket
→ Backend broadcasts to other participants
```

### 4. End Meeting
```
Host → PUT /api/meeting/:id/end → Backend
Backend → Updates meeting status to 'Completed'
Backend → emit 'meeting_ended' to all participants
Frontend → Redirects users
```

---

## 🎬 Recording Management

### Enable Recording

```javascript
// When creating meeting
const meeting = await createMeeting({
  // ... other fields
  enableRecording: true
});
```

### Start Recording (Via Jitsi UI)
- Host clicks "Record" button in Jitsi interface
- Jitsi handles the recording internally
- Frontend receives `recordingStatusChanged` event
- Frontend emits `meeting_recording_started` to socket

### Save Recording

```javascript
// After recording is complete and uploaded
const saveRecording = async (meetingId, recordingData) => {
  const response = await fetch(`/api/meeting/${meetingId}/recording`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      fileName: 'recording_xyz.mp4',
      fileUrl: 'https://storage.example.com/recordings/xyz.mp4',
      fileSize: 104857600,
      duration: 3300,
      format: 'mp4',
      startedAt: '2025-10-20T14:05:00Z',
      endedAt: '2025-10-20T15:00:00Z'
    })
  });

  return await response.json();
};
```

---

## ✅ Best Practices

### 1. **Error Handling**
```javascript
try {
  const data = await joinMeeting(meetingId);
} catch (error) {
  if (error.status === 403) {
    alert('You are not invited to this meeting');
  } else if (error.status === 404) {
    alert('Meeting not found');
  } else {
    alert('Failed to join meeting');
  }
}
```

### 2. **Connection Management**
```javascript
useEffect(() => {
  const socket = io(SOCKET_URL, { auth: { token } });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    // Try to reconnect
  });

  return () => {
    socket.close();
  };
}, []);
```

### 3. **Participant List Management**
```javascript
const [participants, setParticipants] = useState([]);

socket.on('user_joined_meeting', (data) => {
  setParticipants(prev => [...prev, data]);
});

socket.on('user_left_meeting', (data) => {
  setParticipants(prev => prev.filter(p => p.userId !== data.userId));
});
```

### 4. **Recording Indicator**
```javascript
const [isRecording, setIsRecording] = useState(false);

socket.on('recording_started', () => {
  setIsRecording(true);
});

socket.on('recording_stopped', () => {
  setIsRecording(false);
});

return (
  <div>
    {isRecording && (
      <div className="recording-indicator">
        🔴 Recording in progress
      </div>
    )}
  </div>
);
```

### 5. **Cleanup on Unmount**
```javascript
useEffect(() => {
  return () => {
    // Leave meeting room
    socket.emit('leave_meeting_room', { meetingId });
    
    // Close socket connection
    socket.close();
  };
}, []);
```

---

## 🔧 Configuration Options

### Jitsi Config Override Options

```javascript
configOverwrite={{
  // Audio
  startWithAudioMuted: true,
  disableAudioLevels: false,
  
  // Video
  startWithVideoMuted: false,
  resolution: 720,
  constraints: {
    video: { height: { ideal: 720, max: 1080, min: 360 } }
  },
  
  // UI
  prejoinPageEnabled: true,
  hideConferenceSubject: false,
  subject: 'Meeting Title',
  
  // Features
  recording: {
    enabled: true,
    mode: 'stream' // or 'file'
  },
  liveStreaming: {
    enabled: false
  },
  
  // Network
  p2p: {
    enabled: false // Set to true for 1-on-1 calls
  }
}}
```

---

## 📊 Meeting Status Types

| Status | Description |
|--------|-------------|
| `Scheduled` | Meeting scheduled for future |
| `InProgress` | Meeting currently happening |
| `Completed` | Meeting ended normally |
| `Cancelled` | Meeting cancelled by host |

---

## 🎭 User Roles

| Role | Permissions |
|------|-------------|
| `Host` | Full control: End meeting, start recording, mute all |
| `Moderator` | Can record, moderate participants |
| `Participant` | Join and participate only |

---

## 🚀 Quick Start Checklist

- [ ] Install `@jitsi/react-sdk`
- [ ] Install `socket.io-client`
- [ ] Implement create meeting flow
- [ ] Implement join meeting flow
- [ ] Integrate Jitsi component
- [ ] Connect socket events
- [ ] Handle recording (if needed)
- [ ] Test with multiple participants
- [ ] Implement cleanup on unmount
- [ ] Handle errors gracefully

---

**Version**: 1.0  
**Last Updated**: October 2025  
**Jitsi SDK**: @jitsi/react-sdk  
**Backend**: Socket.IO 4.8.1 + Express.js

---

For questions or issues, contact the backend team.

