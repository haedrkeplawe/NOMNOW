import { FaDeleteLeft, FaPlus } from "react-icons/fa6";
import { FiEye, FiEdit } from "react-icons/fi";
import { FaRegTrashAlt } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { useAuth } from "../context/AuthContext";
import CreateFood from "../components/CreateFood";
import UpdateFood from "../components/UpdateFood";
import { useEffect, useMemo, useState } from "react";
import HeadCreateAndDetails from "../components/HeadCreateAndDetails";
import CreateAndUpdateCategory from "../components/CreateAndUpdateCategory";
import { toast } from "react-hot-toast";
import { useRestaurant } from "../context/RestaurantContext";
import { useTranslation } from "react-i18next";

// ── View Food Popup ───────────────────────────────────────────
const ViewFood = ({ food, onClose, currency }) => {
  const { t } = useTranslation();
  if (!food) return null;
  return (
    <div>
      <div className="create-food view-food globale-popp">
        <div className="one globale-close">
          <div className="left">
            <img
              src={food.image?.url}
              alt={food.name}
              className="view-food__img"
            />
            <div>
              <h3>{food.name}</h3>
              <p>{food.categoryId?.name}</p>
            </div>
          </div>
          <div className="right">
            <IoMdClose className="icon" onClick={onClose} />
          </div>
        </div>

        <div className="view-food__body">
          {/* Basic Info */}
          <div className="view-food__section">
            <div className="view-food__row">
              <span>{t("menu.itemPrice").replace(" *", "")}</span>
              {food.sizes?.length > 0 ? (
                <strong>
                  {t("menu.fromPrice")}{" "}
                  {Math.min(...food.sizes.map((s) => s.price))} {currency}
                </strong>
              ) : (
                <strong>
                  {food.price} {currency}
                </strong>
              )}
            </div>
            <div className="view-food__row">
              <span>{t("menu.prepTime")}</span>
              <strong>
                {food.time} {t("menu.min")}
              </strong>
            </div>
            <div className="view-food__row">
              <span>{t("common.status")}</span>
              <span
                className={`status ${
                  food.status === "available" ? "green" : "red"
                }`}
              >
                <FiEye className="icon" />{" "}
                {t(
                  `menu.${
                    food.status === "available" ? "available" : "unavailable"
                  }`,
                )}
              </span>
            </div>
            {food.description && (
              <div className="view-food__row">
                <span>{t("menu.itemDescription")}</span>
                <strong>{food.description}</strong>
              </div>
            )}
          </div>

          {/* Sizes */}
          {food.sizes?.length > 0 && (
            <div className="view-food__section">
              <p className="view-food__label">{t("menu.sizes")}</p>
              <div className="view-food__sizes">
                {food.sizes.map((s, i) => (
                  <div key={i} className="view-food__size-item">
                    <span>{s.name}</span>
                    <strong>
                      {s.price} {currency}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients */}
          {food.ingredients?.length > 0 && (
            <div className="view-food__section">
              <p className="view-food__label">{t("menu.ingredients")}</p>
              <div className="view-food__tags">
                {food.ingredients.map((ing, i) => (
                  <span key={i} className="view-food__tag ing">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Extras */}
          {food.extras?.length > 0 && (
            <div className="view-food__section">
              <p className="view-food__label">{t("menu.extras")}</p>
              <div className="view-food__extras">
                {food.extras.map((ex, i) => (
                  <div key={i} className="view-food__extra-item">
                    <span>{ex.name}</span>
                    <strong>
                      +{ex.price} {currency}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="back" onClick={onClose} />
    </div>
  );
};

// ── truncate description ──────────────────────────────────────
const truncate = (text, words = 5) => {
  if (!text) return "—";
  const arr = text.trim().split(/\s+/);
  return arr.length <= words ? text : arr.slice(0, words).join(" ") + "…";
};

const MenuManagement = () => {
  const { t } = useTranslation();
  const { currency } = useRestaurant();
  const { api } = useAuth();
  const [foods, setFoods] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [category, setCategory] = useState([]);
  const [mainCategories, setMainCategories] = useState([]); // v3.7 — الأقسام العامة (يديرها الأدمن)
  const [categoryChosen, setCategoryChosen] = useState("all");
  const [mainCategoryChosen, setMainCategoryChosen] = useState("all"); // v3.7 — فلتر القسم العام
  const [type, setType] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [viewFood, setViewFood] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // v3.7 — جلب الأقسام العامة بالتوازي (قراءة فقط، يديرها الأدمن)
        const [foodsRes, categoryRes, mainCategoriesRes] = await Promise.all([
          api.get("/restaurant/food"),
          api.get("/restaurant/category"),
          api.get("/restaurant/main-categories"),
        ]);
        setFoods(foodsRes.data.foods);
        setCategory(categoryRes.data.categories);
        setMainCategories(mainCategoriesRes.data.mainCategories);
      } catch (err) {
        toast.error(err.response?.data?.message || err.message);
      } finally {
        setLoadingPage(false);
      }
    };
    fetchData();
  }, [api]);

  const deleteCategory = async (categoryId, categoryName) => {
    if (!window.confirm(t("menu.deleteConfirm"))) return;
    try {
      await api.delete(`/restaurant/category/${categoryId}`);
      setCategory((prev) => prev.filter((cat) => cat._id !== categoryId));
      setCategoryChosen("all");
      toast.success(t("menu.toasts.categoryDeleted", { name: categoryName }));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const deleteFood = async (foodId, foodName) => {
    if (!window.confirm(t("menu.deleteConfirm"))) return;
    try {
      await api.delete(`/restaurant/food`, { data: { foodId } });
      setFoods((prev) => prev.filter((food) => food._id !== foodId));
      toast.success(t("menu.toasts.foodDeleted", { name: foodName }));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  // v3.7 — الفلترة صارت تجمع بين الصنف الخاص والقسم العام معاً (AND)
  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      const matchCategory =
        categoryChosen === "all" || food.categoryId?.name === categoryChosen;
      const matchMainCategory =
        mainCategoryChosen === "all" ||
        food.mainCategoryId?.name === mainCategoryChosen;
      return matchCategory && matchMainCategory;
    });
  }, [foods, categoryChosen, mainCategoryChosen]);

  if (loadingPage)
    return (
      <div className="menu-management page-loader">
        <div className="page-loader__spinner" />
        <p>Loading...</p>
      </div>
    );

  return (
    <div className="menu-management">
      <HeadCreateAndDetails
        text1={t("menu.title")}
        text2={t("menu.subtitle")}
        text3={t("menu.addNewItem")}
        setType={setType}
      />

      {/* ── Categories Bar (خاصة بالمطعم) ────────────────── */}
      <div className="globale-menu">
        <div>
          <button
            className={categoryChosen === "all" ? "active" : ""}
            onClick={() => setCategoryChosen("all")}
          >
            {t("common.all")}
          </button>
          {category.map((cat) => (
            <button
              key={cat._id}
              className={categoryChosen === cat.name ? "cat active" : "cat"}
              onClick={() => setCategoryChosen(cat.name)}
            >
              {cat.name}
              <FaDeleteLeft
                className="delete-icon icon"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCategory(cat._id, cat.name);
                }}
              />
              <FiEdit
                className="upload-icon icon"
                onClick={(e) => {
                  e.stopPropagation();
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

      {/* v3.7 — ── Main Categories Bar (عامة، يديرها الأدمن — للفلترة فقط) ────
          نفس تنسيق شريط الأصناف الخاصة بالضبط، بدون أيقونات تعديل/حذف
          ولا زر "+" لأنه المطعم بيقدر يفلتر فيها بس مش يديرها
      ─────────────────────────────────────────────────────────────── */}
      {mainCategories.length > 0 && (
        <>
          <p className="main-categories-filter__label">
            {t("menu.filterByMainCategory")}
          </p>
          <div className="globale-menu main-categories-filter">
            <div>
              <button
                className={mainCategoryChosen === "all" ? "active" : ""}
                onClick={() => setMainCategoryChosen("all")}
              >
                {t("common.all")}
              </button>
              {mainCategories.map((cat) => (
                <button
                  key={cat._id}
                  className={
                    mainCategoryChosen === cat.name ? "cat active" : "cat"
                  }
                  onClick={() => setMainCategoryChosen(cat.name)}
                >
                  {cat.image?.url && (
                    <img
                      src={cat.image.url}
                      alt={cat.name}
                      className="main-cat-filter-img"
                    />
                  )}
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Foods Table ────────────────────────────────── */}
      <div className="menu-items">
        <div className="head">
          <h3>{t("menu.itemName")}</h3>
          <h3>{t("menu.category")}</h3>
          <h3>{t("common.price")}</h3>
          <h3>{t("menu.description")}</h3>
          <h3>{t("common.status")}</h3>
          <h3>{t("common.actions")}</h3>
        </div>

        {filteredFoods.map((food) => (
          <div className="item" key={food._id}>
            <p className="name">
              <img src={food?.image?.url} alt="" className="image" />
              <span>{food?.name}</span>
            </p>
            <p className="category">{food.categoryId?.name}</p>
            <p className="price">
              {food.sizes?.length > 0
                ? `${t("menu.fromPrice")} ${Math.min(
                    ...food.sizes.map((s) => s.price),
                  )} ${currency}`
                : `${food?.price} ${currency}`}
            </p>
            <p className="description" title={food?.description}>
              {truncate(food?.description, 5)}
            </p>
            <p
              className={`status ${
                food?.status === "available" ? "green" : "red"
              }`}
            >
              <FiEye className="icon" />{" "}
              {t(
                `menu.${
                  food?.status === "available" ? "available" : "unavailable"
                }`,
              )}
            </p>
            <p className="action">
              <FiEye className="icon view" onClick={() => setViewFood(food)} />
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

        {filteredFoods.length === 0 && (
          <div className="item">
            <p>{t("menu.noItems")}</p>
          </div>
        )}
      </div>

      {/* ── Popups ─────────────────────────────────────── */}
      {viewFood && (
        <ViewFood
          food={viewFood}
          currency={currency}
          onClose={() => setViewFood(null)}
        />
      )}

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
        <CreateFood
          category={category}
          mainCategories={mainCategories}
          setType={setType}
          setFoods={setFoods}
        />
      )}
      {type === "update" && selectedFood && (
        <UpdateFood
          food={selectedFood}
          category={category}
          mainCategories={mainCategories}
          setType={setType}
          setFoods={setFoods}
        />
      )}
    </div>
  );
};

export default MenuManagement;
