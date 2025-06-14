
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import * as z from 'zod';
import { updateUserPassword } from '@/lib/user-service'; // We'll create this function

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address."),
  otp: z.string().length(6, "OTP must be 6 digits.").regex(/^\d{6}$/, "OTP must be 6 digits."),
  newPassword: z.string().min(6, "New password must be at least 6 characters."),
});

const OTP_COLLECTION_NAME = 'otpRequests';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input.", details: parsed.error.flatten() }, { status: 400 });
    }
    const { email, otp, newPassword } = parsed.data;

    // 1. Find the OTP request
    const otpQuery = query(
      collection(db, OTP_COLLECTION_NAME),
      where('email', '==', email),
      where('otp', '==', otp)
    );
    const otpSnapshot = await getDocs(otpQuery);

    if (otpSnapshot.empty) {
      return NextResponse.json({ error: "Invalid or expired OTP. Please try again." }, { status: 400 });
    }

    const otpDoc = otpSnapshot.docs[0]; // Should be only one if OTPs are unique enough or handled well
    const otpData = otpDoc.data();

    // 2. Check if OTP is expired
    if (otpData.expiresAt && (otpData.expiresAt as Timestamp).toMillis() < Date.now()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // 3. Check if OTP has been used
    if (otpData.used === true) {
      return NextResponse.json({ error: "This OTP has already been used. Please request a new one." }, { status: 400 });
    }

    const userId = otpData.userId;
    if (!userId) {
        console.error("OTP document is missing userId:", otpDoc.id);
        return NextResponse.json({ error: "OTP validation failed. User association missing." }, { status: 500 });
    }

    // 4. Update user's password (conceptually for now)
    const passwordUpdateResult = await updateUserPassword(userId, newPassword);
    if (!passwordUpdateResult.success) {
      return NextResponse.json({ error: passwordUpdateResult.error || "Failed to update password." }, { status: 500 });
    }

    // 5. Mark OTP as used
    const batch = writeBatch(db);
    batch.update(doc(db, OTP_COLLECTION_NAME, otpDoc.id), { used: true });
    await batch.commit();

    return NextResponse.json({ message: "Password has been reset successfully." }, { status: 200 });

  } catch (error) {
    console.error("Error in verify-otp-and-reset-password API:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
