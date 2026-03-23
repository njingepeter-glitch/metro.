import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data = await req.json();
    const { bookingId, hostEmail, guestName, guestEmail, guestPhone, bookingType, itemName, totalAmount, hostPayoutAmount, serviceFee, visitDate } = data;

    if (!hostEmail || !bookingId) {
      console.error("Missing required fields: hostEmail or bookingId");
      return new Response(
        JSON.stringify({ error: "hostEmail and bookingId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const safeGuestName = escapeHtml(guestName || 'Guest');
    const safeItemName = escapeHtml(itemName || 'Booking');
    const safeBookingId = escapeHtml(bookingId);
    const safeGuestEmail = escapeHtml(guestEmail || '');
    const safeGuestPhone = escapeHtml(guestPhone || '');

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #008080; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .detail-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #008080; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { color: #008080; font-size: 20px; margin-top: 0; }
            .amount { font-size: 28px; color: #008080; font-weight: bold; }
            .payout-info { background: #e6f7f7; padding: 12px; border-radius: 6px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Paid Booking!</h1>
            </div>
            <div class="content">
              <p>Great news! You have received a new paid booking for your listing.</p>
              
              <div class="detail-box">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${safeBookingId}</p>
                <p><strong>Guest Name:</strong> ${safeGuestName}</p>
                ${safeGuestEmail ? `<p><strong>Guest Email:</strong> ${safeGuestEmail}</p>` : ''}
                ${safeGuestPhone ? `<p><strong>Guest Phone:</strong> ${safeGuestPhone}</p>` : ''}
                <p><strong>Item:</strong> ${safeItemName}</p>
                ${visitDate ? `<p><strong>Visit Date:</strong> ${escapeHtml(String(visitDate))}</p>` : ''}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p class="amount">Total: KES ${Number(totalAmount || 0).toLocaleString()}</p>
                ${hostPayoutAmount ? `
                <div class="payout-info">
                  <p style="margin: 4px 0;"><strong>Your Payout:</strong> KES ${Number(hostPayoutAmount).toLocaleString()}</p>
                  ${serviceFee ? `<p style="margin: 4px 0; font-size: 13px; color: #666;">Service Fee: KES ${Number(serviceFee).toLocaleString()}</p>` : ''}
                </div>
                ` : ''}
              </div>

              <p>Please prepare to welcome your guest. You can view full booking details in your dashboard.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from Realtravo. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data: emailData, error } = await resend.emails.send({
      from: "Realtravo Bookings <noreply@realtravo.com>",
      to: [hostEmail],
      subject: `New Paid Booking - ${safeItemName}`,
      html: emailHTML,
    });

    if (error) {
      console.error("Error sending host notification email:", error);
      throw error;
    }

    console.log("Host notification email sent to:", hostEmail);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-host-booking-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
