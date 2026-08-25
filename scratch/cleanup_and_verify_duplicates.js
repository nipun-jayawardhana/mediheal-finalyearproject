const mongoose = require('./node_modules/mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mediheal';

async function auditAndCleanupActiveAlerts() {
  console.log('=== AUDITING EMERGENCY ALERTS IN MONGODB ===\n');
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    const EmergencyAlert = mongoose.model(
      'EmergencyAlert',
      new mongoose.Schema({}, { strict: false })
    );

    const allAlerts = await EmergencyAlert.find({}).sort({ createdAt: -1 });
    console.log(`Total Emergency Alerts in DB: ${allAlerts.length}`);

    const activeAlerts = allAlerts.filter((a) => a.status === 'active');
    console.log(`Currently Active Emergency Alerts: ${activeAlerts.length}`);

    activeAlerts.forEach((alert, i) => {
      console.log(`  [${i + 1}] ID: ${alert._id} | Patient: ${alert.patientId} | Created: ${alert.createdAt} | Status: ${alert.status}`);
    });

    // Group active alerts by patientId
    const activeByPatient = {};
    for (const alert of activeAlerts) {
      const pid = alert.patientId.toString();
      if (!activeByPatient[pid]) activeByPatient[pid] = [];
      activeByPatient[pid].push(alert);
    }

    let cleanedCount = 0;
    for (const [patientId, alerts] of Object.entries(activeByPatient)) {
      if (alerts.length > 1) {
        console.log(`\nFound ${alerts.length} duplicate active alerts for patient ${patientId}. Cleaning up older duplicates...`);
        // Keep the newest active alert (alerts[0]), mark older ones (alerts[1..n]) as cancelled
        for (let i = 1; i < alerts.length; i++) {
          const oldAlert = alerts[i];
          await EmergencyAlert.updateOne(
            { _id: oldAlert._id },
            { $set: { status: 'cancelled', cancellationReason: 'Cleaned up historical duplicate active alert', cancelledAt: new Date() } }
          );
          console.log(`  Updated old duplicate alert ${oldAlert._id} to cancelled.`);
          cleanedCount++;
        }
      }
    }

    console.log(`\nCleanup complete. Duplicate active alerts cancelled: ${cleanedCount}`);

    const activeAlertsAfter = await EmergencyAlert.find({ status: 'active' });
    console.log(`Active Emergency Alerts remaining in DB: ${activeAlertsAfter.length}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  } catch (err) {
    console.error('Error auditing DB:', err);
    process.exit(1);
  }
}

auditAndCleanupActiveAlerts();
