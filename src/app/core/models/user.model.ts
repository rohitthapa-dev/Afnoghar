export interface User {
  id: number;
  name: string;
  email: string;
  role: 'buyer' | 'seller' | 'admin';
  phone: string;
  avatar: string;
  createdAt: string;
  isActive: boolean;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: 'buyer' | 'seller';
}
