```tsx
import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  sender: string;
}

const LiveChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Establish WebSocket connection
    socketRef.current = new WebSocket('ws://localhost:8080');

    // Handle incoming messages
    socketRef.current.onmessage = (event) => {
      const message: Message = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    // Clean up WebSocket connection on component unmount
    return () => {
      socketRef.current?.close();
    };
  }, []);

  const handleSendMessage = () => {
    if (inputText.trim() !== '') {
      const message: Message = {
        id: Date.now(),
        text: inputText,
        timestamp: new Date(),
        sender: 'User',
      };

      // Send message to the server
      socketRef.current?.send(JSON.stringify(message));

      setInputText('');
    }
  };

  return (
    <div className="live-chat">
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className="message">
            <span className="sender">{message.sender}: </span>
            <span className="text">{message.text}</span>
            <span className="timestamp">{message.timestamp.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default LiveChat;
```