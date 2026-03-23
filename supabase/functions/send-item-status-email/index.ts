import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const itemStatusSchema = z.object({
  userId: z.string().uuid(),
  itemName: z.string().min(1).max(200),
  itemType: z.enum(['trip', 'event', 'hotel', 'adventure_place', 'attraction']),
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional().nullable(),
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
      validatedData = itemStatusSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return new Response(JSON.stringify({ error: "Invalid input", details: validationError.errors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw validationError;
    }

    const { userId, itemName, itemType, status, rejectionReason } = validatedData;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.email) {
      return new Response(JSON.stringify({ error: "User not found or no email" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const safeName = escapeHtml(profile.name || 'Host');
    const safeItemName = escapeHtml(itemName);
    const typeDisplay = escapeHtml(itemType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    const isApproved = status === 'approved';

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${isApproved ? '#008080' : '#DC3545'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .detail-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${isApproved ? '#008080' : '#DC3545'}; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            h1 { margin: 0; font-size: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isApproved ? '✅ Listing Approved!' : '❌ Listing Not Approved'}</h1>
            </div>
            <div class="content">
              <p>Dear ${safeName},</p>
              <p>${isApproved
                ? 'Great news! Your listing has been reviewed and approved. It is now visible to users on the platform.'
                : 'We regret to inform you that your listing was not approved at this time.'}</p>
              <div class="detail-box">
                <p><strong>Listing:</strong> ${safeItemName}</p>
                <p><strong>Type:</strong> ${typeDisplay}</p>
                <p><strong>Status:</strong> ${isApproved ? 'Approved ✅' : 'Rejected ❌'}</p>
                ${!isApproved && rejectionReason ? `<p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>` : ''}
              </div>
              ${!isApproved ? '<p>Please review the feedback and resubmit your listing with the necessary changes.</p>' : '<p>You can now manage your listing from your dashboard.</p>'}
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
      to: [profile.email],
      subject: `Listing ${isApproved ? 'Approved' : 'Not Approved'} - ${safeItemName}`,
      html: emailHTML,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-item-status-email:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
