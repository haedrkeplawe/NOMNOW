import { FaPlus } from "react-icons/fa";

const HeadCreateAndDetails = ({ text1, text2, text3, setType }) => {
  return (
    <div className="globale-head-create">
      <div>
        <h2>{text1}</h2>
        <p>{text2}</p>
      </div>
      {text3 && (
        <button onClick={() => setType("create")}>
          <FaPlus />
          <span>{text3}</span>
        </button>
      )}
    </div>
  );
};

export default HeadCreateAndDetails;
