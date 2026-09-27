const mongoose = require('mongoose');
require('dotenv').config();
const DoctorProfile = require('../src/models/DoctorProfile');
const User = require('../src/models/User');

const R = 6371; // Earth's radius in km
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1), nLon1 = Number(lon1), nLat2 = Number(lat2), nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Set Dr. Nishan Silva coordinates to (6.91, 79.87) - ~2.1 km away
  const silvaUser = await User.findOne({ fullName: /Silva/i });
  if (silvaUser) {
    const silvaDoc = await DoctorProfile.findOne({ userId: silvaUser._id });
    if (silvaDoc) {
      silvaDoc.latitude = 6.91;
      silvaDoc.longitude = 79.87;
      await silvaDoc.save();
      console.log('Set Dr Silva coordinates to (6.91, 79.87)');
    }
  }

  // Set Dr. Chathuri Perera to Nugegoda (6.8700, 79.8900) - ~7.1 km away
  const chathuriUser = await User.findOne({ fullName: /Chathuri/i });
  if (chathuriUser) {
    const chathuriDoc = await DoctorProfile.findOne({ userId: chathuriUser._id });
    if (chathuriDoc) {
      chathuriDoc.latitude = 6.8700;
      chathuriDoc.longitude = 79.8900;
      await chathuriDoc.save();
      console.log('Set Dr Chathuri coordinates to (6.87, 79.89)');
    }
  }

  // Set Dr. Ruwan Wickramasinghe to Moratuwa (6.7750, 79.8850) - ~17.1 km away
  const ruwanUser = await User.findOne({ fullName: /Ruwan/i });
  if (ruwanUser) {
    const ruwanDoc = await DoctorProfile.findOne({ userId: ruwanUser._id });
    if (ruwanDoc) {
      ruwanDoc.latitude = 6.7750;
      ruwanDoc.longitude = 79.8850;
      await ruwanDoc.save();
      console.log('Set Dr Ruwan coordinates to (6.775, 79.885)');
    }
  }

  // Set Dr. Audit Perera to Kalutara (6.5850, 79.9600) - ~39.5 km away
  const auditUser = await User.findOne({ fullName: /Audit/i });
  if (auditUser) {
    const auditDoc = await DoctorProfile.findOne({ userId: auditUser._id });
    if (auditDoc) {
      auditDoc.latitude = 6.5850;
      auditDoc.longitude = 79.9600;
      await auditDoc.save();
      console.log('Set Dr Audit coordinates to (6.585, 79.96)');
    }
  }

  const patientLoc = { latitude: 6.9271, longitude: 79.8612 };

  console.log('\n==================================================');
  console.log('DEBUG DISTANCE CALCULATION');
  console.log('==================================================');
  console.log('Patient location:');
  console.log('latitude:');
  console.log(patientLoc.latitude);
  console.log('longitude:');
  console.log(patientLoc.longitude);
  console.log();

  const activeDoctors = await DoctorProfile.find().populate('userId');
  const validActive = activeDoctors.filter((d) => d.userId && d.userId.isActive === true);

  const mappedDoctors = [];
  validActive.forEach((doc) => {
    const docName = doc.userId?.fullName || 'Specialist';
    const hasCoords = doc.latitude != null && doc.longitude != null;
    const dist = hasCoords
      ? calculateHaversineDistance(patientLoc.latitude, patientLoc.longitude, doc.latitude, doc.longitude)
      : null;

    console.log('Doctor:');
    console.log(docName);
    console.log(doc.latitude !== undefined ? doc.latitude : 'undefined');
    console.log(doc.longitude !== undefined ? doc.longitude : 'undefined');
    console.log('Distance:');
    console.log(dist !== null ? `${dist} km` : 'No valid coordinates');
    console.log();

    if (dist !== null) {
      mappedDoctors.push({ name: docName, lat: doc.latitude, lng: doc.longitude, dist });
    }
  });

  console.log('==================================================');
  console.log('RADIUS FILTERING BREAKDOWN');
  console.log('==================================================');
  [5, 10, 25, 50].forEach((rad) => {
    const matching = mappedDoctors.filter((d) => d.dist <= rad);
    console.log(`${rad} km: ${matching.length} Specialists within ${rad} km`);
    matching.forEach((m) => console.log(`   - ${m.name} (${m.lat}, ${m.lng}) => ${m.dist} km`));
  });

  console.log(`\nAll with coordinates on Map: ${mappedDoctors.length} Specialists`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
