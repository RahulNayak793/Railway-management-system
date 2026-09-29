const { getLiveStatusForTrain } = require('../utils/liveStatusHelper');

async function test() {
  const status = await getLiveStatusForTrain('09401');
  console.log('Train:', status.train.train_number, status.train.train_name);
  console.log('Stops returned by getLiveStatusForTrain:');
  status.stops.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.code} (${s.name}) - lat: ${s.lat}, lng: ${s.lng}, dist: ${s.distanceFromOriginKm} km, arr: ${s.arrTime}, dep: ${s.depTime}`);
  });
}

test().catch(console.error);
