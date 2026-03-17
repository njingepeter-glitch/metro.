import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      throw new Error("Reference is required");
    }

    console.log("Verifying payment with reference:", reference);

    // Verify transaction with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.status) {
      throw new Error(verifyData.message || "Verification failed");
    }

    const transaction = verifyData.data;
    const isSuccessful = transaction.status === "success";

    console.log("Paystack verification result:", { status: transaction.status, isSuccessful });

    // Update payment record
    const { data: paymentData, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("checkout_request_id", reference)
      .single();

    if (fetchError) {
      console.error("Error fetching payment:", fetchError);
    }

    if (paymentData) {
      // Update payment status
      await supabase
        .from("payments")
        .update({
          payment_status: isSuccessful ? "completed" : "failed",
          mpesa_receipt_number: transaction.reference,
          result_code: transaction.status,
          result_desc: transaction.gateway_response,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", reference);

      // If successful, create booking with payment distribution
      if (isSuccessful && paymentData.booking_data) {
        const bookingData = paymentData.booking_data as any;
        
        console.log("Creating booking with data:", bookingData);

        // Get referral settings for service fee rates
        const { data: settings } = await supabase
          .from("referral_settings")
          .select("*")
          .single();

        // Calculate service fee based on booking type
        let serviceFeeRate = 20.0; // Default 20%
        let commissionRate = 5.0; // Default 5%

        if (settings) {
          if (bookingData.booking_type === 'trip') {
            serviceFeeRate = Number(settings.trip_service_fee);
            commissionRate = Number(settings.trip_commission_rate);
          } else if (bookingData.booking_type === 'event') {
            serviceFeeRate = Number(settings.event_service_fee);
            commissionRate = Number(settings.event_commission_rate);
          } else if (bookingData.booking_type === 'hotel') {
            serviceFeeRate = Number(settings.hotel_service_fee);
            commissionRate = Number(settings.hotel_commission_rate);
          } else if (bookingData.booking_type === 'adventure' || bookingData.booking_type === 'adventure_place') {
            serviceFeeRate = Number(settings.adventure_place_service_fee);
            commissionRate = Number(settings.adventure_place_commission_rate);
          } else if (bookingData.booking_type === 'attraction') {
            serviceFeeRate = Number(settings.attraction_service_fee);
            commissionRate = Number(settings.attraction_commission_rate);
          }
        }

        const totalAmount = Number(bookingData.total_amount);
        const serviceFeeAmount = (totalAmount * serviceFeeRate) / 100;
        const hostPayoutAmount = totalAmount - serviceFeeAmount;

        // Get host ID
        let hostId = null;
        if (bookingData.booking_type === 'trip' || bookingData.booking_type === 'event') {
          const { data: tripData } = await supabase
            .from('trips')
            .select('created_by, email')
            .eq('id', bookingData.item_id)
            .single();
          hostId = tripData?.created_by;
        } else if (bookingData.booking_type === 'hotel') {
          const { data: hotelData } = await supabase
            .from('hotels')
            .select('created_by, email')
            .eq('id', bookingData.item_id)
            .single();
          hostId = hotelData?.created_by;
        } else if (bookingData.booking_type === 'adventure_place' || bookingData.booking_type === 'adventure') {
          const { data: adventureData } = await supabase
            .from('adventure_places')
            .select('created_by, email')
            .eq('id', bookingData.item_id)
            .single();
          hostId = adventureData?.created_by;
        }

        // Get referral tracking ID from session storage passed in booking data
        const referralTrackingId = bookingData.referral_tracking_id || null;

        // Create booking with payout info
        const visitDate = bookingData.visit_date ? new Date(bookingData.visit_date) : null;
        const payoutScheduledAt = visitDate 
          ? new Date(visitDate.getTime() - (48 * 60 * 60 * 1000)).toISOString() // 48 hours before visit
          : null;

        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert([{
            user_id: bookingData.user_id || null,
            item_id: bookingData.item_id,
            booking_type: bookingData.booking_type,
            total_amount: totalAmount,
            status: "confirmed",
            payment_status: "completed",
            payment_method: "card",
            is_guest_booking: bookingData.is_guest_booking || false,
            guest_name: bookingData.guest_name,
            guest_email: bookingData.guest_email,
            guest_phone: bookingData.guest_phone || null,
            slots_booked: bookingData.slots_booked || 1,
            visit_date: bookingData.visit_date,
            booking_details: bookingData.booking_details,
            service_fee_amount: serviceFeeAmount,
            host_payout_amount: hostPayoutAmount,
            payout_status: 'scheduled',
            payout_scheduled_at: payoutScheduledAt,
            referral_tracking_id: referralTrackingId,
          }])
          .select()
          .single();

        let resolvedBooking = booking ?? null;

        if (bookingError) {
          console.error("Error creating booking:", bookingError);
        }

        if (!resolvedBooking) {
          const { data: existingBookings, error: existingBookingError } = await supabase
            .from("bookings")
            .select("*")
            .eq("item_id", bookingData.item_id)
            .eq("guest_email", bookingData.guest_email)
            .eq("visit_date", bookingData.visit_date)
            .order("created_at", { ascending: false })
            .limit(1);

          if (existingBookingError) {
            console.error("Error resolving existing booking:", existingBookingError);
          }

          resolvedBooking = existingBookings?.[0] ?? null;
        }

        if (resolvedBooking) {
          console.log("Booking resolved successfully:", resolvedBooking.id);
          console.log("Payment distribution:", {
            totalAmount,
            serviceFeeAmount,
            hostPayoutAmount,
            serviceFeeRate,
          });

          // Create payout record for host (to be processed 48h before booking)
          if (hostId && hostPayoutAmount > 0) {
            const { data: bankDetails } = await supabase
              .from('bank_details')
              .select('*')
              .eq('user_id', hostId)
              .eq('verification_status', 'verified')
              .single();

            if (bankDetails) {
              await supabase.from('payouts').insert({
                recipient_id: hostId,
                recipient_type: 'host',
                booking_id: resolvedBooking?.id,
                amount: hostPayoutAmount,
                status: 'scheduled',
                scheduled_for: payoutScheduledAt,
                bank_code: bankDetails.bank_name,
                account_number: bankDetails.account_number,
                account_name: bankDetails.account_holder_name,
              });
              console.log("Host payout scheduled:", hostPayoutAmount);
            } else {
              console.log("No verified bank details found for host:", hostId);
            }
          }

          // Send confirmation email to the user
          try {
            await supabase.functions.invoke("send-booking-confirmation", {
              body: {
                bookingId: resolvedBooking?.id,
                email: bookingData.guest_email,
                guestName: bookingData.guest_name,
                bookingType: bookingData.booking_type,
                itemName: bookingData.emailData?.itemName || bookingData.booking_details?.item_name || "Booking",
                totalAmount: bookingData.total_amount,
                bookingDetails: bookingData.booking_details,
                visitDate: bookingData.visit_date,
              },
            });
            console.log("Booking confirmation email sent");
          } catch (emailError) {
            console.error("Error sending confirmation email:", emailError);
          }

          // Send notification email to the host
          try {
            let hostEmail = null;
            
            if (bookingData.booking_type === 'trip' || bookingData.booking_type === 'event') {
              const { data: tripData } = await supabase
                .from('trips')
                .select('email, created_by')
                .eq('id', bookingData.item_id)
                .single();
              hostEmail = tripData?.email;
            } else if (bookingData.booking_type === 'hotel') {
              const { data: hotelData } = await supabase
                .from('hotels')
                .select('email, created_by')
                .eq('id', bookingData.item_id)
                .single();
              hostEmail = hotelData?.email;
            } else if (bookingData.booking_type === 'adventure_place' || bookingData.booking_type === 'adventure') {
              const { data: adventureData } = await supabase
                .from('adventure_places')
                .select('email, created_by')
                .eq('id', bookingData.item_id)
                .single();
              hostEmail = adventureData?.email;
            }

            if (hostEmail) {
              await supabase.functions.invoke("send-host-booking-notification", {
                body: {
                  bookingId: resolvedBooking?.id,
                  hostEmail: hostEmail,
                  guestName: bookingData.guest_name,
                  guestEmail: bookingData.guest_email,
                  guestPhone: bookingData.guest_phone,
                  bookingType: bookingData.booking_type,
                  itemName: bookingData.emailData?.itemName || bookingData.booking_details?.item_name || "Booking",
                  totalAmount: bookingData.total_amount,
                  hostPayoutAmount: hostPayoutAmount,
                  serviceFee: serviceFeeAmount,
                  bookingDetails: bookingData.booking_details,
                  visitDate: bookingData.visit_date,
                },
              });
              console.log("Host notification email sent to:", hostEmail);
            }
          } catch (hostEmailError) {
            console.error("Error sending host notification email:", hostEmailError);
          }
        }

        // Return full booking details for PDF download
        const bookingDetails = bookingData.booking_details || {};
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              status: transaction.status,
              reference: transaction.reference,
              amount: Number(bookingData.total_amount ?? transaction.amount / 100 ?? 0),
              paid_at: transaction.paid_at,
              channel: transaction.channel,
              currency: transaction.currency,
              isSuccessful,
              bookingId: resolvedBooking?.id ?? null,
              guestName: bookingData.guest_name ?? bookingDetails.guest_name ?? "Guest",
              guestEmail: bookingData.guest_email ?? bookingDetails.guest_email ?? "",
              guestPhone: bookingData.guest_phone ?? bookingDetails.guest_phone ?? "",
              itemName: bookingData.emailData?.itemName || bookingDetails.item_name || "Booking",
              bookingType: bookingData.booking_type,
              visitDate: bookingData.visit_date,
              slotsBooked: bookingData.slots_booked ?? ((bookingDetails.adults ?? bookingDetails.num_adults ?? 0) + (bookingDetails.children ?? bookingDetails.num_children ?? 0)),
              adults: bookingDetails.adults ?? bookingDetails.num_adults,
              children: bookingDetails.children ?? bookingDetails.num_children,
              facilities: bookingDetails.facilities ?? bookingDetails.selectedFacilities ?? [],
              activities: bookingDetails.activities ?? bookingDetails.selectedActivities ?? [],
              serviceFee: serviceFeeAmount,
              hostPayout: hostPayoutAmount,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: transaction.status,
          reference: transaction.reference,
          amount: transaction.amount / 100,
          paid_at: transaction.paid_at,
          channel: transaction.channel,
          currency: transaction.currency,
          isSuccessful,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Paystack verify error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
