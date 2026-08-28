// === ADMIN ===
import { useEffect, useState } from "react";
import { MdCategory } from "react-icons/md";
import { FiEdit } from "react-icons/fi";
import { FaDeleteLeft, FaPlus } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import CreateAndUpdateMainCategory from "./CreateAndUpdateMainCategory";

const MainCategories = ({ api }) => {
  const [mainCategories, setMainCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [selectedMainCategory, setSelectedMainCategory] = useState(null);

  useEffect(() => {
    const fetchMainCategories = async () => {
      setLoading(true);
      try {
        const res = await api.get("/admin/main-categories");
        setMainCategories(res.data.mainCategories);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to load main categories",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchMainCategories();
  }, [api]);

  const deleteMainCategory = async (id, name) => {
    try {
      await api.delete(`/admin/main-categories/${id}`);
      setMainCategories((prev) => prev.filter((cat) => cat._id !== id));
      toast.success(`"${name}" deleted successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="main-categories">
      <div className="main-categories__head">
        <div className="icon">
          <MdCategory />
        </div>
        <div>
          <h3>Main Categories</h3>
          <p>General categories restaurants use to classify their food</p>
        </div>
      </div>

      <div className="globale-menu">
        <div>
          {!loading &&
            mainCategories.map((cat) => (
              <button className="cat" key={cat._id}>
                {cat.image?.url ? (
                  <img src={cat.image.url} alt={cat.name} className="cat-img" />
                ) : (
                  <MdCategory className="cat-img-placeholder" />
                )}
                <span>{cat.name}</span>
                <FiEdit
                  className="icon edit-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMainCategory(cat);
                    setType("update");
                  }}
                />
                <FaDeleteLeft
                  className="icon delete-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMainCategory(cat._id, cat.name);
                  }}
                />
              </button>
            ))}

          {!loading && mainCategories.length === 0 && (
            <p className="main-categories__empty">No main categories yet</p>
          )}
        </div>

        <button
          className="active"
          onClick={() => {
            setSelectedMainCategory(null);
            setType("create");
          }}
        >
          <FaPlus />
          <span>Add Category</span>
        </button>
      </div>

      {(type === "create" || type === "update") && (
        <CreateAndUpdateMainCategory
          api={api}
          selectedMainCategory={selectedMainCategory}
          setSelectedMainCategory={setSelectedMainCategory}
          setType={setType}
          setMainCategories={setMainCategories}
        />
      )}
    </div>
  );
};

export default MainCategories;
