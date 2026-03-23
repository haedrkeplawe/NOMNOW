import Skeleton from "react-loading-skeleton";

const DriverSkeleton = ({ rows = 6 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="card" key={i}>
          <div className="driver">
            <Skeleton circle width={40} height={40} />
            <div className="text">
              <Skeleton width={120} />
              <Skeleton width={80} />
            </div>
          </div>

          <Skeleton width={60} />
          <Skeleton width={60} />
          <Skeleton width={60} />
          <Skeleton width={60} />
          <Skeleton width={40} />
          <Skeleton width={60} />
          <Skeleton width={30} />
        </div>
      ))}
    </>
  );
};

export default DriverSkeleton;
