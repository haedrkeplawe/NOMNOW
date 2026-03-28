import { useEffect, useState } from "react";
import { FaStar } from "react-icons/fa6";
import { TiStarOutline } from "react-icons/ti";
import { FiMessageSquare } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

// ── Stars renderer ────────────────────────────────────────────
const Stars = ({ rating, size = 14 }) => (
  <div className="rv-stars">
    {[1, 2, 3, 4, 5].map((i) =>
      i <= Math.floor(rating) ? (
        <FaStar key={i} size={size} className="rv-star full" />
      ) : (
        <TiStarOutline key={i} size={size} className="rv-star" />
      ),
    )}
  </div>
);

// ── Date formatter ────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const CustomerReviews = () => {
  const { api } = useAuth();
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryChosen, setCategoryChosen] = useState("all");

  useEffect(() => {
    const getReviews = async () => {
      try {
        const res = await api.get("/restaurant/rate-in-restaurant");
        setAverageRating(res.data.averageRating);
        setRatingDistribution(res.data.ratingDistribution);
        setReviews(res.data.reviews);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    getReviews();
  }, []);

  const ratingsOrder = [5, 4, 3, 2, 1];

  const getPercentage = (count) => {
    if (reviews.length === 0) return 0;
    return (count / reviews.length) * 100;
  };

  const filteredReviews = reviews.filter((review) => {
    if (!review.user) return false;
    if (categoryChosen === "all") return true;
    return review.rating === categoryChosen;
  });

  const tabs = [
    { label: "All Reviews", value: "all" },
    ...[5, 4, 3, 2, 1].map((n) => ({
      label: (
        <>
          {n} <FaStar style={{ position: "relative", top: 1 }} />
        </>
      ),
      value: n,
    })),
  ];

  return (
    <div className="reviews-page">
      {/* ── Header ─────────────────────────────────── */}
      <div className="text">
        <div>
          <h2>Customer Reviews</h2>
          <p>Manage and respond to customer feedback</p>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────── */}
      {loading ? (
        <div className="rv-center">
          <div className="rv-spinner" />
          <span>Loading reviews…</span>
        </div>
      ) : (
        <>
          {/* ── Top Stats ──────────────────────────────── */}
          <div className="top">
            <div className="left">
              <div className="star">
                <FaStar className="icon big" />
              </div>
              <h1>{averageRating}</h1>
              <p>Overall Rating</p>
              <Stars rating={averageRating} size={18} />
              <p className="total">{reviews.length} total reviews</p>
            </div>
            <div className="right">
              <h2>Rating Distribution</h2>
              {ratingsOrder.map((star) => {
                const count = ratingDistribution[star] ?? 0;
                return (
                  <div key={star} className="row">
                    <div className="star">
                      {star} <FaStar className="icon" />
                    </div>
                    <div className="mid">
                      <div className="white" />
                      <div
                        className="orange"
                        style={{ width: `${getPercentage(count)}%` }}
                      />
                    </div>
                    <div className="number">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Filter Tabs ─────────────────────────────── */}
          <div className="menu">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                className={categoryChosen === tab.value ? "active" : ""}
                onClick={() => setCategoryChosen(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Empty State ─────────────────────────────── */}
          {filteredReviews.length === 0 ? (
            <div className="rv-empty">
              <FiMessageSquare size={36} />
              <p>
                {categoryChosen === "all"
                  ? "No reviews yet"
                  : `No ${categoryChosen}-star reviews`}
              </p>
            </div>
          ) : (
            /* ── Review Cards ────────────────────────────── */
            <div className="rv-list">
              {filteredReviews.map((review, i) => (
                <div
                  key={`${review.foodId}_${review.user._id}_${i}`}
                  className="review-card"
                >
                  {/* Card Header */}
                  <div className="review-header">
                    <img
                      src={
                        review.user.img?.url ||
                        "https://i.pravatar.cc/150?img=12"
                      }
                      alt={review.user.name}
                      className="avatar"
                    />
                    <div className="user-info">
                      <h4>{review.user.name}</h4>
                      <div className="rating-time">
                        <Stars rating={review.rating} />
                        <span className="time">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Food Name */}
                  <div className="rv-food-name">
                    <span>On:</span> <strong>{review.foodName}</strong>
                  </div>

                  {/* Comment */}
                  <div className="review-body">
                    {review.comment ? (
                      <p>{review.comment}</p>
                    ) : (
                      <p className="rv-no-comment">No comment left</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerReviews;
