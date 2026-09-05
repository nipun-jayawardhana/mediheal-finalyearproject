/**
 * Legacy OpenBioLLM Service Wrapper
 * STEP 37A: Primary model replaced with Med42-8B (m42-health/Llama3-Med42-8B).
 * This module re-exports from med42Service.js for backward-compatibility.
 */

const med42Service = require('./med42Service');

module.exports = {
  analyzeSymptomsWithMed42: med42Service.analyzeSymptomsWithMed42,
  analyzeSymptomsWithOpenBioLLM: med42Service.analyzeSymptomsWithMed42,
  normalizeSpecialist: med42Service.normalizeSpecialist,
  MODEL_NAME: med42Service.MODEL_NAME,
};
