import express from 'express';
import crypto from 'crypto';
import { User } from '../models/index.js';
import {
  hashPassword,
  comparePassword,
  generateTokens,
  authenticateToken,
  loginRateLimit,
  validatePasswordStrength
} from '../middleware/auth.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, role = 'viewer' } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Generate API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      apiKey,
      preferences: {
        notificationThreshold: 80,
        emailNotifications: true,
        timezone: 'UTC'
      }
    });
    
    await user.save();
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    
    // Return user data without password
    const userResponse = {
      id: user._id,
      email: user.email,
      role: user.role,
      apiKey: user.apiKey,
      preferences: user.preferences,
      createdAt: user.createdAt
    };
    
    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update login stats
    await User.findByIdAndUpdate(user._id, {
      $inc: { 'usage.totalLogins': 1 },
      $set: { 'usage.lastLogin': new Date() }
    });
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    
    // Return user data without password
    const userResponse = {
      id: user._id,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
      usage: user.usage
    };
    
    res.json({
      message: 'Login successful',
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      issuer: 'opportunity-scanner',
      audience: 'opportunity-scanner-refresh'
    });
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Generate new tokens
    const tokens = generateTokens(user._id, user.role);
    
    res.json({
      message: 'Tokens refreshed',
      tokens
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = {};
    const allowedUpdates = ['preferences.notificationThreshold', 'preferences.emailNotifications', 'preferences.timezone'];
    
    // Only allow specific fields to be updated
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    // Get user with password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'New password does not meet requirements',
        details: passwordValidation.errors
      });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      updatedAt: new Date()
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Generate new API key
router.post('/regenerate-api-key', authenticateToken, async (req, res) => {
  try {
    const newApiKey = crypto.randomBytes(32).toString('hex');
    
    await User.findByIdAndUpdate(req.user._id, {
      apiKey: newApiKey,
      updatedAt: new Date()
    });
    
    res.json({
      message: 'API key regenerated',
      apiKey: newApiKey
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Blacklist the token
    await blacklistToken(req.token);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;