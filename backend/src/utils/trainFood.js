/**
 * Helper utility for Train Food / Catering Configuration and authoritative price calculation.
 * Food/Catering is available across all supported travel classes.
 */

const { isFoodEligibleClass, normalizeClassCode } = require('./cateringEligibilityHelper');

const ALL_CLASSES = ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', 'FC', '2S', 'EA', 'EV', 'VC'];

function parseAndValidateFoodConfig(reqBody = {}, isUpdate = false, existingTrain = null) {
  let food_available = reqBody.food_available;
  if (food_available === undefined && reqBody.foodAvailable !== undefined) {
    food_available = reqBody.foodAvailable;
  }

  if (isUpdate && food_available === undefined && existingTrain) {
    food_available = existingTrain.food_available !== undefined ? existingTrain.food_available : false;
  }

  if (typeof food_available === 'string') {
    const clean = food_available.trim().toLowerCase();
    food_available = (clean === 'yes' || clean === 'true');
  } else {
    food_available = Boolean(food_available);
  }

  let catering_payment_mode = reqBody.catering_payment_mode || reqBody.cateringPaymentMode || reqBody.payment_mode || (existingTrain ? existingTrain.catering_payment_mode : null);
  if (catering_payment_mode) {
    const cleanMode = String(catering_payment_mode).trim();
    if (cleanMode.toLowerCase().includes('included')) {
      catering_payment_mode = 'Included in Ticket';
    } else {
      catering_payment_mode = 'Paid Separately';
    }
  } else {
    catering_payment_mode = 'Paid Separately';
  }

  // Class catering dictionary for all supported classes
  let class_catering = {};
  ALL_CLASSES.forEach(cls => {
    class_catering[cls] = {
      food_available: food_available,
      payment_mode: catering_payment_mode,
      food_type: reqBody.food_type || 'Both',
      vegetarian_food_price: Number(reqBody.vegetarian_food_price || 150),
      non_vegetarian_food_price: Number(reqBody.non_vegetarian_food_price || 200)
    };
  });

  return {
    valid: true,
    config: {
      food_available,
      catering_payment_mode,
      food_type: reqBody.food_type || 'Both',
      vegetarian_food_price: Number(reqBody.vegetarian_food_price || 150),
      non_vegetarian_food_price: Number(reqBody.non_vegetarian_food_price || 200),
      class_catering
    }
  };
}

/**
 * Resolves effective train food configuration for a specific travel class on a train.
 */
function getClassFoodConfig(train, classCode) {
  if (!train || !classCode) {
    return {
      food_available: false,
      payment_mode: 'Paid Separately',
      food_type: null,
      vegetarian_food_price: 0,
      non_vegetarian_food_price: 0
    };
  }

  const normalized = normalizeClassCode(classCode);

  if (train.class_catering && train.class_catering[normalized]) {
    const cfg = train.class_catering[normalized];
    return {
      food_available: cfg.food_available !== false,
      payment_mode: cfg.payment_mode || train.catering_payment_mode || 'Included in Ticket',
      food_type: cfg.food_type || train.food_type || 'Both',
      vegetarian_food_price: Number(cfg.vegetarian_food_price || train.vegetarian_food_price || 150),
      non_vegetarian_food_price: Number(cfg.non_vegetarian_food_price || train.non_vegetarian_food_price || 200)
    };
  }

  let topPaymentMode = train.catering_payment_mode || 'Included in Ticket';
  let isFoodAvailable = train.food_available !== undefined ? Boolean(train.food_available) : true;

  return {
    food_available: isFoodAvailable,
    payment_mode: topPaymentMode,
    food_type: train.food_type || 'Both',
    vegetarian_food_price: Number(train.vegetarian_food_price || 150),
    non_vegetarian_food_price: Number(train.non_vegetarian_food_price || 200)
  };
}

/**
 * Calculates authoritative train food price per passenger based on DB train & class configuration.
 */
function calculatePassengerFoodPrice(train, requestedSelection, classCode = null) {
  const cleanSel = String(requestedSelection || 'No Train Food').trim();
  const isNoFoodSelected = !cleanSel || ['No Food', 'None', 'No Train Food', 'false', '0'].includes(cleanSel);

  if (isNoFoodSelected) {
    return { 
      food_selection: 'No Train Food', 
      food_price: 0,
      payment_mode: 'Paid Separately',
      included_in_ticket: false
    };
  }

  const classConfig = getClassFoodConfig(train, classCode);

  if (!classConfig.food_available) {
    return { 
      food_selection: 'No Train Food', 
      food_price: 0,
      payment_mode: classConfig.payment_mode,
      included_in_ticket: false
    };
  }

  const isVegRequested = cleanSel.toLowerCase().includes('veg') && !cleanSel.toLowerCase().includes('non');
  const isNonVegRequested = cleanSel.toLowerCase().includes('non');
  const trainFoodType = classConfig.food_type || 'Both';
  const isIncludedInTicket = classConfig.payment_mode === 'Included in Ticket';

  if (isVegRequested) {
    if (trainFoodType === 'Non-Vegetarian') {
      throw new Error('Vegetarian meal is not available on this train/class.');
    }
    const price = Number(classConfig.vegetarian_food_price || 0);
    return { 
      food_selection: 'Vegetarian', 
      food_price: price,
      payment_mode: classConfig.payment_mode,
      included_in_ticket: isIncludedInTicket
    };
  }

  if (isNonVegRequested) {
    if (trainFoodType === 'Vegetarian') {
      throw new Error('Non-Vegetarian meal is not available on this train/class.');
    }
    const price = Number(classConfig.non_vegetarian_food_price || 0);
    return { 
      food_selection: 'Non-Vegetarian', 
      food_price: price,
      payment_mode: classConfig.payment_mode,
      included_in_ticket: isIncludedInTicket
    };
  }

  throw new Error(`Unsupported food selection: ${requestedSelection}`);
}

module.exports = {
  parseAndValidateFoodConfig,
  getClassFoodConfig,
  calculatePassengerFoodPrice,
  isFoodEligibleClass,
  normalizeClassCode
};
