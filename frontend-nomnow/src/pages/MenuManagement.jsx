import { FaDeleteLeft, FaPlus } from "react-icons/fa6";
import { FiEye } from "react-icons/fi";
import { FaRegTrashAlt } from "react-icons/fa";
import { FiEdit } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import CreateFood from "../components/CreateFood";
import UpdateFood from "../components/UpdateFood";
import { useEffect, useMemo, useState } from "react";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import CreateAndUpdateCategory from "../components/CreateAndUpdateCategory";
import { toast } from "react-hot-toast";

const MenuManagement = () => {
  const { api } = useAuth();
  const [foods, setFoods] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [category, setCategory] = useState([]);
  const [categoryChosen, setCategoryChosen] = useState("all");
  const [type, setType] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [foodsRes, categoryRes] = await Promise.all([
          api.get("/restaurant/food"),
          api.get("/restaurant/category"),
        ]);

        setFoods(foodsRes.data.foods);
        setCategory(categoryRes.data.categories);
      } catch (err) {
        toast.error(err.response?.data?.message || err.message);
        console.error(err.response?.data?.message || err.message);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchData();
  }, [api]);

  const deleteCategory = async (categoryId, categoryName) => {
    try {
      if (!window.confirm("Are you sure you want to delete this item?")) return;
      await api.delete(`/restaurant/category/${categoryId}`);
      setCategory((prev) => prev.filter((cat) => cat._id !== categoryId));
      setCategoryChosen("all");
      toast.success(`Category ${categoryName} Delete`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const deleteFood = async (foodId, foodName) => {
    try {
      if (!window.confirm("Are you sure you want to delete this item?")) return;
      await api.delete(`/restaurant/food`, {
        data: { foodId },
      });
      setFoods((prev) => prev.filter((food) => food._id !== foodId));
      toast.success(`Food ${foodName} Delete`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const filteredFoods = useMemo(() => {
    if (categoryChosen === "all") return foods;

    return foods.filter(
      ({ categoryId }) => categoryId?.name === categoryChosen,
    );
  }, [foods, categoryChosen]);

  return (
    <div className="menu-management">
      {loadingPage && (
        <div className="globale-loader">
          <div className="spinner"></div>
        </div>
      )}
      <>
        <HeadCreateAndDetails
          text1={"Menu Management"}
          text2={"Add, edit, or disable menu items"}
          text3={"Add New Item"}
          setType={setType}
        />

        <div className=" globale-menu">
          <div>
            <button
              className={categoryChosen === "all" ? "active" : ""}
              onClick={() => setCategoryChosen("all")}
            >
              All
            </button>
            {category.map((cat) => (
              <button
                className={categoryChosen === cat.name ? "cat active" : "cat"}
                onClick={() => setCategoryChosen(cat.name)}
                key={cat._id}
              >
                {cat.name}
                <FaDeleteLeft
                  className="delete-icon icon"
                  onClick={() => deleteCategory(cat._id, cat.name)}
                />
                <FiEdit
                  className="upload-icon icon"
                  onClick={() => {
                    setType("update-category");
                    setSelectedCategory(cat);
                  }}
                />
              </button>
            ))}
          </div>
          <button
            className="create active"
            onClick={() => setType("create-category")}
          >
            <FaPlus />
          </button>
        </div>
        <div className="menu-items">
          <div className="head">
            <h3>Item Name</h3>
            <h3>Category</h3>
            <h3>Price</h3>
            <h3>Description</h3>
            <h3>Status</h3>
            <h3>Actions</h3>
          </div>
          <>
            {filteredFoods.map((food) => (
              <div className="item" key={food._id}>
                <p className="name">
                  <img src={food?.image.url} alt="" className="image" />
                  <span>{food?.name}</span>
                </p>
                <p className="category">{food.categoryId?.name}</p>
                <p className="price">${food?.price}</p>
                <p className="description">{food?.description}</p>
                <p
                  className={`status ${
                    food?.status === "available" ? "green" : "red"
                  }`}
                >
                  <FiEye className="icon" /> {food?.status}
                </p>
                <p className="action">
                  <FiEdit
                    className="icon edit"
                    onClick={() => {
                      setSelectedFood(food);
                      setType("update");
                    }}
                  />
                  <FaRegTrashAlt
                    className="icon delete"
                    onClick={() => deleteFood(food?._id, food?.name)}
                  />
                </p>
              </div>
            ))}
            {filteredFoods.length <= 0 && (
              <div className="item">
                <p>Food Empty</p>
              </div>
            )}
          </>
        </div>
      </>
      {(type === "create-category" || type === "update-category") && (
        <CreateAndUpdateCategory
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          api={api}
          type={type}
          setType={setType}
          setCategory={setCategory}
        />
      )}

      {type === "create" && (
        <CreateFood category={category} setType={setType} setFoods={setFoods} />
      )}
      {type === "update" && selectedFood && (
        <UpdateFood
          food={selectedFood}
          category={category}
          setType={setType}
          setFoods={setFoods}
        />
      )}
    </div>
  );
};

export default MenuManagement;
