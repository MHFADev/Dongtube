import express from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { User } from '../models/index.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || 'dummy-client-id',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy-secret',
  callbackURL: `/auth/github/callback`,
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.user`;
    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        email,
        password: await bcrypt.hash(Math.random().toString(36), 12),
        role: 'user',
        githubId: profile.id
      });
    } else if (!user.githubId) {
      await user.update({ githubId: profile.id });
    }

    await user.update({ lastLogin: new Date() });
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      password: hashedPassword,
      role: 'user'
    });

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account'
    });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    await user.update({ lastLogin: new Date() });

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

router.get('/auth/me', authenticate, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        vipExpiresAt: req.user.vipExpiresAt,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
});

router.post('/auth/refresh-token', authenticate, async (req, res) => {
  try {
    const freshUser = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'role', 'vipExpiresAt', 'lastLogin']
    });

    if (!freshUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const newToken = generateToken(freshUser);

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log(`🔄 Token refreshed for user ${freshUser.email} - Current role: ${freshUser.role}`);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      message: 'Token refreshed successfully with latest user data',
      user: {
        id: freshUser.id,
        email: freshUser.email,
        role: freshUser.role,
        vipExpiresAt: freshUser.vipExpiresAt,
        lastLogin: freshUser.lastLogin
      },
      token: newToken,
      roleUpdated: req.user.role !== freshUser.role
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
});

router.get('/auth/github', passport.authenticate('github', {
  scope: ['user:email'],
  session: false
}));

router.get('/auth/github/callback', 
  passport.authenticate('github', { session: false, failureRedirect: '/login.html?error=auth_failed' }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      console.log(`✅ GitHub OAuth successful for ${req.user.email}`);

      if (req.user.role === 'admin') {
        res.redirect('/admin-panel.html');
      } else {
        res.redirect('/');
      }
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect('/login.html?error=auth_error');
    }
  }
);

export default router;
