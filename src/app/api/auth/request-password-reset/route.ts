
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import * as z from 'zod';
import crypto from 'crypto';

const requestResetSchema = z.object({
  email: z.string().email("Invalid email address."),
});

const TOKEN_EXPIRY_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestResetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    const { email } = parsed.data;

    // 1. Check if user exists
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const userSnapshot = await getDocs(q);

    // IMPORTANT: To prevent email enumeration attacks, always return a generic success message
    // regardless of whether the email exists or not. The actual logic (token generation and email sending)
    // only proceeds if the user is found.
    if (userSnapshot.empty) {
      console.log(`Password reset requested for non-existent email: ${email}. Sending generic success response.`);
      // We still return a success-like message to the client.
      return NextResponse.json({ message: "If an account with this email exists, a password reset link has been sent." }, { status: 200 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;

    // 2. Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + TOKEN_EXPIRY_DURATION_MS));

    // 3. Store the token. For production, hash the token before storing.
    await addDoc(collection(db, 'passwordResetTokens'), {
      userId,
      token: resetToken, // HASH THIS IN PRODUCTION: crypto.createHash('sha256').update(resetToken).digest('hex')
      createdAt: serverTimestamp(),
      expiresAt,
    });

    // 4. Send the password reset email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Fallback for local dev
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM_ADDRESS } = process.env;
    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
      console.error("Email server configuration is missing. Cannot send password reset email.");
      // Still return a generic success to the client, but log error on server.
      return NextResponse.json({ message: "If an account with this email exists, a password reset link has been sent." }, { status: 200 });
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT, 10),
      secure: parseInt(EMAIL_PORT, 10) === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: EMAIL_FROM_ADDRESS || EMAIL_USER,
      to: email,
      subject: 'Password Reset Request - Insight Stream',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #29ABE2;">Password Reset Request</h2>
          <p>You (or someone else) requested a password reset for your Insight Stream account.</p>
          <p>If this was you, please click the link below to reset your password. The link is valid for 1 hour.</p>
          <p style="margin: 20px 0;">
            <a href="${resetLink}" style="background-color: #29ABE2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          </p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>Reset link: <a href="${resetLink}">${resetLink}</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.9em; color: #777;">This email was sent from Insight Stream.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error(`Failed to send password reset email to ${email}:`, emailError);
      // Still return a generic success to the client
    }

    return NextResponse.json({ message: "If an account with this email exists, a password reset link has been sent." }, { status: 200 });

  } catch (error) {
    console.error("Error in request-password-reset API:", error);
    // Generic error for the client, detailed log on server
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
