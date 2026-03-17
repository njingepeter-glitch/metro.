import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { BookingDownloadButton } from "./BookingDownloadButton";
import { BookingPDFData } from "@/lib/pdfBookingExport";
import { useNavigate } from "react-router-dom";

interface PaymentSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingData: any;
  reference: string;
  onBackToBooking?: () => void;
}

export const PaymentSuccessDialog = ({
  open,
  onOpenChange,
  bookingData,
  reference,
  onBackToBooking,
}: PaymentSuccessDialogProps) => {
  const navigate = useNavigate();

  // Extract booking details - prefer resolved booking row data, then nested booking_details, then safe fallbacks
  const details = bookingData?.booking_details ?? bookingData?.bookingDetails ?? {};
  const adults = bookingData?.adults ?? details?.adults ?? details?.num_adults;
  const children = bookingData?.children ?? details?.children ?? details?.num_children;
  const facilities = bookingData?.facilities ?? details?.facilities ?? details?.selectedFacilities ?? [];
  const activities = bookingData?.activities ?? details?.activities ?? details?.selectedActivities ?? [];
  const slotsBooked =
    bookingData?.slotsBooked ??
    bookingData?.slots_booked ??
    details?.slots_booked ??
    ((adults ?? 0) + (children ?? 0)) ||
    undefined;

  const pdfData: BookingPDFData | null = bookingData
    ? {
        bookingId: bookingData?.bookingId ?? bookingData?.id ?? reference,
        guestName: bookingData?.guestName ?? bookingData?.guest_name ?? details?.guest_name ?? details?.guestName ?? 'Guest',
        guestEmail: bookingData?.guestEmail ?? bookingData?.guest_email ?? details?.guest_email ?? details?.guestEmail ?? '',
        guestPhone: bookingData?.guestPhone ?? bookingData?.guest_phone ?? details?.guest_phone ?? details?.guestPhone,
        itemName:
          bookingData?.itemName ??
          bookingData?.item_name ??
          bookingData?.emailData?.itemName ??
          details?.item_name ??
          'Booking',
        bookingType: bookingData?.bookingType ?? bookingData?.booking_type ?? details?.booking_type ?? 'booking',
        visitDate: bookingData?.visitDate ?? bookingData?.visit_date ?? details?.visit_date ?? new Date().toISOString(),
        totalAmount: bookingData?.amount ?? bookingData?.total_amount ?? details?.total_amount ?? 0,
        adults,
        children,
        slotsBooked,
        paymentStatus: bookingData?.paymentStatus ?? bookingData?.payment_status ?? 'completed',
        facilities,
        activities,
      }
    : null;

  const handleViewBookings = () => {
    onOpenChange(false);
    navigate('/bookings');
  };

  const handleBack = () => {
    onOpenChange(false);
    if (onBackToBooking) {
      onBackToBooking();
    } else {
      navigate(-1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {/* Prevent closing by tapping outside */}}>
      <DialogContent className="sm:max-w-md rounded-[24px] p-6 [&>button:last-child]:hidden">
        
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-popup-accent">
              Payment Successful!
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Your booking has been confirmed. Download your ticket below.
          </p>
          
          {/* Payment Details */}
          {bookingData && (
            <div className="bg-muted rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Booking Details
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-bold">{reference}</span>
                </div>
                {(bookingData.amount || bookingData.total_amount) && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="text-sm font-bold">
                      KES {(bookingData.amount || bookingData.total_amount)?.toLocaleString()}
                    </span>
                  </div>
                )}
                {(bookingData.itemName || bookingData.emailData?.itemName) && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Item</span>
                    <span className="text-sm font-bold truncate max-w-[150px]">
                      {bookingData.itemName || bookingData.emailData?.itemName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {/* Download Button - Critical for guests */}
            {pdfData && (
              <BookingDownloadButton
                booking={pdfData}
                variant="default"
                size="lg"
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest"
              />
            )}
            
            <Button
              onClick={handleViewBookings}
              variant="outline"
              className="w-full h-12 rounded-2xl font-black uppercase tracking-widest border-popup-accent text-popup-accent"
            >
              View My Bookings
            </Button>

            <Button
              onClick={handleBack}
              variant="ghost"
              className="w-full h-10 rounded-2xl font-bold text-sm text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
