const mongoose = require('mongoose');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const MedicationSchedule = require('../models/MedicationSchedule');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

/**
 * Calculates adherence statistics from an array of MedicationSchedule documents
 * Formula: taken / (taken + missed) * 100
 * PENDING doses are not included in the denominator.
 * If (taken + missed) === 0: hasEnoughData = false, displayText = "Not enough adherence data"
 */
const calculateAdherenceForSchedules = (schedules) => {
  let totalScheduled = 0;
  let totalTaken = 0;
  let totalMissed = 0;
  let totalPending = 0;

  for (const schedule of schedules) {
    if (!Array.isArray(schedule.adherenceRecords)) continue;
    for (const record of schedule.adherenceRecords) {
      totalScheduled += 1;
      if (record.status === 'TAKEN') {
        totalTaken += 1;
      } else if (record.status === 'MISSED') {
        totalMissed += 1;
      } else if (record.status === 'PENDING') {
        totalPending += 1;
      }
    }
  }

  const evaluatedDoses = totalTaken + totalMissed;
  const hasEnoughData = evaluatedDoses > 0;
  const adherencePercentage = hasEnoughData
    ? Math.round((totalTaken / evaluatedDoses) * 100)
    : null;

  return {
    totalScheduled,
    totalTaken,
    totalMissed,
    totalPending,
    adherencePercentage,
    hasEnoughData,
    summaryText: hasEnoughData ? `${adherencePercentage}%` : 'Not enough adherence data',
  };
};

/**
 * Fetch and construct doctor profile map for doctor user IDs
 */
const buildDoctorProfileMap = async (doctorUserIds) => {
  const uniqueIds = [...new Set(doctorUserIds.filter(Boolean).map((id) => id.toString()))];
  if (uniqueIds.length === 0) return {};

  const profiles = await DoctorProfile.find({ userId: { $in: uniqueIds } }).lean();
  const map = {};
  for (const prof of profiles) {
    map[prof.userId.toString()] = {
      specialization: prof.specialization || 'Medical Specialist',
      hospital: prof.hospital || 'Hospital Affiliated',
      slmcNumber: prof.slmcNumber || '',
    };
  }
  return map;
};

/**
 * Aggregate complete chronological medical history timeline for a patient
 * @param {string|mongoose.Types.ObjectId} patientId
 * @returns {Promise<Array<Object>>} Chronological timeline items (newest first)
 */
const getPatientTimeline = async (patientId) => {
  const pId = new mongoose.Types.ObjectId(patientId);

  // 1. Fetch all consultations for this patient
  const consultations = await Consultation.find({ patientId: pId })
    .populate('patientId', 'fullName email phoneNumber')
    .populate('doctorId', 'fullName email phoneNumber')
    .populate('appointmentId', 'appointmentDate timeSlot status reason')
    .sort({ completedAt: -1, createdAt: -1 })
    .lean();

  // 2. Fetch all prescriptions for this patient
  const prescriptions = await Prescription.find({ patientId: pId })
    .populate('doctorId', 'fullName email phoneNumber')
    .populate('appointmentId', 'appointmentDate timeSlot status reason')
    .sort({ createdAt: -1 })
    .lean();

  // 3. Fetch all medication schedules for this patient
  const schedules = await MedicationSchedule.find({ patientId: pId }).lean();

  // Group schedules by prescriptionId
  const schedulesByPrescriptionId = {};
  for (const sched of schedules) {
    if (!sched.prescriptionId) continue;
    const key = sched.prescriptionId.toString();
    if (!schedulesByPrescriptionId[key]) {
      schedulesByPrescriptionId[key] = [];
    }
    schedulesByPrescriptionId[key].push(sched);
  }

  // 4. Collect doctor user IDs to fetch DoctorProfiles
  const doctorUserIds = [];
  consultations.forEach((c) => {
    if (c.doctorId?._id) doctorUserIds.push(c.doctorId._id);
    else if (c.doctorId) doctorUserIds.push(c.doctorId);
  });
  prescriptions.forEach((p) => {
    if (p.doctorId?._id) doctorUserIds.push(p.doctorId._id);
    else if (p.doctorId) doctorUserIds.push(p.doctorId);
  });

  const doctorProfileMap = await buildDoctorProfileMap(doctorUserIds);

  const getDoctorDetails = (doctorObj) => {
    const docId = doctorObj?._id ? doctorObj._id.toString() : doctorObj ? doctorObj.toString() : null;
    const profile = docId && doctorProfileMap[docId] ? doctorProfileMap[docId] : null;

    return {
      _id: docId,
      name: doctorObj?.fullName || (profile ? `Dr. Specialist` : 'Doctor'),
      specialization: profile?.specialization || 'General Physician',
      hospital: profile?.hospital || 'Hospital Affiliated',
      slmcNumber: profile?.slmcNumber || '',
    };
  };

  // 5. Track which prescriptions are linked to consultations to avoid duplicates
  const linkedPrescriptionIds = new Set();
  const timelineEvents = [];

  // Process Consultations
  for (const cons of consultations) {
    const consIdStr = cons._id.toString();
    const apptIdStr = cons.appointmentId?._id
      ? cons.appointmentId._id.toString()
      : cons.appointmentId
      ? cons.appointmentId.toString()
      : null;

    // Find matching prescription by consultationId or appointmentId
    let linkedPrescription = prescriptions.find(
      (p) =>
        (p.consultationId && p.consultationId.toString() === consIdStr) ||
        (apptIdStr && p.appointmentId && (p.appointmentId._id?.toString() === apptIdStr || p.appointmentId.toString() === apptIdStr))
    );

    let prescriptionData = null;
    let adherenceData = null;

    if (linkedPrescription) {
      linkedPrescriptionIds.add(linkedPrescription._id.toString());
      const pKey = linkedPrescription._id.toString();
      const prescSchedules = schedulesByPrescriptionId[pKey] || [];

      prescriptionData = {
        prescriptionId: linkedPrescription._id,
        date: linkedPrescription.createdAt,
        status: linkedPrescription.status || 'active',
        medications: linkedPrescription.medications || [],
      };

      if (prescSchedules.length > 0) {
        adherenceData = calculateAdherenceForSchedules(prescSchedules);
      } else {
        adherenceData = {
          totalScheduled: 0,
          totalTaken: 0,
          totalMissed: 0,
          totalPending: 0,
          adherencePercentage: null,
          hasEnoughData: false,
          summaryText: 'Not enough adherence data',
        };
      }
    } else if (Array.isArray(cons.prescriptions) && cons.prescriptions.length > 0) {
      // Fallback: consultation has inline prescriptions without a separate Prescription doc
      prescriptionData = {
        prescriptionId: null,
        date: cons.completedAt || cons.createdAt,
        status: 'completed',
        medications: cons.prescriptions,
      };
      adherenceData = {
        totalScheduled: 0,
        totalTaken: 0,
        totalMissed: 0,
        totalPending: 0,
        adherencePercentage: null,
        hasEnoughData: false,
        summaryText: 'Not enough adherence data',
      };
    }

    const eventDate = cons.completedAt || cons.createdAt;

    timelineEvents.push({
      id: `cons_${cons._id}`,
      type: 'CONSULTATION',
      date: eventDate,
      consultationId: cons._id,
      appointmentId: cons.appointmentId?._id || cons.appointmentId || null,
      appointmentDetails: cons.appointmentId
        ? {
            appointmentDate: cons.appointmentId.appointmentDate,
            timeSlot: cons.appointmentId.timeSlot,
            reason: cons.appointmentId.reason || '',
          }
        : null,
      doctor: getDoctorDetails(cons.doctorId),
      diagnosis: cons.diagnosis || 'Clinical Consultation',
      clinicalNotes: cons.clinicalNotes || '',
      recommendations: cons.recommendations || [],
      followUpDate: cons.followUpDate || null,
      prescription: prescriptionData,
      adherence: adherenceData,
    });
  }

  // 6. Process standalone prescriptions that were NOT linked to any consultation
  for (const presc of prescriptions) {
    if (linkedPrescriptionIds.has(presc._id.toString())) {
      continue;
    }

    const pKey = presc._id.toString();
    const prescSchedules = schedulesByPrescriptionId[pKey] || [];
    let adherenceData = null;

    if (prescSchedules.length > 0) {
      adherenceData = calculateAdherenceForSchedules(prescSchedules);
    } else {
      adherenceData = {
        totalScheduled: 0,
        totalTaken: 0,
        totalMissed: 0,
        totalPending: 0,
        adherencePercentage: null,
        hasEnoughData: false,
        summaryText: 'Not enough adherence data',
      };
    }

    timelineEvents.push({
      id: `presc_${presc._id}`,
      type: 'PRESCRIPTION',
      date: presc.createdAt,
      consultationId: presc.consultationId || null,
      appointmentId: presc.appointmentId?._id || presc.appointmentId || null,
      appointmentDetails: presc.appointmentId
        ? {
            appointmentDate: presc.appointmentId.appointmentDate,
            timeSlot: presc.appointmentId.timeSlot,
            reason: presc.appointmentId.reason || '',
          }
        : null,
      doctor: getDoctorDetails(presc.doctorId),
      diagnosis: presc.diagnosis || '',
      clinicalNotes: presc.clinicalNotes || '',
      recommendations: [],
      followUpDate: null,
      prescription: {
        prescriptionId: presc._id,
        date: presc.createdAt,
        status: presc.status || 'active',
        medications: presc.medications || [],
      },
      adherence: adherenceData,
    });
  }

  // 7. Sort chronologically (newest event first)
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return timelineEvents;
};

module.exports = {
  getPatientTimeline,
  calculateAdherenceForSchedules,
};
