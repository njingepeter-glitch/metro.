import { useState, useCallback, useRef } from "react";
import PaystackPop from "@paystack/inline-js";
import { supabase } from "@/integrations/supabase/client";
import { getReferralTrackingId } from "@/lib/referralUtils";

interface PaystackPopupOptions {
  onSuccess?: (reference: string, bookingData: any) => void;
  onVerifying?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

interface BookingData {
  item_id: string;
  booking_type: string;
  total_amount: number;
  booking_details: Record<string, any>;
  user_id?: string | null;
  is_guest_booking: boolean;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  visit_date: string;
  slots_booked: number;
  host_id?: string;
  referral_tracking_id?: string | null;
  emailData?: {
    itemName: string;
  };
}

export const usePaystackPopup = (options: PaystackPopupOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const popupRef = useRef<PaystackPop | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const initiatePayment = useCallback(async (
    email: string,
    amount: number,
    bookingData: BookingData
  ) => {
    setIsLoading(true);
    setPaymentStatus('pending');
    setErrorMessage(null);

    try {
      // Add referral tracking ID to booking data
      const bookingDataWithReferral = {
        ...bookingData,
        referral_tracking_id: getReferralTrackingId(),
      };

      // Initialize transaction on backend to get access_code
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: {
          email,
          amount,
          bookingData: bookingDataWithReferral,
          callbackUrl: `${window.location.origin}/payment/verify`,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to initialize payment');
      }

      const { access_code, reference } = data.data;

      if (!access_code) {
        throw new Error('No access code received from payment initialization');
      }

      // Store reference for verification
      sessionStorage.setItem('paystack_reference', reference);
      sessionStorage.setItem('paystack_booking_data', JSON.stringify(bookingDataWithReferral));

      // Reuse popup instance to prevent re-initialization
      if (!popupRef.current) {
        popupRef.current = new PaystackPop();
      }
      const popup = popupRef.current;
      
      popup.resumeTransaction(access_code, {
        onSuccess: async (transaction: any) => {
          console.log('Payment successful:', transaction);
          setPaymentStatus('success');
          optionsRef.current.onVerifying?.();
          // Verify payment on backend
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('paystack-verify', {
              body: { reference: transaction.reference },
            });

            if (verifyError || !verifyData?.success) {
              console.error('Verification error:', verifyError || verifyData?.error);
            }

            // Clear session storage
            sessionStorage.removeItem('paystack_reference');
            sessionStorage.removeItem('paystack_booking_data');

            optionsRef.current.onSuccess?.(transaction.reference, verifyData?.data);
          } catch (err) {
            console.error('Error verifying payment:', err);
            // Still consider it success since payment went through
            // Pass booking data with correct field names for PDF generation
            optionsRef.current.onSuccess?.(transaction.reference, {
              bookingId: transaction.reference,
              guestName: bookingDataWithReferral.guest_name,
              guestEmail: bookingDataWithReferral.guest_email,
              guestPhone: bookingDataWithReferral.guest_phone,
              itemName: bookingDataWithReferral.emailData?.itemName || bookingDataWithReferral.booking_details?.item_name || 'Booking',
              bookingType: bookingDataWithReferral.booking_type,
              visitDate: bookingDataWithReferral.visit_date,
              amount: bookingDataWithReferral.total_amount,
              slotsBooked: bookingDataWithReferral.slots_booked,
              adults: bookingDataWithReferral.booking_details?.adults,
              children: bookingDataWithReferral.booking_details?.children,
              facilities: bookingDataWithReferral.booking_details?.facilities,
              activities: bookingDataWithReferral.booking_details?.activities,
              isSuccessful: true,
            });
          }
        },
        onCancel: () => {
          console.log('Payment cancelled');
          setPaymentStatus('idle');
          setIsLoading(false);
          optionsRef.current.onClose?.();
        },
      });

    } catch (error: any) {
      console.error('Paystack payment error:', error);
      setPaymentStatus('error');
      setErrorMessage(error.message);
      setIsLoading(false);
      options.onError?.(error.message);
    }
  }, [options]);

  const resetPayment = useCallback(() => {
    setPaymentStatus('idle');
    setErrorMessage(null);
    setIsLoading(false);
  }, []);

  return {
    initiatePayment,
    isLoading,
    paymentStatus,
    errorMessage,
    resetPayment,
  };
};
