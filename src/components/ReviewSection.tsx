import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface ReviewSectionProps {
  itemId: string;
  itemType: "trip" | "event" | "hotel" | "adventure_place" | "attraction";
}

export function ReviewSection({ itemId, itemType }: ReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    fetchRatings();
  }, [itemId, itemType]);

  const fetchRatings = async () => {
    try {
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select("rating, user_id")
        .eq("item_id", itemId)
        .eq("item_type", itemType);

      if (error) throw error;
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        setAverageRating(avg);
        setTotalReviews(reviews.length);

        if (user) {
          const userReview = reviews.find((r) => r.user_id === user.id);
          if (userReview) {
            setUserRating(userReview.rating);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching ratings:", error);
    }
  };

  const handleRating = async (rating: number) => {
    if (!user) return;
    try {
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .single();

      if (existingReview) {
        const { error } = await supabase
          .from("reviews")
          .update({ rating })
          .eq("id", existingReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert({
          user_id: user.id,
          item_id: itemId,
          item_type: itemType,
          rating,
        });
        if (error) throw error;
      }
      setUserRating(rating);
      fetchRatings();
      toast({ title: "Rating submitted", description: "Thank you for your feedback!" });
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({ title: "Error", description: error.message || "Failed to submit rating", variant: "destructive" });
    }
  };

  const displayRating = hoveredStar || userRating;

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      {/* Compact header with average */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="text-2xl font-black text-slate-900">
              {averageRating > 0 ? averageRating.toFixed(1) : "—"}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-bold">
            {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
          </span>
        </div>

        {/* Mini star bar for average */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-3.5 w-3.5 ${
                star <= Math.round(averageRating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-slate-200 text-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* User rating - direct and simple */}
      {user ? (
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 shrink-0">
            {userRating > 0 ? "Your rating:" : "Rate:"}
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                <Star
                  className={`h-7 w-7 cursor-pointer transition-colors ${
                    star <= displayRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-slate-200"
                  }`}
                />
              </button>
            ))}
          </div>
          {userRating > 0 && (
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              ★ {userRating}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">
          <Link to="/auth" className="font-bold text-primary underline">Log in</Link> to rate
        </p>
      )}
    </section>
  );
}