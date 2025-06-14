
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import * as z from 'zod';

const requestResetSchema = z.object({
  email: z.string().email("Invalid email address."),
});

const OTP_EXPIRY_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const OTP_COLLECTION_NAME = 'otpRequests'; // Renamed collection

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestResetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    const { email } = parsed.data;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const userSnapshot = await getDocs(q);

    if (userSnapshot.empty) {
      console.log(`OTP requested for non-existent email: ${email}. Sending generic success response.`);
      return NextResponse.json({ message: "If an account with this email exists, an OTP has been sent." }, { status: 200 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;

    const otp = generateOtp();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + OTP_EXPIRY_DURATION_MS));

    // Store the OTP
    await addDoc(collection(db, OTP_COLLECTION_NAME), {
      userId,
      otp, // In a real production app, consider hashing the OTP before storing if feasible or using more advanced OTP services.
      email, // Storing email for easier lookup if needed, though OTP validation will primarily use the OTP value.
      createdAt: serverTimestamp(),
      expiresAt,
      used: false, // Flag to mark OTP as used
    });

    // Send the OTP email
    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM_ADDRESS } = process.env;
    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
      console.error("Email server configuration is missing. Cannot send OTP email.");
      return NextResponse.json({ message: "If an account with this email exists, an OTP has been sent." }, { status: 200 });
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
      subject: 'Your Password Reset OTP - Insight Stream',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #29ABE2;">Password Reset OTP</h2>
          <p>You (or someone else) requested a password reset for your Insight Stream account.</p>
          <p>Your One-Time Password (OTP) is:</p>
          <p style="font-size: 24px; font-weight: bold; color: #29ABE2; margin: 20px 0; letter-spacing: 2px;">
            ${otp}
          </p>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.9em; color: #777;">This email was sent from Insight Stream.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`OTP email sent to ${email}`);
    } catch (emailError) {
      console.error(`Failed to send OTP email to ${email}:`, emailError);
    }

    return NextResponse.json({ message: "If an account with this email exists, an OTP has been sent." }, { status: 200 });

  } catch (error) {
    console.error("Error in request-otp API:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
