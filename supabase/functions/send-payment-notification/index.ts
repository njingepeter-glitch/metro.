import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const paymentNotificationSchema = z.object({
  bookingId: z.string().uuid(),
  email: z.string().email().max(255),
  guestName: z.string().min(1).max(100),
  itemName: z.string().min(1).max(200),
  totalAmount: z.number().positive(),
  paymentStatus: z.enum(['completed', 'failed', 'refunded']),
  paymentMethod: z.string().optional(),
  visitDate: z.string().optional().nullable(),
});

function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawData = await req.json();
    let validatedData;
    try {
      validatedData = paymentNotificationSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return new Response(JSON.stringify({ error: "Invalid input", details: validationError.errors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw validationError;
    }

    const { bookingId, email, guestName, itemName, totalAmount, paymentStatus, paymentMethod, visitDate } = validatedData;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const safeName = escapeHtml(guestName);
    const safeItemName = escapeHtml(itemName);
    const safeBookingId = escapeHtml(bookingId);

    const statusConfig = {
      completed: { emoji: '✅', title: 'Payment Successful', color: '#008080', badge: '#D4EDDA', badgeText: '#155724' },
      failed: { emoji: '❌', title: 'Payment Failed', color: '#DC3545', badge: '#F8D7DA', badgeText: '#721C24' },
      refunded: { emoji: '💰', title: 'Payment Refunded', color: '#FFC107', badge: '#FFF3CD', badgeText: '#856404' },
    };

    const config = statusConfig[paymentStatus];

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${config.color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .detail-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${config.color}; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            h1 { margin: 0; font-size: 24px; }
            .amount { font-size: 28px; color: ${config.color}; font-weight: bold; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background: ${config.badge}; color: ${config.badgeText}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${config.emoji} ${config.title}</h1>
            </div>
            <div class="content">
              <p>Dear ${safeName},</p>
              <p>${paymentStatus === 'completed' ? 'Your payment has been successfully processed.' : paymentStatus === 'failed' ? 'Unfortunately, your payment could not be processed.' : 'Your payment has been refunded.'}</p>
              <div class="detail-box">
                <p><strong>Booking ID:</strong> ${safeBookingId}</p>
                <p><strong>Item:</strong> ${safeItemName}</p>
                ${visitDate ? `<p><strong>Visit Date:</strong> ${escapeHtml(String(visitDate))}</p>` : ''}
                ${paymentMethod ? `<p><strong>Payment Method:</strong> ${escapeHtml(paymentMethod)}</p>` : ''}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p class="amount">KES ${Number(totalAmount).toLocaleString()}</p>
                <span class="status-badge">${paymentStatus === 'completed' ? 'Payment Confirmed' : paymentStatus === 'failed' ? 'Payment Failed' : 'Refunded'}</span>
              </div>
              ${paymentStatus === 'failed' ? '<p>Please try again or contact support if the issue persists.</p>' : ''}
              ${paymentStatus === 'completed' ? '<p>Thank you for your booking! You can view your booking details in the app.</p>' : ''}
            </div>
            <div class="footer">
              <p>This is an automated notification from Realtravo.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Realtravo <noreply@realtravo.com>",
      to: [email],
      subject: `${config.title} - ${safeItemName}`,
      html: emailHTML,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-payment-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
