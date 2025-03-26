const UserLoginReports = require('../models/UserLoginReports');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Function to register user
const registerUser = async (name, email, password, designation) => {
    try {
        console.log(name,'name service')
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds); 

        const newUser = new UserLoginReports({
            name,
            email,
            password: hashedPassword, 
            designation
        });

        await newUser.save();
        return { message: 'User registered successfully', user: newUser };
    } catch (error) {
        throw new Error(error.message);
    }
};

const loginUser = async (email, password) => {
    try {
        console.log(email, password);
        //Find the user with the email
        const user = await UserLoginReports.findOne({
            email
        });

        if(!user){
            throw new Error('User not found');
        }

        // Compare the provided password with the hashed password stored in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log(isPasswordValid,'isPasswordValid')

        if(!isPasswordValid){
            throw new Error('Invalid password');
        }

        //Return the user data
        return {
            userName: user.name,
            email: user.email,
            roles: user.roles,
            permissions: user.permissions
        };
    } catch (error) {
        throw new Error(error.message);
    }
};


const forgotPassword = async (email) => {
    try {
        // Check if the user exists
        const user = await UserLoginReports.findOne({ email });

        console.log(user,'user email')

        if (!user) {
            throw new Error('User not found');
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Set the reset token and expiration time (e.g., 1 hour)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        // Save the user with the reset token
        await user.save();

        // Send the reset token via email
        const resetUrl = `https://mdnrpt.medianet.mv/reports/reset-password/${resetToken}`;

        console.log(process.env.EMAIL_USER,process.env.EMAIL_PASS,'email user and pass')

        const transporter = nodemailer.createTransport({
            service: 'gmail', // Use your email service
            auth: {
                user: process.env.EMAIL_USER, // Your email
                pass: process.env.EMAIL_PASS, // Your email password
            },
        });

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
                Please click on the following link, or paste it into your browser to complete the process:\n\n
                ${resetUrl}\n\n
                If you did not request this, please ignore this email and your password will remain unchanged.\n`,
        };

        console.log(mailOptions,'mail optionsS')

        await transporter.sendMail(mailOptions);

        return { message: 'Password reset link sent to your email.' };
    } catch (error) {
        throw new Error(error.message);
    }
};

// Function to handle reset password
const resetPassword = async (token, newPassword) => {
    try {
        // Find the user with the reset token and check if it's still valid
        const user = await UserLoginReports.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            throw new Error('Invalid or expired token.');
        }

        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password and clear the reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        return { message: 'Password reset successful.' };
    } catch (error) {
        throw new Error(error.message);
    }
};


module.exports = {
    loginUser,
    registerUser,
    forgotPassword,
    resetPassword,
  };