export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  timestamp: Date;
  status: MessageStatus;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface SendMessageRequest {
  session_id: string;
  message: string;
  stream?: boolean;
}

export interface SendMessageResponse {
  messageId: string;
  content: string;
  role: MessageRole;
  timestamp: Date;
  stream?: boolean;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  data: string;
  messageId?: string;
}

export interface SessionResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
  user_id?: string;
  message_count?: number;
}

export interface MessageResponse {
  id: string;
  content: string;
  role: MessageRole;
  timestamp: string;
  session_id: string;
  metadata?: Record<string, any>;
}