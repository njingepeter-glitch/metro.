import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const hostNotificationSchema = z.object({
  hostId: z.string().uuid("Invalid host ID format"),
  bookingId: z.string().uuid("Invalid booking ID format"),
  guestName: z.string().min(1, "Guest name required").max(100, "Guest name too long"),
  itemName: z.string().min(1, "Item name required").max(200, "Item name too long"),
  totalAmount: z.number().positive("Amount must be positive").max(10000000, "Amount too large"),
  visitDate: z.string().optional().nullable(),
});

// HTML escape function to prevent XSS
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawData = await req.json();
    
    let validatedData;
    try {
      validatedData = hostNotificationSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error("Validation error:", validationError.errors);
        return new Response(
          JSON.stringify({ error: "Invalid input", details: validationError.errors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw validationError;
    }

    const { hostId, bookingId, guestName, itemName, totalAmount, visitDate } = validatedData;

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify booking exists and is paid
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, item_id, booking_type, payment_status, total_amount')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking not found:", bookingId);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only send notification for paid bookings
    if (booking.payment_status !== 'paid' && booking.payment_status !== 'completed') {
      console.error("Booking not paid:", bookingId, "Status:", booking.payment_status);
      return new Response(
        JSON.stringify({ error: "Booking is not paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine the table based on booking type
    let tableName = 'trips';
    if (booking.booking_type === 'hotel') {
      tableName = 'hotels';
    } else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') {
      tableName = 'adventure_places';
    }

    // Verify the item belongs to the claimed host
    const { data: item, error: itemError } = await supabaseClient
      .from(tableName)
      .select('created_by')
      .eq('id', booking.item_id)
      .single();

    if (itemError || !item) {
      console.error("Item not found:", booking.item_id);
      return new Response(
        JSON.stringify({ error: "Item not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify host owns this item
    if (item.created_by !== hostId) {
      console.error("Host does not own this item:", hostId, "vs", item.created_by);
      return new Response(
        JSON.stringify({ error: "Host does not own this item" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get host details
    const { data: host, error: hostError } = await supabaseClient
      .from('profiles')
      .select('email, name')
      .eq('id', hostId)
      .single();

    if (hostError || !host || !host.email) {
      console.error("Host not found or no email:", hostId);
      return new Response(
        JSON.stringify({ error: "Host not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Escape all user-provided data for HTML
    const safeHostName = escapeHtml(host.name || 'Host');
    const safeGuestName = escapeHtml(guestName);
    const safeItemName = escapeHtml(itemName);
    const safeBookingId = escapeHtml(bookingId);

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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Paid Booking!</h1>
            </div>
            <div class="content">
              <p>Dear ${safeHostName},</p>
              <p>Great news! You have received a new paid booking for your listing.</p>
              
              <div class="detail-box">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${safeBookingId}</p>
                <p><strong>Guest Name:</strong> ${safeGuestName}</p>
                <p><strong>Item:</strong> ${safeItemName}</p>
                ${visitDate ? `<p><strong>Visit Date:</strong> ${escapeHtml(String(visitDate))}</p>` : ''}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p class="amount">Amount: Sh ${Number(totalAmount).toFixed(2)}</p>
              </div>

              <p>Please prepare to welcome your guest. You can view full booking details in your dashboard.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Realtravo Bookings <noreply@realtravo.com>",
      to: [host.email],
      subject: `New Paid Booking - ${safeItemName}`,
      html: emailHTML,
    });

    if (error) {
      console.error("Error sending host notification email:", error);
      throw error;
    }

    console.log("Host notification email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
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
