const Driver = require("../../models/Driver");

/* تحديث موقع السائق */
const updateLocation = async (driverId, data) => {
  const { lat, lng } = data;

  if (
    lat === undefined ||
    lng === undefined ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  )
    throw new Error("Invalid latitude or longitude");

  const driver = await Driver.findById(driverId);
  if (!driver) throw new Error("Driver not found");

  driver.currentLocation = {
    type: "Point",
    coordinates: [lng, lat],
  };

  await driver.save();
  return driver;
};

/* جعل السائق اونلاين */
const goOnline = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new Error("Driver not found");

  driver.availability = "online";
  await driver.save();
  return driver;
};

/* جعل السائق اوفلاين */
const goOffline = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new Error("Driver not found");

  driver.availability = "offline";
  await driver.save();
  return driver;
};

module.exports = {
  updateLocation,
  goOnline,
  goOffline,
};
