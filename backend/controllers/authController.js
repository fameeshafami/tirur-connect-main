const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const MIN_PASSWORD_LENGTH = 8;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const safeUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required.' });
    }

    const allowedRoles = ['shop_owner', 'job_seeker', 'chamber_member'];

    if (role === 'admin') {
      return res.status(403).json({ message: 'Admin registration is not allowed from a public request.' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: 'Only shop_owner, job_seeker, and chamber_member roles are allowed for public registration.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role,
      status: 'active',
    });

    const token = signToken(newUser);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: safeUserResponse(newUser),
    });
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ message: 'Registration failed.' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({
        message: `Account is ${user.status}. Please contact the administrator.`,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: safeUserResponse(user),
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Login failed.' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user: safeUserResponse(user) });
  } catch (error) {
    console.error('Get current user error:', error.message);
    return res.status(500).json({ message: 'Unable to fetch current user.' });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current password and new password are required.' });
  if (newPassword.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });

  const user = await User.findById(req.user.userId).select('+passwordHash');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!await bcrypt.compare(currentPassword, user.passwordHash)) return res.status(401).json({ message: 'Current password is incorrect.' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  res.json({ message: 'Password updated successfully.' });
};

const requestPasswordReset = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email is required.' });
  const user = await User.findOne({ email });
  const response = { message: 'If an account exists for that email, password reset instructions are ready.' };
  if (!user) return res.json(response);

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(resetToken);
  user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  response.resetToken = resetToken;
  response.resetUrl = `/reset-password.html?token=${resetToken}`;
  res.json(response);
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Reset token and new password are required.' });
  if (newPassword.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  const user = await User.findOne({ passwordResetTokenHash: hashResetToken(token), passwordResetExpiresAt: { $gt: new Date() } }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) return res.status(400).json({ message: 'This reset link is invalid or expired.' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  res.json({ message: 'Password reset successfully. You can now log in.' });
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
};
