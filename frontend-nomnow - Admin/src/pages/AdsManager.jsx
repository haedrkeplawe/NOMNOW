import { useEffect, useState } from "react";
import { FaRegTrashAlt } from "react-icons/fa";
import { FiEdit, FiEye } from "react-icons/fi";
import CreateAd from "../components/CreateAd";
import EditAd from "../components/EditAd";
import { useAuth } from "../context/AuthContext";
import ShowAd from "../components/ShowAd";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import { toast } from "react-hot-toast";

const AdsManager = () => {
  const { api } = useAuth();

  const [ads, setAds] = useState([]);
  const [categoryChosen, setCategoryChosen] = useState("all");
  const [type, setType] = useState("show");
  const [selectedAd, setSelectedAd] = useState(null);
  const [loading, setLoading] = useState(true);

  const categories = [
    { key: "active", label: "Active" },
    { key: "scheduled", label: "Scheduled" },
    { key: "expired", label: "Expired" },
  ];

  const getAdStatus = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > now) return "scheduled";
    if (now >= start && now <= end) return "active";
    return "expired";
  };

  const fetchAds = async () => {
    try {
      const res = await api.get("admin/ads");
      const adsWithStatus = res.data.ads.map((ad) => ({
        ...ad,
        status: getAdStatus(ad.startDate, ad.endDate),
      }));
      setAds(adsWithStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleDelete = async (ad) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ad "${ad.title}"?`,
    );
    if (!confirmDelete) return;

    try {
      await api.delete("/admin/ads", {
        data: { adId: ad._id },
      });
      toast.success(`ad ${ad.title} Deleted`);
      fetchAds();
    } catch (err) {
      toast.error(err.response.data.message);
    }
  };

  const filteredAds =
    categoryChosen === "all"
      ? ads
      : ads.filter((ad) => ad.status === categoryChosen);

  return (
    <div className="ads-manager-page ">
      {loading && (
        <div className="globale-loader">
          <div className="spinner"></div>
        </div>
      )}
      <HeadCreateAndDetails
        text1={"Ads Manager"}
        text2={"Create and manage advertising campaigns"}
        text3={"Create New Ad"}
        setType={setType}
      />

      <div className="globale-menu">
        <button
          className={categoryChosen === "all" ? "active" : ""}
          onClick={() => setCategoryChosen("all")}
        >
          All
        </button>

        {categories.map((cat) => (
          <button
            key={cat.key}
            className={categoryChosen === cat.key ? "active" : ""}
            onClick={() => setCategoryChosen(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="menu-items">
        <div className="head">
          <h3>Ad Title</h3>
          <h3>Type</h3>
          <h3>Duration</h3>
          <h3>Target</h3>
          <h3>Priority</h3>
          <h3>Status</h3>
          <h3>Clicks</h3>
          <h3>Actions</h3>
        </div>

        {filteredAds &&
          filteredAds.map((ad) => (
            <div className="item" key={ad._id}>
              <h2>{ad.title}</h2>
              <span className="type">{ad.adtype}</span>

              <div className="date">
                <span>{ad.startDate.slice(0, 10)}</span>
                <span>-</span>
                <span>{ad.endDate.slice(0, 10)}</span>
              </div>

              <p className="Target">{ad.target}</p>
              <p className="priority">{ad.priority}</p>
              <span className={`status ${ad.status}`}>{ad.status}</span>
              <p className="clicks">{ad.clicks?.length || 0}</p>

              <p className="action">
                <FiEye
                  className="icon show"
                  onClick={() => {
                    setSelectedAd(ad);
                    setType("show");
                  }}
                />
                <FiEdit
                  className="icon edit"
                  onClick={() => {
                    setSelectedAd(ad);
                    setType("edit");
                  }}
                />
                <FaRegTrashAlt
                  className="icon delete"
                  onClick={() => handleDelete(ad)}
                />
              </p>
            </div>
          ))}

        {filteredAds.length <= 0 && (
          <div className="item item-empty">
            <p>Ads not found</p>
          </div>
        )}
      </div>

      {type === "show" && selectedAd && (
        <ShowAd
          api={api}
          ad={selectedAd}
          setType={setType}
          refreshAds={fetchAds}
        />
      )}

      {type === "create" && (
        <CreateAd api={api} setType={setType} refreshAds={fetchAds} />
      )}

      {type === "edit" && selectedAd && (
        <EditAd
          api={api}
          ad={selectedAd}
          setType={setType}
          refreshAds={fetchAds}
        />
      )}
    </div>
  );
};

export default AdsManager;
