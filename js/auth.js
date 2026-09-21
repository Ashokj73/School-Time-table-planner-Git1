/**
 * SchoolFlow SaaS - Google ID Authorization & Identity Hub
 * 
 * Supports:
 * 1. Official Google Identity Services (GIS) / Firebase Google OAuth 2.0
 * 2. Instant Sandbox Personas (for testing multi-user isolation locally)
 */

import { AppConfig } from './config.js';

const AUTH_USER_KEY = 'schoolflow_active_user';

// Mock/Sandbox Personas for testing multi-user isolation locally without setup
export const SANDBOX_PERSONAS = [
  {
    id: 'google-sub-10827361928374',
    name: 'Dr. Sarah Jenkins',
    email: 'sarah.jenkins@oakridge-academy.edu',
    picture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    schoolName: 'Oakridge International Academy',
    role: 'Head of Academics'
  },
  {
    id: 'google-sub-29384756102938',
    name: 'Prof. Michael Chen',
    email: 'm.chen@stjudes-school.org',
    picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    schoolName: 'St. Jude Grammar School',
    role: 'Principal'
  }
];

class AuthController {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this.firebaseAuth = null;
    this.init();
  }

  init() {
    // 1. Try to restore active user session from storage
    try {
      const savedUser = localStorage.getItem(AUTH_USER_KEY);
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    } catch (e) {
      console.warn("Error restoring user session", e);
    }

    // 2. If no user, default to first sandbox user so the SaaS is immediately usable
    if (!this.currentUser) {
      this.currentUser = SANDBOX_PERSONAS[0];
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    // Immediately call with current user
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.currentUser);
      } catch (err) {
        console.error("Auth listener error", err);
      }
    });
  }

  // Switch to one of the Sandbox accounts (proves multi-user data isolation!)
  switchSandboxUser(personaId) {
    const persona = SANDBOX_PERSONAS.find(p => p.id === personaId) || SANDBOX_PERSONAS[0];
    this.currentUser = { ...persona };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  }

  // Handle Google OAuth Sign-in response (JWT credential from Google Identity Services)
  handleGoogleCredential(credentialResponse) {
    try {
      // Decode JWT token payload
      const payload = this.parseJwt(credentialResponse.credential);
      this.currentUser = {
        id: 'google-sub-' + payload.sub,
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        picture: payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name)}&background=2563eb&color=fff`,
        schoolName: payload.hd ? `${payload.hd.split('.')[0].toUpperCase()} School` : 'Personal Workspace',
        role: 'Administrator',
        isLiveGoogle: true
      };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      this.notifyListeners();
      return this.currentUser;
    } catch (err) {
      console.error("Failed to parse Google credential", err);
      throw new Error("Failed to process Google sign-in.");
    }
  }

  // Helper to decode standard Google ID JWT
  parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  // Sign out user
  signOut() {
    this.currentUser = null;
    localStorage.removeItem(AUTH_USER_KEY);
    this.notifyListeners();
  }
}

export const AuthService = new AuthController();
