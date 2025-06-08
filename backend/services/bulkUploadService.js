const xlsx = require('xlsx');
const mongoose = require('mongoose');
const BulkOperationReports = require('../models/bulkOperationReports');
const UserLoginReports = require('../models/UserLoginReports');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
            userName: user.userName,
            email: user.email
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
        const resetUrl = `https://mdnrpt.medianet.mv/reset-password/${resetToken}`;

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

const processBulkUpload = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract contact codes
    const contactCodes = data.map(row => row['Contact Code']).filter(Boolean);

    // Get native collection reference
    const collection = mongoose.connection.db.collection('Journals');

    // Find contacts
    const contacts = await collection.find({ 
        contact_code: { $in: [...new Set(contactCodes)] } // Deduplicate codes
      }).toArray();
      
      // Create a map for quick lookup
      const contactMap = new Map(contacts.map(c => [c.contact_code, c]));
      
      // Map each Excel row to a contact (using the first occurrence in the database)
      const result = contactCodes.map(code => ({
        contact_id: contactMap.get(code)?.contact_id,
        contact_code: code
      }));

      return result;
};

const processServiceBulk = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const contactCodes = data.map(row => row['Contact Code'] ? String(row['Contact Code']).replace(/'/g, '').trim() : null).filter(Boolean);

    // Get native collection references
    const journalsCollection = mongoose.connection.db.collection('Journals');
    const contactProfilesCollection = mongoose.connection.db.collection('ContactProfiles');

    // Find contacts from Journals collection to get contact_id
    const contacts = await journalsCollection.find({ 
        contact_code: { $in: [...new Set(contactCodes)] } // Use cleaned codes
    }).toArray();

    // Create a map for quick lookup of Journals contacts (contact_code to contact_id)
    const contactMap = new Map(contacts.map(c => [String(c.contact_code).trim(), c]));

    // Extract contact_id values from Journals for ContactProfiles query
    const contactIds = contacts.map(c => c.contact_id).filter(Boolean);

    // Find contact profiles with custom_fields using contact_id
    const contactProfiles = await contactProfilesCollection.find({ 
        contact_id: { $in: [...new Set(contactIds)] } // Deduplicate contact_ids
    }).toArray();

    // Create a map for quick lookup of custom_fields from ContactProfiles (keyed by contact_id)
    const customFieldsMap = new Map();
    contactProfiles.forEach(profile => {
        if (profile.custom_fields && Array.isArray(profile.custom_fields)) {
            // Filter valid custom_fields entries with key, value, and value_label
            const validCustomFields = profile.custom_fields.filter(field => 
                field.key && field.value && field.value_label
            );
            if (validCustomFields.length > 0) {
                customFieldsMap.set(profile.contact_id, validCustomFields);
            }
        }
    });

    // Map each Excel row to a contact, dynamically including all custom_fields as separate fields
    const result = contactCodes.map(code => {
        const contact = contactMap.get(code);
        const resultObj = {
            contact_id: contact?.contact_id,
            contact_code: code // Use cleaned contact_code
        };

        // Get custom_fields for this contact_id
        const customFields = contact && customFieldsMap.get(contact.contact_id) || [];

        // Dynamically add key, value, value_label for each custom_field
        customFields.forEach(field => {
            // Use a sanitized version of the key to avoid invalid field names
            const safeKey = field.key.replace(/[^a-zA-Z0-9_]/g, '_');
            resultObj[`${safeKey}_key`] = field.key;
            resultObj[`${safeKey}_value`] = field.value;
            resultObj[`${safeKey}_value_label`] = field.value_label;
        });

        return resultObj;
    });
    console.log(result,'result of service bulk upload')
    return result;
};

const processAddressBulk = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract and clean contact codes
    const contactCodes = data
        .map(row => row['Contact Code'] ? String(row['Contact Code']).replace(/'/g, '').trim() : null)
        .filter(Boolean);

        console.log(contactCodes,'contact codes in address bulk upload')

    // Get Journals collection reference
    const journalsCollection = mongoose.connection.db.collection('Journals');

    // Find contacts from Journals collection to get contact_id
    const contacts = await journalsCollection.find({ 
        contact_code: { $in: [...new Set(contactCodes)] } // Use deduplicated cleaned codes
    }).toArray();

    // Create a map for quick lookup of Journals contacts (contact_code to contact_id)
    const contactMap = new Map(contacts.map(c => [String(c.contact_code).trim(), c]));

    // Map each Excel contact code to a result object with contact_id and contact_code
    const result = contactCodes.map(code => ({
        contact_id: contactMap.get(code)?.contact_id || null,
        contact_code: code
    }));

    console.log(result, 'result of service bulk upload');
    return result;
};

const processDealerBulkUpload = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract contact codes
    const accountNumbers = data.map(row => row['Dealer Name']).filter(Boolean);


    // Get native collection reference
    const collection = mongoose.connection.db.collection('Journals');


    // const contacts = await collection.find(
    //     { contact_code: { $in: contactCodes } },
    //     { projection: { contact_id: 1,contact_code: 1, _id: 0 } }
    // ).toArray();
    // Find contacts
    const contacts = await collection.find({
        account_organisation_name: { $in: [...new Set(accountNumbers)] } // Deduplicate codes
      }).toArray();
      
      // Create a map for quick lookup
      const contactMap = new Map(contacts.map(c => [c.account_organisation_name, c]));

      
      // Map each Excel row to a contact (using the first occurrence in the database)
      const result = accountNumbers.map(code => ({
        account_id: contactMap.get(code)?.account_id,
      }));

      return result;
    // Return array of objects with contact_id property
    // return contacts.map(contact => ({ contact_id: contact.contact_id, contact_code: contact.contact_code }));
};

const createBulkOperation = async (batch, file_name, date, type, status) => {
    try {

        const newReport = new BulkOperationReports({
            batch, file_name, date,type, status
        });

        await newReport.save();
        return { message: 'Report created successfully', report: newReport };
    } catch (error) {
        throw new Error(error.message);
    }
};

const getAllBulkOperations = async (page = 1, limit = 10, type) => {
    try {
        const skip = (page - 1) * limit;
        const query = {};
        if (type) {
            query.type = type;
        }
        const total = await BulkOperationReports.countDocuments(query);
        const reports = await BulkOperationReports.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ date: -1 });

        return {
            reports,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalRecords: total
        };
    } catch (error) {
        throw new Error(error.message);
    }
};
module.exports = {
    processBulkUpload,
    createBulkOperation,
    getAllBulkOperations,
    loginUser,
    forgotPassword,
    resetPassword,
    processDealerBulkUpload,
    processServiceBulk,
    processAddressBulk
};