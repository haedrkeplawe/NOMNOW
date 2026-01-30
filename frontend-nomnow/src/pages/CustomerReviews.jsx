import { useEffect, useState } from "react";
import { FaStar } from "react-icons/fa6";
import { TiStarOutline } from "react-icons/ti";
import { useAuth } from "../context/AuthContext";

const CustomerReviews = () => {
  const { api } = useAuth();
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState([]);
  const [reviews, setReviews] = useState([]);

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
      }
    };
    getReviews();
  }, []);

  const ratingsOrder = [5, 4, 3, 2, 1];

  const getPercentage = (count) => {
    if (reviews.length === 0) return 0;
    return (count / reviews.length) * 100;
  };

  const categories = [
    { label: "All Reviews", value: "all" },
    {
      label: (
        <>
          5 <FaStar />
        </>
      ),
      value: 5,
    },
    {
      label: (
        <>
          4 <FaStar />
        </>
      ),
      value: 4,
    },
    {
      label: (
        <>
          3 <FaStar />
        </>
      ),
      value: 3,
    },
    {
      label: (
        <>
          2 <FaStar />
        </>
      ),
      value: 2,
    },
    {
      label: (
        <>
          1 <FaStar />
        </>
      ),
      value: 1,
    },
  ];

  return (
    <div className="reviews-page">
      <div className="text">
        <div>
          <h2>Customer Reviews</h2>
          <p>Manage and respond to customer feedback</p>
        </div>
      </div>
      <>
        <div className="top">
          <div className="left">
            <div className="star">
              <FaStar className="icon big" />
            </div>
            <h1>{averageRating}</h1>
            <p>Overall Rating</p>
            <div className="five">
              {[...Array(Math.floor(averageRating))].map((_, i) => (
                <FaStar key={`full-${i}`} className="icon full" />
              ))}

              {[...Array(5 - Math.floor(averageRating))].map((_, i) => (
                <TiStarOutline key={`empty-${i}`} className="icon" />
              ))}
            </div>
            <p className="total">{reviews.length} total reviews</p>
          </div>
          <div className="right">
            <h2>Rating Distribution</h2>
            {ratingsOrder.map((star) => {
              const count = ratingDistribution[star];
              const percentage = getPercentage(count);

              return (
                <div key={star} className="row">
                  <div className="star">
                    {star} <FaStar className="icon" />
                  </div>

                  <div className="mid">
                    <div className="white"></div>
                    <div
                      className="orange"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>

                  <div className="number">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="menu">
          {categories.map((cat) => (
            <button
              key={cat.value}
              className={categoryChosen === cat.value ? "active" : ""}
              onClick={() => setCategoryChosen(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {reviews &&
          reviews
            .filter((review) => {
              if (categoryChosen === "all") return true; // عرض كل الريفيوز
              return review.rating === categoryChosen; // عرض حسب عدد النجوم
            })
            .map((review) => {
              if (!review.user) return null; // تجاهل الفارغ
              return (
                <div
                  key={review.foodId + review.user._id}
                  className="review-card"
                >
                  <div className="review-header">
                    <img
                      src={
                        review.user.img?.url ||
                        "https://i.pravatar.cc/150?img=12"
                      }
                      alt="user"
                      className="avatar"
                    />
                    <div className="user-info">
                      <h4>{review.user.name}</h4>
                      <div className="rating-time">
                        <div className="stars">
                          {[...Array(Math.floor(review.rating))].map((_, i) => (
                            <FaStar key={`full-${i}`} className="icon full" />
                          ))}
                          {[...Array(5 - Math.floor(review.rating))].map(
                            (_, i) => (
                              <TiStarOutline
                                key={`empty-${i}`}
                                className="icon"
                              />
                            )
                          )}
                        </div>
                        <span className="time">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="review-body">
                    <p>{review.comment}</p>
                  </div>
                </div>
              );
            })}
      </>
    </div>
  );
};

export default CustomerReviews;
