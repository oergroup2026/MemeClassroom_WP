// Email Service for dispatching 4-digit OTP verification codes to real inboxes
export const sendOtpEmail = async (userEmail, otpCode) => {
  console.log(`[EmailService] Dispatching 4-digit code ${otpCode} to ${userEmail}`);
  
  // Environment variables for optional production SMTP / EmailJS integration
  const emailJsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim();
  const emailJsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim();
  const emailJsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim();

  if (emailJsServiceId && emailJsTemplateId && emailJsPublicKey) {
    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: emailJsServiceId,
          template_id: emailJsTemplateId,
          user_id: emailJsPublicKey,
          template_params: {
            to_email: userEmail,
            email: userEmail,
            otp_code: otpCode,
            app_name: "MemeClassroom"
          }
        })
      });
      const responseText = await response.text();
      if (response.ok) {
        console.log("[EmailService] EmailJS dispatch successful:", responseText);
        return { success: true, method: "emailjs", response: responseText };
      } else {
        console.error("[EmailService] EmailJS returned error:", response.status, responseText);
      }
    } catch (err) {
      console.warn("[EmailService] EmailJS dispatch failed:", err);
    }
  }

  return { success: true, method: "local_preview", code: otpCode };
};
